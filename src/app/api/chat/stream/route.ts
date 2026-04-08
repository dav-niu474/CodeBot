import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatCompletionStream,
  getDefaultModel,
  getModelInfo,
  type ChatMessage,
  type ToolDefinition as NvidiaToolDef,
} from "@/lib/nvidia";
import { getCoreToolSchemas, getToolMeta } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/executor";
import type { ToolExecutionResult, ToolExecutionContext } from "@/lib/tools/types";
import { checkToolPermission } from "@/lib/tools/permissions";
import { compressMessages, needsCompression, DEFAULT_COMPRESSION_CONFIG } from "@/lib/compression";
import { buildFullMemoryContext, processConversationForMemory } from "@/lib/memory/memory-manager";
import { isPlanMode } from "@/lib/plan/plan-state";
import { buildSkillSystemPrompt, getAllowedTools, discoverSkillsForPath } from "@/lib/skills/dynamic-loader";

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const MAX_TOOL_LOOPS = 10;
const MAX_OUTPUT_CHARS = 8000; // Truncate tool outputs to prevent context overflow
const MEMORY_CONTEXT_MIN_MESSAGES = 5; // Only build memory context for sessions with ≥ 5 messages

/** Tool names that are blocked in plan mode (write/mutating operations) */
const PLAN_MODE_BLOCKED_TOOLS = new Set([
  'file-write',
  'file-edit',
  'bash',
  'notebook-edit',
  'send-message',
]);

const SYSTEM_PROMPT = `You are CodeBot, an AI coding assistant inspired by Claude Code. You have access to tools for file operations, shell execution, and web search. Use them when needed to complete tasks.

Rules:
- Always respond in the same language the user uses
- For complex tasks, use tools step by step
- Be accurate, concise, and provide actionable results`;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface ParsedToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ToolExecutionRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: ToolExecutionResult;
  duration: number;
}

interface AgenticStepResult {
  finishReason: string;
  content: string;
  toolCalls: ParsedToolCall[] | null;
  toolExecutions: ToolExecutionRecord[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

// ────────────────────────────────────────────
// Core: Execute tools from a tool_calls response
// ────────────────────────────────────────────

async function executeToolsFromCalls(
  toolCalls: ParsedToolCall[],
  sessionId: string,
  sendEvent: (event: Record<string, unknown>) => void,
): Promise<ToolExecutionRecord[]> {
  const executions: ToolExecutionRecord[] = [];
  const planModeActive = isPlanMode(sessionId);

  for (const tc of toolCalls) {
    const meta = getToolMeta(tc.name);
    const riskLevel = meta?.riskLevel || "medium";

    // ── Plan mode enforcement: block write tools ──
    if (planModeActive && PLAN_MODE_BLOCKED_TOOLS.has(tc.name)) {
      const blockedResult: ToolExecutionResult = {
        output: `Plan mode is active. This operation (${tc.name}) is not allowed in plan mode. Use exit-plan-mode to return to normal execution.`,
        isError: true,
        metadata: { blockedByPlanMode: true, toolName: tc.name },
      };

      // Notify client about the blocked tool call
      sendEvent({
        type: "tool_call_start",
        toolCallId: tc.id,
        toolName: tc.name,
        arguments: tc.arguments,
        riskLevel,
        planModeBlocked: true,
      });

      sendEvent({
        type: "tool_call_result",
        toolCallId: tc.id,
        toolName: tc.name,
        result: blockedResult.output,
        status: "blocked",
        duration: 0,
      });

      executions.push({
        id: tc.id,
        name: tc.name,
        args: {},
        result: blockedResult,
        duration: 0,
      });

      continue; // Skip execution, move to next tool call
    }

    // Parse arguments
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(tc.arguments);
    } catch {
      args = {};
    }

    // ── Permission check ──
    const permResult = checkToolPermission(tc.name, args);
    if (permResult.permission === 'deny') {
      const deniedResult: ToolExecutionResult = {
        output: `Tool ${tc.name} is not allowed: ${permResult.reason}`,
        isError: true,
        metadata: { permissionDenied: true },
      };

      sendEvent({
        type: "tool_call_start",
        toolCallId: tc.id,
        toolName: tc.name,
        arguments: tc.arguments,
        riskLevel,
        permissionDenied: true,
      });

      sendEvent({
        type: "tool_call_result",
        toolCallId: tc.id,
        toolName: tc.name,
        result: deniedResult.output,
        status: "denied",
        duration: 0,
      });

      executions.push({
        id: tc.id,
        name: tc.name,
        args,
        result: deniedResult,
        duration: 0,
      });

      continue;
    }

    // Note: 'ask' permission is handled client-side in a future iteration.
    // For now, we auto-allow most tools and only log dangerous patterns.

    // Notify client about tool call start
    sendEvent({
      type: "tool_call_start",
      toolCallId: tc.id,
      toolName: tc.name,
      arguments: tc.arguments,
      riskLevel,
    });

    // Execute the tool
    const startTime = Date.now();
    const context: ToolExecutionContext = {
      sessionId,
      onProgress: (eventName, data) => {
        sendEvent({
          type: "tool_call_progress",
          toolCallId: tc.id,
          toolName: tc.name,
          event: eventName,
          ...data,
        });
      },
    };

    const result = await executeTool(tc.name, args, context);
    const duration = Date.now() - startTime;

    executions.push({
      id: tc.id,
      name: tc.name,
      args,
      result,
      duration,
    });

    // ── Skill discovery: trigger after successful file-read, glob, grep ──
    if (
      (tc.name === 'file-read' || tc.name === 'glob' || tc.name === 'grep') &&
      !result.isError
    ) {
      const filePath = args.path as string || args.pattern as string || '';
      if (filePath) {
        discoverSkillsForPath(sessionId, filePath);
      }
    }

    // Truncate large outputs
    const displayResult =
      result.output.length > MAX_OUTPUT_CHARS
        ? result.output.substring(0, MAX_OUTPUT_CHARS) +
          `\n... [truncated, ${result.output.length} total chars]`
        : result.output;

    // Notify client about tool result
    sendEvent({
      type: "tool_call_result",
      toolCallId: tc.id,
      toolName: tc.name,
      result: displayResult,
      status: result.isError ? "error" : "success",
      duration,
    });
  }

  return executions;
}

// ────────────────────────────────────────────
// Core: Run one agentic loop step (streaming)
// ────────────────────────────────────────────

async function runAgenticStepStream(
  messages: ChatMessage[],
  tools: NvidiaToolDef[],
  model: string,
  temperature: number,
  maxTokens: number,
  sessionId: string,
  sendEvent: (event: Record<string, unknown>) => void,
): Promise<AgenticStepResult> {
  const stream = await chatCompletionStream({
    model,
    messages,
    temperature,
    maxTokens,
    tools,
  });

  let content = '';
  const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
  let finishReason = '';

  for await (const delta of stream) {
    const choice = delta.choices?.[0];
    if (!choice) continue;

    // Stream content immediately to client
    if (choice.delta?.content) {
      content += choice.delta.content;
      sendEvent({ type: 'content_delta', content: choice.delta.content });
    }

    // Accumulate tool calls (they come in chunks)
    if (choice.delta?.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        const existing = toolCallsMap.get(tc.index) || { id: '', name: '', arguments: '' };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
        toolCallsMap.set(tc.index, existing);
      }
    }

    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }

  // Parse accumulated tool calls
  const toolCalls: ParsedToolCall[] | null = toolCallsMap.size > 0
    ? Array.from(toolCallsMap.values()).map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      }))
    : null;

  // Execute tools if present
  let toolExecutions: ToolExecutionRecord[] = [];
  if (toolCalls && toolCalls.length > 0) {
    toolExecutions = await executeToolsFromCalls(toolCalls, sessionId, sendEvent);
  }

  return {
    finishReason,
    content,
    toolCalls,
    toolExecutions,
    usage: null, // Streaming doesn't return usage in all chunks; we estimate
  };
}

// ────────────────────────────────────────────
// POST Handler — Main agentic streaming endpoint
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      message,
      model,
      temperature,
      maxTokens,
      thinkingEnabled,
    } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Load agent config
    const agentConfig = await db.agentConfig.findFirst();

    const effectiveModel = model || agentConfig?.activeModel || getDefaultModel();
    const effectiveTemperature = temperature ?? agentConfig?.temperature ?? 0.7;
    const effectiveMaxTokens = maxTokens ?? agentConfig?.maxTokens ?? 8192;
    const modelInfo = getModelInfo(effectiveModel);

    // Save user message
    const userTokens = estimateTokens(message);
    await db.message.create({
      data: {
        sessionId,
        role: "user",
        content: message,
        tokens: userTokens,
      },
    });

    // Load conversation history (most recent 30 messages)
    const totalCount = await db.message.count({ where: { sessionId } });
    const skipCount = Math.max(0, totalCount - 30);
    const history = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      skip: skipCount,
      take: 30,
    });

    // Build memory context — skip for sessions with < 5 messages
    let memoryContext = '';
    if (totalCount > MEMORY_CONTEXT_MIN_MESSAGES) {
      memoryContext = await buildFullMemoryContext(sessionId) || '';
    }
    const enhancedSystemPrompt = SYSTEM_PROMPT + (memoryContext ? '\n\n' + memoryContext : '');

    // Build messages array for NVIDIA API
    let chatMessages: ChatMessage[] = [
      { role: "system", content: enhancedSystemPrompt },
      ...history.map((msg) => ({
        role: (msg.role as "user" | "assistant" | "system" | "tool") || "user",
        content: msg.content,
      })),
    ];

    // ── Pre-loop compression check ─────────────
    const conversationMessages = chatMessages.filter(m => m.role !== 'system');
    if (needsCompression(conversationMessages, DEFAULT_COMPRESSION_CONFIG)) {
      // This runs BEFORE the SSE stream is set up, so we can't send SSE events here.
      // The compression will be logged server-side only.
      const systemMessages = chatMessages.filter(m => m.role === 'system');
      const result = await compressMessages(conversationMessages, DEFAULT_COMPRESSION_CONFIG);
      chatMessages = [
        ...systemMessages,
        ...result.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
        })),
      ];
      console.log(`[compression] Pre-loop compressed ${result.compressedCount} messages, ratio: ${(result.ratio * 100).toFixed(0)}%`);
    }

    // ── Set up SSE stream ───────────────────────────────
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    function sendSSE(data: Record<string, unknown>) {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }

    // ── Run the agentic loop asynchronously ────────────
    (async () => {
      try {
        // Load core tools and apply skill-based filtering
        let tools = getCoreToolSchemas();
        const skillPrompt = buildSkillSystemPrompt(sessionId);
        if (skillPrompt) {
          // Inject skill prompts into system message
          chatMessages[0] = { role: "system", content: chatMessages[0].content + '\n\n' + skillPrompt };
        }

        const skillAllowedTools = getAllowedTools(sessionId);
        if (skillAllowedTools) {
          tools = tools.filter(t => skillAllowedTools.includes(t.function.name));
        }

        const currentPlanMode = isPlanMode(sessionId);

        // Send metadata
        sendSSE({
          type: "meta",
          model: effectiveModel,
          modelName: modelInfo?.name || effectiveModel,
          provider: modelInfo?.provider || "NVIDIA",
          v3: true, // Flag to indicate V3 protocol
          toolCount: tools.length,
          maxIterations: MAX_TOOL_LOOPS,
          plan_mode: currentPlanMode,
        });

        const allToolResults: Array<{
          name: string;
          result: string;
          isError: boolean;
          duration: number;
        }> = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let finalContent = "";
        let loopCount = 0;

        while (loopCount < MAX_TOOL_LOOPS) {
          loopCount++;

          // ── Send loop iteration event ──
          sendSSE({
            type: "loop_iteration",
            iteration: loopCount,
            maxIterations: MAX_TOOL_LOOPS,
            phase: loopCount === 1 ? "thinking" : "executing",
          });

          // ── Run agentic step with responsive compression fallback ──
          let step;
          try {
            step = await runAgenticStepStream(
              chatMessages,
              tools,
              effectiveModel,
              effectiveTemperature,
              effectiveMaxTokens,
              sessionId,
              sendSSE,
            );
          } catch (stepErr) {
            const errMsg = stepErr instanceof Error ? stepErr.message : String(stepErr);
            if (errMsg.includes('prompt') && (errMsg.includes('too long') || errMsg.includes('maximum'))) {
              console.log('[compression] Responsive compression triggered by prompt-too-long error');
              sendSSE({
                type: "status",
                phase: "compressing",
                detail: "Conversation context too long, compressing...",
              });
              const compResult = await compressMessages(
                chatMessages.filter(m => m.role !== 'system'),
                DEFAULT_COMPRESSION_CONFIG,
                { force: 'responsive' }
              );
              chatMessages = [
                chatMessages[0], // keep enhanced system prompt
                ...compResult.messages.map(m => ({
                  role: m.role as 'user' | 'assistant' | 'system' | 'tool',
                  content: m.content,
                })),
              ];
              console.log(`[compression] Responsive compressed ${compResult.compressedCount} messages, ratio: ${(compResult.ratio * 100).toFixed(0)}%`);
              sendSSE({
                type: "status",
                phase: "ready",
                detail: "Context compressed, continuing...",
              });
              step = await runAgenticStepStream(
                chatMessages,
                tools,
                effectiveModel,
                effectiveTemperature,
                effectiveMaxTokens,
                sessionId,
                sendSSE,
              );
            } else {
              throw stepErr;
            }
          }

          // Track usage (streaming may not return usage; estimate from content)
          if (step.usage) {
            totalPromptTokens += step.usage.prompt_tokens;
            totalCompletionTokens += step.usage.completion_tokens;
          } else if (step.content) {
            // Estimate tokens when streaming doesn't provide usage
            totalCompletionTokens += estimateTokens(step.content);
          }

          // If no tool calls, this is the final response
          if (!step.toolCalls || step.toolCalls.length === 0) {
            finalContent = step.content;
            break;
          }

          // Tool calls were made — add assistant message to conversation
          chatMessages.push({
            role: "assistant",
            content: step.content || "",
          });

          // Add tool results to conversation and tracking
          for (const exec of step.toolExecutions) {
            allToolResults.push({
              name: exec.name,
              result: exec.result.output.substring(0, 5000),
              isError: !!exec.result.isError,
              duration: exec.duration,
            });

            chatMessages.push({
              role: "tool",
              content: exec.result.isError
                ? `Error: ${exec.result.output}`
                : exec.result.output,
            });
          }

          // Log progress
          console.log(
            `[agentic] Loop ${loopCount}: ${step.toolCalls.length} tool call(s), continuing...`
          );
        }

        // ── Extract memories from conversation (fire-and-forget) ──
        try {
          const memoryResult = await processConversationForMemory(sessionId, chatMessages);
          if (memoryResult.sessionMemories > 0 || memoryResult.memdirEntries > 0) {
            console.log(`[memory] Extracted ${memoryResult.sessionMemories} session memories, ${memoryResult.memdirEntries} memdir entries`);
          }
        } catch (memErr) {
          console.error('[memory] Failed to extract memories:', memErr);
        }

        // ── Handle max loop reached ──
        if (!finalContent && loopCount >= MAX_TOOL_LOOPS) {
          sendSSE({
            content:
              "I've reached the maximum number of tool execution steps. Let me summarize what I've done so far.",
          });
        }

        // ── Send done signal ───────────────────────────
        sendSSE({
          done: true,
          tokens: totalPromptTokens + totalCompletionTokens,
          loopIterations: loopCount,
          toolResults: allToolResults.length,
        });

        // ── Persist to DB ──────────────────────────────
        if (finalContent.trim()) {
          const assistantTokens =
            totalCompletionTokens || estimateTokens(finalContent);
          const promptTokens = totalPromptTokens || userTokens;

          await db.message.create({
            data: {
              sessionId,
              role: "assistant",
              content: finalContent,
              tokens: assistantTokens,
              toolCalls:
                allToolResults.length > 0
                  ? JSON.stringify(allToolResults)
                  : null,
            },
          });

          await db.session.update({
            where: { id: sessionId },
            data: {
              tokenCount: session.tokenCount + promptTokens + assistantTokens,
              updatedAt: new Date(),
            },
          });

          try {
            await db.tokenUsage.create({
              data: {
                sessionId,
                modelId: effectiveModel,
                inputTokens: promptTokens,
                outputTokens: assistantTokens,
              },
            });
          } catch {
            // ignore
          }

          console.log(
            `[stream] V3 agentic loop: ${loopCount} iterations, ${allToolResults.length} tool calls, ${assistantTokens} tokens — session ${sessionId}`
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[stream] V3 agentic loop error:", err);
        sendSSE({ error: errorMsg });
      } finally {
        writer.close();
      }
    })();

    // Return the streaming response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/chat/stream] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to process chat message", details: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatCompletion,
  getDefaultModel,
  getModelInfo,
  type ChatMessage,
  type ToolDefinition as NvidiaToolDef,
} from "@/lib/nvidia";
import { getCoreToolSchemas, getToolMeta } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/executor";
import type { ToolExecutionResult, ToolExecutionContext } from "@/lib/tools/types";

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const MAX_TOOL_LOOPS = 10;
const MAX_OUTPUT_CHARS = 8000; // Truncate tool outputs to prevent context overflow

const SYSTEM_PROMPT = `You are CodeBot, a powerful AI coding assistant with tool execution capabilities. You can:

- **Execute bash commands** to run code, install packages, manage git, etc.
- **Read, write, and edit files** on the filesystem
- **Search files** using glob patterns and regex grep
- **Search the web** for up-to-date information
- **Fetch web pages** to extract content
- **Manage todo lists** for tracking complex tasks

When the user asks you to do something that requires tools, USE them. For example:
- "Show me the files in src/" → use glob with pattern "src/**/*"
- "What does package.json say?" → use file-read
- "Search for TODO comments" → use grep with pattern "TODO"
- "Create a hello.ts file" → use file-write
- "Fix the bug in line 42" → use file-edit
- "Run the test suite" → use bash with command "npm test"

Always respond in the same language the user uses. Be helpful, concise, and accurate.`;

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

  for (const tc of toolCalls) {
    const meta = getToolMeta(tc.name);
    const riskLevel = meta?.riskLevel || "medium";

    // Parse arguments
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(tc.arguments);
    } catch {
      args = {};
    }

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
// Core: Run one agentic loop step
// ────────────────────────────────────────────

async function runAgenticStep(
  messages: ChatMessage[],
  tools: NvidiaToolDef[],
  model: string,
  temperature: number,
  maxTokens: number,
  sessionId: string,
  sendEvent: (event: Record<string, unknown>) => void,
): Promise<AgenticStepResult> {
  const response = await chatCompletion({
    model,
    messages,
    temperature,
    maxTokens,
    tools,
  });

  const choice = response.choices[0];
  const finishReason = choice.finish_reason || "";
  const content = choice.message.content || "";
  const usage = response.usage || null;

  // Parse tool calls if present
  const toolCalls: ParsedToolCall[] | null =
    choice.message.tool_calls && choice.message.tool_calls.length > 0
      ? choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }))
      : null;

  // Execute tools if present
  let toolExecutions: ToolExecutionRecord[] = [];
  if (toolCalls && toolCalls.length > 0) {
    toolExecutions = await executeToolsFromCalls(
      toolCalls,
      sessionId,
      sendEvent,
    );
  }

  return {
    finishReason,
    content,
    toolCalls,
    toolExecutions,
    usage,
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

    // Load conversation history
    const history = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    // Build messages array for NVIDIA API
    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: (msg.role as "user" | "assistant" | "system" | "tool") || "user",
        content: msg.content,
      })),
    ];

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
        // Send metadata
        sendSSE({
          type: "meta",
          model: effectiveModel,
          modelName: modelInfo?.name || effectiveModel,
          provider: modelInfo?.provider || "NVIDIA",
          v3: true, // Flag to indicate V3 protocol
        });

        const tools = getCoreToolSchemas();
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

          const step = await runAgenticStep(
            chatMessages,
            tools,
            effectiveModel,
            effectiveTemperature,
            effectiveMaxTokens,
            sessionId,
            sendSSE,
          );

          // Track usage
          if (step.usage) {
            totalPromptTokens += step.usage.prompt_tokens;
            totalCompletionTokens += step.usage.completion_tokens;
          }

          // If no tool calls, this is the final response
          if (!step.toolCalls || step.toolCalls.length === 0) {
            finalContent = step.content;
            break;
          }

          // Tool calls were made — add assistant message to conversation
          chatMessages.push({
            role: "assistant",
            content: step.content || null,
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

        // ── Stream final content to client ─────────────
        if (finalContent) {
          // Stream in chunks for visual effect
          const chunkSize = 16;
          for (let i = 0; i < finalContent.length; i += chunkSize) {
            const chunk = finalContent.substring(i, i + chunkSize);
            sendSSE({ content: chunk });
            await new Promise((r) => setTimeout(r, 3));
          }
        } else if (loopCount >= MAX_TOOL_LOOPS) {
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

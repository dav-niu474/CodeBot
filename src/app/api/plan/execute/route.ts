// ============================================================
// Plan Execution API — SSE Streaming
// POST /api/plan/execute
//
// Executes a plan step-by-step using an agentic loop per step.
// Emits SSE events for real-time progress tracking.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getDefaultModel, type ChatMessage } from '@/lib/nvidia';
import { getCoreToolSchemas } from '@/lib/tools/definitions';
import { executeTool } from '@/lib/tools/executor';
import type { ToolExecutionResult, ToolExecutionContext } from '@/lib/tools/types';
import {
  setPlanState,
  updateStepStatus,
  setCurrentStepId,
} from '@/lib/plan/plan-state';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const MAX_TOOL_LOOPS_PER_STEP = 5;
const MAX_OUTPUT_CHARS = 8000;

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface PlanStepInput {
  id: number;
  title: string;
  description: string;
  dependencies: number[];
}

interface PlanInput {
  goal: string;
  steps: PlanStepInput[];
}

interface ExecuteRequestBody {
  sessionId: string;
  plan: PlanInput;
  model?: string;
}

// ────────────────────────────────────────────
// Topological Sort — resolve step execution order
// ────────────────────────────────────────────

/**
 * Topologically sort plan steps respecting dependencies.
 * Returns layers of steps that can be executed in parallel.
 * E.g. [[1, 2], [3], [4, 5]] means steps 1 & 2 first, then 3, then 4 & 5.
 */
function topologicalSortLayers(steps: PlanStepInput[]): number[][] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();

  for (const step of steps) {
    inDegree.set(step.id, step.dependencies.length);
    if (!dependents.has(step.id)) {
      dependents.set(step.id, []);
    }
    for (const dep of step.dependencies) {
      if (!dependents.has(dep)) {
        dependents.set(dep, []);
      }
      dependents.get(dep)!.push(step.id);
    }
  }

  const layers: number[][] = [];
  const completed = new Set<number>();

  // Kahn's algorithm — layer by layer
  while (completed.size < steps.length) {
    const layer: number[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0 && !completed.has(id)) {
        layer.push(id);
      }
    }

    if (layer.length === 0) {
      // Circular dependency detected — break by taking remaining steps
      console.warn('[plan-execute] Circular dependency detected, executing remaining steps sequentially');
      const remaining = steps.filter((s) => !completed.has(s.id)).map((s) => s.id);
      if (remaining.length > 0) {
        layers.push(remaining);
        break;
      }
      break;
    }

    layers.push(layer);

    for (const id of layer) {
      completed.add(id);
      for (const depId of dependents.get(id) || []) {
        inDegree.set(depId, (inDegree.get(depId) || 1) - 1);
      }
    }
  }

  return layers;
}

// ────────────────────────────────────────────
// Execute a single step via agentic loop
// ────────────────────────────────────────────

async function executeStep(
  step: PlanStepInput,
  goal: string,
  previousResults: Map<number, string>,
  model: string,
  sessionId: string,
  sendEvent: (event: Record<string, unknown>) => void,
): Promise<{ result: string; tokens: number }> {
  const stepId = step.id;
  let totalTokens = 0;

  // Build context from previous step results
  let contextStr = '';
  for (const [prevStepId, prevResult] of previousResults) {
    contextStr += `\n--- Previous Step ${prevStepId} Result ---\n${prevResult.substring(0, 2000)}\n`;
  }

  // Build system prompt for this step
  const systemPrompt = `You are executing a plan step-by-step. You have access to tools (bash, file operations, search, web, etc.).

**Overall Goal:** ${goal}

**Current Step (#${stepId}):** ${step.title}
**Description:** ${step.description}
${contextStr ? `\n**Results from previous steps:**${contextStr}` : ''}

Instructions:
- Execute this step specifically. Focus ONLY on what this step describes.
- Use the available tools to accomplish the task.
- Be concise in your responses.
- When done, provide a brief summary of what you accomplished for this step.
- Do NOT try to do work that belongs to other steps.`;

  // Build initial messages
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Execute step ${stepId}: ${step.title}\n\n${step.description}` },
  ];

  const tools = getCoreToolSchemas();
  let loopCount = 0;
  let finalContent = '';

  while (loopCount < MAX_TOOL_LOOPS_PER_STEP) {
    loopCount++;

    // Call LLM
    const response = await chatCompletion({
      model,
      messages,
      temperature: 0.3,
      maxTokens: 4096,
      tools,
    });

    const choice = response.choices[0];
    const usage = response.usage;
    if (usage) {
      totalTokens += usage.total_tokens;
    }

    const content = choice.message.content || '';
    const toolCalls = choice.message.tool_calls;

    // If no tool calls, this is the final answer for this step
    if (!toolCalls || toolCalls.length === 0) {
      finalContent = content;
      break;
    }

    // Add assistant message with tool calls
    messages.push({ role: 'assistant', content: content || '' });

    // Execute each tool call
    for (const tc of toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      // Notify progress
      sendEvent({
        type: 'plan_step_progress',
        stepId,
        detail: `Executing tool: ${tc.function.name}`,
      });

      const context: ToolExecutionContext = {
        sessionId,
        onProgress: (eventName, data) => {
          sendEvent({
            type: 'plan_step_progress',
            stepId,
            detail: `${tc.function.name}: ${eventName}`,
            ...data,
          });
        },
      };

      const startTime = Date.now();
      const result: ToolExecutionResult = await executeTool(tc.function.name, args, context);
      const duration = Date.now() - startTime;

      // Truncate large outputs
      const displayResult =
        result.output.length > MAX_OUTPUT_CHARS
          ? result.output.substring(0, MAX_OUTPUT_CHARS) +
            `\n... [truncated, ${result.output.length} total chars]`
          : result.output;

      // Send tool result as SSE event
      sendEvent({
        type: 'plan_step_progress',
        stepId,
        detail: `${tc.function.name} ${result.isError ? 'failed' : 'completed'} (${duration}ms)`,
        toolName: tc.function.name,
        toolResult: displayResult.substring(0, 1000),
        status: result.isError ? 'error' : 'success',
      });

      // Add tool result to conversation
      messages.push({
        role: 'tool',
        content: result.isError ? `Error: ${result.output}` : result.output,
      });
    }
  }

  const resultText = finalContent || `(Completed after ${loopCount} tool loop(s) with no final text)`;
  return { result: resultText, tokens: totalTokens };
}

// ────────────────────────────────────────────
// POST Handler — Plan Execution SSE Stream
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExecuteRequestBody;
    const { sessionId, plan: planInput, model } = body;

    if (!sessionId || !planInput?.goal || !planInput?.steps?.length) {
      return NextResponse.json(
        { error: 'sessionId and plan (with goal and steps) are required' },
        { status: 400 },
      );
    }

    // Validate steps
    for (const step of planInput.steps) {
      if (typeof step.id !== 'number' || !step.title || !step.description) {
        return NextResponse.json(
          { error: `Invalid step: each step must have id (number), title, and description` },
          { status: 400 },
        );
      }
    }

    const effectiveModel = model || getDefaultModel();

    // Store plan state
    const planData = {
      goal: planInput.goal,
      complexity: 'medium',
      steps: planInput.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: 'pending' as const,
        dependencies: s.dependencies || [],
      })),
    };
    setPlanState(sessionId, planData);

    // Compute execution order
    const layers = topologicalSortLayers(planInput.steps);

    // Set up SSE stream
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    function sendSSE(data: Record<string, unknown>) {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }

    // Run execution asynchronously
    (async () => {
      try {
        sendSSE({
          type: 'plan_meta',
          goal: planInput.goal,
          totalSteps: planInput.steps.length,
          layers: layers.length,
          model: effectiveModel,
        });

        const stepMap = new Map(planInput.steps.map((s) => [s.id, s]));
        const previousResults = new Map<number, string>();
        const allResults: Array<{ stepId: number; title: string; result: string; status: string }> = [];
        let totalTokens = 0;

        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
          const layer = layers[layerIdx];

          // Execute steps in this layer sequentially (safe execution order)
          // Note: Could be parallelized with Promise.all for true parallel execution,
          // but sequential is safer for file operations.
          for (const stepId of layer) {
            const step = stepMap.get(stepId);
            if (!step) continue;

            // Emit step start
            sendSSE({
              type: 'plan_step_start',
              stepId,
              title: step.title,
              description: step.description,
              layer: layerIdx + 1,
            });

            setCurrentStepId(sessionId, stepId);
            updateStepStatus(sessionId, stepId, 'in_progress');

            try {
              const { result, tokens } = await executeStep(
                step,
                planInput.goal,
                previousResults,
                effectiveModel,
                sessionId,
                sendSSE,
              );

              totalTokens += tokens;
              previousResults.set(stepId, result);
              updateStepStatus(sessionId, stepId, 'completed', result);

              allResults.push({
                stepId,
                title: step.title,
                result: result.substring(0, 1000),
                status: 'completed',
              });

              // Emit step complete
              sendSSE({
                type: 'plan_step_complete',
                stepId,
                title: step.title,
                result: result.substring(0, 1000),
                tokens,
              });
            } catch (stepError) {
              const errMsg = stepError instanceof Error ? stepError.message : String(stepError);
              updateStepStatus(sessionId, stepId, 'failed', errMsg);

              allResults.push({
                stepId,
                title: step.title,
                result: errMsg,
                status: 'failed',
              });

              // Emit step failed
              sendSSE({
                type: 'plan_step_failed',
                stepId,
                title: step.title,
                error: errMsg,
              });

              console.error(`[plan-execute] Step ${stepId} failed:`, stepError);
              // Continue with next steps even on failure
            }

            setCurrentStepId(sessionId, null);
          }
        }

        // Emit plan complete
        const completedCount = allResults.filter((r) => r.status === 'completed').length;
        const failedCount = allResults.filter((r) => r.status === 'failed').length;

        sendSSE({
          type: 'plan_complete',
          results: allResults,
          totalSteps: planInput.steps.length,
          completedSteps: completedCount,
          failedSteps: failedCount,
          totalTokens,
          summary: `Plan execution complete: ${completedCount}/${planInput.steps.length} steps succeeded${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });

        console.log(
          `[plan-execute] Plan complete: ${completedCount}/${planInput.steps.length} steps, ${totalTokens} tokens — session ${sessionId}`,
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[plan-execute] Error:', err);
        sendSSE({ type: 'plan_error', error: errorMsg });
      } finally {
        setCurrentStepId(sessionId, null);
        writer.close();
      }
    })();

    // Return the streaming response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    console.error('[/api/plan/execute] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to execute plan', details: message },
      { status: 500 },
    );
  }
}

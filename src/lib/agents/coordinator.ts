// ============================================================
// Coordinator Mode Engine (V4.0.0)
// Leader-Worker parallel execution with SSE streaming
// ============================================================

import { chatCompletion, type ChatMessage } from '@/lib/nvidia';
import { db } from '@/lib/db';
import { decomposeTask } from './task-decomposer';
import { aggregateResults } from './result-aggregator';
import type {
  AgentTask,
  MultiAgentEvent,
  MultiAgentStatus,
} from './protocol';
import { generateAgentId, estimateTokens } from './protocol';

interface CoordinatorParams {
  task: string;
  model: string;
  maxWorkers: number;
  sessionId: string;
  sendEvent: (event: Record<string, unknown>) => void;
}

interface CoordinatorResult {
  content: string;
  totalTokens: number;
}

/**
 * Run coordinator mode: decompose task → parallel workers → aggregate.
 * Streams SSE events throughout the process.
 */
export async function runCoordinatorMode(
  params: CoordinatorParams
): Promise<CoordinatorResult> {
  const { task, model, maxWorkers, sessionId, sendEvent } = params;
  const startTime = Date.now();
  let totalTokens = 0;

  // ── Step 1: Create leader agent session in DB ──
  const leader = await db.agentSession.create({
    data: {
      name: 'Coordinator Leader',
      role: 'leader',
      status: 'running',
      task,
      config: JSON.stringify({ mode: 'coordinator', model, numWorkers: maxWorkers }),
    },
  });

  const leaderSession = await db.session.create({
    data: {
      title: `Coordinator: ${task.slice(0, 50)}`,
      agentId: leader.id,
      mode: 'coordinator',
    },
  });

  // ── Step 2: Decompose the task ──
  sendEvent({
    type: 'agent_status',
    agentId: leader.id,
    agentName: 'Coordinator',
    status: 'thinking',
    task: 'Decomposing task into sub-tasks...',
    metadata: { phase: 'decomposing' },
  } as MultiAgentEvent);

  const { subTasks, tokensUsed: decompTokens } = await decomposeTask({
    task,
    model,
    maxWorkers,
  });
  totalTokens += decompTokens;

  // Save plan to DB
  await db.message.create({
    data: {
      sessionId: leaderSession.id,
      role: 'system',
      content: `[COORDINATOR MODE] Task: ${task}\nWorkers: ${subTasks.length}\n\nPlan:\n${subTasks.map((t, i) => `${i + 1}. ${t.description.slice(0, 100)}`).join('\n')}`,
      tokens: estimateTokens(task),
    },
  });

  sendEvent({
    type: 'agent_status',
    agentId: leader.id,
    agentName: 'Coordinator',
    status: 'done',
    task: `Decomposed into ${subTasks.length} sub-tasks`,
  } as MultiAgentEvent);

  // ── Step 3: Spawn workers in DB ──
  const workerAgents: Array<{ id: string; name: string; sessionId: string }> = [];
  for (let i = 0; i < subTasks.length; i++) {
    const subTask = subTasks[i];
    const meta = (subTask as Record<string, unknown>).metadata as { name?: string; approach?: string } | undefined;
    const workerName = meta?.name || `Worker ${i + 1}`;

    const worker = await db.agentSession.create({
      data: {
        name: workerName,
        role: 'worker',
        status: 'idle',
        task: subTask.description,
        parentId: leader.id,
        config: JSON.stringify({
          mode: 'teammate',
          model,
          approach: meta?.approach || '',
          taskIndex: i,
        }),
      },
    });

    const workerSession = await db.session.create({
      data: {
        title: `Worker ${i + 1}: ${workerName}`,
        agentId: worker.id,
        mode: 'teammate',
      },
    });

    workerAgents.push({ id: worker.id, name: workerName, sessionId: workerSession.id });

    // Assign sub-task
    subTask.assignedTo = worker.id;
    subTask.status = 'assigned';

    sendEvent({
      type: 'agent_spawned',
      agentId: worker.id,
      agentName: workerName,
      agentIndex: i,
      totalAgents: subTasks.length,
    } as MultiAgentEvent);
  }

  // ── Step 4: Execute workers in parallel (max 3 concurrent) ──
  const concurrencyLimit = Math.min(maxWorkers, 3);

  sendEvent({
    type: 'agent_status',
    agentId: leader.id,
    agentName: 'Coordinator',
    status: 'executing',
    task: `Executing ${subTasks.length} workers (concurrency: ${concurrencyLimit})...`,
  } as MultiAgentEvent);

  // Process workers in batches
  for (let batchStart = 0; batchStart < workerAgents.length; batchStart += concurrencyLimit) {
    const batch = workerAgents.slice(batchStart, batchStart + concurrencyLimit);
    const batchTasks = subTasks.slice(batchStart, batchStart + concurrencyLimit);

    const results = await Promise.allSettled(
      batch.map(async (worker, idx) => {
        const subTask = batchTasks[idx];

        // Update status to running
        await db.agentSession.update({
          where: { id: worker.id },
          data: { status: 'running' },
        });

        sendEvent({
          type: 'task_assigned',
          agentId: worker.id,
          agentName: worker.name,
          agentIndex: batchStart + idx,
          task: subTask.description,
          totalAgents: subTasks.length,
        } as MultiAgentEvent);

        // Execute the worker task via LLM
        const meta = (subTask as Record<string, unknown>).metadata as { approach?: string } | undefined;
        const workerPrompt = `You are a focused worker agent. Execute the following task precisely.

Task: ${subTask.description}
Approach: ${meta?.approach || 'Use your best judgment'}

Provide a clear, concise result. Include any relevant code, data, or findings.`;

        const workerResponse = await chatCompletion({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a focused worker agent. Execute tasks precisely and report results concisely.',
            },
            { role: 'user', content: workerPrompt },
          ],
          temperature: 0.4,
          maxTokens: 4096,
        });

        const resultContent = workerResponse.choices[0]?.message?.content || 'No result produced.';
        const inputT = workerResponse.usage?.prompt_tokens || estimateTokens(workerPrompt);
        const outputT = workerResponse.usage?.completion_tokens || estimateTokens(resultContent);

        // Save worker messages to DB
        await db.message.create({
          data: { sessionId: worker.sessionId, role: 'user', content: workerPrompt, tokens: inputT },
        });
        await db.message.create({
          data: { sessionId: worker.sessionId, role: 'assistant', content: resultContent, tokens: outputT },
        });

        // Update agent status
        await db.agentSession.update({
          where: { id: worker.id },
          data: { status: 'completed', result: resultContent },
        });

        // Update sub-task
        subTask.status = 'completed';
        subTask.result = resultContent;
        subTask.tokens = { input: inputT, output: outputT };

        return {
          task: subTask,
          agentName: worker.name,
          content: resultContent,
          tokens: { input: inputT, output: outputT },
        };
      })
    );

    // Process results and emit events
    for (let idx = 0; idx < results.length; idx++) {
      const settled = results[idx];
      const worker = batch[idx];
      const subTask = batchTasks[idx];

      if (settled.status === 'fulfilled') {
        totalTokens += settled.value.tokens.input + settled.value.tokens.output;

        sendEvent({
          type: 'agent_result',
          agentId: worker.id,
          agentName: worker.name,
          status: 'done',
          result: settled.value.content.slice(0, 300) + (settled.value.content.length > 300 ? '...' : ''),
          tokens: settled.value.tokens,
          completedAgents: subTasks.filter((t) => t.status === 'completed').length,
          totalAgents: subTasks.length,
        } as MultiAgentEvent);
      } else {
        const errorMsg = settled.reason instanceof Error ? settled.reason.message : 'Unknown error';
        subTask.status = 'failed';
        subTask.error = errorMsg;

        await db.agentSession.update({
          where: { id: worker.id },
          data: { status: 'failed', result: errorMsg },
        });

        sendEvent({
          type: 'agent_result',
          agentId: worker.id,
          agentName: worker.name,
          status: 'failed',
          error: errorMsg,
          completedAgents: subTasks.filter((t) => t.status === 'completed' || t.status === 'failed').length,
          totalAgents: subTasks.length,
        } as MultiAgentEvent);
      }
    }
  }

  // ── Step 5: Aggregate results ──
  const completedTasks = subTasks.filter((t) => t.status === 'completed' && t.result);
  const workerResults = workerAgents
    .map((w, i) => ({
      task: subTasks[i],
      agentName: w.name,
      content: subTasks[i].result || '',
    }))
    .filter((r) => r.content);

  sendEvent({
    type: 'aggregation_start',
    agentId: leader.id,
    agentName: 'Coordinator',
    completedAgents: completedTasks.length,
    totalAgents: subTasks.length,
  } as MultiAgentEvent);

  const { content: finalContent, tokensUsed: aggTokens } = await aggregateResults({
    originalTask: task,
    results: workerResults,
    model,
  });
  totalTokens += aggTokens;

  // Save synthesis to DB
  await db.message.create({
    data: {
      sessionId: leaderSession.id,
      role: 'assistant',
      content: `[SYNTHESIS]\n${finalContent}`,
      tokens: estimateTokens(finalContent),
    },
  });

  // Update leader status
  await db.agentSession.update({
    where: { id: leader.id },
    data: { status: 'completed', result: finalContent },
  });

  await db.session.update({
    where: { id: leaderSession.id },
    data: { updatedAt: new Date() },
  });

  const duration = Date.now() - startTime;

  sendEvent({
    type: 'aggregation_complete',
    finalContent,
    totalTokens,
    duration,
    totalAgents: subTasks.length + 1, // +1 for leader
  } as MultiAgentEvent);

  return { content: finalContent, totalTokens };
}

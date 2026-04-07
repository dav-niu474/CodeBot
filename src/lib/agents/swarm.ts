// ============================================================
// Swarm Mode Engine (V4.0.0)
// Peer-to-peer parallel agent execution with in-memory message bus
// ============================================================

import { chatCompletion, type ChatMessage } from '@/lib/nvidia';
import { db } from '@/lib/db';
import { aggregateResults } from './result-aggregator';
import {
  type MultiAgentEvent,
  type AgentMessageBus,
  estimateTokens,
  generateAgentId,
} from './protocol';
import { AgentMessageBus as MessageBusClass } from './protocol';

interface SwarmParams {
  task: string;
  model: string;
  agentCount: number;
  sessionId: string;
  sendEvent: (event: Record<string, unknown>) => void;
}

interface SwarmResult {
  content: string;
  totalTokens: number;
  confidence: number;
}

/** Focus angles for swarm diversity */
const SWARM_ANGLES = [
  'Focus on correctness and edge cases. Be thorough and precise.',
  'Focus on simplicity and readability. Prefer clean, maintainable solutions.',
  'Focus on performance and optimization. Consider time/space complexity.',
  'Focus on best practices and design patterns. Apply industry standards.',
  'Focus on error handling and robustness. Consider failure scenarios.',
  'Focus on testability and maintainability. Write testable code.',
  'Focus on scalability and extensibility. Design for growth.',
  'Focus on user experience and documentation. Make it developer-friendly.',
];

/**
 * Run swarm mode: spawn peer agents → parallel execution → consensus.
 * Each agent gets a different focus angle for diversity.
 */
export async function runSwarmMode(
  params: SwarmParams
): Promise<SwarmResult> {
  const { task, model, agentCount, sessionId, sendEvent } = params;
  const startTime = Date.now();
  let totalTokens = 0;

  // Create in-memory message bus for peer communication
  const messageBus: AgentMessageBus = new MessageBusClass();

  // ── Step 1: Create swarm agents in DB ──
  const swarmAgents: Array<{ id: string; name: string; sessionId: string; angle: string }> = [];

  for (let i = 0; i < agentCount; i++) {
    const agentName = `Swarm Agent ${i + 1}`;
    const angle = SWARM_ANGLES[i % SWARM_ANGLES.length];

    const agent = await db.agentSession.create({
      data: {
        name: agentName,
        role: 'worker',
        status: 'idle',
        task,
        config: JSON.stringify({
          mode: 'swarm',
          model,
          swarmIndex: i,
          totalAgents: agentCount,
          angle,
        }),
      },
    });

    const agentSession = await db.session.create({
      data: {
        title: `Swarm ${i + 1}: ${task.slice(0, 30)}`,
        agentId: agent.id,
        mode: 'swarm',
      },
    });

    swarmAgents.push({ id: agent.id, name: agentName, sessionId: agentSession.id, angle });

    sendEvent({
      type: 'agent_spawned',
      agentId: agent.id,
      agentName,
      agentIndex: i,
      totalAgents: agentCount,
    } as MultiAgentEvent);
  }

  // ── Step 2: Execute all agents in parallel ──
  const concurrencyLimit = Math.min(agentCount, 4);
  let completedCount = 0;

  for (let batchStart = 0; batchStart < swarmAgents.length; batchStart += concurrencyLimit) {
    const batch = swarmAgents.slice(batchStart, batchStart + concurrencyLimit);

    const results = await Promise.allSettled(
      batch.map(async (agent, idx) => {
        // Update status to running
        await db.agentSession.update({
          where: { id: agent.id },
          data: { status: 'running' },
        });

        sendEvent({
          type: 'task_assigned',
          agentId: agent.id,
          agentName: agent.name,
          agentIndex: batchStart + idx,
          task: agent.angle.slice(0, 80),
          totalAgents: agentCount,
        } as MultiAgentEvent);

        // Build prompt with angle and any messages from the bus
        const busMessages = messageBus.getBroadcasts();
        const contextFromPeers =
          busMessages.length > 0
            ? `\n\nShared discoveries from other agents:\n${busMessages.map((m) => `- [${m.fromAgentId}]: ${m.content.slice(0, 200)}`).join('\n')}`
            : '';

        const prompt = `You are swarm agent ${batchStart + idx + 1} of ${agentCount}. Independently solve the following task.

${agent.angle}
${contextFromPeers}

Task: ${task}

Provide your solution clearly and concisely. Include code if applicable.`;

        const response = await chatCompletion({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an independent swarm agent. Solve the task with your assigned focus area. Be concise and direct.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5 + (batchStart + idx) * 0.05, // Diversity via temperature
          maxTokens: 4096,
        });

        const resultContent = response.choices[0]?.message?.content || 'No result produced.';
        const inputT = response.usage?.prompt_tokens || estimateTokens(prompt);
        const outputT = response.usage?.completion_tokens || estimateTokens(resultContent);

        // Save messages to DB
        await db.message.create({
          data: { sessionId: agent.sessionId, role: 'user', content: prompt, tokens: inputT },
        });
        await db.message.create({
          data: { sessionId: agent.sessionId, role: 'assistant', content: resultContent, tokens: outputT },
        });

        // Update status
        await db.agentSession.update({
          where: { id: agent.id },
          data: { status: 'completed', result: resultContent },
        });

        // Share a brief discovery on the message bus
        const discovery = resultContent.slice(0, 300);
        messageBus.publish({
          id: generateAgentId(),
          fromAgentId: agent.name,
          toAgentId: 'all',
          type: 'status',
          content: discovery,
          timestamp: new Date().toISOString(),
        });

        return {
          agentId: agent.id,
          agentName: agent.name,
          angle: agent.angle,
          content: resultContent,
          tokens: { input: inputT, output: outputT },
        };
      })
    );

    // Process results
    for (const settled of results) {
      completedCount++;
      if (settled.status === 'fulfilled') {
        totalTokens += settled.value.tokens.input + settled.value.tokens.output;

        sendEvent({
          type: 'agent_result',
          agentId: settled.value.agentId,
          agentName: settled.value.agentName,
          status: 'done',
          result: settled.value.content.slice(0, 300) + (settled.value.content.length > 300 ? '...' : ''),
          tokens: settled.value.tokens,
          completedAgents: completedCount,
          totalAgents: agentCount,
        } as MultiAgentEvent);
      } else {
        const errorMsg = settled.reason instanceof Error ? settled.reason.message : 'Unknown error';

        sendEvent({
          type: 'agent_result',
          status: 'failed',
          error: errorMsg,
          completedAgents: completedCount,
          totalAgents: agentCount,
        } as MultiAgentEvent);
      }
    }
  }

  // ── Step 3: Consensus / Aggregation ──
  const successfulResults = swarmAgents
    .map((a, i) => results[i])
    .filter(
      (r): r is PromiseFulfilledResult<{ content: string; agentName: string; agentId: string; angle: string }> =>
        r.status === 'fulfilled'
    )
    .map((r) => ({
      task: { id: r.value.agentId, description: r.value.angle.slice(0, 100), status: 'completed' as const, tokens: { input: 0, output: 0 } },
      agentName: r.value.agentName,
      content: r.value.content,
    }));

  const confidence = successfulResults.length / agentCount;

  sendEvent({
    type: 'aggregation_start',
    completedAgents: successfulResults.length,
    totalAgents: agentCount,
  } as MultiAgentEvent);

  const { content: finalContent, tokensUsed: aggTokens } = await aggregateResults({
    originalTask: task,
    results: successfulResults,
    model,
  });
  totalTokens += aggTokens;

  const duration = Date.now() - startTime;

  sendEvent({
    type: 'aggregation_complete',
    finalContent,
    totalTokens,
    duration,
    totalAgents: agentCount,
    metadata: { confidence },
  } as MultiAgentEvent);

  return { content: finalContent, totalTokens, confidence };
}

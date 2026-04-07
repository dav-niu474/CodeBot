// ============================================================
// LLM-based Result Aggregation (V4.0.0)
// Synthesizes multiple agent results into a coherent final answer
// ============================================================

import { chatCompletion, type ChatMessage } from '@/lib/nvidia';
import type { AgentTask } from './protocol';
import { estimateTokens } from './protocol';

interface AggregationResult {
  content: string;
  tokensUsed: number;
}

/**
 * Aggregate multiple worker results into a comprehensive final answer.
 * Uses an LLM to synthesize, resolve contradictions, and present a unified response.
 */
export async function aggregateResults(params: {
  originalTask: string;
  results: Array<{
    task: AgentTask;
    agentName: string;
    content: string;
  }>;
  model: string;
}): Promise<AggregationResult> {
  const { originalTask, results, model } = params;

  const successfulResults = results.filter((r) => r.content && !r.task.error);
  const failedCount = results.length - successfulResults.length;

  if (successfulResults.length === 0) {
    return {
      content: 'All agents failed. No results to aggregate.',
      tokensUsed: 0,
    };
  }

  // If only one result, return it directly (no aggregation needed)
  if (successfulResults.length === 1) {
    return {
      content: successfulResults[0].content,
      tokensUsed: estimateTokens(successfulResults[0].content),
    };
  }

  const systemPrompt = `You are a result aggregator for a multi-agent system. Your job is to synthesize multiple independent results into a single, comprehensive, and coherent answer.

Rules:
- Identify and highlight common findings across results
- Incorporate unique insights from each result
- Resolve any contradictions by presenting the strongest evidence
- Maintain the same language as the original task
- Present the final answer in a clear, well-structured format
- If the results contain code, merge and deduplicate code blocks`;

  const resultsSection = successfulResults
    .map(
      (r, i) =>
        `### ${r.agentName} (Sub-task: ${r.task.description.slice(0, 80)})\n\n${r.content}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Original task: ${originalTask}

${failedCount > 0 ? `**Note: ${failedCount} agent(s) failed and were excluded.**\n\n` : ''}Here are the results from ${successfulResults.length} agent(s):\n\n${resultsSection}

Synthesize these results into the best possible answer to the original task.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await chatCompletion({
    model,
    messages,
    temperature: 0.4,
    maxTokens: 4096,
  });

  const content = response.choices[0]?.message?.content || 'Aggregation failed.';
  const inputTokens = response.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt);
  const outputTokens = response.usage?.completion_tokens || estimateTokens(content);

  return {
    content,
    tokensUsed: inputTokens + outputTokens,
  };
}

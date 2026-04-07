// ============================================================
// LLM-based Task Decomposition (V4.0.0)
// Breaks complex tasks into sub-tasks for parallel execution
// ============================================================

import { chatCompletion, type ChatMessage } from '@/lib/nvidia';
import type { AgentTask } from './protocol';
import { generateAgentId, estimateTokens } from './protocol';

interface SubTaskPlan {
  name: string;
  task: string;
  approach: string;
}

interface DecompositionResult {
  subTasks: AgentTask[];
  tokensUsed: number;
}

/**
 * Decompose a complex task into sub-tasks using an LLM.
 * Returns a list of AgentTask objects ready for assignment to workers.
 */
export async function decomposeTask(params: {
  task: string;
  model: string;
  maxWorkers: number;
}): Promise<DecompositionResult> {
  const { task, model, maxWorkers } = params;

  const systemPrompt = `You are an expert task planner. Your job is to break complex tasks into clear, independent sub-tasks that can be executed in parallel.

Rules:
- Each sub-task should be self-contained and independently executable.
- Sub-tasks should NOT depend on each other's results.
- Provide a specific approach or methodology for each sub-task.
- If the task is simple enough for a single worker, still create 1 sub-task.
- Use descriptive names for each sub-task.

Respond ONLY with a JSON array. No other text.`;

  const userPrompt = `Break this task into ${maxWorkers} sub-tasks (or fewer if appropriate):

Task: ${task}

Respond with a JSON array of objects:
[
  {
    "name": "Short descriptive name",
    "task": "Detailed task description",
    "approach": "Suggested approach or methodology"
  }
]`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await chatCompletion({
    model,
    messages,
    temperature: 0.3,
    maxTokens: 2048,
  });

  const content = response.choices[0]?.message?.content || '';
  const inputTokens = response.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt);
  const outputTokens = response.usage?.completion_tokens || estimateTokens(content);

  // Parse the JSON array from the response
  let plans: SubTaskPlan[] = [];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      plans = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: single task
    plans = [
      { name: 'Main Task', task, approach: 'Direct execution' },
    ];
  }

  // If LLM returned fewer tasks, pad with remaining parts
  // If more, truncate
  const finalPlans = plans.slice(0, maxWorkers);

  const subTasks: AgentTask[] = finalPlans.map((plan) => ({
    id: generateAgentId(),
    description: plan.task || task,
    status: 'pending' as const,
    tokens: { input: 0, output: 0 },
    ...(plan.name && { metadata: { name: plan.name, approach: plan.approach } }),
  }));

  return {
    subTasks,
    tokensUsed: inputTokens + outputTokens,
  };
}

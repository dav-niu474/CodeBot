// ============================================================
// Skill-Tool Bridge
// Executor function for the `skill` tool
// Connects the tool execution system to the skill engine
// ============================================================

import type { ToolExecutionResult, ToolExecutionContext } from '@/lib/tools/types';

/**
 * Execute a skill tool call.
 * This is the bridge between the tool execution system (executor.ts)
 * and the skill execution engine (engine.ts).
 *
 * Expected args:
 *   - skillId (string, required): The ID of the skill to execute
 *   - input (string, optional): The input to pass to the skill
 *
 * @param args - Tool call arguments from the LLM
 * @param context - Tool execution context (sessionId, workingDir, etc.)
 * @returns Tool execution result
 */
export async function executeSkillTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const skillId = args.skillId as string | undefined;
  const input = args.input as string | undefined;

  if (!skillId) {
    return {
      output: 'Error: skillId is required. Usage: { "skillId": "<skill-id>", "input": "<your request>" }',
      isError: true,
    };
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { executeSkill } = await import('./engine');
    const { getDefaultModel } = await import('@/lib/nvidia');

    const result = await executeSkill({
      sessionId: context.sessionId,
      skillId,
      input: input || '',
      model: getDefaultModel(),
      onProgress: context.onProgress
        ? (step) => context.onProgress!('skill-progress', { step, skillId })
        : undefined,
    });

    return {
      output: `[Skill: ${skillId}]\n${result.output}`,
      metadata: {
        type: 'skill_result',
        skillId,
        steps: result.steps,
        tokensUsed: result.tokensUsed,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Skill execution failed: ${message}`,
      isError: true,
      metadata: {
        type: 'skill_error',
        skillId,
        error: message,
      },
    };
  }
}

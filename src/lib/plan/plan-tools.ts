// ============================================================
// Plan Mode Tool Executors
// Dedicated executors for enter-plan-mode and exit-plan-mode tools.
// ============================================================

import type { ToolExecutionResult, ToolExecutionContext } from '@/lib/tools/types';
import {
  enterPlanMode,
  exitPlanMode,
  getPlanState,
} from './plan-state';

/**
 * enter-plan-mode: Switch to plan mode where the agent creates plans
 * without executing changes.
 */
export async function executeEnterPlanMode(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const description = (args.description as string) || '';
  enterPlanMode(context.sessionId);
  return {
    output: `Plan mode activated.${description ? ` Planning: ${description}` : ''} I will create a detailed plan before making any changes.`,
    metadata: { type: 'plan_mode_entered' },
  };
}

/**
 * exit-plan-mode: Exit plan mode and return to normal execution mode.
 */
export async function executeExitPlanMode(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const planState = getPlanState(context.sessionId);
  exitPlanMode(context.sessionId);
  return {
    output: `Plan mode exited.${planState ? ` Plan had ${planState.steps.length} steps.` : ''} Returning to normal execution.`,
    metadata: { type: 'plan_mode_exited' },
  };
}

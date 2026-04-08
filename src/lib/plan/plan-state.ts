// ============================================================
// Plan Mode State Management
// In-memory state tracking for plan mode per session.
// ============================================================

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: number[];
  result?: string;
}

export interface PlanData {
  goal: string;
  complexity: string;
  steps: PlanStep[];
}

interface PlanSessionState {
  active: boolean;
  plan: PlanData | null;
  currentStepId: number | null;
  startedAt: number;
}

// ────────────────────────────────────────────
// State Store (in-memory, keyed by sessionId)
// ────────────────────────────────────────────

const planModeSessions = new Map<string, PlanSessionState>();

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Enter plan mode for a session.
 * Activates plan mode tracking; plan data can be set separately via setPlanState().
 */
export function enterPlanMode(sessionId: string): void {
  const existing = planModeSessions.get(sessionId);
  if (existing) {
    existing.active = true;
    existing.startedAt = Date.now();
    return;
  }
  planModeSessions.set(sessionId, {
    active: true,
    plan: null,
    currentStepId: null,
    startedAt: Date.now(),
  });
}

/**
 * Exit plan mode for a session.
 * Clears plan mode tracking and state.
 */
export function exitPlanMode(sessionId: string): void {
  planModeSessions.delete(sessionId);
}

/**
 * Check if a session is currently in plan mode.
 */
export function isPlanMode(sessionId: string): boolean {
  return planModeSessions.get(sessionId)?.active ?? false;
}

/**
 * Get the current plan data for a session.
 * Returns null if not in plan mode or no plan has been set.
 */
export function getPlanState(sessionId: string): PlanData | null {
  return planModeSessions.get(sessionId)?.plan ?? null;
}

/**
 * Set (or replace) the plan data for a session in plan mode.
 * Also enters plan mode if not already active.
 */
export function setPlanState(sessionId: string, plan: PlanData): void {
  let state = planModeSessions.get(sessionId);
  if (!state) {
    state = {
      active: true,
      plan: null,
      currentStepId: null,
      startedAt: Date.now(),
    };
    planModeSessions.set(sessionId, state);
  }
  state.plan = plan;
  state.active = true;
}

/**
 * Update the status of a specific step in the plan.
 * Optionally stores the result text (for completed/failed steps).
 */
export function updateStepStatus(
  sessionId: string,
  stepId: number,
  status: PlanStep['status'],
  result?: string,
): void {
  const state = planModeSessions.get(sessionId);
  if (!state?.plan) return;

  const step = state.plan.steps.find((s) => s.id === stepId);
  if (step) {
    step.status = status;
    if (result !== undefined) {
      step.result = result;
    }
  }
}

/**
 * Get the current step ID being executed (if any).
 */
export function getCurrentStepId(sessionId: string): number | null {
  return planModeSessions.get(sessionId)?.currentStepId ?? null;
}

/**
 * Set the current step ID being executed.
 */
export function setCurrentStepId(sessionId: string, stepId: number | null): void {
  const state = planModeSessions.get(sessionId);
  if (state) {
    state.currentStepId = stepId;
  }
}

/**
 * Clean up stale plan mode sessions (call periodically to avoid memory leaks).
 * Removes sessions older than the given maxAgeMs.
 */
export function cleanupStaleSessions(maxAgeMs: number = 30 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionId, state] of planModeSessions) {
    if (now - state.startedAt > maxAgeMs) {
      planModeSessions.delete(sessionId);
    }
  }
}

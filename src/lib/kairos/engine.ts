// ============================================================
// Kairos Autonomous Engine
// Proactive monitoring agent with real DB queries and AI analysis
// ============================================================

import {
  runSessionCleanup,
  runTokenAnalysis,
  runAgentHealthCheck,
  runMemoryConsolidation,
  runSystemReport,
} from './tasks';

// ─── Types ────────────────────────────────────────────────

export interface KairosConfig {
  enabled: boolean;
  checkIntervalMs: number;
  proactiveActions: boolean;
  maxConcurrentActions: number;
}

export interface KairosAction {
  id: string;
  type: 'monitor' | 'analyze' | 'optimize' | 'notify' | 'cleanup';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  createdAt: string;
  completedAt?: string;
}

export interface KairosState {
  enabled: boolean;
  config: KairosConfig;
  actions: KairosAction[];
  stats: {
    totalActions: number;
    completedActions: number;
    failedActions: number;
    uptimeStart: string;
    lastCheckAt: string;
  };
}

// ─── Default Config ───────────────────────────────────────

const DEFAULT_CONFIG: KairosConfig = {
  enabled: false,
  checkIntervalMs: 30000,
  proactiveActions: true,
  maxConcurrentActions: 2,
};

const MAX_ACTIONS_IN_MEMORY = 100;

// ─── Singleton State ──────────────────────────────────────

let kairosState: KairosState = {
  enabled: false,
  config: { ...DEFAULT_CONFIG },
  actions: [],
  stats: {
    totalActions: 0,
    completedActions: 0,
    failedActions: 0,
    uptimeStart: '',
    lastCheckAt: '',
  },
};

let intervalTimer: ReturnType<typeof setInterval> | null = null;
let isRunningCheck = false;

// ─── Action helpers ───────────────────────────────────────

function addAction(action: KairosAction): void {
  kairosState.actions = [action, ...kairosState.actions].slice(0, MAX_ACTIONS_IN_MEMORY);
  kairosState.stats.totalActions += 1;
  if (action.status === 'completed') {
    kairosState.stats.completedActions += 1;
  } else if (action.status === 'failed') {
    kairosState.stats.failedActions += 1;
  }
}

// ─── Proactive Check ──────────────────────────────────────

async function proactiveCheck(): Promise<void> {
  if (isRunningCheck || !kairosState.enabled) return;
  isRunningCheck = true;

  try {
    const { db } = await import('@/lib/db');
    const now = new Date();

    kairosState.stats.lastCheckAt = now.toISOString();

    // ── 1. Check session activity ────────────────────────
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentSessions = await db.session.count({
      where: { updatedAt: { gte: twoMinutesAgo } },
    });

    if (recentSessions === 0) {
      const action = await runSessionCleanup();
      addAction(action);
    }

    // ── 2. Check token usage ────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTokenUsage = await db.tokenUsage.aggregate({
      where: { createdAt: { gte: oneHourAgo } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    const recentTokens =
      (recentTokenUsage._sum.inputTokens || 0) +
      (recentTokenUsage._sum.outputTokens || 0);

    // Run token analysis if usage is significant (>10k tokens in last hour)
    // or periodically (every ~5 checks based on action count)
    if (recentTokens > 10000 || kairosState.stats.totalActions % 5 === 0) {
      const action = await runTokenAnalysis();
      addAction(action);
    }

    // ── 3. Check for long-running agents ────────────────
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckAgents = await db.agentSession.count({
      where: {
        status: 'running',
        createdAt: { lt: tenMinutesAgo },
      },
    });

    if (stuckAgents > 0) {
      const action = await runAgentHealthCheck();
      addAction(action);
    }

    // ── 4. Memory consolidation (periodic) ──────────────
    if (kairosState.stats.totalActions % 7 === 0) {
      const action = await runMemoryConsolidation();
      addAction(action);
    }

    // ── 5. System report (periodic) ─────────────────────
    if (kairosState.stats.totalActions % 3 === 0) {
      const action = await runSystemReport();
      addAction(action);
    }
  } catch (error) {
    console.error('[Kairos] proactiveCheck error:', error);
  } finally {
    isRunningCheck = false;
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * Start the Kairos autonomous monitoring loop.
 */
export function startKairos(): void {
  if (intervalTimer) {
    // Already running — update state but don't create duplicate timer
    kairosState.enabled = true;
    kairosState.config.enabled = true;
    if (!kairosState.stats.uptimeStart) {
      kairosState.stats.uptimeStart = new Date().toISOString();
    }
    return;
  }

  kairosState.enabled = true;
  kairosState.config.enabled = true;

  if (!kairosState.stats.uptimeStart) {
    kairosState.stats.uptimeStart = new Date().toISOString();
  }

  intervalTimer = setInterval(() => {
    proactiveCheck().catch((err) => {
      console.error('[Kairos] interval error:', err);
    });
  }, kairosState.config.checkIntervalMs);

  // Run first check immediately (non-blocking)
  proactiveCheck().catch((err) => {
    console.error('[Kairos] initial check error:', err);
  });

  console.log('[Kairos] Autonomous monitoring started');
}

/**
 * Stop the Kairos autonomous monitoring loop.
 */
export function stopKairos(): void {
  kairosState.enabled = false;
  kairosState.config.enabled = false;

  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }

  console.log('[Kairos] Autonomous monitoring stopped');
}

/**
 * Check if Kairos is currently running.
 */
export function isKairosRunning(): boolean {
  return kairosState.enabled;
}

/**
 * Get the full current Kairos state (deep clone for safety).
 */
export function getKairosState(): KairosState {
  return {
    enabled: kairosState.enabled,
    config: { ...kairosState.config },
    actions: [...kairosState.actions],
    stats: { ...kairosState.stats },
  };
}

/**
 * Update Kairos configuration. If checkIntervalMs changes while running,
 * the timer is restarted with the new interval.
 */
export function updateKairosConfig(config: Partial<KairosConfig>): void {
  const wasEnabled = kairosState.enabled;
  const oldInterval = kairosState.config.checkIntervalMs;

  kairosState.config = { ...kairosState.config, ...config };

  // If the interval changed and we're running, restart the timer
  if (
    wasEnabled &&
    config.checkIntervalMs !== undefined &&
    config.checkIntervalMs !== oldInterval
  ) {
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }

    intervalTimer = setInterval(() => {
      proactiveCheck().catch((err) => {
        console.error('[Kairos] interval error:', err);
      });
    }, kairosState.config.checkIntervalMs);

    console.log(
      `[Kairos] Check interval updated to ${kairosState.config.checkIntervalMs}ms`
    );
  }
}

/**
 * Get recent actions, optionally limited.
 */
export function getRecentActions(limit: number = 20): KairosAction[] {
  return kairosState.actions.slice(0, limit);
}

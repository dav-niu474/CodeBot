// ============================================================
// Kairos Monitoring Tasks
// Individual proactive monitoring task implementations
// ============================================================

import type { KairosAction } from './engine';

// ─── Helpers ──────────────────────────────────────────────

function createKairosAction(
  type: KairosAction['type'],
  description: string
): KairosAction {
  return {
    id: `kairos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    status: 'running',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Run an AI analysis snippet via chatCompletion.
 * Returns a short, concise analysis string.
 * Falls back to a plain summary if the API call fails.
 */
async function aiAnalyze(
  prompt: string,
  fallback: string
): Promise<string> {
  try {
    const { chatCompletion } = await import('@/lib/nvidia');
    const response = await chatCompletion({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        {
          role: 'system',
          content:
            'You are a system monitoring assistant. Provide extremely concise analysis (2-3 sentences max). Be factual and specific.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 200,
    });
    return response.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// ─── Task: Session Cleanup ────────────────────────────────

/**
 * Archive old/stale sessions and compress stale memories.
 * Triggered when no recent session activity (>2 min).
 */
export async function runSessionCleanup(): Promise<KairosAction> {
  const action = createKairosAction('cleanup', 'Session cleanup — archiving stale sessions');

  try {
    const { db } = await import('@/lib/db');

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find inactive sessions (not updated in the last hour)
    const staleSessions = await db.session.findMany({
      where: {
        isActive: true,
        updatedAt: { lt: oneHourAgo },
      },
      select: { id: true, title: true, updatedAt: true },
      take: 20,
    });

    // Count total active vs inactive
    const activeCount = await db.session.count({ where: { isActive: true } });
    const totalCount = await db.session.count();

    // Mark old inactive sessions
    const archiveResult = staleSessions.length > 0
      ? `Marked ${staleSessions.length} stale sessions for archival.`
      : 'No stale sessions found.';

    // Check for stale memories
    const staleMemories = await db.memory.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: 20,
    });

    let memoryNote = '';
    if (staleMemories.length > 0) {
      await db.memory.deleteMany({
        where: { id: { in: staleMemories.map((m) => m.id) } },
      });
      memoryNote = ` Cleaned up ${staleMemories.length} expired memories.`;
    }

    action.result = `${archiveResult} Active sessions: ${activeCount}/${totalCount}.${memoryNote}`;

    // AI analysis
    if (staleSessions.length > 3 || staleMemories.length > 5) {
      const aiResult = await aiAnalyze(
        `System cleanup performed: ${staleSessions.length} stale sessions archived, ${staleMemories.length} expired memories cleaned. Total active: ${activeCount}/${totalCount}. Brief recommendation?`,
        action.result
      );
      action.result = aiResult;
    }

    action.status = 'completed';
  } catch (error) {
    action.status = 'failed';
    action.result = error instanceof Error ? error.message : 'Unknown error during session cleanup';
  }

  action.completedAt = new Date().toISOString();
  return action;
}

// ─── Task: Token Analysis ─────────────────────────────────

/**
 * Analyze token usage patterns and suggest optimizations.
 * Triggered when token usage is high.
 */
export async function runTokenAnalysis(): Promise<KairosAction> {
  const action = createKairosAction('analyze', 'Token usage analysis');

  try {
    const { db } = await import('@/lib/db');

    // Aggregate total usage
    const stats = await db.tokenUsage.aggregate({
      _sum: { inputTokens: true, outputTokens: true, cost: true },
      _count: true,
    });
    const totalInput = stats._sum.inputTokens || 0;
    const totalOutput = stats._sum.outputTokens || 0;
    const totalTokens = totalInput + totalOutput;
    const totalCost = stats._sum.cost || 0;
    const totalRequests = stats._count || 0;

    // Recent usage (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentStats = await db.tokenUsage.aggregate({
      where: { createdAt: { gte: oneHourAgo } },
      _sum: { inputTokens: true, outputTokens: true, cost: true },
      _count: true,
    });
    const recentTokens =
      (recentStats._sum.inputTokens || 0) + (recentStats._sum.outputTokens || 0);

    // Top sessions by token usage
    const topSessions = await db.tokenUsage.groupBy({
      by: ['sessionId'],
      _sum: { inputTokens: true, outputTokens: true },
      orderBy: { _sum: { inputTokens: 'desc' } },
      take: 3,
    });

    const baseResult = `Total tokens: ${totalTokens.toLocaleString()} (in: ${totalInput.toLocaleString()}, out: ${totalOutput.toLocaleString()}), Requests: ${totalRequests}, Cost: $${totalCost.toFixed(4)}. Last hour: ${recentTokens.toLocaleString()} tokens. Top sessions: ${topSessions.length} tracked.`;

    // AI analysis for optimization suggestions
    const aiResult = await aiAnalyze(
      `Token usage report: Total ${totalTokens.toLocaleString()} tokens across ${totalRequests} requests, cost $${totalCost.toFixed(4)}. Last hour: ${recentTokens.toLocaleString()} tokens. ${topSessions.length} sessions tracked. Give a brief optimization assessment (1-2 sentences).`,
      baseResult
    );

    action.result = aiResult;
    action.status = 'completed';
  } catch (error) {
    action.status = 'failed';
    action.result = error instanceof Error ? error.message : 'Unknown error during token analysis';
  }

  action.completedAt = new Date().toISOString();
  return action;
}

// ─── Task: Agent Health Check ─────────────────────────────

/**
 * Check for stuck/long-running agents and report their status.
 * Triggered when agents have been running for >10 minutes.
 */
export async function runAgentHealthCheck(): Promise<KairosAction> {
  const action = createKairosAction('monitor', 'Agent health check — checking for stuck agents');

  try {
    const { db } = await import('@/lib/db');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Find potentially stuck agents (running for >10 minutes)
    const stuckAgents = await db.agentSession.findMany({
      where: {
        status: 'running',
        createdAt: { lt: tenMinutesAgo },
      },
      select: { id: true, name: true, role: true, task: true, createdAt: true },
      take: 10,
    });

    // Overall agent status summary
    const allAgents = await db.agentSession.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusSummary = allAgents
      .map((s) => `${s.status}: ${s._count}`)
      .join(', ');

    let healthNote = '';
    if (stuckAgents.length > 0) {
      healthNote = ` ⚠️ ${stuckAgents.length} potentially stuck agent(s): ${stuckAgents.map((a) => a.name).join(', ')}. Consider manual review.`;
    } else {
      healthNote = ' No stuck agents detected.';
    }

    const baseResult = `Agent status: ${statusSummary}.${healthNote}`;

    // AI analysis
    const aiResult = await aiAnalyze(
      `Agent health report: ${statusSummary}. ${stuckAgents.length} stuck agents detected (running >10min). ${stuckAgents.map((a) => `${a.name}: "${a.task?.slice(0, 50)}"`).join('; ') || 'None'}. Brief assessment (1-2 sentences).`,
      baseResult
    );

    action.result = aiResult;
    action.status = 'completed';
  } catch (error) {
    action.status = 'failed';
    action.result = error instanceof Error ? error.message : 'Unknown error during agent health check';
  }

  action.completedAt = new Date().toISOString();
  return action;
}

// ─── Task: Memory Consolidation ───────────────────────────

/**
 * Run memory consolidation on sessions with many messages.
 * Identifies sessions with high memory counts and suggests consolidation.
 */
export async function runMemoryConsolidation(): Promise<KairosAction> {
  const action = createKairosAction('optimize', 'Memory consolidation analysis');

  try {
    const { db } = await import('@/lib/db');

    // Count memories by session
    const memoryBySession = await db.memory.groupBy({
      by: ['sessionId'],
      _count: true,
      orderBy: { _count: true, id: 'desc' } as any, // prisma groupBy ordering workaround
      take: 5,
      where: { sessionId: { not: null } },
    });

    // Total memory count by layer
    const memoryByLayer = await db.memory.groupBy({
      by: ['layer'],
      _count: true,
    });

    const totalMemories = await db.memory.count();
    const layerSummary = memoryByLayer.map((l) => `${l.layer}: ${l._count}`).join(', ');

    let consolidationNote = '';
    const highMemorySessions = memoryBySession.filter(
      (s) => s._count > 20
    );

    if (highMemorySessions.length > 0) {
      consolidationNote = ` ${highMemorySessions.length} session(s) with >20 memories flagged for consolidation.`;
    } else {
      consolidationNote = ' All sessions within normal memory bounds.';
    }

    action.result = `Total memories: ${totalMemories}. Layers: ${layerSummary}.${consolidationNote}`;

    // AI analysis if there are sessions needing consolidation
    if (highMemorySessions.length > 0) {
      const aiResult = await aiAnalyze(
        `Memory consolidation: ${totalMemories} total memories. Layers: ${layerSummary}. ${highMemorySessions.length} sessions with >20 memories. Brief recommendation (1-2 sentences).`,
        action.result
      );
      action.result = aiResult;
    }

    action.status = 'completed';
  } catch (error) {
    action.status = 'failed';
    action.result = error instanceof Error ? error.message : 'Unknown error during memory consolidation';
  }

  action.completedAt = new Date().toISOString();
  return action;
}

// ─── Task: System Report ──────────────────────────────────

/**
 * Generate a comprehensive system health summary.
 * Runs periodically as a general health check.
 */
export async function runSystemReport(): Promise<KairosAction> {
  const action = createKairosAction('notify', 'System health report generated');

  try {
    const { db } = await import('@/lib/db');

    // Gather system metrics in parallel
    const [sessionCount, messageCount, agentCount, memoryCount, toolCount, tokenStats, securityLogs] =
      await Promise.all([
        db.session.count(),
        db.message.count(),
        db.agentSession.count(),
        db.memory.count(),
        db.toolDef.count({ where: { isEnabled: true } }),
        db.tokenUsage.aggregate({
          _sum: { inputTokens: true, outputTokens: true, cost: true },
          _count: true,
        }),
        db.securityLog.findMany({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { toolName: true, riskLevel: true, action: true, createdAt: true },
        }),
      ]);

    const totalTokens =
      (tokenStats._sum.inputTokens || 0) + (tokenStats._sum.outputTokens || 0);
    const totalCost = tokenStats._sum.cost || 0;

    const baseResult = [
      `Sessions: ${sessionCount}`,
      `Messages: ${messageCount}`,
      `Agents: ${agentCount}`,
      `Memories: ${memoryCount}`,
      `Active Tools: ${toolCount}`,
      `Tokens Used: ${totalTokens.toLocaleString()} ($${totalCost.toFixed(4)})`,
      `Security Events (24h): ${securityLogs.length}`,
    ].join(' | ');

    // AI analysis
    const aiResult = await aiAnalyze(
      `System health summary: ${sessionCount} sessions, ${messageCount} messages, ${agentCount} agents, ${memoryCount} memories, ${toolCount} tools active, ${totalTokens.toLocaleString()} tokens ($${totalCost.toFixed(4)}), ${securityLogs.length} security events in 24h. Brief status summary (2 sentences).`,
      baseResult
    );

    action.result = aiResult;
    action.status = 'completed';
  } catch (error) {
    action.status = 'failed';
    action.result = error instanceof Error ? error.message : 'Unknown error during system report';
  }

  action.completedAt = new Date().toISOString();
  return action;
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ── GET /api/analytics ────────────────────────────────────────────────
// Returns token usage analytics: totals, model breakdown, daily usage, recent records

export async function GET() {
  try {
    // ── Aggregate totals ─────────────────────────────────
    const totals = await db.tokenUsage.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheHitTokens: true,
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    const totalInputTokens = totals._sum.inputTokens ?? 0;
    const totalOutputTokens = totals._sum.outputTokens ?? 0;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalCost = totals._sum.cost ?? 0;

    // ── Distinct session count ───────────────────────────
    const sessionsWithUsage = await db.tokenUsage.findMany({
      where: { sessionId: { not: null } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    const sessionCount = sessionsWithUsage.length;

    // ── Model breakdown (GROUP BY modelId) ──────────────
    const allUsages = await db.tokenUsage.findMany({
      select: {
        modelId: true,
        inputTokens: true,
        outputTokens: true,
        sessionId: true,
        cost: true,
      },
    });

    // Group by modelId
    const modelMap = new Map<string, {
      modelId: string;
      tokens: number;
      inputTokens: number;
      outputTokens: number;
      sessions: Set<string>;
    }>();

    for (const u of allUsages) {
      const existing = modelMap.get(u.modelId);
      if (existing) {
        existing.tokens += u.inputTokens + u.outputTokens;
        existing.inputTokens += u.inputTokens;
        existing.outputTokens += u.outputTokens;
        if (u.sessionId) existing.sessions.add(u.sessionId);
      } else {
        modelMap.set(u.modelId, {
          modelId: u.modelId,
          tokens: u.inputTokens + u.outputTokens,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          sessions: new Set(u.sessionId ? [u.sessionId] : []),
        });
      }
    }

    const modelBreakdown = Array.from(modelMap.values())
      .sort((a, b) => b.tokens - a.tokens)
      .map((m) => ({
        modelId: m.modelId,
        tokens: m.tokens,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        sessions: m.sessions.size,
        percentage: totalTokens > 0 ? Math.round((m.tokens / totalTokens) * 1000) / 10 : 0,
      }));

    // ── Daily usage (last 7 days) ────────────────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentUsages = await db.tokenUsage.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
        cost: true,
      },
    });

    // Group by date
    const dailyMap = new Map<string, { tokens: number; cost: number }>();
    for (const u of recentUsages) {
      const dateStr = u.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.tokens += u.inputTokens + u.outputTokens;
        existing.cost += u.cost;
      } else {
        dailyMap.set(dateStr, {
          tokens: u.inputTokens + u.outputTokens,
          cost: u.cost,
        });
      }
    }

    const dailyUsage = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        tokens: data.tokens,
        cost: Math.round(data.cost * 100) / 100,
      }));

    // ── Recent usage (last 20 records) ───────────────────
    const recentRecords = await db.tokenUsage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentUsage = recentRecords.map((r) => ({
      id: r.id,
      modelId: r.modelId,
      tokens: r.inputTokens + r.outputTokens,
      cost: Math.round(r.cost * 100) / 100,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      sessionCount,
      modelBreakdown,
      dailyUsage,
      recentUsage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analytics API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

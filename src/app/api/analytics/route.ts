import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const sessionCountResult = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "sessionId")::int as count FROM "token_usages" WHERE "sessionId" IS NOT NULL
    `;
    const sessionCount = Number(sessionCountResult[0]?.count) || 0;

    // ── Model breakdown (GROUP BY modelId) ──────────────
    const modelBreakdownRaw = await db.$queryRaw<
      Array<{
        "modelId": string;
        tokens: bigint;
        inputTokens: bigint;
        outputTokens: bigint;
        sessions: bigint;
      }>
    >`
      SELECT "modelId",
             SUM("inputTokens" + "outputTokens") as tokens,
             SUM("inputTokens") as "inputTokens",
             SUM("outputTokens") as "outputTokens",
             COUNT(DISTINCT "sessionId")::int as sessions
      FROM "token_usages"
      GROUP BY "modelId"
      ORDER BY tokens DESC
    `;

    const modelBreakdown = modelBreakdownRaw.map((row) => ({
      modelId: row.modelId,
      tokens: Number(row.tokens) || 0,
      inputTokens: Number(row.inputTokens) || 0,
      outputTokens: Number(row.outputTokens) || 0,
      sessions: Number(row.sessions) || 0,
      percentage: totalTokens > 0 ? Math.round(((Number(row.tokens) || 0) / totalTokens) * 1000) / 10 : 0,
    }));

    // ── Daily usage (last 7 days) ────────────────────────
    const dailyUsageRaw = await db.$queryRaw<
      Array<{
        date: string;
        tokens: bigint;
        cost: number;
      }>
    >`
      SELECT DATE("createdAt") as date,
             SUM("inputTokens" + "outputTokens") as tokens,
             SUM(cost) as cost
      FROM "token_usages"
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyUsage = dailyUsageRaw.map((row) => ({
      date: String(row.date),
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
    }));

    // ── Recent usage (last 20 records) ───────────────────
    const recentUsageRaw = await db.$queryRaw<
      Array<{
        id: string;
        "modelId": string;
        tokens: bigint;
        cost: number;
        "createdAt": Date;
      }>
    >`
      SELECT id,
             "modelId",
             ("inputTokens" + "outputTokens") as tokens,
             cost,
             "createdAt"
      FROM "token_usages"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;

    const recentUsage = recentUsageRaw.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
      createdAt: row.createdAt.toISOString(),
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

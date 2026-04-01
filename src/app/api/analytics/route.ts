import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

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
    const sessionCountResult = await db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT session_id) as count FROM TokenUsage WHERE session_id IS NOT NULL
    `;
    const sessionCount = sessionCountResult[0]?.count ?? 0;

    // ── Model breakdown (GROUP BY modelId) ──────────────
    const modelBreakdownRaw = await db.$queryRaw<
      Array<{
        modelId: string;
        tokens: number;
        inputTokens: number;
        outputTokens: number;
        sessions: number;
      }>
    >`
      SELECT model_id as modelId,
             SUM(input_tokens + output_tokens) as tokens,
             SUM(input_tokens) as inputTokens,
             SUM(output_tokens) as outputTokens,
             COUNT(DISTINCT session_id) as sessions
      FROM TokenUsage
      GROUP BY model_id
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
        tokens: number;
        cost: number;
      }>
    >`
      SELECT date(createdAt) as date,
             SUM(input_tokens + output_tokens) as tokens,
             SUM(cost) as cost
      FROM TokenUsage
      WHERE createdAt >= date('now', '-7 days')
      GROUP BY date(createdAt)
      ORDER BY date ASC
    `;

    const dailyUsage = dailyUsageRaw.map((row) => ({
      date: row.date,
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
    }));

    // ── Recent usage (last 20 records) ───────────────────
    const recentUsageRaw = await db.$queryRaw<
      Array<{
        id: string;
        modelId: string;
        tokens: number;
        cost: number;
        createdAt: string;
      }>
    >`
      SELECT id,
             model_id as modelId,
             (input_tokens + output_tokens) as tokens,
             cost,
             createdAt
      FROM TokenUsage
      ORDER BY createdAt DESC
      LIMIT 20
    `;

    const recentUsage = recentUsageRaw.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
      createdAt: row.createdAt,
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

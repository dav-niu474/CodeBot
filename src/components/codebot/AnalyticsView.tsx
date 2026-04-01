'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Coins,
  Radio,
  Cpu,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Info,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';

// ── Animation Variants ──────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Inline Types ────────────────────────────────

interface ModelBreakdownRow {
  modelId: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  sessions: number;
  percentage: number;
}

interface DailyUsageRow {
  date: string;
  tokens: number;
  cost: number;
}

interface RecentUsageRow {
  id: string;
  modelId: string;
  tokens: number;
  cost: number;
  createdAt: string;
}

interface AnalyticsData {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  sessionCount: number;
  modelBreakdown: ModelBreakdownRow[];
  dailyUsage: DailyUsageRow[];
  recentUsage: RecentUsageRow[];
}

// ── Cost Estimate Data ──────────────────────────

const COST_ESTIMATES = [
  {
    model: 'meta/llama-3.3-70b-instruct',
    inputRate: '$0.0005',
    outputRate: '$0.001',
  },
  {
    model: 'meta/llama-3.1-8b-instruct',
    inputRate: '$0.0001',
    outputRate: '$0.0002',
  },
  {
    model: 'mistralai/mixtral-8x22b-instruct-v0.1',
    inputRate: '$0.0006',
    outputRate: '$0.0009',
  },
  {
    model: 'google/gemma-2-27b-it',
    inputRate: '$0.0003',
    outputRate: '$0.0006',
  },
  {
    model: 'nvidia/nemotron-4-340b-instruct',
    inputRate: '$0.001',
    outputRate: '$0.002',
  },
];

// ── Helpers ─────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function getModelDisplayName(modelId: string): string {
  // Shorten long model IDs for display
  const parts = modelId.split('/');
  if (parts.length > 1) {
    const model = parts[parts.length - 1];
    return model.length > 28 ? model.slice(0, 25) + '...' : model;
  }
  return modelId.length > 32 ? modelId.slice(0, 29) + '...' : modelId;
}

function isMetaModel(modelId: string): boolean {
  return modelId.startsWith('meta/');
}

// ── Component ───────────────────────────────────

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Loading State ─────────────────────────────
  if (loading) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex h-full items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="text-sm text-muted-foreground">Loading analytics...</span>
        </div>
      </motion.div>
    );
  }

  // ── Error State ───────────────────────────────
  if (error) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex h-full items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Analytics Error</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  if (!data) return null;

  // ── Compute chart data ────────────────────────
  const maxDailyTokens = Math.max(...data.dailyUsage.map((d) => d.tokens), 1);
  const maxModelTokens = Math.max(...data.modelBreakdown.map((m) => m.tokens), 1);
  const modelsUsed = data.modelBreakdown.length;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Token Analytics</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usage patterns, spending & model comparison
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              >
                <BarChart3 className="mr-1 h-3 w-3" />
                {formatNumber(data.totalTokens)} tokens
              </Badge>
              <button
                onClick={fetchData}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ─────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total Tokens */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-lg font-bold text-foreground">
                    {formatNumber(data.totalTokens)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">Total Tokens</div>
              </CardContent>
            </Card>

            {/* Total Cost */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-lg font-bold text-foreground">
                    {formatCost(data.totalCost)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">Total Cost</div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Radio className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-lg font-bold text-foreground">
                    {data.sessionCount}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">Active Sessions</div>
              </CardContent>
            </Card>

            {/* Models Used */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-lg font-bold text-foreground">
                    {modelsUsed}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">Models Used</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* ── Input/Output Split ─────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-foreground">Input Tokens</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">
                  {formatNumber(data.totalInputTokens)}
                </span>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${data.totalTokens > 0 ? (data.totalInputTokens / data.totalTokens) * 100 : 0}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-xs font-medium text-foreground">Output Tokens</span>
                </div>
                <span className="text-lg font-bold text-sky-400">
                  {formatNumber(data.totalOutputTokens)}
                </span>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{
                      width: `${data.totalTokens > 0 ? (data.totalOutputTokens / data.totalTokens) * 100 : 0}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* ── Model Comparison ──────────────────── */}
        {data.modelBreakdown.length > 0 && (
          <motion.div variants={item} className="mb-6">
            <Card className="border-border/50 bg-card/50">
              <div className="border-b border-border/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Model Comparison
                  </span>
                  <Badge variant="secondary" className="text-[9px] text-muted-foreground h-4 px-1.5">
                    {data.modelBreakdown.length} models
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {data.modelBreakdown.map((model, i) => {
                    const barWidth = (model.tokens / maxModelTokens) * 100;
                    const isMeta = isMetaModel(model.modelId);
                    return (
                      <motion.div
                        key={model.modelId}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.08 }}
                        className="group"
                      >
                        <div className="flex items-center gap-3">
                          {/* Model name */}
                          <div className="w-40 shrink-0 text-right">
                            <span className="truncate text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors block">
                              {getModelDisplayName(model.modelId)}
                            </span>
                          </div>
                          {/* Bar */}
                          <div className="flex-1">
                            <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-800/50">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.6, delay: i * 0.08 + 0.1 }}
                                className={`h-full rounded-md ${
                                  isMeta
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                                    : 'bg-gradient-to-r from-amber-600 to-amber-400'
                                }`}
                              />
                            </div>
                          </div>
                          {/* Token count + percentage */}
                          <div className="w-24 shrink-0 text-right">
                            <span className="text-xs font-semibold text-foreground">
                              {formatNumber(model.tokens)}
                            </span>
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({model.percentage}%)
                            </span>
                          </div>
                        </div>
                        {/* Sub-detail row */}
                        <div className="mt-1 flex items-center gap-3 pl-[172px]">
                          <span className="text-[9px] text-muted-foreground/60">
                            In: {formatNumber(model.inputTokens)} &middot; Out: {formatNumber(model.outputTokens)} &middot; Sessions: {model.sessions}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Daily Usage Chart ──────────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <div className="border-b border-border/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Daily Usage (Last 7 Days)
                </span>
              </div>
            </div>
            <CardContent className="p-4">
              {data.dailyUsage.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs">No usage data in the last 7 days</p>
                </div>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {data.dailyUsage.map((day, i) => {
                    const barHeight = Math.max((day.tokens / maxDailyTokens) * 100, 2);
                    return (
                      <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                        {/* Value on top */}
                        <span className="text-[9px] font-medium text-muted-foreground">
                          {formatNumber(day.tokens)}
                        </span>
                        {/* Bar */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${barHeight}%` }}
                          transition={{ duration: 0.5, delay: i * 0.06 }}
                          className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 min-h-[4px]"
                          title={`${day.date}: ${formatNumber(day.tokens)} tokens, ${formatCost(day.cost)}`}
                        />
                        {/* Date label */}
                        <span className="text-[9px] text-muted-foreground/60">
                          {format(new Date(day.date + 'T00:00:00'), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Y-axis label */}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/40 italic">tokens</span>
                {data.dailyUsage.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/40">
                    Total: {formatNumber(data.dailyUsage.reduce((s, d) => s + d.tokens, 0))} tokens &middot; {formatCost(data.dailyUsage.reduce((s, d) => s + d.cost, 0))}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Recent Usage Table ─────────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <div className="border-b border-border/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Recent Usage
                </span>
                <Badge variant="secondary" className="text-[9px] text-muted-foreground h-4 px-1.5">
                  {data.recentUsage.length}
                </Badge>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {data.recentUsage.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Clock className="mb-2 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs">No usage records found</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-sm">
                    <tr className="border-b border-border/30">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Model
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Tokens
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentUsage.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/20 transition-colors hover:bg-zinc-800/30 ${
                          i % 2 === 0 ? '' : 'bg-zinc-900/30'
                        }`}
                      >
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-2">
                          <span className="truncate max-w-[180px] inline-block text-foreground font-mono text-[11px]">
                            {getModelDisplayName(row.modelId)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">
                          {formatNumber(row.tokens)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {formatCost(row.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Cost Estimate Card ─────────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <div className="border-b border-border/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-foreground">
                  Cost Estimates
                </span>
              </div>
            </div>
            <CardContent className="p-4">
              {/* Disclaimer */}
              <div className="flex items-start gap-2 mb-4 rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                <span className="text-[10px] text-muted-foreground leading-relaxed">
                  Note: Actual costs depend on your API provider. The rates below are
                  approximate NVIDIA NIM API pricing.
                </span>
              </div>

              {/* Pricing table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Model
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Input (1M tokens)
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Output (1M tokens)
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Est. Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COST_ESTIMATES.map((rate, i) => {
                    // Find matching model usage data
                    const modelData = data.modelBreakdown.find(
                      (m) => m.modelId === rate.model
                    );
                    const inputCost =
                      (parseFloat(rate.inputRate.replace('$', '')) * (modelData?.inputTokens ?? 0)) / 1_000_000;
                    const outputCost =
                      (parseFloat(rate.outputRate.replace('$', '')) * (modelData?.outputTokens ?? 0)) / 1_000_000;
                    const estCost = inputCost + outputCost;

                    return (
                      <tr
                        key={rate.model}
                        className={`border-b border-border/20 ${
                          i % 2 === 0 ? '' : 'bg-zinc-900/30'
                        }`}
                      >
                        <td className="px-3 py-2 text-foreground font-mono text-[11px] truncate max-w-[200px]">
                          {getModelDisplayName(rate.model)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {rate.inputRate}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {rate.outputRate}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-amber-400">
                          {estCost > 0 ? formatCost(estCost) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

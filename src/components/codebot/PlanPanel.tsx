'use client';

import { useState, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useLocale } from '@/lib/i18n/use-locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Play,
  Download,
  Lightbulb,
  RotateCcw,
  AlertCircle,
  Target,
  Clock,
  Zap,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface PlanStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  dependencies: number[];
  result?: string;
}

interface Plan {
  goal: string;
  complexity: 'low' | 'medium' | 'high';
  steps: PlanStep[];
}

// ────────────────────────────────────────────
// Animation variants
// ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export function PlanPanel() {
  const { t } = useLocale();
  const { selectedModel, addMessage, setLoading } = useChatStore();

  const [taskInput, setTaskInput] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Computed values ───────────────────
  const completedCount = plan?.steps.filter((s) => s.status === 'completed').length ?? 0;
  const totalCount = plan?.steps.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const complexityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    low: { label: t.plan.low, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
    medium: { label: t.plan.medium, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
    high: { label: t.plan.high, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
  };

  // ── Generate plan ─────────────────────
  const handleGeneratePlan = useCallback(async () => {
    const trimmed = taskInput.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: trimmed, model: selectedModel }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate plan');
      }

      setPlan(data as Plan);
      setExpandedStepId(null);
      setIsCollapsed(false);
      toast.success(t.plan.planGenerated);
    } catch (err) {
      toast.error(t.plan.planError, {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [taskInput, isGenerating, selectedModel, t]);

  // ── Toggle step status ────────────────
  const handleToggleStep = useCallback(
    (stepId: number) => {
      if (!plan) return;

      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((step) => {
            if (step.id !== stepId) return step;

            const nextStatus: PlanStep['status'] =
              step.status === 'pending' ? 'in-progress' : step.status === 'in-progress' ? 'completed' : 'pending';

            return { ...step, status: nextStatus };
          }),
        };
      });
    },
    [plan]
  );

  // ── Clear plan ────────────────────────
  const handleClearPlan = useCallback(() => {
    // Abort any running auto-execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPlan(null);
    setTaskInput('');
    setExpandedStepId(null);
    setIsAutoExecuting(false);
    setExecutionSummary(null);
  }, []);

  // ── Execute plan (send all steps as messages) ──
  const handleExecutePlan = useCallback(() => {
    if (!plan) return;

    const stepsText = plan.steps
      .map((step, i) => `${i + 1}. **${step.title}** (${step.status}): ${step.description}`)
      .join('\n');

    const message = `[Ultraplan] Execute the following plan:\n\n**Goal:** ${plan.goal}\n**Complexity:** ${plan.complexity}\n\n${stepsText}`;

    addMessage({
      id: `msg-plan-${Date.now()}`,
      sessionId: '',
      role: 'user',
      content: message,
      toolCalls: null,
      toolResults: null,
      tokens: Math.floor(message.length * 1.5),
      createdAt: new Date().toISOString(),
    });

    toast.success(t.plan.executePlan);
  }, [plan, addMessage, t]);

  // ── Auto Execute plan via SSE ──────────
  const handleAutoExecute = useCallback(async () => {
    if (!plan || isAutoExecuting) return;

    // Abort any previous execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAutoExecuting(true);
    setExecutionSummary(null);

    // Reset all step statuses to pending
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => ({ ...s, status: 'pending' as const, result: undefined })),
      };
    });

    try {
      const res = await fetch('/api/plan/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `plan-exec-${Date.now()}`,
          plan: {
            goal: plan.goal,
            steps: plan.steps.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              dependencies: s.dependencies,
            })),
          },
          model: selectedModel,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || 'Failed to start plan execution');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));

            switch (event.type) {
              case 'plan_step_start':
                setPlan((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    steps: prev.steps.map((s) =>
                      s.id === event.stepId ? { ...s, status: 'in-progress' as const } : s
                    ),
                  };
                });
                break;

              case 'plan_step_complete':
                setPlan((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    steps: prev.steps.map((s) =>
                      s.id === event.stepId
                        ? { ...s, status: 'completed' as const, result: event.result }
                        : s
                    ),
                  };
                });
                break;

              case 'plan_step_failed':
                setPlan((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    steps: prev.steps.map((s) =>
                      s.id === event.stepId
                        ? { ...s, status: 'failed' as const, result: event.error }
                        : s
                    ),
                  };
                });
                break;

              case 'plan_complete':
                setExecutionSummary(event.summary || `Done: ${event.completedSteps}/${event.totalSteps} steps`);
                break;

              case 'plan_error':
                setExecutionSummary(`Error: ${event.error}`);
                toast.error('Plan execution error', { description: event.error });
                break;
            }
          } catch {
            // Ignore JSON parse errors for non-data lines
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExecutionSummary('Execution cancelled');
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setExecutionSummary(`Error: ${msg}`);
        toast.error('Plan execution failed', { description: msg });
      }
    } finally {
      setIsAutoExecuting(false);
      abortControllerRef.current = null;
    }
  }, [plan, isAutoExecuting, selectedModel]);

  // ── Export plan as Markdown ───────────
  const handleExportPlan = useCallback(() => {
    if (!plan) return;

    const lines: string[] = [];
    lines.push(`# ${t.plan.title}: ${plan.goal}`);
    lines.push(`> ${t.plan.complexity}: ${complexityConfig[plan.complexity]?.label || plan.complexity}`);
    lines.push(`> ${new Date().toLocaleString()}`);
    lines.push('');

    plan.steps.forEach((step, i) => {
      const statusIcon = step.status === 'completed' ? '✅' : step.status === 'in-progress' ? '🔄' : '⬜';
      const deps = step.dependencies.length > 0 ? ` *(depends on: ${step.dependencies.join(', ')})*` : '';
      lines.push(`${statusIcon} **Step ${i + 1}: ${step.title}** [${step.status}]${deps}`);
      lines.push(`   ${step.description}`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(t.plan.exportPlan);
  }, [plan, t, complexityConfig]);

  // ── Get step status icon ──────────────
  const getStepIcon = (status: PlanStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'in-progress':
        return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Circle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStepStatusBadge = (status: PlanStep['status']) => {
    const config = {
      pending: { label: t.plan.pending, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
      'in-progress': { label: t.plan.inProgress, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      completed: { label: t.plan.completed, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    };
    const c = config[status];
    return (
      <Badge variant="outline" className={cn('gap-0.5 px-1.5 py-0 text-[9px]', c.border, c.bg, c.color)}>
        {status === 'in-progress' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
        {status === 'failed' && <XCircle className="h-2.5 w-2.5" />}
        {c.label}
      </Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="border-b border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent">
        <div className="mx-auto max-w-4xl">
          {/* ─── Collapsible Header ─── */}
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-indigo-500/5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">{t.plan.title}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t.plan.subtitle}</span>
              </div>
            </div>

            {plan && (
              <Badge variant="outline" className="ml-2 gap-1 border-indigo-500/20 bg-indigo-500/10 text-[10px] text-indigo-400">
                {completedCount}/{totalCount} {t.plan.steps}
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2">
              {plan && !isCollapsed && (
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-0.5 px-1.5 py-0 text-[9px]',
                    complexityConfig[plan.complexity]?.borderColor,
                    complexityConfig[plan.complexity]?.bgColor,
                    complexityConfig[plan.complexity]?.color
                  )}
                >
                  {t.plan.complexity}: {complexityConfig[plan.complexity]?.label}
                </Badge>
              )}
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* ─── Panel Body ─── */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3">
                  {/* ─── Task Input ─── */}
                  {!plan && !isGenerating && (
                    <div className="mt-2 space-y-2">
                      <div className="relative">
                        <Textarea
                          value={taskInput}
                          onChange={(e) => setTaskInput(e.target.value)}
                          placeholder={t.plan.describeTask}
                          className="min-h-[72px] resize-none rounded-lg border-border/50 bg-card/80 text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/30"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={handleGeneratePlan}
                        disabled={!taskInput.trim()}
                        className={cn(
                          'w-full gap-2 rounded-lg transition-all duration-200',
                          taskInput.trim()
                            ? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.3)] hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t.plan.generatePlan}
                      </Button>
                    </div>
                  )}

                  {/* ─── Loading State ─── */}
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex flex-col items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-6"
                    >
                      <div className="relative">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-foreground">{t.plan.generating}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{t.plan.subtitle}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Plan Display ─── */}
                  {plan && (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="mt-2 space-y-3"
                    >
                      {/* Goal Card */}
                      <motion.div
                        variants={itemVariants}
                        className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                              {t.plan.goal}
                            </p>
                            <p className="mt-1 text-xs font-medium text-foreground">{plan.goal}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 gap-0.5 px-1.5 py-0 text-[9px]',
                              complexityConfig[plan.complexity]?.borderColor,
                              complexityConfig[plan.complexity]?.bgColor,
                              complexityConfig[plan.complexity]?.color
                            )}
                          >
                            {t.plan.complexity}: {complexityConfig[plan.complexity]?.label}
                          </Badge>
                        </div>
                      </motion.div>

                      {/* Progress Bar */}
                      {totalCount > 0 && (
                        <motion.div variants={itemVariants} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {t.plan.stepOf.replace('{current}', String(completedCount)).replace('{total}', String(totalCount))}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </div>
                        </motion.div>
                      )}

                      {/* Steps Timeline */}
                      <motion.div variants={itemVariants} className="space-y-0">
                        {plan.steps.map((step, index) => {
                          const isExpanded = expandedStepId === step.id;
                          const isLast = index === plan.steps.length - 1;

                          return (
                            <motion.div
                              key={step.id}
                              variants={itemVariants}
                              className="relative"
                            >
                              {/* Timeline line */}
                              {!isLast && (
                                <div
                                  className={cn(
                                    'absolute left-[11px] top-5 h-full w-px',
                                    step.status === 'completed' ? 'bg-indigo-500/40' : step.status === 'failed' ? 'bg-red-500/40' : 'bg-border/40'
                                  )}
                                />
                              )}

                              {/* Step Row */}
                              <button
                                type="button"
                                onClick={() => handleToggleStep(step.id)}
                                className={cn(
                                  'group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-all',
                                  isExpanded ? 'bg-muted/60' : 'hover:bg-muted/30',
                                  step.status === 'completed' && 'opacity-75'
                                )}
                              >
                                {/* Status Icon */}
                                <div className="relative mt-0.5 shrink-0">
                                  {getStepIcon(step.status)}
                                </div>

                                {/* Step Content */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'text-xs font-medium',
                                        step.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'
                                      )}
                                    >
                                      {step.title}
                                    </span>
                                    {getStepStatusBadge(step.status)}
                                  </div>

                                  {/* Expanded description */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                          {step.description}
                                        </p>
                                        {step.dependencies.length > 0 && (
                                          <div className="mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="h-2.5 w-2.5 text-muted-foreground/50" />
                                            <span className="text-[9px] text-muted-foreground/60">
                                              {t.plan.steps} {step.dependencies.join(', ')}
                                            </span>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* Expand/Collapse Indicator */}
                                <ChevronDown
                                  className={cn(
                                    'mt-1 h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              </button>
                            </motion.div>
                          );
                        })}
                      </motion.div>

                      {/* Action Buttons */}
                      <motion.div
                        variants={itemVariants}
                        className="flex flex-wrap items-center gap-2 pt-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAutoExecute}
                          disabled={isAutoExecuting}
                          className={cn(
                            'h-7 gap-1.5 text-[10px] font-medium transition-all duration-200',
                            isAutoExecuting
                              ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                              : 'border-violet-500/20 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300'
                          )}
                        >
                          {isAutoExecuting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          {isAutoExecuting ? 'Executing...' : 'Auto Execute'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExecutePlan}
                          disabled={isAutoExecuting}
                          className="h-7 gap-1.5 border-indigo-500/20 bg-indigo-500/10 text-[10px] font-medium text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300"
                        >
                          <Play className="h-3 w-3" />
                          {t.plan.executePlan}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportPlan}
                          className="h-7 gap-1.5 border-border/50 bg-card/50 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          <Download className="h-3 w-3" />
                          {t.plan.exportPlan}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPlan(null);
                            setTaskInput('');
                          }}
                          className="h-7 gap-1.5 border-border/50 bg-card/50 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t.plan.generatePlan}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (abortControllerRef.current) {
                              abortControllerRef.current.abort();
                            }
                          }}
                          disabled={!isAutoExecuting}
                          className="h-7 gap-1.5 text-[10px] text-red-400/60 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <XCircle className="h-3 w-3" />
                          Stop
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearPlan}
                          className="ml-auto h-7 gap-1.5 text-[10px] text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          {t.plan.clearPlan}
                        </Button>
                      </motion.div>

                      {/* Execution Summary */}
                      {executionSummary && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-2.5',
                            executionSummary.startsWith('Error')
                              ? 'border-red-500/20 bg-red-500/5'
                              : executionSummary.includes('cancelled')
                              ? 'border-amber-500/20 bg-amber-500/5'
                              : 'border-emerald-500/20 bg-emerald-500/5'
                          )}
                        >
                          <BarChart3 className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            executionSummary.startsWith('Error')
                              ? 'text-red-400'
                              : executionSummary.includes('cancelled')
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          )} />
                          <span className="text-[11px] text-muted-foreground">{executionSummary}</span>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* ─── Empty State (when plan cleared) ─── */}
                  {!plan && !isGenerating && taskInput.trim() === '' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/30 p-5 text-center"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10">
                        <Lightbulb className="h-5 w-5 text-indigo-400/60" />
                      </div>
                      <p className="text-[11px] text-muted-foreground/70">{t.plan.noPlan}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

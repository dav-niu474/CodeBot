'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/use-locale';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
  ListChecks,
  RotateCcw,
  Zap,
} from 'lucide-react';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface TaskPlanItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface TaskPlanPanelProps {
  items: TaskPlanItem[];
  mode: 'single' | 'multi';
  modeLabel: string;
  isActive: boolean;
  userTask?: string;
  onDismiss?: () => void;
}

// ────────────────────────────────────────────
// Mode Color Configuration
// ────────────────────────────────────────────

const modeColorConfig: Record<
  'single' | 'multi',
  {
    gradientFrom: string;
    gradientTo: string;
    border: string;
    bg: string;
    color: string;
    colorDim: string;
    borderDim: string;
  }
> = {
  single: {
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-blue-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/5',
    color: 'text-sky-400',
    colorDim: 'text-sky-400/60',
    borderDim: 'border-sky-500/10',
  },
  multi: {
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-amber-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/5',
    color: 'text-orange-400',
    colorDim: 'text-orange-400/60',
    borderDim: 'border-orange-500/10',
  },
};

// ────────────────────────────────────────────
// Status Configuration
// ────────────────────────────────────────────

type StepStatus = TaskPlanItem['status'];

const statusConfig: Record<
  StepStatus,
  {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    border: string;
    animated: boolean;
  }
> = {
  pending: {
    icon: Circle,
    color: 'text-zinc-500',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    animated: false,
  },
  in_progress: {
    icon: Loader2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    animated: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    animated: false,
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    animated: false,
  },
};

// ────────────────────────────────────────────
// Animation Variants
// ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

// ────────────────────────────────────────────
// Utility: format elapsed time
// ────────────────────────────────────────────

function formatElapsed(ms: number): string {
  if (!ms || ms < 1000) return `${ms || 0}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

// ────────────────────────────────────────────
// Component: TaskPlanPanel
// ────────────────────────────────────────────

export function TaskPlanPanel({
  items,
  mode,
  modeLabel,
  isActive,
  userTask,
  onDismiss,
}: TaskPlanPanelProps) {
  const { t, locale } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, [isActive]);

  // Reset elapsed when inactive
  useEffect(() => {
    if (!isActive) {
      // Freeze elapsed at current value (keep showing it)
    }
  }, [isActive]);

  const cfg = modeColorConfig[mode];

  // Computed values
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isDone = !isActive && completedCount + failedCount === totalCount && totalCount > 0;

  // Total duration from completed items
  const totalDuration = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.duration || 0), 0);
  }, [items]);

  // Status badge labels (i18n)
  const statusLabels: Record<StepStatus, string> = {
    pending: locale === 'zh' ? '等待中' : 'Pending',
    in_progress: locale === 'zh' ? '进行中' : 'In Progress',
    completed: locale === 'zh' ? '已完成' : 'Done',
    failed: locale === 'zh' ? '失败' : 'Failed',
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="mx-auto max-w-4xl">
        {/* ─── Animated Gradient Accent Bar ─── */}
        <div className="relative h-[2px] overflow-hidden">
          <motion.div
            className={cn(
              'absolute inset-0 bg-gradient-to-r',
              cfg.gradientFrom,
              cfg.gradientTo,
            )}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ backgroundSize: '200% 100%' }}
          />
          {isActive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{
                opacity: [0, 0.6, 0],
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ width: '60%' }}
            />
          )}
        </div>

        {/* ─── Glassmorphism Card Body ─── */}
        <div className={cn('border-x border-b backdrop-blur-xl bg-card/80', cfg.borderDim)}>
          {/* ─── Collapsible Header ─── */}
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
              `hover:${cfg.bg}`,
            )}
          >
            {/* Icon */}
            <div className={cn(
              'relative flex h-7 w-7 items-center justify-center rounded-lg shadow-lg',
              cfg.bg,
              'ring-1',
              cfg.border,
            )}>
              <ListChecks className={cn('h-3.5 w-3.5', cfg.color)} />
              {isActive && (
                <motion.div
                  className={cn('absolute inset-0 rounded-lg ring-2', cfg.border)}
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>

            {/* Title & subtitle */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.taskPlan?.title ?? 'Task Plan'}
                </span>
                <Badge
                  variant="outline"
                  className={cn('gap-1 px-1.5 py-0 text-[9px] font-semibold', cfg.border, cfg.bg, cfg.color)}
                >
                  {modeLabel}
                </Badge>
                {totalCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {completedCount}/{totalCount} {t.taskPlan?.steps ?? 'steps'}
                  </span>
                )}
              </div>
              {/* Mini progress bar in header */}
              {totalCount > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-muted/80">
                    <motion.div
                      className={cn('h-full rounded-full bg-gradient-to-r', cfg.gradientFrom, cfg.gradientTo)}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    {progressPct}%
                  </span>
                </div>
              )}
            </div>

            {/* Right side: metrics */}
            <div className="flex items-center gap-2">
              {(isActive || elapsed > 0) && (
                <Badge
                  variant="outline"
                  className="gap-1 border-border/50 bg-muted/50 text-[9px] text-muted-foreground"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {formatElapsed(elapsed)}
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
                  {/* ─── User Task (if provided) ─── */}
                  {userTask && (
                    <motion.div
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      className="mb-2.5 rounded-lg border border-border/30 bg-muted/30 p-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className={cn('h-3 w-3', cfg.colorDim)} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t.taskPlan?.title ?? 'Task Plan'}
                        </span>
                      </div>
                      <p className={cn(
                        'text-[11px] leading-relaxed text-foreground/80',
                        userTask.length > 120 && 'line-clamp-2',
                      )}>
                        {userTask}
                      </p>
                    </motion.div>
                  )}

                  {/* ─── Progress Bar ─── */}
                  {totalCount > 0 && (
                    <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {completedCount}/{totalCount} {t.taskPlan?.steps ?? 'steps'}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                        <motion.div
                          className={cn('h-full rounded-full bg-gradient-to-r', cfg.gradientFrom, cfg.gradientTo)}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Steps Timeline ─── */}
                  <AnimatePresence mode="wait">
                    {totalCount > 0 && (
                      <motion.div
                        key="checklist"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-0"
                      >
                        {/* Section header */}
                        <motion.div variants={itemVariants} className="flex items-center gap-1.5 mb-2">
                          <ListChecks className={cn('h-3 w-3', cfg.colorDim)} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t.taskPlan?.subtitle ?? 'Agent execution steps'}
                          </span>
                        </motion.div>

                        {/* Task items */}
                        {items.map((item, index) => {
                          const isLast = index === items.length - 1;
                          const isExpanded = expandedItemId === item.id;
                          const sCfg = statusConfig[item.status];
                          const StatusIcon = sCfg.icon;
                          const stepNum = String(index + 1).padStart(2, '0');

                          return (
                            <motion.div
                              key={item.id}
                              variants={itemVariants}
                              className="relative"
                            >
                              {/* Timeline connector line */}
                              {!isLast && (
                                <div
                                  className={cn(
                                    'absolute left-[11px] top-5 h-[calc(100%-12px)] w-px',
                                    item.status === 'completed'
                                      ? cn('bg-gradient-to-b', cfg.gradientFrom, 'opacity-40')
                                      : 'bg-border/30',
                                  )}
                                />
                              )}

                              {/* Step Row */}
                              <button
                                type="button"
                                onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                                className={cn(
                                  'group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-all',
                                  isExpanded ? 'bg-muted/60' : 'hover:bg-muted/30',
                                  item.status === 'completed' && !isExpanded && 'opacity-70',
                                )}
                              >
                                {/* Status Icon */}
                                <div className="relative mt-0.5 shrink-0">
                                  <div className={cn(
                                    'flex h-5 w-5 items-center justify-center rounded-full transition-all',
                                    item.status === 'completed'
                                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                                      : item.status === 'failed'
                                        ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                                        : item.status === 'in_progress'
                                          ? cn('ring-1', sCfg.border, sCfg.bg, sCfg.color)
                                          : 'bg-muted/60 text-muted-foreground ring-1 ring-border/30',
                                  )}>
                                    <StatusIcon
                                      className={cn(
                                        'h-3 w-3',
                                        sCfg.color,
                                        sCfg.animated && 'animate-spin',
                                      )}
                                    />
                                  </div>
                                  {/* Pulse on active */}
                                  {item.status === 'in_progress' && (
                                    <motion.div
                                      className={cn('absolute -inset-0.5 rounded-full', cfg.border)}
                                      animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.4, 1] }}
                                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                  )}
                                </div>

                                {/* Step Content */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'text-[11px] font-medium truncate',
                                        item.status === 'completed' && !isExpanded
                                          ? 'text-muted-foreground line-through'
                                          : 'text-foreground',
                                      )}
                                    >
                                      {item.title}
                                    </span>
                                    {/* Status badge */}
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'gap-0.5 px-1.5 py-0 text-[9px] shrink-0',
                                        sCfg.border, sCfg.bg, sCfg.color,
                                      )}
                                    >
                                      {sCfg.animated && <Loader2 className="h-2 w-2 animate-spin" />}
                                      {statusLabels[item.status]}
                                    </Badge>
                                  </div>

                                  {/* Duration row */}
                                  {(item.duration || item.startedAt) && (
                                    <div className="mt-0.5 flex items-center gap-2">
                                      {item.duration ? (
                                        <span className="text-[10px] text-muted-foreground/50">
                                          <Clock className="mr-0.5 inline h-2 w-2" />
                                          {formatElapsed(item.duration)}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}

                                  {/* Expanded description */}
                                  <AnimatePresence>
                                    {isExpanded && item.description && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                          {item.description}
                                        </p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* Expand chevron */}
                                {item.description && (
                                  <ChevronDown
                                    className={cn(
                                      'mt-1 h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform duration-200',
                                      isExpanded && 'rotate-180',
                                    )}
                                  />
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ─── Empty State (loading skeleton) ─── */}
                  {totalCount === 0 && isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="space-y-2.5 py-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <Loader2 className={cn('h-3 w-3 animate-spin', cfg.colorDim)} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t.taskPlan?.thinking ?? 'Analyzing task...'}
                        </span>
                      </div>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-muted/60" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className={cn('h-3 w-', `${30 + i * 15}%`, ' animate-pulse rounded bg-muted/50')} />
                            <div className="h-2 w-16 animate-pulse rounded bg-muted/30" />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* ─── Summary Section (when done) ─── */}
                  {isDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                          {t.taskPlan?.summary ?? 'Summary'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">
                            {t.taskPlan?.time ?? 'Time'}
                          </div>
                          <div className="text-[11px] font-semibold tabular-nums text-foreground">
                            {formatElapsed(elapsed)}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">
                            {t.taskPlan?.totalSteps ?? 'Total'}
                          </div>
                          <div className="text-[11px] font-semibold tabular-nums text-foreground">
                            {totalCount} {t.taskPlan?.steps ?? 'steps'}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">
                            {t.taskPlan?.success ?? 'Success'}
                          </div>
                          <div className="text-[11px] font-semibold tabular-nums text-emerald-400">
                            {completedCount}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">
                            {t.taskPlan?.fail ?? 'Fail'}
                          </div>
                          <div className={cn(
                            'text-[11px] font-semibold tabular-nums',
                            failedCount > 0 ? 'text-red-400' : 'text-muted-foreground',
                          )}>
                            {failedCount}
                          </div>
                        </div>
                      </div>
                      {/* Dismiss button */}
                      {onDismiss && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={onDismiss}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            {t.taskPlan?.dismiss ?? 'Dismiss'}
                          </button>
                        </div>
                      )}
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

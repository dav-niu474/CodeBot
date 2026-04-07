'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/use-locale';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Network,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  Zap,
  ArrowRight,
  Terminal,
  Brain,
  Cpu,
  Layers,
  Copy,
  Eye,
  Timer,
  Sparkles,
  Play,
  RotateCcw,
  BarChart3,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type MultiAgentMode = 'coordinator' | 'swarm' | 'teammate';

export interface MultiAgentAgentInfo {
  id: string;
  name: string;
  status: 'spawning' | 'thinking' | 'executing' | 'done' | 'failed';
  tokens?: { input: number; output: number };
  result?: string;
  error?: string;
  task?: string;
}

export interface MultiAgentState {
  phase: 'idle' | 'spawning' | 'executing' | 'aggregating' | 'done';
  mode: MultiAgentMode | null;
  agents: MultiAgentAgentInfo[];
  totalAgents: number;
  completedAgents: number;
  totalTokens: number;
  configOpen: boolean;
  workerCount: number;
}

// ────────────────────────────────────────────
// Mode Configuration
// ────────────────────────────────────────────

const modeConfig: Record<
  MultiAgentMode,
  {
    label: string;
    icon: LucideIcon;
    color: string;
    colorDim: string;
    bg: string;
    border: string;
    borderDim: string;
    gradientFrom: string;
    gradientTo: string;
    accentHue: string; // for gradient accent bar
  }
> = {
  coordinator: {
    label: 'Coordinator',
    icon: Users,
    color: 'text-orange-400',
    colorDim: 'text-orange-400/60',
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/20',
    borderDim: 'border-orange-500/10',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-amber-400',
    accentHue: 'orange',
  },
  swarm: {
    label: 'Swarm',
    icon: Network,
    color: 'text-red-400',
    colorDim: 'text-red-400/60',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    borderDim: 'border-red-500/10',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-orange-400',
    accentHue: 'red',
  },
  teammate: {
    label: 'Teammate',
    icon: UserCheck,
    color: 'text-cyan-400',
    colorDim: 'text-cyan-400/60',
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/20',
    borderDim: 'border-cyan-500/10',
    gradientFrom: 'from-cyan-500',
    gradientTo: 'to-teal-400',
    accentHue: 'cyan',
  },
};

// ────────────────────────────────────────────
// Agent Status Configuration
// ────────────────────────────────────────────

type AgentStatus = MultiAgentAgentInfo['status'];

const agentStatusConfig: Record<
  AgentStatus,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: LucideIcon;
    animated: boolean;
  }
> = {
  spawning: {
    label: 'Spawning',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: Loader2,
    animated: true,
  },
  thinking: {
    label: 'Thinking',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: Brain,
    animated: true,
  },
  executing: {
    label: 'Executing',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: Cpu,
    animated: true,
  },
  done: {
    label: 'Done',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
    animated: false,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: XCircle,
    animated: false,
  },
};

// ────────────────────────────────────────────
// Phase Configuration
// ────────────────────────────────────────────

type Phase = MultiAgentState['phase'];

const phaseSteps: { key: Phase; labelEn: string; labelZh: string; icon: LucideIcon }[] = [
  { key: 'spawning', labelEn: 'Spawning agents', labelZh: '生成智能体', icon: Play },
  { key: 'executing', labelEn: 'Executing tasks', labelZh: '执行任务', icon: Cpu },
  { key: 'aggregating', labelEn: 'Aggregating results', labelZh: '聚合结果', icon: TrendingUp },
  { key: 'done', labelEn: 'Complete', labelZh: '已完成', icon: CheckCircle2 },
];

const phaseLabels: Record<Phase, string> = {
  idle: '',
  spawning: 'Spawning agents...',
  executing: 'Agents executing...',
  aggregating: 'Aggregating results...',
  done: 'Operation complete',
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
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ────────────────────────────────────────────
// Utility: get agent initials (up to 2 chars)
// ────────────────────────────────────────────

function getAgentInitials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ────────────────────────────────────────────
// Component: AgentProgressPanel
// ────────────────────────────────────────────

interface AgentProgressPanelProps {
  multiAgent: MultiAgentState;
  userTask?: string;
  onDismiss?: () => void;
}

export function AgentProgressPanel({ multiAgent, userTask, onDismiss }: AgentProgressPanelProps) {
  const { t, locale } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [taskExpanded, setTaskExpanded] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const isActive = multiAgent.phase === 'spawning' || multiAgent.phase === 'executing' || multiAgent.phase === 'aggregating';

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, multiAgent.phase]);

  // Reset elapsed when phase changes to idle
  useEffect(() => {
    if (multiAgent.phase === 'idle') {
      setElapsed(0);
    }
  }, [multiAgent.phase]);

  const cfg = multiAgent.mode ? modeConfig[multiAgent.mode] : null;
  const ModeIcon = cfg?.icon ?? Users;

  // Computed values
  const totalTaskCount = multiAgent.agents.length;
  const completedTaskCount = multiAgent.agents.filter(a => a.status === 'done' || a.status === 'failed').length;
  const failedCount = multiAgent.agents.filter(a => a.status === 'failed').length;
  const progressPct = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0;

  const totalInputTokens = multiAgent.agents.reduce((sum, a) => sum + (a.tokens?.input ?? 0), 0);
  const totalOutputTokens = multiAgent.agents.reduce((sum, a) => sum + (a.tokens?.output ?? 0), 0);
  const totalTokensCalc = totalInputTokens + totalOutputTokens;

  // Phase index for timeline
  const phaseOrder: Phase[] = ['spawning', 'executing', 'aggregating', 'done'];
  const currentPhaseIdx = phaseOrder.indexOf(multiAgent.phase);

  // Handle copy result
  const handleCopyResult = useCallback((agentId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(agentId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // Handle task click → expand agent
  const handleTaskClick = useCallback((agentId: string) => {
    setExpandedAgentId(prev => (prev === agentId ? null : agentId));
    if (isCollapsed) setIsCollapsed(false);
  }, [isCollapsed]);

  // ── Early return if no mode ──
  if (!cfg || !multiAgent.mode) return null;

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
        </div>

        {/* ─── Glassmorphism Card Body ─── */}
        <div className={cn(
          'border-x border-b backdrop-blur-xl',
          cfg.borderDim,
          'bg-zinc-900/60',
        )}>
          <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
            {/* ─── Collapsible Header ─── */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  `hover:${cfg.bg}`,
                )}
              >
                {/* Agent avatar with initials */}
                <div className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-lg font-bold text-[10px] shadow-lg',
                  cfg.bg,
                  'ring-1',
                  cfg.border,
                )}>
                  <ModeIcon className={cn('h-4 w-4', cfg.color)} />
                  {/* Sparkle/pulse animation on active agents */}
                  {isActive && (
                    <motion.div
                      className={cn(
                        'absolute inset-0 rounded-lg ring-2',
                        cfg.border,
                      )}
                      animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>

                {/* Title & subtitle */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {t.multiAgent.agents ?? 'Agent Progress'}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 px-1.5 py-0 text-[9px] font-semibold',
                        cfg.border, cfg.bg, cfg.color,
                      )}
                    >
                      {cfg.label}
                    </Badge>
                    {/* Phase step indicator */}
                    <AnimatePresence mode="wait">
                      {isActive && (
                        <motion.span
                          key={multiAgent.phase}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 4 }}
                          className={cn('text-[9px]', cfg.colorDim)}
                        >
                          {phaseLabels[multiAgent.phase]}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Mini progress bar in header */}
                  {totalTaskCount > 0 && (
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
                        {completedTaskCount}/{totalTaskCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right side: metrics */}
                <div className="flex items-center gap-2">
                  {/* Progress badge */}
                  {totalTaskCount > 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 px-1.5 py-0 text-[9px] tabular-nums',
                        cfg.border, cfg.bg, cfg.color,
                      )}
                    >
                      {progressPct}%
                    </Badge>
                  )}

                  {/* Token count */}
                  {(totalTokensCalc > 0 || multiAgent.totalTokens > 0) && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-border/50 bg-muted/50 text-[9px] text-muted-foreground"
                    >
                      <Zap className="h-2.5 w-2.5" />
                      {formatTokenCount(totalTokensCalc || multiAgent.totalTokens)}
                    </Badge>
                  )}

                  {/* Elapsed time */}
                  {(isActive || elapsed > 0) && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-border/50 bg-muted/50 text-[9px] text-muted-foreground"
                    >
                      <Timer className="h-2.5 w-2.5" />
                      {formatElapsed(elapsed)}
                    </Badge>
                  )}

                  {/* Collapse chevron */}
                  {isCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            {/* ─── Panel Body ─── */}
            <CollapsibleContent>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3">
                  {/* ─── Task Plan Section ─── */}
                  {userTask && (
                    <motion.div
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      className="mb-3 rounded-lg border border-border/30 bg-muted/30 p-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ClipboardList className={cn('h-3 w-3', cfg.colorDim)} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Task Plan
                        </span>
                      </div>
                      {/* User prompt (truncated, expandable) */}
                      <div className={cn(
                        'rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5',
                        !taskExpanded && 'cursor-pointer',
                      )}
                        onClick={() => setTaskExpanded(!taskExpanded)}
                      >
                        <p className={cn(
                          'text-[11px] leading-relaxed text-foreground/80',
                          !taskExpanded && 'line-clamp-2',
                        )}>
                          {userTask}
                        </p>
                        {!taskExpanded && userTask.length > 80 && (
                          <span className={cn('mt-0.5 inline-block text-[9px]', cfg.colorDim)}>
                            Click to expand
                          </span>
                        )}
                      </div>
                      {/* Plan breakdown timeline */}
                      <div className="mt-2 flex items-center gap-0">
                        {phaseSteps.slice(0, 3).map((step, idx) => {
                          const stepPhaseIdx = phaseOrder.indexOf(step.key);
                          const isStepActive = currentPhaseIdx >= stepPhaseIdx;
                          const StepIcon = step.icon;
                          return (
                            <div key={step.key} className="flex items-center gap-0">
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  'flex h-5 w-5 items-center justify-center rounded-full transition-colors',
                                  isStepActive ? cfg.bg : 'bg-muted/50',
                                )}>
                                  <StepIcon className={cn(
                                    'h-2.5 w-2.5',
                                    isStepActive ? cfg.color : 'text-zinc-500',
                                  )} />
                                </div>
                                <span className={cn(
                                  'mt-0.5 text-[8px]',
                                  isStepActive ? 'text-foreground/70' : 'text-muted-foreground/40',
                                )}>
                                  {locale === 'zh' ? step.labelZh : step.labelEn}
                                </span>
                              </div>
                              {idx < 2 && (
                                <div className={cn(
                                  'h-px w-6 mx-1 mb-3 transition-colors',
                                  isStepActive ? cn('bg-gradient-to-r', cfg.gradientFrom, cfg.gradientTo, 'opacity-50') : 'bg-border/30',
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Overall Progress Timeline Bar ─── */}
                  {totalTaskCount > 0 && (
                    <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {completedTaskCount}/{totalTaskCount} {t.multiAgent.agents.toLowerCase() ?? 'agents'}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{progressPct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                        <motion.div
                          className={cn('h-full rounded-full bg-gradient-to-r', cfg.gradientFrom, cfg.gradientTo)}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  )}

                  <AnimatePresence mode="wait">
                    {/* ─── Task Checklist Section ─── */}
                    {totalTaskCount > 0 && (
                      <motion.div
                        key="checklist"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-0"
                      >
                        {/* Section header */}
                        <motion.div variants={itemVariants} className="flex items-center gap-1.5 mb-2">
                          <Layers className={cn('h-3 w-3', cfg.colorDim)} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Task Checklist
                          </span>
                          <span className="text-[9px] text-muted-foreground/40">
                            {totalTaskCount} subtasks
                          </span>
                        </motion.div>

                        {/* Task items */}
                        {multiAgent.agents.map((agent, index) => {
                          const isLast = index === multiAgent.agents.length - 1;
                          const isExpanded = expandedAgentId === agent.id;
                          const statusCfg = agentStatusConfig[agent.status];
                          const StatusIcon = statusCfg.icon;
                          const tokenTotal = agent.tokens ? agent.tokens.input + agent.tokens.output : 0;
                          const isActiveAgent = statusCfg.animated;
                          const stepNum = String(index + 1).padStart(2, '0');

                          return (
                            <motion.div
                              key={agent.id}
                              variants={itemVariants}
                              className="relative"
                            >
                              {/* Timeline connector line */}
                              {!isLast && (
                                <div
                                  className={cn(
                                    'absolute left-[15px] top-8 h-[calc(100%-16px)] w-px',
                                    agent.status === 'done'
                                      ? cn('bg-gradient-to-b', cfg.gradientFrom, 'opacity-40')
                                      : 'bg-border/30',
                                  )}
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => handleTaskClick(agent.id)}
                                className={cn(
                                  'group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-all',
                                  isExpanded ? 'bg-muted/60' : 'hover:bg-muted/30',
                                  agent.status === 'done' && !isExpanded && 'opacity-70',
                                )}
                              >
                                {/* Step number with agent avatar circle */}
                                <div className="relative mt-0.5 shrink-0">
                                  <div className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold transition-all',
                                    agent.status === 'done'
                                      ? cn('bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30')
                                      : agent.status === 'failed'
                                        ? cn('bg-red-500/15 text-red-400 ring-1 ring-red-500/30')
                                        : isActiveAgent
                                          ? cn('bg-gradient-to-br', cfg.bg, 'ring-1', cfg.border, 'text-foreground/80')
                                          : 'bg-muted/60 text-muted-foreground ring-1 ring-border/30',
                                  )}>
                                    {agent.status === 'done' ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : agent.status === 'failed' ? (
                                      <XCircle className="h-3.5 w-3.5" />
                                    ) : isActiveAgent ? (
                                      <StatusIcon className={cn('h-3.5 w-3.5', statusCfg.color, statusCfg.animated && 'animate-spin')} />
                                    ) : (
                                      stepNum
                                    )}
                                  </div>
                                  {/* Sparkle pulse on active agent */}
                                  {isActiveAgent && (
                                    <motion.div
                                      className={cn(
                                        'absolute -inset-0.5 rounded-full',
                                        cfg.border,
                                      )}
                                      animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.3, 1] }}
                                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                  )}
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'text-[11px] font-medium truncate',
                                        agent.status === 'done' && !isExpanded
                                          ? 'text-muted-foreground line-through'
                                          : 'text-foreground',
                                      )}
                                    >
                                      {agent.task || agent.name}
                                    </span>
                                    {/* Status badge */}
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'gap-0.5 px-1.5 py-0 text-[9px] shrink-0',
                                        statusCfg.border, statusCfg.bg, statusCfg.color,
                                      )}
                                    >
                                      {statusCfg.animated && <Loader2 className="h-2 w-2 animate-spin" />}
                                      {statusCfg.label}
                                    </Badge>
                                  </div>

                                  {/* Agent name + token count row */}
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/50">
                                      {agent.name}
                                    </span>
                                    {tokenTotal > 0 && (
                                      <>
                                        <span className="text-[9px] text-muted-foreground/30">·</span>
                                        <span className="text-[10px] text-muted-foreground/50">
                                          <Zap className="mr-0.5 inline h-2 w-2" />
                                          {formatTokenCount(tokenTotal)} tokens
                                        </span>
                                      </>
                                    )}
                                    {(isActive || elapsed > 0) && (
                                      <>
                                        <span className="text-[9px] text-muted-foreground/30">·</span>
                                        <span className="text-[10px] text-muted-foreground/50">
                                          <Clock className="mr-0.5 inline h-2 w-2" />
                                          {formatElapsed(elapsed)}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Expanded: agent detail card */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <AgentDetailCard
                                          agent={agent}
                                          modeColor={cfg}
                                          copiedId={copiedId}
                                          onCopy={handleCopyResult}
                                        />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* Expand chevron */}
                                {(!!agent.result || !!agent.error) && (
                                  <ChevronRight
                                    className={cn(
                                      'mt-1 h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform duration-200',
                                      isExpanded && 'rotate-90',
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

                  {/* ─── Summary Section (when phase is 'done') ─── */}
                  {multiAgent.phase === 'done' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                          Summary
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">Time</div>
                          <div className="text-[11px] font-semibold tabular-nums text-foreground">
                            {formatElapsed(elapsed)}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">Tokens</div>
                          <div className="text-[11px] font-semibold tabular-nums text-foreground">
                            {formatTokenCount(totalTokensCalc || multiAgent.totalTokens)}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">Success</div>
                          <div className="text-[11px] font-semibold tabular-nums text-emerald-400">
                            {completedTaskCount - failedCount}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/20 bg-card/40 px-2.5 py-1.5">
                          <div className="text-[9px] text-muted-foreground/50 mb-0.5">Failed</div>
                          <div className={cn(
                            'text-[11px] font-semibold tabular-nums',
                            failedCount > 0 ? 'text-red-400' : 'text-muted-foreground',
                          )}>
                            {failedCount}
                          </div>
                        </div>
                      </div>
                      {/* Aggregated result preview */}
                      {multiAgent.agents.length > 0 && multiAgent.agents.some(a => a.result) && (
                        <div className="mt-2 rounded-md border border-border/20 bg-card/30 px-2.5 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Eye className="h-2.5 w-2.5 text-muted-foreground/40" />
                            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Result Preview</span>
                          </div>
                          <div className="max-h-24 overflow-y-auto custom-scrollbar">
                            {multiAgent.agents.filter(a => a.result).map(a => (
                              <div key={a.id} className="mb-1.5 last:mb-0">
                                <span className="text-[9px] font-medium text-foreground/60">{a.name}:</span>
                                <p className="text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
                                  {a.result}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Dismiss button */}
                      {onDismiss && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={onDismiss}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            {t.multiAgent.dismiss ?? 'Dismiss'}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Sub-component: Agent Detail Card (inline in checklist)
// ────────────────────────────────────────────

interface AgentDetailCardProps {
  agent: MultiAgentAgentInfo;
  modeColor: typeof modeConfig[MultiAgentMode];
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

function AgentDetailCard({ agent, modeColor, copiedId, onCopy }: AgentDetailCardProps) {
  const statusCfg = agentStatusConfig[agent.status];
  const StatusIcon = statusCfg.icon;
  const tokenTotal = agent.tokens ? agent.tokens.input + agent.tokens.output : 0;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/30 bg-card/60 p-2.5 backdrop-blur-sm">
      {/* Agent header with avatar */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold',
          modeColor.bg,
          'ring-1',
          modeColor.border,
          modeColor.color,
        )}>
          {getAgentInitials(agent.name)}
        </div>
        <span className="text-[11px] font-medium text-foreground">{agent.name}</span>
        <Badge
          variant="outline"
          className={cn(
            'ml-auto gap-0.5 px-1.5 py-0 text-[9px]',
            statusCfg.border, statusCfg.bg, statusCfg.color,
          )}
        >
          <StatusIcon
            className={cn('h-2.5 w-2.5', statusCfg.animated && 'animate-spin')}
          />
          {statusCfg.label}
        </Badge>
      </div>

      {/* Token usage breakdown */}
      {tokenTotal > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-muted-foreground">
            <ArrowRight className="mr-0.5 inline h-2.5 w-2.5 text-sky-400/60" />
            In: {formatTokenCount(agent.tokens!.input)}
          </span>
          <span className="text-[9px] text-muted-foreground">
            <ArrowRight className="mr-0.5 inline h-2.5 w-2.5 text-emerald-400/60 rotate-180" />
            Out: {formatTokenCount(agent.tokens!.output)}
          </span>
        </div>
      )}

      {/* Result preview */}
      {agent.result && (
        <div className="relative group">
          <pre className="max-h-32 overflow-y-auto rounded-md border border-border/20 bg-muted/40 p-2 text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words custom-scrollbar">
            {agent.result}
          </pre>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(agent.id, agent.result!);
            }}
            className={cn(
              'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md transition-all',
              copiedId === agent.id
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-card/80 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground',
            )}
            title="Copy result"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Error */}
      {agent.error && (
        <p className="text-[10px] leading-relaxed text-red-400/80 bg-red-500/5 rounded-md px-2 py-1.5">
          {agent.error}
        </p>
      )}
    </div>
  );
}

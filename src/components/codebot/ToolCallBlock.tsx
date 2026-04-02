'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, FileText, FilePlus, Pencil, FolderSearch, Search, Globe, Link,
  Bot, MessageSquare, ListTodo, HelpCircle, BookOpen, FileBarChart,
  CheckCircle2, XCircle, Loader2, ChevronDown, Clock, Shield,
  Plug, ScanLine, Sparkles, List, FileInput, SearchCode, ClipboardList,
  GitBranch, GitMerge, PlusCircle, ListChecks, FileOutput, CircleStop,
  RefreshCw, Plan, Play, ShieldAlert, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ToolCallDisplay } from '@/lib/types';

// ────────────────────────────────────────────
// Tool name to icon mapping
// ────────────────────────────────────────────
const TOOL_ICONS: Record<string, LucideIcon> = {
  bash: Terminal,
  powershell: Terminal,
  'file-read': FileText,
  'file-write': FilePlus,
  'file-edit': Pencil,
  glob: FolderSearch,
  grep: Search,
  agent: Bot,
  'web-search': Globe,
  'web-fetch': Link,
  'send-message': MessageSquare,
  'todo-write': ListTodo,
  'ask-user': HelpCircle,
  'notebook-edit': BookOpen,
  brief: FileBarChart,
  mcp: Plug,
  lsp: ScanLine,
  skill: Sparkles,
  'list-mcp-resources': List,
  'read-mcp-resource': FileInput,
  'mcp-auth': Shield,
  'tool-search': SearchCode,
  'enter-plan-mode': Plan,
  'exit-plan-mode': Play,
  'enter-worktree': GitBranch,
  'exit-worktree': GitMerge,
  'task-create': PlusCircle,
  'task-get': ClipboardList,
  'task-list': ListChecks,
  'task-output': FileOutput,
  'task-stop': CircleStop,
  'task-update': RefreshCw,
  'team-create': Bot,
  'team-delete': Bot,
  'synthetic-output': FileOutput,
  config: Zap,
  'remote-trigger': Zap,
  'schedule-cron': Clock,
};

// ────────────────────────────────────────────
// Tool name to display name mapping
// ────────────────────────────────────────────
const TOOL_NAMES: Record<string, string> = {
  bash: 'Bash',
  powershell: 'PowerShell',
  'file-read': 'Read File',
  'file-write': 'Write File',
  'file-edit': 'Edit File',
  glob: 'Glob',
  grep: 'Grep',
  agent: 'Sub-Agent',
  'web-search': 'Web Search',
  'web-fetch': 'Web Fetch',
  'send-message': 'Send Message',
  'todo-write': 'Todo Write',
  'ask-user': 'Ask User',
  'notebook-edit': 'Notebook Edit',
  brief: 'Brief',
  mcp: 'MCP',
  lsp: 'LSP',
  skill: 'Skill',
  'list-mcp-resources': 'MCP Resources',
  'read-mcp-resource': 'Read Resource',
  'mcp-auth': 'MCP Auth',
  'tool-search': 'Tool Search',
  'enter-plan-mode': 'Plan Mode',
  'exit-plan-mode': 'Exit Plan',
  'enter-worktree': 'Enter Worktree',
  'exit-worktree': 'Exit Worktree',
  'task-create': 'Create Task',
  'task-get': 'Get Task',
  'task-list': 'List Tasks',
  'task-output': 'Task Output',
  'task-stop': 'Stop Task',
  'task-update': 'Update Task',
  'team-create': 'Create Team',
  'team-delete': 'Delete Team',
  'synthetic-output': 'Output',
  config: 'Config',
  'remote-trigger': 'Remote Trigger',
  'schedule-cron': 'Cron Job',
};

// ────────────────────────────────────────────
// Risk level colors & labels
// ────────────────────────────────────────────
const RISK_CONFIG: Record<string, {
  color: string;
  bg: string;
  border: string;
  badge: string;
  glow: string;
  label: string;
  icon: LucideIcon;
}> = {
  low: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/[0.06]',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    glow: '',
    label: 'Low',
    icon: Shield,
  },
  medium: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/[0.06]',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    glow: '',
    label: 'Medium',
    icon: Shield,
  },
  high: {
    color: 'text-red-400',
    bg: 'bg-red-500/[0.06]',
    border: 'border-red-500/20',
    badge: 'bg-red-500/10 border-red-500/20 text-red-400',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.08)]',
    label: 'High',
    icon: ShieldAlert,
  },
  critical: {
    color: 'text-red-400',
    bg: 'bg-red-500/[0.08]',
    border: 'border-red-500/30',
    badge: 'bg-red-500/15 border-red-500/30 text-red-400',
    glow: 'shadow-[0_0_16px_rgba(239,68,68,0.12)]',
    label: 'Critical',
    icon: ShieldAlert,
  },
};

// ────────────────────────────────────────────
// Argument formatting helper
// ────────────────────────────────────────────
function formatArguments(argsStr: string): string {
  try {
    const parsed = JSON.parse(argsStr);
    if (typeof parsed === 'string') return parsed;
    return Object.entries(parsed)
      .map(([key, value]) => {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        // Truncate long values
        const truncated = val.length > 80 ? val.slice(0, 77) + '...' : val;
        return `${key}: ${truncated}`;
      })
      .join(', ');
  } catch {
    return argsStr.length > 100 ? argsStr.slice(0, 97) + '...' : argsStr;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ────────────────────────────────────────────
// Animation variants
// ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

// ────────────────────────────────────────────
// ToolCallBlock Component
// ────────────────────────────────────────────
interface ToolCallBlockProps {
  toolCall: ToolCallDisplay;
  isLatest?: boolean;
}

export function ToolCallBlock({ toolCall, isLatest }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const risk = RISK_CONFIG[toolCall.riskLevel || 'low'] || RISK_CONFIG.low;
  const Icon = TOOL_ICONS[toolCall.toolName] || Terminal;
  const displayName = TOOL_NAMES[toolCall.toolName] || toolCall.toolName;
  const isActive = toolCall.status === 'executing' || toolCall.status === 'pending';
  const isSuccess = toolCall.status === 'success';
  const isError = toolCall.status === 'error';
  const isWaiting = toolCall.status === 'waiting_approval';

  const formattedArgs = useMemo(() => formatArguments(toolCall.arguments), [toolCall.arguments]);

  // Determine border and accent colors based on status and risk
  const borderClass = cn(
    'border rounded-lg',
    isWaiting && 'border-amber-500/30',
    isError && 'border-red-500/25',
    isSuccess && risk.border,
    isActive && risk.border,
    !isError && !isSuccess && !isActive && !isWaiting && 'border-border/50',
  );

  const bgClass = cn(
    'rounded-lg',
    isWaiting && 'bg-amber-500/[0.04]',
    isError && 'bg-red-500/[0.04]',
    isSuccess && risk.bg,
    isActive && risk.bg,
    !isError && !isSuccess && !isActive && !isWaiting && 'bg-zinc-900/60',
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={cn('group relative', bgClass, borderClass, risk.glow, isLatest && isActive && 'animate-in fade-in slide-in-from-bottom-2 duration-300')}
    >
      {/* Header row — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Tool Icon */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
            isActive && `${risk.bg} ${risk.border} ${risk.color}`,
            isSuccess && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            isError && 'bg-red-500/10 border-red-500/20 text-red-400',
            isWaiting && 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            !toolCall.status && 'bg-zinc-800 border-border/50 text-muted-foreground',
          )}
        >
          {isActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : isError ? (
            <XCircle className="h-3.5 w-3.5" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Tool Name Badge */}
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 border font-mono text-[10px] font-semibold px-1.5 py-0 h-5',
            isActive && risk.badge,
            isSuccess && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            isError && 'bg-red-500/10 border-red-500/20 text-red-400',
            isWaiting && 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            !toolCall.status && 'bg-zinc-800/50 border-border/50 text-muted-foreground',
          )}
        >
          {displayName}
        </Badge>

        {/* Arguments preview (truncated) */}
        <span className="flex-1 truncate text-[11px] font-mono text-muted-foreground/70">
          {formattedArgs}
        </span>

        {/* Risk level indicator */}
        {toolCall.riskLevel && (
          <span className={cn('shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full border', risk.badge)}>
            {risk.label}
          </span>
        )}

        {/* Status indicator for waiting approval */}
        {isWaiting && (
          <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse">
            Awaiting Approval
          </span>
        )}

        {/* Duration display */}
        {toolCall.duration != null && toolCall.duration > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[9px] text-muted-foreground/50">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(toolCall.duration)}
          </span>
        )}

        {/* Expand chevron */}
        {(toolCall.result || toolCall.arguments) && (
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-3 py-2 space-y-2">
              {/* Full arguments */}
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1 block">
                  Arguments
                </span>
                <pre className="rounded-md border border-border/30 bg-zinc-950/80 p-2 text-[11px] font-mono text-muted-foreground/80 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(toolCall.arguments), null, 2);
                    } catch {
                      return toolCall.arguments;
                    }
                  })()}
                </pre>
              </div>

              {/* Result output (if available) */}
              {toolCall.result && (
                <div>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1 flex items-center gap-1">
                    Output
                    {isSuccess && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                    {isError && <XCircle className="h-2.5 w-2.5 text-red-400" />}
                  </span>
                  <pre
                    className={cn(
                      'rounded-md border p-2 text-[11px] font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto',
                      isError
                        ? 'border-red-500/20 bg-red-500/[0.04] text-red-300/80'
                        : 'border-border/30 bg-zinc-950/80 text-emerald-200/70',
                    )}
                  >
                    {toolCall.result}
                  </pre>
                </div>
              )}

              {/* Timestamps */}
              {(toolCall.startedAt || toolCall.completedAt) && (
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40">
                  {toolCall.startedAt && (
                    <span>Started: {new Date(toolCall.startedAt).toLocaleTimeString()}</span>
                  )}
                  {toolCall.completedAt && (
                    <span>Completed: {new Date(toolCall.completedAt).toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active execution shimmer bar */}
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

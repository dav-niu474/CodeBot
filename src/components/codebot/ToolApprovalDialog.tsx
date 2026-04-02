'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldAlert, ShieldCheck, Ban, Check,
  Terminal, AlertTriangle, ChevronDown,
  FileText, FilePlus, Pencil, FolderSearch, Search, Globe, Link,
  Bot, MessageSquare, ListTodo, HelpCircle, BookOpen, FileBarChart,
  Plug, ScanLine, Sparkles, List, FileInput, SearchCode,
  GitBranch, GitMerge, PlusCircle, ListChecks, FileOutput, CircleStop,
  RefreshCw, Plan, Play, Zap, Clock,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ToolCallDisplay } from '@/lib/types';

// ────────────────────────────────────────────
// Tool name to icon name mapping (string-based for JSX rendering)
// ────────────────────────────────────────────
const TOOL_ICON_MAP: Record<string, string> = {
 bash: 'Terminal',
 powershell: 'Terminal',
 'file-read': 'FileText',
 'file-write': 'FilePlus',
 'file-edit': 'Pencil',
 glob: 'FolderSearch',
 grep: 'Search',
 agent: 'Bot',
 'web-search': 'Globe',
 'web-fetch': 'Link',
 'send-message': 'MessageSquare',
 'todo-write': 'ListTodo',
 'ask-user': 'HelpCircle',
 'notebook-edit': 'BookOpen',
 brief: 'FileBarChart',
 mcp: 'Plug',
 lsp: 'ScanLine',
 skill: 'Sparkles',
 'list-mcp-resources': 'List',
 'read-mcp-resource': 'FileInput',
 'mcp-auth': 'Shield',
 'tool-search': 'SearchCode',
 'enter-plan-mode': 'Plan',
 'exit-plan-mode': 'Play',
 'enter-worktree': 'GitBranch',
 'exit-worktree': 'GitMerge',
 'task-create': 'PlusCircle',
 'task-get': 'ListChecks',
 'task-list': 'ListChecks',
 'task-output': 'FileOutput',
 'task-stop': 'CircleStop',
 'task-update': 'RefreshCw',
 'team-create': 'Bot',
 'team-delete': 'Bot',
 'synthetic-output': 'FileOutput',
 config: 'Zap',
 'remote-trigger': 'Zap',
 'schedule-cron': 'Clock',
};

// Map icon names to actual icon components
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Terminal, FileText, FilePlus, Pencil, FolderSearch, Search, Globe, Link,
  Bot, MessageSquare, ListTodo, HelpCircle, BookOpen, FileBarChart,
  Plug, ScanLine, Sparkles, List, FileInput, SearchCode,
  GitBranch, GitMerge, PlusCircle, ListChecks, FileOutput, CircleStop,
  RefreshCw, Plan, Play, Zap, Clock,
};

function formatArguments(argsStr: string): string {
  try {
    const parsed = JSON.parse(argsStr);
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return argsStr;
  }
}

// ────────────────────────────────────────────
// Animation variants
// ────────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 5,
    transition: { duration: 0.15 },
  },
};

// ────────────────────────────────────────────
// Risk level config for the dialog
// ────────────────────────────────────────────
const RISK_CONFIG = {
  medium: {
    icon: Shield,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/[0.04]',
    headerBg: 'bg-amber-500/[0.08]',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-400',
    descColor: 'text-amber-200/80',
    glow: 'shadow-[0_0_24px_rgba(245,158,11,0.08)]',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    label: 'Medium Risk',
  },
  high: {
    icon: ShieldAlert,
    border: 'border-red-500/30',
    bg: 'bg-red-500/[0.04]',
    headerBg: 'bg-red-500/[0.08]',
    iconColor: 'text-red-400',
    titleColor: 'text-red-400',
    descColor: 'text-red-200/80',
    glow: 'shadow-[0_0_24px_rgba(239,68,68,0.1)]',
    badge: 'bg-red-500/10 border-red-500/20 text-red-400',
    label: 'High Risk',
  },
  critical: {
    icon: ShieldAlert,
    border: 'border-red-500/40',
    bg: 'bg-red-500/[0.06]',
    headerBg: 'bg-red-500/[0.1]',
    iconColor: 'text-red-400',
    titleColor: 'text-red-400 font-bold',
    descColor: 'text-red-200/90',
    glow: 'shadow-[0_0_32px_rgba(239,68,68,0.15)]',
    badge: 'bg-red-500/15 border-red-500/30 text-red-400 font-bold',
    label: 'Critical Risk',
  },
} as const;

// ────────────────────────────────────────────
// ToolApprovalDialog Component
// ────────────────────────────────────────────
export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  arguments: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
}

export function ToolApprovalDialog({
  request,
  onApprove,
  onDeny,
  onAlwaysAllow,
}: ToolApprovalDialogProps) {
  const [expanded, setExpanded] = useState(false);

  const risk = RISK_CONFIG[request.riskLevel] || RISK_CONFIG.high;
  const RiskIcon = risk.icon;
  const toolIconName = TOOL_ICON_MAP[request.toolName] || 'Terminal';
  const ToolIconComponent = ICON_COMPONENTS[toolIconName] || Terminal;

  const formattedArgs = useMemo(() => formatArguments(request.arguments), [request.arguments]);

  return (
    <AnimatePresence>
      <motion.div
        key="approval-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onDeny();
        }}
      >
        <motion.div
          key="approval-dialog"
          variants={dialogVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'w-full max-w-md rounded-xl border bg-zinc-900 shadow-2xl',
            risk.border,
            risk.glow,
          )}
        >
          {/* Header with risk icon */}
          <div className={cn('flex items-center gap-3 rounded-t-xl px-5 py-4 border-b', risk.headerBg, risk.border)}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <RiskIcon className={cn('h-6 w-6', risk.iconColor)} />
            </motion.div>
            <div className="flex-1">
              <h3 className={cn('text-sm font-semibold', risk.titleColor)}>
                Permission Required
              </h3>
              <p className="text-[11px] text-muted-foreground/60">
                This tool requires your approval to execute
              </p>
            </div>
            <Badge variant="outline" className={cn('text-[10px] border px-2 py-0', risk.badge)}>
              {risk.label}
            </Badge>
          </div>

          {/* Tool details */}
          <div className="px-5 py-4 space-y-3">
            {/* Tool info row */}
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border',
                risk.bg, risk.border, risk.iconColor,
              )}>
                <ToolIconComponent className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold font-mono text-foreground">
                  {request.toolName}
                </span>
                <p className="text-[10px] text-muted-foreground/60 font-mono">
                  ID: {request.toolCallId}
                </p>
              </div>
            </div>

            {/* Arguments section */}
            <div>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left"
              >
                <AlertTriangle className={cn('h-3.5 w-3.5', risk.iconColor)} />
                <span className="text-xs font-medium text-foreground">Tool Arguments</span>
                <ChevronDown className={cn(
                  'ml-auto h-3 w-3 text-muted-foreground/40 transition-transform duration-200',
                  expanded && 'rotate-180',
                )} />
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 rounded-lg border border-border/30 bg-zinc-950/80 p-3 text-[11px] font-mono text-muted-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {formattedArgs}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Warning message */}
            <div className={cn('flex items-start gap-2 rounded-lg border p-2.5', risk.bg, risk.border)}>
              <AlertTriangle className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', risk.iconColor)} />
              <p className={cn('text-[11px] leading-relaxed', risk.descColor)}>
                {request.riskLevel === 'critical'
                  ? 'This action could have irreversible consequences. Please review the arguments carefully before approving.'
                  : request.riskLevel === 'high'
                  ? 'This tool can modify your system. Make sure you trust the arguments before allowing execution.'
                  : 'This tool performs a potentially sensitive operation. Review the arguments if needed.'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-t border-border/30 px-5 py-3.5 bg-zinc-950/40 rounded-b-xl">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeny}
              className="flex-1 gap-1.5 h-8 text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
            >
              <Ban className="h-3.5 w-3.5" />
              Deny
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onApprove}
              className="flex-1 gap-1.5 h-8 text-xs border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/30"
            >
              <Check className="h-3.5 w-3.5" />
              Allow Once
            </Button>
            <Button
              size="sm"
              onClick={onAlwaysAllow}
              className="flex-1 gap-1.5 h-8 text-xs bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/10"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Always Allow
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

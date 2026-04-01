'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { FeatureFlag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  MessageSquare,
  Wrench,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  Activity,
  Cpu,
  Brain,
  Eye,
  Globe,
  Code,
  Shield,
  Layers,
  Users,
  Database,
  FileBarChart,
  HardDrive,
  Hash,
  CheckCircle,
  ToggleRight,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// ── Animation Variants ──────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Feature Flag Names ──────────────────────────
const FEATURE_FLAG_LIST: { flag: FeatureFlag; label: string }[] = [
  { flag: 'KAIROS', label: 'KAIROS' },
  { flag: 'PROACTIVE', label: 'Proactive' },
  { flag: 'VOICE', label: 'Voice' },
  { flag: 'COORDINATOR', label: 'Coordinator' },
  { flag: 'SWARM', label: 'Swarm' },
  { flag: 'BRIDGE', label: 'Bridge' },
  { flag: 'DREAM', label: 'Dream' },
  { flag: 'MAGIC_DOCS', label: 'Magic Docs' },
  { flag: 'TEAM_SYNC', label: 'Team Sync' },
  { flag: 'ULTRAPLAN', label: 'UltraPlan' },
  { flag: 'MCP', label: 'MCP' },
  { flag: 'LSP', label: 'LSP' },
  { flag: 'POWER_SHELL', label: 'PowerShell' },
  { flag: 'REPL', label: 'REPL' },
  { flag: 'SLEEP', label: 'Sleep' },
  { flag: 'CRON', label: 'Cron' },
];

// ── Complete Capabilities Checklist ──────────────
interface CapabilityItem {
  text: string;
  detail: string;
}

const COMPLETE_CAPABILITIES: CapabilityItem[] = [
  {
    text: '44 Tools',
    detail: '14 Core + 25 Lazy + 5 Flag-gated',
  },
  {
    text: '10 Running Modes',
    detail: 'Interactive to Dream autonomous mode',
  },
  {
    text: '3 Multi-Agent Routes',
    detail: 'Coordinator, Swarm, Teammate',
  },
  {
    text: '4-Layer Memory System',
    detail: 'Session → Memdir → Magic Docs → Team Sync',
  },
  {
    text: '7-Layer Security',
    detail: 'Permissions to Secret Scanning',
  },
  {
    text: 'Token Compression',
    detail: 'Snip + Auto + Responsive',
  },
  {
    text: 'DreamTask Auto-Memory',
    detail: 'Background async task processing',
  },
  {
    text: 'Magic Docs Auto-Documentation',
    detail: 'Auto-generated project summaries',
  },
  {
    text: 'NVIDIA Multi-Model Support',
    detail: '161 models across 6 categories',
  },
  {
    text: 'Command Palette',
    detail: 'Cmd+K quick navigation & actions',
  },
  {
    text: 'Git Integration',
    detail: 'Commit log, branches, diff view',
  },
  {
    text: 'Chat Export',
    detail: 'Export conversations to Markdown',
  },
  {
    text: 'Session Manager',
    detail: 'Create, search, rename, and delete chat sessions',
  },
  {
    text: 'Token Analytics',
    detail: 'Usage dashboard with model comparison and cost tracking',
  },
];

// ── Quick Actions ───────────────────────────────
interface QuickAction {
  label: string;
  view: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'New Chat',
    view: 'chat',
    icon: MessageSquare,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Browse Models',
    view: 'model-hub',
    icon: Cpu,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    label: 'Manage Tools',
    view: 'tools',
    icon: Wrench,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'View Memory',
    view: 'memory',
    icon: Database,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
  {
    label: 'Agent Sessions',
    view: 'agents',
    icon: Users,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    label: 'Security Settings',
    view: 'security',
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
];

// ── Animated Counter Hook ───────────────────────
function useAnimatedCounter(target: number, duration: number = 1000) {
  const [count, setCount] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    if (target === 0) {
      return;
    }
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

// ── Mode Color Map ──────────────────────────────
const modeColors: Record<string, { color: string; bg: string }> = {
  interactive: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  kairos: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  plan: { color: 'text-sky-400', bg: 'bg-sky-500/10' },
  worktree: { color: 'text-green-400', bg: 'bg-green-500/10' },
  voice: { color: 'text-violet-400', bg: 'bg-violet-500/10' },
  coordinator: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  swarm: { color: 'text-red-400', bg: 'bg-red-500/10' },
  teammate: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ultraplan: { color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  dream: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

// ── Component ───────────────────────────────────
export function DashboardView() {
  const {
    sessions,
    messages,
    tools,
    skills,
    agentConfig,
    aiCapabilities,
    activeMode,
    selectedModel,
    featureFlags,
    setActiveView,
    setActiveSession,
  } = useChatStore();

  const enabledTools = tools.filter((t) => t.isEnabled).length;
  const enabledSkills = skills.filter((s) => s.isEnabled).length;
  const enabledCaps = aiCapabilities.filter((c) => c.isEnabled).length;
  const totalTokens = messages.reduce((acc, m) => acc + m.tokens, 0);

  const enabledFlagsCount = Object.values(featureFlags).filter(Boolean).length;
  const totalFlags = FEATURE_FLAG_LIST.length;

  const animTokens = useAnimatedCounter(totalTokens, 1200);
  const animSessions = useAnimatedCounter(sessions.length, 800);
  const animFlags = useAnimatedCounter(enabledFlagsCount, 600);

  const mc = modeColors[activeMode] || modeColors.interactive;

  const recentSessions = sessions.slice(0, 5);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={item} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20 codebot-glow">
              <span className="text-2xl">{agentConfig.avatar}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                  CodeBot Agent v2.5
                </h1>
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400"
                >
                  Claude Code Architecture
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Comprehensive AI coding agent — 44 tools, 10 modes, 7-layer security, multi-agent orchestration
              </p>
            </div>
          </div>
        </motion.div>

        {/* Hero Stats Row */}
        <motion.div variants={item} className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Total Sessions',
                value: animSessions,
                icon: <MessageSquare className="h-4 w-4" />,
                gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
                iconBg: 'bg-emerald-500/15',
                iconColor: 'text-emerald-400',
                border: 'border-emerald-500/20',
              },
              {
                label: 'Active Model',
                value: selectedModel
                  .split('/')
                  .pop()
                  ?.replace(/-/g, ' ')
                  .slice(0, 18) || 'Default',
                isText: true,
                icon: <Cpu className="h-4 w-4" />,
                gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
                iconBg: 'bg-purple-500/15',
                iconColor: 'text-purple-400',
                border: 'border-purple-500/20',
              },
              {
                label: 'Current Mode',
                value: activeMode.charAt(0).toUpperCase() + activeMode.slice(1),
                isBadge: true,
                icon: <Zap className="h-4 w-4" />,
                gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
                iconBg: 'bg-amber-500/15',
                iconColor: 'text-amber-400',
                border: 'border-amber-500/20',
              },
              {
                label: 'Total Tokens Used',
                value: animTokens.toLocaleString(),
                isText: true,
                icon: <Hash className="h-4 w-4" />,
                gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
                iconBg: 'bg-rose-500/15',
                iconColor: 'text-rose-400',
                border: 'border-rose-500/20',
              },
            ].map((stat, idx) => (
              <Card
                key={idx}
                className={`border-border/50 bg-gradient-to-b ${stat.gradient} transition-colors hover:border-border`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`rounded-md p-1.5 ${stat.iconBg} ring-1 ${stat.border}`}
                    >
                      <span className={stat.iconColor}>{stat.icon}</span>
                    </div>
                  </div>
                  {stat.isText ? (
                    <div className="text-sm font-bold text-foreground leading-tight truncate">
                      {stat.value}
                    </div>
                  ) : stat.isBadge ? (
                    <Badge
                      variant="outline"
                      className={`${mc.bg} ${mc.color} text-xs font-bold`}
                    >
                      {stat.value}
                    </Badge>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <div className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Architecture Overview — Iceberg Metaphor */}
        <motion.div variants={item} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Architecture Overview
            </h2>
          </div>

          <Card className="border-border/50 bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              {/* Iceberg Visualization */}
              <div className="relative">
                {/* Above water (60%) */}
                <div className="bg-gradient-to-b from-emerald-500/5 to-emerald-500/0 p-4 pb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400"
                    >
                      Public Version 60%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      — Visible features & tools
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      'Bash, File Read/Write/Edit',
                      'Glob, Grep Search',
                      'Web Search & Fetch',
                      'Sub-Agent Spawning',
                      'Todo & Ask User',
                      'Notebook Edit, Brief',
                    ].map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                      >
                        <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Water line */}
                <div className="relative h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] text-sky-400">
                    ~water line~
                  </div>
                </div>
                {/* Below water (40%) */}
                <div className="bg-gradient-to-b from-sky-500/0 to-sky-500/5 p-4 pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className="border-sky-500/20 bg-sky-500/10 text-[10px] text-sky-400"
                    >
                      40% Hidden
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      — Advanced internal capabilities
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      'Lazy Tool Loading (25)',
                      'MCP Protocol Integration',
                      'LSP Code Intelligence',
                      'Hook Interception System',
                      'AI Transcript Classifier',
                      'Bash Sandbox (25 checks)',
                    ].map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                      >
                        <Eye className="h-3 w-3 shrink-0 text-sky-500/60" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Flags Section */}
              <div className="border-t border-border/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ToggleRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">
                      Feature Flags
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {animFlags} / {totalFlags} enabled
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FEATURE_FLAG_LIST.map(({ flag, label }) => {
                    const isEnabled = featureFlags[flag];
                    return (
                      <Badge
                        key={flag}
                        variant="outline"
                        className={`text-[9px] ${
                          isEnabled
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'
                        }`}
                      >
                        <span
                          className={`mr-1 h-1.5 w-1.5 rounded-full ${
                            isEnabled
                              ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                              : 'bg-zinc-600'
                          }`}
                        />
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Complete Capabilities Checklist */}
        <motion.div variants={item} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Complete Capabilities
            </h2>
          </div>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {COMPLETE_CAPABILITIES.map((cap, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    className="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-2.5 transition-colors hover:bg-zinc-800/50"
                  >
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <span className="text-xs font-medium text-foreground">
                        {cap.text}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {cap.detail}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div variants={item} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.view}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Button
                    variant="outline"
                    className="group h-auto w-full flex-col gap-2 bg-card/50 py-4 hover:bg-zinc-800/80"
                    onClick={() => setActiveView(action.view as 'chat' | 'model-hub' | 'tools' | 'memory' | 'agents' | 'security')}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.bg} transition-all group-hover:scale-110`}
                    >
                      <Icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {action.label}
                    </span>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={item} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Recent Activity
              </h2>
            </div>
            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setActiveView('chat')}
              >
                View All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>

          {recentSessions.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">
                  No sessions yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  Create a new session to start coding
                </p>
                <Button
                  onClick={() => {
                    const newSession = {
                      id: `session-${Date.now()}`,
                      title: `Session 1`,
                      model: 'default',
                      systemPrompt: null,
                      isActive: true,
                      tokenCount: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    useChatStore.getState().addSession(newSession);
                  }}
                  className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500"
                  size="sm"
                >
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  Start First Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <Card
                  key={session.id}
                  className="group cursor-pointer border-border/50 bg-card/50 transition-all hover:border-emerald-500/20 hover:bg-card/80"
                  onClick={() => setActiveSession(session.id)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {session.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(session.createdAt), {
                            addSuffix: true,
                          })}
                          {session.model && (
                            <>
                              {' '}·{' '}
                              <span className="text-muted-foreground/70">
                                {session.model}
                              </span>
                            </>
                          )}
                          {session.tokenCount > 0 && (
                            <>
                              {' '}·{' '}
                              <span className="text-muted-foreground/70">
                                {session.tokenCount.toLocaleString()} tokens
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.isActive && (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>

        {/* What's New in v2.5 */}
        <motion.div variants={item} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-foreground">
              What's New in v2.5
            </h2>
          </div>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="space-y-1.5">
                {[
                  { emoji: '🎨', text: 'Command Palette — Press Cmd+K for quick navigation' },
                  { emoji: '🔍', text: 'Git Integration — View commits, branches, and diffs' },
                  { emoji: '📥', text: 'Chat Export — Download conversations as Markdown' },
                  { emoji: '⌨️', text: 'Keyboard Shortcuts — Press ? for shortcuts overlay' },
                  { emoji: '🛠️', text: 'Custom Models — Add any OpenAI-compatible API' },
                  { emoji: '🐛', text: 'UI Fixes — Scroll and layout improvements' },
                  { emoji: '📋', text: 'Session Manager — Create, search, rename, and delete sessions' },
                  { emoji: '📊', text: 'Token Analytics — Usage dashboard with model comparison' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-800/30"
                  >
                    <span className="text-sm">{item.emoji}</span>
                    <span className="text-xs text-muted-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Status Bar */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  System Status
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="text-[11px] text-muted-foreground">
                    NVIDIA API:{' '}
                    <span className="text-emerald-400 font-medium">Connected</span>
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[8px] text-muted-foreground hidden sm:inline-flex"
                  >
                    {selectedModel.split('/').pop()?.replace(/-/g, ' ').slice(0, 20)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] text-muted-foreground">
                    Feature Flags:{' '}
                    <span className="text-emerald-400 font-medium">
                      {animFlags}/{totalFlags} enabled
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] text-muted-foreground">
                    Memory:{' '}
                    <span className="text-emerald-400 font-medium">
                      4 layers active
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] text-muted-foreground">
                    Security:{' '}
                    <span className="text-emerald-400 font-medium">
                      7 layers active
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

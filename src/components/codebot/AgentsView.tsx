'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import type {
  AgentRole,
  AgentStatus,
  AgentSession,
  AgentMessage,
  RunningMode,
} from '@/lib/types';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Crown,
  Wrench,
  Search,
  Bot,
  Plus,
  ArrowRight,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Ban,
  Terminal,
  GitBranch,
  Zap,
  Mail,
  CircleDot,
  Sparkles,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

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

// ── Status Colors ───────────────────────────────
const statusColorMap: Record<
  AgentStatus,
  { dot: string; text: string; bg: string }
> = {
  idle: { dot: 'bg-zinc-500', text: 'text-zinc-400', bg: 'bg-zinc-500/10' },
  working: {
    dot: 'bg-emerald-500 animate-pulse',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  waiting: { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  blocked: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  completed: { dot: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  failed: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  terminated: { dot: 'bg-zinc-600', text: 'text-zinc-500', bg: 'bg-zinc-600/10' },
  initializing: {
    dot: 'bg-sky-500 animate-pulse',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
};

// ── Role Badge Styles ───────────────────────────
const roleStyles: Record<AgentRole, { color: string; bg: string; border: string }> = {
  leader: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  worker: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  scout: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
};

// ── Message Type Colors ─────────────────────────
const messageTypeStyles: Record<
  AgentMessage['type'],
  { color: string; bg: string; border: string }
> = {
  task: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  result: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  question: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  error: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  status: { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  cancel: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

// ── Route Cards Config ──────────────────────────
interface RouteConfig {
  id: string;
  name: string;
  description: string;
  principle: string;
  icon: LucideIcon;
  theme: {
    gradient: string;
    iconBg: string;
    iconColor: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  };
}

const ROUTE_CARDS: RouteConfig[] = [
  {
    id: 'coordinator',
    name: 'Coordinator',
    description:
      'Leader理解全局任务、拆分子任务；Worker在独立Git Worktree中并行执行',
    principle: "Don't delegate understanding to workers",
    icon: Crown,
    theme: {
      gradient: 'from-orange-500/5 to-orange-500/0',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-400',
      border: 'border-orange-500/20',
      badgeBg: 'bg-orange-500/10',
      badgeText: 'text-orange-400',
    },
  },
  {
    id: 'swarm',
    name: 'Swarm',
    description:
      'Agent之间是对等的，可以互相发消息、共享发现、协同决策',
    principle: 'Supports tmux visualization',
    icon: Zap,
    theme: {
      gradient: 'from-red-500/5 to-red-500/0',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      border: 'border-red-500/20',
      badgeBg: 'bg-red-500/10',
      badgeText: 'text-red-400',
    },
  },
  {
    id: 'teammate',
    name: 'Teammate',
    description:
      '同一Node进程内运行多个队友Agent，通过Mailbox机制实现隔离通信',
    principle: 'Max 50 messages per teammate',
    icon: Mail,
    theme: {
      gradient: 'from-cyan-500/5 to-cyan-500/0',
      iconBg: 'bg-cyan-500/15',
      iconColor: 'text-cyan-400',
      border: 'border-cyan-500/20',
      badgeBg: 'bg-cyan-500/10',
      badgeText: 'text-cyan-400',
    },
  },
];

// ── Mock Data ───────────────────────────────────
const MOCK_AGENT_SESSIONS: AgentSession[] = [
  {
    id: 'agent-1',
    parentId: null,
    name: 'Orchestrator',
    role: 'leader',
    status: 'working',
    task: 'Build a comprehensive REST API with authentication',
    childIds: ['agent-2', 'agent-3'],
    allowedTools: ['bash', 'file-write', 'file-read', 'grep', 'glob'],
    mode: 'coordinator',
    tokenBudget: 100000,
    tokensUsed: 34520,
    startedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    completedAt: null,
    errorMessage: null,
  },
  {
    id: 'agent-2',
    parentId: 'agent-1',
    name: 'Auth Worker',
    role: 'worker',
    status: 'working',
    task: 'Implement JWT authentication middleware',
    childIds: [],
    allowedTools: ['bash', 'file-write', 'file-read', 'file-edit'],
    mode: 'interactive',
    tokenBudget: 30000,
    tokensUsed: 18200,
    startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    completedAt: null,
    errorMessage: null,
  },
  {
    id: 'agent-3',
    parentId: 'agent-1',
    name: 'Route Scout',
    role: 'scout',
    status: 'completed',
    task: 'Analyze existing codebase and identify endpoints needed',
    childIds: [],
    allowedTools: ['file-read', 'grep', 'glob', 'web-search'],
    mode: 'interactive',
    tokenBudget: 15000,
    tokensUsed: 12300,
    startedAt: new Date(Date.now() - 42 * 60000).toISOString(),
    completedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    errorMessage: null,
  },
  {
    id: 'agent-4',
    parentId: null,
    name: 'DB Worker',
    role: 'worker',
    status: 'waiting',
    task: 'Set up Prisma schema and database migrations',
    childIds: [],
    allowedTools: ['bash', 'file-write', 'file-read', 'file-edit'],
    mode: 'interactive',
    tokenBudget: 25000,
    tokensUsed: 8700,
    startedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    completedAt: null,
    errorMessage: null,
  },
  {
    id: 'agent-5',
    parentId: null,
    name: 'Test Worker',
    role: 'worker',
    status: 'blocked',
    task: 'Write integration tests for auth module',
    childIds: [],
    allowedTools: ['bash', 'file-write', 'file-read'],
    mode: 'interactive',
    tokenBudget: 20000,
    tokensUsed: 3400,
    startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    completedAt: null,
    errorMessage: 'Waiting for Auth Worker to complete',
  },
];

const MOCK_MESSAGES: AgentMessage[] = [
  {
    id: 'msg-1',
    fromAgentId: 'agent-1',
    toAgentId: 'agent-2',
    content: 'Implement JWT authentication with refresh tokens. Use bcrypt for password hashing.',
    type: 'task',
    sentAt: new Date(Date.now() - 28 * 60000).toISOString(),
  },
  {
    id: 'msg-2',
    fromAgentId: 'agent-1',
    toAgentId: 'agent-3',
    content: 'Scan the codebase and identify all existing API routes and their patterns.',
    type: 'task',
    sentAt: new Date(Date.now() - 40 * 60000).toISOString(),
  },
  {
    id: 'msg-3',
    fromAgentId: 'agent-3',
    toAgentId: 'agent-1',
    content: 'Found 12 existing endpoints in /api. Identified 8 new routes needed for auth, users, and CRUD operations.',
    type: 'result',
    sentAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'msg-4',
    fromAgentId: 'agent-2',
    toAgentId: 'agent-1',
    content: 'Should I use RS256 or HS256 for JWT signing?',
    type: 'question',
    sentAt: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'msg-5',
    fromAgentId: 'agent-1',
    toAgentId: 'agent-2',
    content: 'Use HS256 for simplicity. We can upgrade to RS256 later.',
    type: 'status',
    sentAt: new Date(Date.now() - 11 * 60000).toISOString(),
  },
  {
    id: 'msg-6',
    fromAgentId: 'agent-5',
    toAgentId: 'agent-1',
    content: 'Blocked: Auth middleware not available yet. Cannot write tests without auth endpoints.',
    type: 'error',
    sentAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'msg-7',
    fromAgentId: 'agent-4',
    toAgentId: 'agent-1',
    content: 'Schema migration complete. 5 tables created: users, sessions, tokens, roles, permissions.',
    type: 'result',
    sentAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'msg-8',
    fromAgentId: 'agent-2',
    toAgentId: null,
    content: 'JWT auth middleware implemented. Refresh token rotation active.',
    type: 'result',
    sentAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

const RUNNING_MODES: RunningMode[] = [
  'interactive',
  'kairos',
  'plan',
  'worktree',
  'voice',
  'coordinator',
  'swarm',
  'teammate',
  'ultraplan',
  'dream',
];

const AGENT_ROLES: { value: AgentRole; label: string }[] = [
  { value: 'leader', label: 'Leader' },
  { value: 'worker', label: 'Worker' },
  { value: 'scout', label: 'Scout' },
];

// ── API → Frontend mapping helpers ─────────────
/** Map API status to frontend AgentStatus */
function mapApiStatus(apiStatus: string): AgentStatus {
  switch (apiStatus) {
    case 'running':
      return 'working';
    case 'idle':
    case 'completed':
    case 'failed':
      return apiStatus as AgentStatus;
    default:
      return 'idle';
  }
}

/** Map a raw API agent object to the frontend AgentSession shape */
function mapApiAgent(raw: Record<string, unknown>): AgentSession {
  const cfg = (raw.config as Record<string, unknown>) || {};
  const sessions = (raw.sessions as Array<{ id: string; tokenCount?: number; isActive?: boolean }>) || [];
  const tokensUsed = sessions.reduce((sum: number, s) => sum + (s.tokenCount || 0), 0);
  return {
    id: raw.id as string,
    parentId: (raw.parentId as string) || null,
    name: raw.name as string,
    role: (raw.role as AgentRole) || 'worker',
    status: mapApiStatus(raw.status as string),
    task: (raw.task as string) || '',
    childIds: [], // childIds derived below after all agents loaded
    allowedTools: ((cfg.allowedTools as string[]) || ['bash', 'file-read', 'file-write', 'grep', 'glob']),
    mode: ((cfg.mode as RunningMode) || 'interactive'),
    tokenBudget: ((cfg.tokenBudget as number) || 8192),
    tokensUsed,
    startedAt: (raw.createdAt as string) || new Date().toISOString(),
    completedAt: raw.status === 'completed' ? (raw.updatedAt as string) || null : null,
    errorMessage: raw.status === 'failed' ? 'Agent failed' : null,
  };
}

/** Derive childIds from parentId relationships */
function deriveChildIds(agents: AgentSession[]): AgentSession[] {
  const parentMap = new Map<string, string[]>();
  for (const a of agents) {
    if (a.parentId) {
      const children = parentMap.get(a.parentId) || [];
      children.push(a.id);
      parentMap.set(a.parentId, children);
    }
  }
  return agents.map((a) => ({
    ...a,
    childIds: parentMap.get(a.id) || [],
  }));
}

/** Map DB chat messages to frontend AgentMessage shape */
function mapApiMessages(agentId: string, msgs: Array<{ id: string; role: string; content: string; createdAt: string }>): AgentMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    fromAgentId: m.role === 'user' ? '__user__' : agentId,
    toAgentId: m.role === 'user' ? agentId : null,
    content: m.content,
    type: m.role === 'user' ? 'task' as const : 'result' as const,
    sentAt: m.createdAt,
  }));
}

// ── Loading Skeleton ─────────────────────────────
function AgentCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-full max-w-xs" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-2 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2.5 py-2">
      <Skeleton className="h-6 w-6 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10 rounded-full ml-auto" />
        </div>
        <Skeleton className="h-3 w-full max-w-sm" />
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────
export function AgentsView() {
  const { agentSessions, setActiveView, setActiveMode, setAgentSessions } = useChatStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: 'worker' as AgentRole,
    mode: 'interactive' as RunningMode,
    task: '',
    tokenBudget: 25000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiMessages, setApiMessages] = useState<AgentMessage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ─────────────────────────────
  const fetchAgents = useCallback(async (showToast = false) => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.agents)) {
        const mapped = data.agents.map(mapApiAgent);
        const withChildren = deriveChildIds(mapped);
        setAgentSessions(withChildren);
        return withChildren;
      }
      return null;
    } catch (err) {
      console.error('[AgentsView] Failed to fetch agents:', err);
      if (showToast) {
        toast.error('Failed to load agents', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      return null;
    }
  }, [setAgentSessions]);

  const fetchMessages = useCallback(async (agents: AgentSession[]) => {
    if (agents.length === 0) return;
    try {
      const allMessages: AgentMessage[] = [];
      // Fetch messages for each agent (up to 10 agents to avoid too many requests)
      const toFetch = agents.slice(0, 10);
      const results = await Promise.allSettled(
        toFetch.map(async (agent) => {
          const res = await fetch(`/api/agents/${agent.id}`);
          if (!res.ok) return [];
          const data = await res.json();
          if (!data.success || !data.agent) return [];
          const agentSessions = data.agent.sessions || [];
          const msgs: AgentMessage[] = [];
          for (const s of agentSessions) {
            const sMsgs = (s.messages || []) as Array<{ id: string; role: string; content: string; createdAt: string }>;
            msgs.push(...mapApiMessages(agent.id, sMsgs));
          }
          return msgs;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allMessages.push(...r.value);
      }
      // Sort by sentAt descending
      allMessages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setApiMessages(allMessages);
    } catch (err) {
      console.error('[AgentsView] Failed to fetch messages:', err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    const agents = await fetchAgents(true);
    if (agents && agents.length > 0) {
      await fetchMessages(agents);
    }
    setIsRefreshing(false);
  }, [fetchAgents, fetchMessages]);

  // ── Initial load ──────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      const agents = await fetchAgents();
      if (mounted && agents && agents.length > 0) {
        await fetchMessages(agents);
      }
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchAgents, fetchMessages]);

  // ── Polling for active agents ─────────────────
  useEffect(() => {
    // Clear any existing interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const currentSessions = agentSessions.length > 0 ? agentSessions : [];
    const hasActive = currentSessions.some(
      (s) => s.status === 'working' || s.status === 'initializing'
    );

    if (hasActive) {
      pollingRef.current = setInterval(async () => {
        const agents = await fetchAgents();
        if (agents && agents.length > 0) {
          await fetchMessages(agents);
        }
      }, 5000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [agentSessions, fetchAgents, fetchMessages]);

  // ── Derived data (API first, mock fallback) ───
  const sessions = agentSessions.length > 0 ? agentSessions : MOCK_AGENT_SESSIONS;
  const messages = apiMessages.length > 0 ? apiMessages : MOCK_MESSAGES;

  const totalTokens = sessions.reduce((a, s) => a + s.tokensUsed, 0);
  const totalBudget = sessions.reduce((a, s) => a + s.tokenBudget, 0);
  const activeAgents = sessions.filter(
    (s) => s.status === 'working' || s.status === 'initializing'
  ).length;

  const handleCreateAgent = async () => {
    if (!newAgent.name.trim() || !newAgent.task.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgent.name,
          role: newAgent.role,
          task: newAgent.task,
          tokenBudget: newAgent.tokenBudget,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.agent) {
        toast.success('Agent created', {
          description: `${data.agent.name} is ready to work`,
        });
        // Refresh data to pick up the new agent
        const agents = await fetchAgents();
        if (agents && agents.length > 0) {
          await fetchMessages(agents);
        }
      }
      setCreateDialogOpen(false);
      setNewAgent({
        name: '',
        role: 'worker',
        mode: 'interactive',
        task: '',
        tokenBudget: 25000,
      });
    } catch (err) {
      console.error('[AgentsView] Failed to create agent:', err);
      toast.error('Failed to create agent', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getAgentName = (id: string) => {
    const found = sessions.find((s) => s.id === id);
    return found ? found.name : id;
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Multi-Agent System
                </h1>
                <p className="text-xs text-muted-foreground">
                  3 technical routes from Claude Code architecture
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              >
                {activeAgents} active
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {sessions.length} agents
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={refreshData}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Three Route Cards */}
        <motion.div variants={item} className="mb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ROUTE_CARDS.map((route) => {
              const Icon = route.icon;
              return (
                <motion.div
                  key={route.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="cursor-pointer"
                  onClick={() => {
                    if (route.id === 'coordinator') setActiveMode('coordinator');
                    else if (route.id === 'swarm') setActiveMode('swarm');
                    else if (route.id === 'teammate') setActiveMode('teammate');
                    setActiveView('chat');
                    toast.success(`${route.name} mode activated`, {
                      description: 'Start chatting to use multi-agent capabilities',
                    });
                  }}
                >
                  <Card
                    className={`border-border/50 bg-gradient-to-b ${route.theme.gradient} transition-all hover:border-border`}
                  >
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${route.theme.iconBg} ring-1 ${route.theme.border}`}
                        >
                          <Icon className={`h-4 w-4 ${route.theme.iconColor}`} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {route.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`mt-0.5 text-[9px] ${route.theme.badgeBg} ${route.theme.badgeText} ${route.theme.border}`}
                          >
                            {route.id === 'coordinator'
                              ? 'Leader-Worker'
                              : route.id === 'swarm'
                                ? 'Peer-to-Peer'
                                : 'In-Process'}
                          </Badge>
                        </div>
                      </div>
                      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                        {route.description}
                      </p>
                      <div
                        className={`rounded-md px-2 py-1 text-[10px] italic ${route.theme.badgeText}`}
                      >
                        &quot;{route.principle}&quot;
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── How to Use Multi-Agent Section ─── */}
        <motion.div variants={item} className="mb-6">
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm">
            {/* Decorative gradient accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-cyan-400 to-orange-400" />

            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Icon + Title */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    How to Use Multi-Agent Mode
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground mb-3">
                    Activate multi-agent collaboration to parallelize complex tasks across specialized AI agents.
                  </p>

                  {/* Steps */}
                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[9px] font-bold text-orange-400 ring-1 ring-orange-500/20">
                        1
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/90">Select a Route</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          Choose Coordinator, Swarm, or Teammate above to activate multi-agent mode
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                        2
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/90">Send Your Task</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          Go to Chat and describe your task — agents will execute automatically
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[9px] font-bold text-cyan-400 ring-1 ring-cyan-500/20">
                        3
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/90">Monitor Progress</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          Watch the real-time progress panel above the chat input
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode('coordinator');
                      setActiveView('chat');
                      toast.success('Coordinator mode activated', {
                        description: 'Send your task in chat to use multi-agent capabilities',
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30"
                  >
                    Try Multi-Agent
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Agent Session List */}
        <motion.div variants={item} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Agent Sessions
              </h2>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {sessions.length} total
              </Badge>
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={isLoading}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border/50 bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Create New Agent
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Agent Name
                    </Label>
                    <Input
                      placeholder="e.g. Frontend Worker"
                      value={newAgent.name}
                      onChange={(e) =>
                        setNewAgent({ ...newAgent, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Role
                      </Label>
                      <Select
                        value={newAgent.role}
                        onValueChange={(v) =>
                          setNewAgent({
                            ...newAgent,
                            role: v as AgentRole,
                          })
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Mode
                      </Label>
                      <Select
                        value={newAgent.mode}
                        onValueChange={(v) =>
                          setNewAgent({
                            ...newAgent,
                            mode: v as RunningMode,
                          })
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RUNNING_MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Task Description
                    </Label>
                    <Textarea
                      placeholder="Describe what this agent should accomplish..."
                      rows={3}
                      value={newAgent.task}
                      onChange={(e) =>
                        setNewAgent({ ...newAgent, task: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Token Budget
                    </Label>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={newAgent.tokenBudget}
                      onChange={(e) =>
                        setNewAgent({
                          ...newAgent,
                          tokenBudget: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={handleCreateAgent}
                    disabled={!newAgent.name.trim() || !newAgent.task.trim() || isCreating}
                  >
                    {isCreating ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isCreating ? 'Creating…' : 'Create Agent'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Token Usage Bar */}
          <Card className="mb-3 border-border/50 bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  Token Budget Usage
                </span>
                <span className="text-xs font-medium text-foreground">
                  {totalTokens.toLocaleString()} / {totalBudget.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.min((totalTokens / totalBudget) * 100, 100)}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Cards */}
          <div className="max-h-96 overflow-y-auto pr-1">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <AgentCardSkeleton key={`skeleton-${i}`} />
                ))
              ) : (
              sessions.map((session) => {
                const sc = statusColorMap[session.status];
                const rs = roleStyles[session.role];
                const usagePct =
                  session.tokenBudget > 0
                    ? Math.round((session.tokensUsed / session.tokenBudget) * 100)
                    : 0;

                const RoleIcon =
                  session.role === 'leader'
                    ? Crown
                    : session.role === 'scout'
                      ? Search
                      : Wrench;

                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/50 bg-card/50 transition-colors hover:border-border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                              <RoleIcon className={`h-4 w-4 ${rs.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">
                                  {session.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] ${rs.bg} ${rs.color} ${rs.border}`}
                                >
                                  {session.role}
                                </Badge>
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                  <span className={`text-[10px] ${sc.text}`}>
                                    {session.status}
                                  </span>
                                </div>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground truncate">
                                {session.task}
                              </p>
                              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CircleDot className="h-3 w-3" />
                                  {session.tokensUsed.toLocaleString()} /{' '}
                                  {session.tokenBudget.toLocaleString()} tokens
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(session.startedAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                                {session.mode !== 'interactive' && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] text-muted-foreground"
                                  >
                                    {session.mode}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    usagePct > 80
                                      ? 'bg-red-500'
                                      : usagePct > 50
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${usagePct}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {usagePct}%
                              </span>
                            </div>
                          </div>
                        </div>
                        {session.errorMessage && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
                            <span className="text-[10px] text-red-400">
                              {session.errorMessage}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
              )}
            </div>
          </div>
        </motion.div>

        {/* Message Log */}
        <motion.div variants={item} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Message Log
            </h2>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {messages.length} messages
            </Badge>
          </div>

          <Card className="border-border/50 bg-card/50">
            <div className="max-h-80 overflow-y-auto">
              <div className="space-y-1 p-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <MessageSkeleton key={`msg-skeleton-${i}`} />
                  ))
                ) : (
                messages.map((msg, i) => {
                  const from = getAgentName(msg.fromAgentId);
                  const to = msg.toAgentId ? getAgentName(msg.toAgentId) : 'broadcast';
                  const mts = messageTypeStyles[msg.type];

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Bot className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground">
                            {from}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-xs text-muted-foreground">
                            {to}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${mts.bg} ${mts.color} ${mts.border}`}
                          >
                            {msg.type}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/50 ml-auto">
                            {formatDistanceToNow(new Date(msg.sentAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';
import type { ActiveView, RunningMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bot,
  Plus,
  MessageSquare,
  LayoutDashboard,
  Wrench,
  Sparkles,
  Settings,
  Menu,
  X,
  Trash2,
  Cpu,
  Layers,
  Brain,
  Users,
  Shield,
  Eye,
  Zap,
  Clock,
  Moon,
  Sun,
  Network,
  UserCircle,
  Lightbulb,
  GitBranch,
  BarChart3,
  Languages,
  Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from 'next-themes';
import { useLocale } from '@/lib/i18n/use-locale';
import { toast } from 'sonner';

// ────────────────────────────────────────────
// Mode color config
// ────────────────────────────────────────────
const modeColorMap: Record<
  RunningMode,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  interactive: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
    dot: 'bg-green-500',
    label: 'Interactive',
  },
  kairos: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Kairos',
  },
  plan: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
    label: 'Plan',
  },
  voice: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    dot: 'bg-purple-500',
    label: 'Voice',
  },
  coordinator: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-500',
    label: 'Coordinator',
  },
  swarm: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
    label: 'Swarm',
  },
  teammate: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    dot: 'bg-cyan-500',
    label: 'Teammate',
  },
  ultraplan: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    dot: 'bg-indigo-500',
    label: 'Ultraplan',
  },
  dream: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/20',
    dot: 'bg-pink-500',
    label: 'Dream',
  },
  worktree: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    dot: 'bg-teal-500',
    label: 'Worktree',
  },
};

const modeIcons: Record<RunningMode, React.ReactNode> = {
  interactive: <MessageSquare className="h-3 w-3" />,
  kairos: <Zap className="h-3 w-3" />,
  plan: <Lightbulb className="h-3 w-3" />,
  voice: <Cpu className="h-3 w-3" />,
  coordinator: <Network className="h-3 w-3" />,
  swarm: <Users className="h-3 w-3" />,
  teammate: <UserCircle className="h-3 w-3" />,
  ultraplan: <Layers className="h-3 w-3" />,
  dream: <Moon className="h-3 w-3" />,
  worktree: <GitBranch className="h-3 w-3" />,
};

// ────────────────────────────────────────────
// Navigation items
// ────────────────────────────────────────────
interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
  badge?: () => React.ReactNode;
}

function useNavItems(): NavItem[] {
  const { t } = useLocale();
  return [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'chat', label: t.nav.chat, icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'model-hub', label: t.nav.modelHub, icon: <Cpu className="h-4 w-4" /> },
    { id: 'tools', label: t.nav.tools, icon: <Wrench className="h-4 w-4" /> },
    { id: 'skills', label: t.nav.skills, icon: <Sparkles className="h-4 w-4" /> },
    { id: 'modes', label: t.nav.modes, icon: <Layers className="h-4 w-4" /> },
    { id: 'memory', label: t.nav.memory, icon: <Brain className="h-4 w-4" /> },
    { id: 'agents', label: t.nav.agents, icon: <Users className="h-4 w-4" /> },
    { id: 'security', label: t.nav.security, icon: <Shield className="h-4 w-4" /> },
    { id: 'ai-capabilities', label: t.nav.aiCaps, icon: <Eye className="h-4 w-4" /> },
    { id: 'analytics', label: t.nav.analytics, icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'git', label: t.nav.git, icon: <GitBranch className="h-4 w-4" /> },
    { id: 'kairos', label: t.nav.kairos, icon: <Zap className="h-4 w-4" /> },
    { id: 'bridge', label: t.nav.bridge, icon: <Radio className="h-4 w-4" /> },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="h-4 w-4" /> },
  ];
}

// ────────────────────────────────────────────
// Active Mode Pill
// ────────────────────────────────────────────
function ActiveModePill() {
  const { activeMode } = useChatStore();
  const { t } = useLocale();
  const config = modeColorMap[activeMode];
  const icon = modeIcons[activeMode];
  const isPulsing = activeMode === 'kairos';
  const isDream = activeMode === 'dream';
  const modeLabel = t.modes[activeMode as keyof typeof t.modes] || config.label;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 p-2.5">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', config.bg)}>
          <span className={config.text}>{icon}</span>
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-[10px] font-medium text-muted-foreground">
            {t.sidebar.activeMode}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                config.dot,
                isPulsing && 'animate-pulse',
                isDream && 'animate-pulse'
              )}
            />
            <span className={cn('text-xs font-semibold', config.text)}>
              {modeLabel}
            </span>
          </div>
        </div>
        {isDream && (
          <span className="text-xs animate-pulse text-pink-300">Zzz</span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Model Indicator
// ────────────────────────────────────────────
function ModelIndicator() {
  const { selectedModel, models, bookmarkedModels, setActiveView } = useChatStore();
  const model = models.find((m) => m.id === selectedModel);
  const displayName = model
    ? model.name
    : selectedModel
        ? selectedModel.split('/').pop()?.replace(/-/g, ' ') ?? selectedModel
        : 'Default';
  const isBookmarked = bookmarkedModels.includes(selectedModel);

  return (
    <button
      onClick={() => setActiveView('model-hub')}
      className="border-t border-border/50 px-4 py-3 transition-colors hover:bg-muted/30"
      title={`Current: ${displayName} — Click to open Model Hub`}
    >
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-emerald-500" />
        <span className="flex-1 truncate text-left text-[10px] font-medium text-muted-foreground">
          {displayName}
        </span>
        {isBookmarked && (
          <span className="text-[9px] text-amber-400">★</span>
        )}
        {model?.isFree && (
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[9px] font-medium text-emerald-400"
          >
            Free
          </Badge>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────
// Sidebar Content
// ────────────────────────────────────────────
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const {
    activeView,
    activeSessionId,
    sessions,
    tools,
    agentSessions,
    setActiveSession,
    setActiveView,
    addSession,
    deleteSession,
    sidebarOpen,
    setSidebarOpen,
  } = useChatStore();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const navItems = useNavItems();

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: locale === 'zh' ? `会话 ${sessions.length + 1}` : `Session ${sessions.length + 1}` }),
      });
      const data = await res.json();
      if (data.id) {
        addSession({
          ...data,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    } catch {
      const newSession = {
        id: `session-${Date.now()}`,
        title: locale === 'zh' ? `会话 ${sessions.length + 1}` : `Session ${sessions.length + 1}`,
        model: 'default',
        systemPrompt: null,
        isActive: true,
        tokenCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addSession(newSession);
    }
    onNavigate?.();
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    } catch {
      // API call failed — still remove from local state
    }
    deleteSession(id);
    toast.success(locale === 'zh' ? '会话已删除' : 'Session deleted');
  };

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    onNavigate?.();
  };

  const handleSessionClick = (id: string) => {
    setActiveSession(id);
    onNavigate?.();
  };

  const recentSessions = sessions.slice(0, 5);
  const activeToolsCount = tools.filter((t) => t.isEnabled).length;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* ── Logo / Header ───────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
          <Bot className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            CodeBot Agent
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              v4.1.0
            </span>
            <Badge
              variant="secondary"
              className="h-3.5 px-1 text-[8px] text-emerald-400"
            >
              161 Models
            </Badge>
          </div>
        </div>
        {sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* ── New Chat Button ─────────────────── */}
      <div className="px-3 py-3">
        <Button
          onClick={handleNewSession}
          className="h-9 w-full justify-start gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {t.sidebar.newChat}
        </Button>
      </div>

      {/* ── Main Navigation Grid ────────────── */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 pb-4">
          {/* Navigation grid */}
          <div className="grid grid-cols-1 gap-0.5">
            {navItems.map((item, idx) => {
              const isActive = activeView === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.15 }}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all',
                    isActive
                      ? 'border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'transition-colors',
                      isActive
                        ? 'text-emerald-400'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="text-xs font-medium">{item.label}</span>
                  {/* Chat badge — active sessions */}
                  {item.id === 'chat' && activeSessionId && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-4 min-w-4 px-1 text-[9px] font-semibold text-emerald-400"
                    >
                      1
                    </Badge>
                  )}
                  {/* Tools badge */}
                  {item.id === 'tools' && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-4 min-w-4 px-1 text-[9px] text-muted-foreground"
                    >
                      {activeToolsCount}
                    </Badge>
                  )}
                  {/* Agents badge */}
                  {item.id === 'agents' && agentSessions.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-4 min-w-4 px-1 text-[9px] text-muted-foreground"
                    >
                      {agentSessions.length}
                    </Badge>
                  )}
                </motion.button>
              );
            })}
          </div>

          <Separator className="opacity-30" />

          {/* ── Active Mode Indicator ────────── */}
          <ActiveModePill />

          <Separator className="opacity-30" />

          {/* ── Recent Sessions ──────────────── */}
          <div>
            <div className="flex items-center justify-between px-1 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.sidebar.recentSessions}
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {sessions.length}
              </Badge>
            </div>

            <AnimatePresence mode="popLayout">
              {recentSessions.length === 0 ? (
                <div className="px-1 py-4 text-center">
                  <MessageSquare className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/20" />
                  <p className="text-[10px] text-muted-foreground/40">
                    {t.sidebar.noSessionsYet}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6, height: 0 }}
                      transition={{ duration: 0.12 }}
                      className="group relative"
                    >
                      <button
                        onClick={() => handleSessionClick(session.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-all',
                          activeSessionId === session.id && activeView === 'chat'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        <div className="flex flex-1 flex-col overflow-hidden">
                          <span className="truncate text-[11px] font-medium">
                            {session.title}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50">
                            {formatDistanceToNow(new Date(session.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground/40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>

      {/* ── Theme & Language Toggle ────── */}
      <div className="border-t border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme !== 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {theme === 'dark' ? (locale === 'zh' ? '切换到浅色模式' : 'Switch to light mode') : (locale === 'zh' ? '切换到深色模式' : 'Switch to dark mode')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Language Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
                >
                  <Languages className="h-3.5 w-3.5" />
                  {locale === 'zh' ? 'EN' : '中'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {locale === 'zh' ? 'Switch to English' : '切换到中文'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Model Indicator (bottom) ────────── */}
      <ModelIndicator />
    </div>
  );
}

// ────────────────────────────────────────────
// Exported Sidebar Components
// ────────────────────────────────────────────

export function Sidebar() {
  return null;
}

export function DesktopSidebar() {
  return (
    <div className="hidden h-full w-64 shrink-0 border-r border-border/50 lg:flex">
      <SidebarContent />
    </div>
  );
}

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useChatStore();

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent onNavigate={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function MobileSidebarTrigger() {
  const { setSidebarOpen } = useChatStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

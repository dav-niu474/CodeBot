'use client';

import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';
import type { ActiveView } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" /> },
  { id: 'ai-capabilities', label: 'AI Capabilities', icon: <Cpu className="h-4 w-4" /> },
  { id: 'skills', label: 'Skills', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const {
    activeView,
    activeSessionId,
    sessions,
    setActiveSession,
    setActiveView,
    addSession,
    deleteSession,
    sidebarOpen,
    setSidebarOpen,
  } = useChatStore();

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Session ${sessions.length + 1}` }),
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
      // Fallback to local session
      const newSession = {
        id: `session-${Date.now()}`,
        title: `Session ${sessions.length + 1}`,
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

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    onNavigate?.();
  };

  const handleSessionClick = (id: string) => {
    setActiveSession(id);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo + Name */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
          <Bot className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">CodeBot</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            Agent v1.0
          </span>
        </div>
        {/* Mobile close */}
        {sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* New Session Button */}
      <div className="px-3 py-3">
        <Button
          onClick={handleNewSession}
          className="w-full justify-start gap-2 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      {/* Session List */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sessions
          </span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {sessions.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="max-h-96 space-y-0.5 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {sessions.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/50">
                  No sessions yet
                </p>
                <p className="text-[10px] text-muted-foreground/30">
                  Create one to start chatting
                </p>
              </div>
            ) : (
              sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="group relative"
                >
                  <button
                    onClick={() => handleSessionClick(session.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-all',
                      activeSessionId === session.id && activeView === 'chat'
                        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-xs font-medium">
                        {session.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(session.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground/60"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <Separator className="opacity-50" />

      {/* Navigation */}
      <TooltipProvider delayDuration={300}>
        <nav className="px-3 py-3">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all',
                      activeView === item.id
                        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {item.icon}
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="border-t border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-medium text-muted-foreground">
            Agent Online
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return null;
}

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useChatStore();

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="codebot-sidebar-gradient h-full">
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DesktopSidebar() {
  return (
    <div className="codebot-sidebar-gradient hidden h-full w-64 shrink-0 border-r border-border/50 md:block lg:w-72">
      <SidebarContent />
    </div>
  );
}

export function MobileSidebarTrigger() {
  const { setSidebarOpen } = useChatStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

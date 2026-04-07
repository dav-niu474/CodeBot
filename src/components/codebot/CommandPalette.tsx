'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { ActiveView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Sparkles,
  Settings,
  Eye,
  Cpu,
  Layers,
  Brain,
  Users,
  Shield,
  Plus,
  Lightbulb,
  Moon,
  Sun,
  Command,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type CommandItemType = 'navigation' | 'action';

interface CommandItem {
  id: string;
  type: CommandItemType;
  label: string;
  description: string;
  shortcut?: string;
  icon: React.ReactNode;
  group: string;
  /** Execute the action; returns true if the palette should close */
  action: () => void | boolean;
}

// ────────────────────────────────────────────
// Recent items tracker (in-memory per session)
// ────────────────────────────────────────────

const MAX_RECENT = 5;
const recentIds: string[] = [];

function pushRecent(id: string) {
  const idx = recentIds.indexOf(id);
  if (idx !== -1) recentIds.splice(idx, 1);
  recentIds.unshift(id);
  if (recentIds.length > MAX_RECENT) recentIds.pop();
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    activeView,
    setActiveView,
    agentConfig,
    setAgentConfig,
    sessions,
    addSession,
  } = useChatStore();

  // ── Build command list ────────────────────
  const allCommands = useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = [
      {
        id: 'nav-dashboard',
        type: 'navigation',
        label: 'Dashboard',
        description: 'Overview and welcome page',
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('dashboard'),
      },
      {
        id: 'nav-chat',
        type: 'navigation',
        label: 'Chat',
        description: 'Main chat interface',
        icon: <MessageSquare className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('chat'),
      },
      {
        id: 'nav-model-hub',
        type: 'navigation',
        label: 'Model Hub',
        description: 'Browse and select NVIDIA models',
        icon: <Cpu className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('model-hub'),
      },
      {
        id: 'nav-tools',
        type: 'navigation',
        label: 'Tools',
        description: 'Manage 44 agent tools',
        icon: <Wrench className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('tools'),
      },
      {
        id: 'nav-skills',
        type: 'navigation',
        label: 'Skills',
        description: 'Manage and configure skills',
        icon: <Sparkles className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('skills'),
      },
      {
        id: 'nav-modes',
        type: 'navigation',
        label: 'Modes',
        description: 'Switch running modes',
        icon: <Layers className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('modes'),
      },
      {
        id: 'nav-memory',
        type: 'navigation',
        label: 'Memory',
        description: '4-layer memory system viewer',
        icon: <Brain className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('memory'),
      },
      {
        id: 'nav-agents',
        type: 'navigation',
        label: 'Agents',
        description: 'Multi-agent session manager',
        icon: <Users className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('agents'),
      },
      {
        id: 'nav-security',
        type: 'navigation',
        label: 'Security',
        description: 'Permissions and audit log',
        icon: <Shield className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('security'),
      },
      {
        id: 'nav-ai-capabilities',
        type: 'navigation',
        label: 'AI Capabilities',
        description: 'Toggle AI capability flags',
        icon: <Eye className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('ai-capabilities'),
      },
      {
        id: 'nav-settings',
        type: 'navigation',
        label: 'Settings',
        description: 'Agent configuration and preferences',
        icon: <Settings className="h-4 w-4" />,
        group: 'Navigation',
        action: () => setActiveView('settings'),
      },
    ];

    const actionCommands: CommandItem[] = [
      {
        id: 'action-new-chat',
        type: 'action',
        label: 'New Chat',
        description: 'Start a new conversation session',
        icon: <Plus className="h-4 w-4" />,
        group: 'Actions',
        shortcut: 'N',
        action: () => {
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
        },
      },
      {
        id: 'action-thinking-mode',
        type: 'action',
        label: 'Toggle Thinking Mode',
        description: agentConfig.thinkingEnabled
          ? 'Disable extended thinking'
          : 'Enable extended thinking for deeper reasoning',
        icon: <Lightbulb className="h-4 w-4" />,
        group: 'Actions',
        shortcut: 'T',
        action: () => {
          setAgentConfig({ thinkingEnabled: !agentConfig.thinkingEnabled });
        },
      },
      {
        id: 'action-theme',
        type: 'action',
        label: 'Toggle Theme',
        description: agentConfig.theme === 'dark'
          ? 'Switch to light theme'
          : 'Switch to dark theme',
        icon:
          agentConfig.theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          ),
        group: 'Actions',
        shortcut: 'D',
        action: () => {
          setAgentConfig({
            theme: agentConfig.theme === 'dark' ? 'light' : 'dark',
          });
        },
      },
    ];

    return [...navCommands, ...actionCommands];
  }, [activeView, agentConfig, sessions, setActiveView, setAgentConfig, addSession]);

  // ── Filtered items with grouping ──────────
  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allCommands;

    return allCommands.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [query, allCommands]);

  // Build grouped display list: Recent first, then Navigation, then Actions
  const displayGroups = useMemo(() => {
    const groups: { title: string; items: CommandItem[] }[] = [];

    // Recent items (only when no query and there are recent items)
    if (!query.trim() && recentIds.length > 0) {
      const recentItems = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is CommandItem => !!c);
      if (recentItems.length > 0) {
        groups.push({ title: 'Recent', items: recentItems });
      }
    }

    // Navigation items
    const navItems = filteredItems.filter((i) => i.type === 'navigation');
    if (navItems.length > 0) {
      groups.push({ title: 'Navigation', items: navItems });
    }

    // Action items
    const actionItems = filteredItems.filter((i) => i.type === 'action');
    if (actionItems.length > 0) {
      groups.push({ title: 'Actions', items: actionItems });
    }

    return groups;
  }, [query, filteredItems, allCommands]);

  // Flat list for index-based keyboard navigation
  const flatItems = useMemo(
    () => displayGroups.flatMap((g) => g.items),
    [displayGroups]
  );

  // ── Open/close with reset ──────────────────
  const toggleOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setSelectedIndex(0);
      setResetKey((k) => k + 1);
    }
  }, []);

  // ── Keyboard shortcut to open/close ───────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleOpen(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, toggleOpen]);

  // ── Focus input when open ──────────────────
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, resetKey]);

  // ── Reset selected index when query changes (handled in onChange) ──
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  }, []);

  // ── Keyboard navigation inside palette ────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          const item = flatItems[selectedIndex];
          pushRecent(item.id);
          item.action();
          setOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [flatItems, selectedIndex]
  );

  // ── Scroll active item into view ──────────
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-command-index="${selectedIndex}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // ── Execute item ──────────────────────────
  const executeItem = (item: CommandItem) => {
    pushRecent(item.id);
    item.action();
    setOpen(false);
  };

  // ── Close on backdrop click ───────────────
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <>
          {/* ── Backdrop ────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />

          {/* ── Palette ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-[15%] z-[101] mx-auto w-full max-w-lg px-4"
          >
            <div className="overflow-hidden rounded-xl border border-border/50 bg-popover/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
              {/* ── Search Input ────────────── */}
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search views, actions, and settings..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <kbd className="hidden items-center gap-1 rounded-md border border-border/50 bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                  ESC
                </kbd>
              </div>

              {/* ── Results List ────────────── */}
              <div
                ref={listRef}
                className="max-h-[380px] overflow-y-auto p-2"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(113,113,122,0.3) transparent',
                }}
              >
                {flatItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Search className="mb-2 h-6 w-6 opacity-30" />
                    <p className="text-xs">No results found</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  displayGroups.map((group) => (
                    <div key={group.title} className="mb-1 last:mb-0">
                      {/* Group header */}
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        {group.title === 'Recent' ? (
                          <Clock className="h-3 w-3 text-emerald-500/70" />
                        ) : group.title === 'Navigation' ? (
                          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                        ) : (
                          <Command className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {group.title}
                        </span>
                      </div>

                      {/* Group items */}
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          // Compute the global flat index for this item
                          const globalIndex = flatItems.indexOf(item);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <button
                              key={item.id}
                              data-command-index={globalIndex}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() =>
                                setSelectedIndex(globalIndex)
                              }
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-100',
                                isSelected
                                  ? 'bg-emerald-500/10 text-foreground'
                                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              {/* Icon */}
                              <span
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                                  isSelected
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-muted/80 text-muted-foreground'
                                )}
                              >
                                {item.icon}
                              </span>

                              {/* Label + description */}
                              <div className="flex flex-1 flex-col overflow-hidden">
                                <span
                                  className={cn(
                                    'text-sm font-medium truncate',
                                    isSelected && 'text-emerald-400'
                                  )}
                                >
                                  {item.label}
                                </span>
                                <span className="truncate text-[11px] text-muted-foreground/60">
                                  {item.description}
                                </span>
                              </div>

                              {/* Shortcut badge */}
                              {item.shortcut && (
                                <kbd
                                  className={cn(
                                    'hidden shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex',
                                    isSelected
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                      : 'border-border/50 bg-muted/60 text-muted-foreground/60'
                                  )}
                                >
                                  {item.shortcut}
                                </kbd>
                              )}

                              {/* Active view indicator */}
                              {item.type === 'navigation' &&
                                !item.shortcut &&
                                item.id === `nav-${activeView}` && (
                                  <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── Footer ─────────────────── */}
              <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5">
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/40 bg-muted/60 px-1 py-0.5 font-mono text-[9px]">
                      ↑↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/40 bg-muted/60 px-1 py-0.5 font-mono text-[9px]">
                      ↵
                    </kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/40 bg-muted/60 px-1 py-0.5 font-mono text-[9px]">
                      esc
                    </kbd>
                    Close
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                  <Command className="h-3 w-3" />
                  <span>K</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

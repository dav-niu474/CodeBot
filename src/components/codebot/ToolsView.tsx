'use client';

import { useState, useMemo } from 'react';
import { ALL_CLAUDE_TOOLS } from '@/lib/types';
import type { ToolDefinition, ToolLoadStrategy, ClaudeToolCategory, RiskLevel, ToolCategory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Wrench,
  Search,
  Lock,
  ChevronDown,
  Terminal,
  FileText,
  FilePlus,
  Pencil,
  FolderSearch,
  Bot,
  Globe,
  Link,
  MessageSquare,
  ListTodo,
  CircleQuestionMark,
  BookOpen,
  ChartBar,
  Plug,
  ScanLine,
  Sparkles,
  List,
  FileInput,
  Shield,
  SearchCode,
  Play,
  GitBranch,
  GitMerge,
  PlusCircle,
  ClipboardList,
  ListChecks,
  CircleStop,
  RefreshCw,
  Users,
  UserMinus,
  Package,
  Settings2,
  Radio,
  Clock,
  Zap,
  Moon,
  FileCode,
  Settings,
  Monitor,
  Timer,
  Mic,
  Wand,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useChatStore } from '@/store/chat-store';

// ─── Icon Mapping ──────────────────────────────
const iconMap: Record<string, LucideIcon> = {
  Terminal,
  FileText,
  FilePlus,
  Pencil,
  FolderSearch,
  Search,
  Bot,
  Globe,
  Link,
  MessageSquare,
  ListTodo,
  UserQuestion: CircleQuestionMark,
  BookOpen,
  FileBarChart: ChartBar,
  Plug,
  ScanLine,
  Sparkles,
  List,
  FileInput,
  Shield,
  SearchCode,
  Play,
  GitBranch,
  GitMerge,
  PlusCircle,
  ClipboardList,
  ListChecks,
  FileOutput: CircleStop,
  CircleStop,
  RefreshCw,
  Users,
  UserMinus,
  Package,
  Settings2,
  Settings,
  Radio,
  Clock,
  Zap,
  Moon,
  FileEdit2: Pencil,
  FileCode,
  Monitor,
  Timer,
  TerminalSquare: Terminal,
  Mic,
  Wand2: Wand,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Wrench;
}

// ─── Category Labels & Colors ─────────────────
const categoryLabels: Record<string, string> = {
  'shell': 'Shell',
  'file-operations': 'File Operations',
  'editing': 'Editing',
  'search': 'Search',
  'system': 'System',
  'web': 'Web',
  'collaboration': 'Collaboration',
  'mcp': 'MCP',
  'lsp': 'LSP',
  'planning': 'Planning',
  'worktree': 'Worktree',
  'task': 'Task Management',
  'team': 'Team',
  'output': 'Output',
  'config': 'Config',
  'automation': 'Automation',
  'experimental': 'Experimental',
  'generation': 'Generation',
  'general': 'General',
};

const categoryColors: Record<string, { text: string; bg: string; border: string }> = {
  'shell': { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  'file-operations': { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'editing': { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  'search': { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  'system': { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'web': { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  'collaboration': { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  'mcp': { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'lsp': { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'planning': { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  'worktree': { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  'task': { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  'team': { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  'output': { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
  'config': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  'automation': { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'experimental': { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  'generation': { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'general': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

// ─── Load Strategy & Risk Level ───────────────
const loadStrategyConfig: Record<ToolLoadStrategy, { label: string; text: string; bg: string; border: string }> = {
  core: { label: 'Core', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  lazy: { label: 'Lazy', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  flag: { label: 'Flag', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

const riskLevelConfig: Record<RiskLevel, { label: string; color: string; pulse?: boolean }> = {
  low: { label: 'Low', color: 'bg-green-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  high: { label: 'High', color: 'bg-red-500' },
  critical: { label: 'Critical', color: 'bg-red-600', pulse: true },
};

// ─── Animation Variants ───────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ─── Filter type ──────────────────────────────
type FilterTab = 'all' | 'core' | 'lazy' | 'flag';

export function ToolsView() {
  const { setTools: setStoreTools, setActiveView } = useChatStore();
  const [tools, setTools] = useState<ToolDefinition[]>(ALL_CLAUDE_TOOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // ── Derived Stats ──────────────────────────
  const stats = useMemo(() => {
    const total = tools.length;
    const core = tools.filter((t) => t.loadStrategy === 'core').length;
    const lazy = tools.filter((t) => t.loadStrategy === 'lazy').length;
    const flagged = tools.filter((t) => t.loadStrategy === 'flag').length;
    const enabled = tools.filter((t) => t.isEnabled).length;
    return { total, core, lazy, flagged, enabled };
  }, [tools]);

  // ── Filtered Tools ─────────────────────────
  const filteredTools = useMemo(() => {
    let result = tools;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.displayName.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    // Strategy filter
    if (filterTab !== 'all') {
      result = result.filter((t) => t.loadStrategy === filterTab);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    return result;
  }, [tools, searchQuery, filterTab, categoryFilter]);

  // ── Available categories ───────────────────
  const categories = useMemo(() => {
    const cats = new Set(tools.map((t) => t.category));
    return Array.from(cats).sort();
  }, [tools]);

  // ── Toggle Handler ─────────────────────────
  const handleToggle = (id: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isEnabled: !t.isEnabled } : t))
    );
  };

  const handleEnableAll = () => setTools((prev) => prev.map((t) => ({ ...t, isEnabled: true })));
  const handleDisableAll = () => setTools((prev) => prev.map((t) => ({ ...t, isEnabled: false })));

  const handleApplyToChat = () => {
    setStoreTools(tools.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category as ToolCategory,
      isEnabled: t.isEnabled,
      isReadOnly: t.isReadOnly,
      config: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })));
    setActiveView('chat');
    toast.success('Tools configuration applied', { description: `${tools.filter(t => t.isEnabled).length} tools enabled in chat` });
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'core', label: 'Core', count: stats.core },
    { key: 'lazy', label: 'Lazy', count: stats.lazy },
    { key: 'flag', label: 'Flag-gated', count: stats.flagged },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Wrench className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">Tool System</h1>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
                    44 Tools
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full Claude Code tool registry — Core, Lazy &amp; Flag-gated
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools by name, display name, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* ── Stats Bar ──────────────────────── */}
        <motion.div variants={item} className="mb-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Wrench className="mr-1 h-3 w-3" />
              Total: {stats.total}
            </Badge>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
              Core: {stats.core}
            </Badge>
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
              Lazy: {stats.lazy}
            </Badge>
            <Badge variant="outline" className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400">
              Flag: {stats.flagged}
            </Badge>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400 font-semibold">
              Enabled: {stats.enabled}
            </Badge>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleEnableAll}>
                Enable All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDisableAll}>
                Disable All
              </Button>
              <Button size="sm" className="h-7 bg-emerald-600 text-white text-xs hover:bg-emerald-700" onClick={handleApplyToChat}>
                Apply to Chat
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Filter Tabs ────────────────────── */}
        <motion.div variants={item} className="mb-6 flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={filterTab === tab.key ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs ${
                filterTab === tab.key
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border-border/50'
              }`}
              onClick={() => setFilterTab(tab.key)}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
                {tab.count}
              </span>
            </Button>
          ))}
          <div className="ml-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="By Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* ── Tool Cards Grid ────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          key={`${filterTab}-${categoryFilter}-${searchQuery}`}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredTools.map((tool) => {
            const IconComp = getIcon(tool.icon);
            const ls = loadStrategyConfig[tool.loadStrategy];
            const risk = riskLevelConfig[tool.riskLevel];
            const catColor = categoryColors[tool.category] || categoryColors.general;
            const catLabel = categoryLabels[tool.category] || tool.category;

            return (
              <motion.div key={tool.id} variants={item}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`group relative border-border/50 bg-card/50 transition-all duration-200 hover:bg-card/80 hover:border-border ${
                          tool.isEnabled
                            ? 'ring-1 ring-inset ring-emerald-500/10'
                            : 'opacity-50'
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`rounded-lg p-2 ${catColor.bg} shrink-0`}>
                              <IconComp className={`h-4 w-4 ${catColor.text}`} />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {tool.displayName}
                                </span>
                                {tool.isReadOnly && (
                                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                )}
                              </div>
                              <code className="block text-[10px] text-muted-foreground/70 mb-1.5 truncate">
                                {tool.name}
                              </code>
                              <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 mb-2">
                                {tool.description}
                              </p>

                              {/* Badges Row */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[9px] border ${catColor.border} ${catColor.bg} ${catColor.text}`}
                                >
                                  {catLabel}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[9px] border ${ls.border} ${ls.bg} ${ls.text}`}
                                >
                                  {ls.label}
                                </Badge>
                                {/* Risk Level Dot */}
                                <div className="flex items-center gap-1">
                                  <div
                                    className={`h-2 w-2 rounded-full ${risk.color} ${
                                      risk.pulse ? 'animate-pulse' : ''
                                    }`}
                                  />
                                  <span className="text-[9px] text-muted-foreground">
                                    {risk.label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Toggle */}
                            <Switch
                              checked={tool.isEnabled}
                              onCheckedChange={() => handleToggle(tool.id)}
                              className="mt-1 shrink-0 data-[state=checked]:bg-emerald-600"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-xs">
                      <div>
                        <p className="font-medium">{tool.displayName}</p>
                        <p className="text-muted-foreground">{tool.description}</p>
                        <div className="mt-1 flex gap-1">
                          <span>{tool.isReadOnly ? '🔒 Read-only' : '⚡ State-changing'}</span>
                          <span>·</span>
                          <span>{ls.label} loaded</span>
                          <span>·</span>
                          <span>Risk: {risk.label}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Empty State ────────────────────── */}
        {filteredTools.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tools match your filters</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
          </motion.div>
        )}

        {/* ── Tool Search Info Section ───────── */}
        <motion.div variants={item} className="mt-8 mb-4">
          <Separator className="mb-6" />
          <Card className="border-border/50 bg-card/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <SearchCode className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Tool Search &amp; Dynamic Loading</h3>
                  <p className="text-[11px] text-muted-foreground">How Claude Code tools are loaded at runtime</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-400">Core Tools (14)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Always loaded into the agent runtime. These are the fundamental tools needed for every conversation — file operations, search, web access, and collaboration.
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-amber-400">Lazy Tools (25)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Loaded on demand when first invoked. MCP, LSP, task management, team operations — loaded dynamically to reduce startup overhead and memory usage.
                  </p>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-medium text-purple-400">Flag-gated Tools (5)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Only available behind feature flags. Voice, Dream, REPL, Sleep, and Magic Docs — experimental tools toggled via the Feature Flags system.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

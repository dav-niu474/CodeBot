'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import {
  Brain,
  Database,
  FileText,
  Users,
  Plus,
  Search,
  Trash2,
  Tag,
  Star,
  Clock,
  AlertCircle,
  CheckCircle,
  Sparkles,
  FolderTree,
  FileCode,
  BookOpen,
  RefreshCw,
  Loader2,
  Moon,
  Zap,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Memory Layer Types ───────────────────────
type MemoryTab = 'session' | 'memdir' | 'magic-doc' | 'dream';

interface MemoryItem {
  id: string;
  content: string;
  category: string | null;
  importance: number;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
  layer: string;
  tags: string[];
  filePath: string | null;
  sessionId: string | null;
  expiresAt: string | null;
}

interface MemoryStats {
  sessionMemories: number;
  memdirEntries: number;
  magicDocs: number;
  totalAccessCount: number;
  dreamInsights?: number;
  total?: number;
}

// ─── Category Badge Colors ────────────────────
const categoryColors: Record<string, { text: string; bg: string; border: string }> = {
  preference: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  pattern: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  decision: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  fact: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  error: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  task: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  convention: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
  architecture: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  context: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  knowledge: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

const defaultCategoryColor = { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };

function getCategoryColor(category: string | null) {
  if (!category) return defaultCategoryColor;
  return categoryColors[category] || defaultCategoryColor;
}

const tabConfig: Record<MemoryTab, { label: string; icon: LucideIcon; color: string; desc: string }> = {
  session: {
    label: 'Session',
    icon: Brain,
    color: 'emerald',
    desc: 'In-memory context for the current conversation',
  },
  memdir: {
    label: 'Memdir',
    icon: FolderTree,
    color: 'sky',
    desc: 'File-path based memories from CLAUDE.md and project',
  },
  'magic-doc': {
    label: 'Magic Docs',
    icon: Sparkles,
    color: 'amber',
    desc: 'Auto-generated documentation and summaries',
  },
  dream: {
    label: 'Dream',
    icon: Moon,
    color: 'purple',
    desc: 'Consolidated insights from knowledge distillation',
  },
};

const tabColorMap: Record<string, { text: string; bg: string; border: string; indicator: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', indicator: 'bg-emerald-500' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', indicator: 'bg-sky-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', indicator: 'bg-amber-500' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', indicator: 'bg-purple-500' },
};

// ─── Helpers ──────────────────────────────────
function ImportanceStars({ importance }: { importance: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Star
          key={i}
          className={`h-2.5 w-2.5 ${i < importance ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// ─── Animation ────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ─── Loading Skeleton ─────────────────────────
function MemorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-3 animate-pulse">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-zinc-800" />
              <div className="h-2 w-1/2 rounded bg-zinc-800/70" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-4 w-24 rounded bg-zinc-800/50" />
            <div className="h-4 w-12 rounded bg-zinc-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────
function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/50 mb-3">
        <Icon className="h-6 w-6 text-zinc-500" />
      </div>
      <h4 className="text-sm font-medium text-zinc-400 mb-1">{title}</h4>
      <p className="text-[11px] text-zinc-600 max-w-xs">{description}</p>
    </div>
  );
}

export function MemoryView() {
  const [activeTab, setActiveTab] = useState<MemoryTab>('session');
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // ── Data State ──────────────────────────────
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDreaming, setIsDreaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Form State ──────────────────────────────
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('preference');
  const [formImportance, setFormImportance] = useState('5');
  const [formTags, setFormTags] = useState('');
  const [formLayer, setFormLayer] = useState<string>('session');

  // ── Abort controller ref ────────────────────
  const abortRef = useRef<AbortController | null>(null);

  // ── Layer mapping for API ───────────────────
  const getApiLayer = useCallback((tab: MemoryTab): string => {
    switch (tab) {
      case 'session': return 'session';
      case 'memdir': return 'memdir';
      case 'magic-doc': return 'magic_doc';
      case 'dream': return 'dream';
    }
  }, []);

  // ── Load memories ───────────────────────────
  const loadMemories = useCallback(async (tab?: MemoryTab, signal?: AbortSignal) => {
    const targetTab = tab || activeTab;
    try {
      const params = new URLSearchParams({ layer: getApiLayer(targetTab), limit: '100' });
      const res = await fetch(`/api/memory?${params}`, { signal });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.memories)) {
        setMemories(
          data.memories.map((m: Record<string, unknown>) => ({
            id: m.id,
            content: m.content,
            category: m.category,
            importance: m.importance ?? 5,
            accessCount: m.accessCount ?? 0,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            layer: m.layer,
            tags: Array.isArray(m.tags) ? m.tags : [],
            filePath: m.filePath,
            sessionId: m.sessionId,
            expiresAt: m.expiresAt,
          }))
        );
      }
    } catch {
      // silently fail — abort or network error
    }
  }, [activeTab, getApiLayer]);

  // ── Load stats ──────────────────────────────
  const loadStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/memory?action=stats', { signal });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.stats) {
        setStats({
          sessionMemories: data.stats.sessionMemories ?? 0,
          memdirEntries: data.stats.memdirEntries ?? 0,
          magicDocs: data.stats.magicDocs ?? 0,
          totalAccessCount: data.stats.totalAccessCount ?? 0,
          dreamInsights: data.stats.dreamInsights ?? 0,
          total: (data.stats.sessionMemories ?? 0) + (data.stats.memdirEntries ?? 0) + (data.stats.magicDocs ?? 0) + (data.stats.dreamInsights ?? 0),
        });
      }
    } catch {
      // silently fail
    }
  }, []);

  // ── Initial load ────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    Promise.all([
      loadMemories(undefined, controller.signal),
      loadStats(controller.signal),
    ]).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, []);

  // ── Reload on tab change ────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    loadMemories(undefined, controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [activeTab]);

  // ── Manual refresh ──────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    await Promise.all([
      loadMemories(undefined, controller.signal),
      loadStats(controller.signal),
    ]);
    if (!controller.signal.aborted) setIsRefreshing(false);
  };

  // ── Delete memory ───────────────────────────
  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        toast.success('Memory deleted');
        loadStats();
      } else {
        toast.error(data.error || 'Failed to delete memory');
      }
    } catch {
      toast.error('Failed to delete memory');
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Create memory ───────────────────────────
  const handleAddMemory = async () => {
    if (!formContent.trim()) return;
    setIsCreating(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: formLayer,
          content: formContent.trim(),
          category: formCategory || null,
          importance: parseInt(formImportance, 10),
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Memory created');
        setAddDialogOpen(false);
        setFormContent('');
        setFormCategory('preference');
        setFormImportance('5');
        setFormTags('');
        setFormLayer('session');
        // Refresh current view
        loadMemories();
        loadStats();
      } else {
        toast.error(data.error || 'Failed to create memory');
      }
    } catch {
      toast.error('Failed to create memory');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Dream task ──────────────────────────────
  const handleDream = async () => {
    setIsDreaming(true);
    try {
      const res = await fetch('/api/memory/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Dream complete — consolidated ${data.consolidatedCount ?? 0} memories`);
        loadMemories();
        loadStats();
      } else {
        toast.error(data.error || 'Dream task failed');
      }
    } catch {
      toast.error('Dream task failed');
    } finally {
      setIsDreaming(false);
    }
  };

  // ── Process conversation ────────────────────
  const handleProcess = async () => {
    try {
      const res = await fetch('/api/memory?action=process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'default',
          messages: [{ role: 'user', content: 'Process current conversation for memory extraction' }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Extracted ${data.sessionMemories ?? 0} session memories, ${data.memdirEntries ?? 0} memdir entries`);
        loadMemories();
        loadStats();
      } else {
        toast.error(data.error || 'Memory extraction failed');
      }
    } catch {
      toast.error('Memory extraction failed');
    }
  };

  // ── Filtered memories ───────────────────────
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories;
    const q = searchQuery.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q)) ||
        (m.filePath && m.filePath.toLowerCase().includes(q)) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [memories, searchQuery]);

  // ── Compute totals for stats display ────────
  const displayStats = stats || {
    sessionMemories: 0,
    memdirEntries: 0,
    magicDocs: 0,
    totalAccessCount: 0,
    dreamInsights: 0,
    total: 0,
  };

  // ── Available categories ────────────────────
  const allCategories = ['preference', 'pattern', 'decision', 'fact', 'error', 'task', 'convention', 'architecture', 'context', 'knowledge'];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Brain className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">Memory System</h1>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
                    {displayStats.total ?? 0} memories
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hierarchical memory — from ephemeral session context to persistent knowledge
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-border/50"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                onClick={handleDream}
                disabled={isDreaming}
              >
                {isDreaming ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Moon className="mr-1.5 h-4 w-4" />
                )}
                Dream
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                onClick={handleProcess}
              >
                <Zap className="mr-1.5 h-4 w-4" />
                Extract
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Memory
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-border/50 bg-zinc-900 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Add New Memory</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                      Create a new memory entry. It will be stored in the selected layer.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Layer</label>
                      <Select value={formLayer} onValueChange={setFormLayer}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="session">Session</SelectItem>
                          <SelectItem value="memdir">Memdir</SelectItem>
                          <SelectItem value="magic_doc">Magic Doc</SelectItem>
                          <SelectItem value="dream">Dream</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content</label>
                      <textarea
                        placeholder="Enter memory content..."
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-border/50 bg-zinc-800/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                        <Select value={formCategory} onValueChange={setFormCategory}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Importance (1-10)</label>
                        <Select value={formImportance} onValueChange={setFormImportance}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags (comma separated)</label>
                      <Input
                        placeholder="typescript, pattern, architecture"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={handleAddMemory}
                      disabled={!formContent.trim() || isCreating}
                    >
                      {isCreating ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                      )}
                      Save Memory
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* ── Memory Stats ────────────────────── */}
        <motion.div variants={item} className="mb-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Database className="mr-1 h-3 w-3" />
              Total: {displayStats.total ?? 0}
            </Badge>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
              Session: {displayStats.sessionMemories}
            </Badge>
            <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-xs text-sky-400">
              Memdir: {displayStats.memdirEntries}
            </Badge>
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
              Magic Docs: {displayStats.magicDocs}
            </Badge>
            <Badge variant="outline" className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400">
              Dream: {displayStats.dreamInsights ?? 0}
            </Badge>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Eye className="mr-1 h-3 w-3" />
              {displayStats.totalAccessCount} accesses
            </Badge>
          </div>
        </motion.div>

        {/* ── Layer Tabs ──────────────────────── */}
        <motion.div variants={item}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MemoryTab)}>
            <TabsList className="mb-4 bg-card/50 border border-border/50">
              {(Object.entries(tabConfig) as [MemoryTab, typeof tabConfig[MemoryTab]][]).map(([key, config]) => {
                const tc = tabColorMap[config.color];
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className={`text-xs data-[state=active]:${tc.bg} data-[state=active]:${tc.text} gap-1.5`}
                  >
                    <config.icon className="h-3.5 w-3.5" />
                    {config.label}
                    <div className={`h-1.5 w-1.5 rounded-full ${tc.indicator}`} />
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* ── Session Tab ──────────────────── */}
            <TabsContent value="session">
              <Card className="border-border/50 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-emerald-400" />
                    <CardTitle className="text-sm">Session Memory</CardTitle>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {filteredMemories.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ephemeral in-memory context — user preferences, patterns, and decisions from conversations
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                      <MemorySkeleton />
                    ) : filteredMemories.length === 0 ? (
                      <EmptyState
                        icon={Brain}
                        title="No session memories"
                        description="Session memories are created when you interact with the AI. They capture preferences, patterns, and decisions."
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                          {filteredMemories.map((mem) => {
                            const cc = getCategoryColor(mem.category);
                            return (
                              <motion.div key={mem.id} variants={item} layout>
                                <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <p className="text-xs text-foreground leading-relaxed flex-1">
                                      {searchQuery ? highlightMatch(mem.content, searchQuery) : mem.content}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0"
                                      onClick={() => handleDelete(mem.id)}
                                      disabled={isDeleting === mem.id}
                                    >
                                      {isDeleting === mem.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <ImportanceStars importance={mem.importance} />
                                    {mem.category && (
                                      <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                        {mem.category}
                                      </Badge>
                                    )}
                                    {mem.tags.length > 0 && mem.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[9px] border-border/50 bg-zinc-800/50 text-muted-foreground">
                                        <Tag className="mr-0.5 h-2 w-2" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDate(mem.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Memdir Tab ───────────────────── */}
            <TabsContent value="memdir">
              <Card className="border-border/50 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-sky-400" />
                    <CardTitle className="text-sm">Memdir Memory</CardTitle>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {filteredMemories.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    File-path based memories — CLAUDE.md conventions, project-level facts, per-file context
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                      <MemorySkeleton />
                    ) : filteredMemories.length === 0 ? (
                      <EmptyState
                        icon={FolderTree}
                        title="No memdir memories"
                        description="Memdir entries capture project-level knowledge tied to file paths, such as conventions, patterns, and architecture decisions."
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                          {filteredMemories.map((mem) => {
                            const cc = getCategoryColor(mem.category);
                            return (
                              <motion.div key={mem.id} variants={item} layout>
                                <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="flex-1">
                                      {mem.filePath && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <FileCode className="h-3 w-3 text-sky-400/70" />
                                          <code className="text-[10px] text-sky-400">{mem.filePath}</code>
                                        </div>
                                      )}
                                      <p className="text-xs text-foreground leading-relaxed">
                                        {searchQuery ? highlightMatch(mem.content, searchQuery) : mem.content}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0"
                                      onClick={() => handleDelete(mem.id)}
                                      disabled={isDeleting === mem.id}
                                    >
                                      {isDeleting === mem.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {mem.category && (
                                      <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                        {mem.category}
                                      </Badge>
                                    )}
                                    {mem.tags.length > 0 && mem.tags.slice(0, 4).map((tag) => (
                                      <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[9px] border-border/50 bg-zinc-800/50 text-muted-foreground">
                                        <Tag className="mr-0.5 h-2 w-2" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    {mem.accessCount > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Eye className="h-2.5 w-2.5 text-muted-foreground/50" />
                                        <span className="text-[10px] text-muted-foreground">{mem.accessCount}</span>
                                      </div>
                                    )}
                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDate(mem.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Magic Docs Tab ───────────────── */}
            <TabsContent value="magic-doc">
              <Card className="border-border/50 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <CardTitle className="text-sm">Magic Docs</CardTitle>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {filteredMemories.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-generated documentation — project summaries, architecture decisions, knowledge entries
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                      <MemorySkeleton />
                    ) : filteredMemories.length === 0 ? (
                      <EmptyState
                        icon={Sparkles}
                        title="No magic docs"
                        description="Magic docs are auto-generated AI documentation. Run the Dream task to consolidate existing memories into structured docs."
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                          {filteredMemories.map((mem) => {
                            const cc = getCategoryColor(mem.category);
                            return (
                              <motion.div key={mem.id} variants={item} layout>
                                <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="flex-1">
                                      {mem.filePath && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <FileText className="h-3 w-3 text-amber-400/70" />
                                          <span className="text-[10px] text-amber-400">{mem.filePath}</span>
                                        </div>
                                      )}
                                      <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                        {searchQuery ? highlightMatch(truncateText(mem.content, 300), searchQuery) : truncateText(mem.content, 300)}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0"
                                      onClick={() => handleDelete(mem.id)}
                                      disabled={isDeleting === mem.id}
                                    >
                                      {isDeleting === mem.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap mt-2">
                                    {mem.category && (
                                      <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                        {mem.category}
                                      </Badge>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-2.5 w-2.5 text-muted-foreground/50" />
                                      <span className="text-[10px] text-muted-foreground">{mem.accessCount} accesses</span>
                                    </div>
                                    {mem.tags.length > 0 && mem.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[9px] border-amber-500/20 bg-amber-500/5 text-amber-400/70">
                                        <Tag className="mr-0.5 h-2 w-2" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    <ImportanceStars importance={mem.importance} />
                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDate(mem.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Dream Tab ────────────────────── */}
            <TabsContent value="dream">
              <Card className="border-border/50 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-purple-400" />
                    <CardTitle className="text-sm">Dream Insights</CardTitle>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {filteredMemories.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Consolidated insights from knowledge distillation — key facts, patterns, and recommendations
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                      <MemorySkeleton />
                    ) : filteredMemories.length === 0 ? (
                      <EmptyState
                        icon={Moon}
                        title="No dream insights"
                        description="Dream insights are generated by the Dream task, which consolidates memories across all layers into structured knowledge summaries."
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                          {filteredMemories.map((mem) => {
                            const cc = getCategoryColor(mem.category);
                            return (
                              <motion.div key={mem.id} variants={item} layout>
                                <div className="rounded-lg border border-purple-500/10 bg-purple-500/[0.02] p-3 transition-colors hover:bg-purple-500/[0.05]">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <BookOpen className="h-3 w-3 text-purple-400/70" />
                                        {mem.category && (
                                          <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                            {mem.category}
                                          </Badge>
                                        )}
                                        <ImportanceStars importance={mem.importance} />
                                      </div>
                                      <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                        {searchQuery ? highlightMatch(truncateText(mem.content, 500), searchQuery) : truncateText(mem.content, 500)}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0"
                                      onClick={() => handleDelete(mem.id)}
                                      disabled={isDeleting === mem.id}
                                    >
                                      {isDeleting === mem.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap mt-2">
                                    {mem.tags.length > 0 && mem.tags.map((tag) => (
                                      <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[9px] border-purple-500/20 bg-purple-500/5 text-purple-400/70">
                                        <Tag className="mr-0.5 h-2 w-2" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-2.5 w-2.5 text-muted-foreground/50" />
                                      <span className="text-[10px] text-muted-foreground">{mem.accessCount} accesses</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDate(mem.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* ── Architecture Info ───────────────── */}
        <motion.div variants={item} className="mt-6 mb-4">
          <Separator className="mb-6" />
          <Card className="border-border/50 bg-card/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Database className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">4-Layer Memory Architecture</h3>
                  <p className="text-[11px] text-muted-foreground">How memories are organized and consolidated</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Session (L1)</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{displayStats.sessionMemories}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Volatile in-memory context. User preferences, patterns, and decisions from conversations. Extracted automatically or added manually.
                  </p>
                </div>
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FolderTree className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-xs font-medium text-sky-400">Memdir (L2)</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{displayStats.memdirEntries}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Persistent file-scoped memories. CLAUDE.md conventions, project facts, per-file context stored in the database.
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">Magic Docs (L3)</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{displayStats.magicDocs}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Auto-generated documentation. Project summaries, architecture decisions, and frequently accessed context entries with hot-entry tracking.
                  </p>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Moon className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">Dream (L4)</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{displayStats.dreamInsights ?? 0}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Consolidated knowledge insights. AI-generated summaries of facts, patterns, and recommendations distilled from all memory layers.
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

// ─── Search Highlight Helper ──────────────────
function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-emerald-500/30 text-emerald-300 rounded px-0.5">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}



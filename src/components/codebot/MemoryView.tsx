'use client';

import { useState, useMemo } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { MagicDocEntry } from '@/lib/types';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// ScrollArea removed — using native overflow-y-auto
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
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Memory Layer Types ───────────────────────
type MemoryTab = 'session' | 'memdir' | 'magic-doc' | 'team-sync';

interface SessionMemoryItem {
  id: string;
  content: string;
  importance: number;
  createdAt: string;
  category: string;
}

interface MemdirItem {
  id: string;
  filePath: string;
  content: string;
  category: 'preference' | 'pattern' | 'decision' | 'error';
  createdAt: string;
  tags: string[];
}

interface MagicDocItem {
  id: string;
  title: string;
  content: string;
  sourceFiles: string[];
  accessCount: number;
  tags: string[];
  generatedAt: string;
}

interface TeamSyncItem {
  id: string;
  fact: string;
  agents: string[];
  status: 'shared' | 'conflict' | 'resolved';
  updatedAt: string;
}

// ─── Mock Data ────────────────────────────────
const MOCK_SESSION_MEMORIES: SessionMemoryItem[] = [
  {
    id: 's1',
    content: 'User prefers TypeScript over JavaScript for new files',
    importance: 8,
    createdAt: '2024-01-15T10:30:00Z',
    category: 'preference',
  },
  {
    id: 's2',
    content: 'Project uses Prisma ORM with PostgreSQL database',
    importance: 9,
    createdAt: '2024-01-15T10:35:00Z',
    category: 'pattern',
  },
  {
    id: 's3',
    content: 'API routes should use Next.js App Router with route.ts files',
    importance: 7,
    createdAt: '2024-01-15T11:00:00Z',
    category: 'decision',
  },
  {
    id: 's4',
    content: 'Tailwind CSS 4 with shadcn/ui components for all UI',
    importance: 9,
    createdAt: '2024-01-15T11:05:00Z',
    category: 'pattern',
  },
  {
    id: 's5',
    content: 'Dark theme is the default — use emerald accents, avoid blue/indigo',
    importance: 8,
    createdAt: '2024-01-15T11:10:00Z',
    category: 'preference',
  },
];

const MOCK_MEMDIR_ITEMS: MemdirItem[] = [
  {
    id: 'm1',
    filePath: '/src/lib/types.ts',
    content: 'Comprehensive type system with 44-tool registry, 10 modes, 4-layer memory',
    category: 'pattern',
    createdAt: '2024-01-15T09:00:00Z',
    tags: ['typescript', 'types', 'architecture'],
  },
  {
    id: 'm2',
    filePath: '/prisma/schema.prisma',
    content: 'Database schema with Session, Message, Tool, Skill, AgentConfig models',
    category: 'decision',
    createdAt: '2024-01-15T09:30:00Z',
    tags: ['prisma', 'database', 'schema'],
  },
  {
    id: 'm3',
    filePath: '/src/store/chat-store.ts',
    content: 'Zustand store with session, message, tool, skill, mode, and model state',
    category: 'pattern',
    createdAt: '2024-01-15T10:00:00Z',
    tags: ['zustand', 'state', 'store'],
  },
  {
    id: 'm4',
    filePath: '/CLAUDE.md',
    content: 'Project conventions: dark theme, emerald accents, shadcn/ui components',
    category: 'preference',
    createdAt: '2024-01-15T08:00:00Z',
    tags: ['convention', 'style', 'theme'],
  },
];

const MOCK_MAGIC_DOCS: MagicDocItem[] = [
  {
    id: 'd1',
    title: 'Project Architecture Overview',
    content: 'Next.js 15 App Router with dark theme, emerald accents, shadcn/ui, Zustand state management, Prisma ORM, and z-ai-web-dev-sdk AI integration.',
    sourceFiles: ['/src/app/page.tsx', '/src/lib/types.ts', '/src/store/chat-store.ts'],
    accessCount: 42,
    tags: ['architecture', 'overview', 'tech-stack'],
    generatedAt: '2024-01-15T12:00:00Z',
  },
  {
    id: 'd2',
    title: 'Tool System Architecture',
    content: '44-tool system with three load strategies: Core (14 always loaded), Lazy (25 on-demand), and Flag-gated (5 behind feature flags). Risk levels range from low to critical.',
    sourceFiles: ['/src/lib/types.ts', '/src/components/codebot/ToolsView.tsx'],
    accessCount: 28,
    tags: ['tools', 'system', 'architecture'],
    generatedAt: '2024-01-15T12:30:00Z',
  },
  {
    id: 'd3',
    title: 'API Routes Reference',
    content: 'Backend API routes: /api/chat, /api/sessions, /api/tools, /api/skills, /api/settings, /api/ai/web-search, /api/ai/image-analyze, /api/ai/code-analyze, /api/chat/stream.',
    sourceFiles: ['/src/app/api/chat/route.ts', '/src/app/api/sessions/route.ts'],
    accessCount: 19,
    tags: ['api', 'routes', 'reference'],
    generatedAt: '2024-01-15T13:00:00Z',
  },
];

const MOCK_TEAM_SYNC: TeamSyncItem[] = [
  {
    id: 't1',
    fact: 'Shared code style: TypeScript strict mode, no any types, explicit return types',
    agents: ['leader', 'worker-1', 'worker-2'],
    status: 'shared',
    updatedAt: '2024-01-15T14:00:00Z',
  },
  {
    id: 't2',
    fact: 'Database migration strategy: use Prisma push for development',
    agents: ['leader', 'worker-1'],
    status: 'shared',
    updatedAt: '2024-01-15T14:30:00Z',
  },
  {
    id: 't3',
    fact: 'Component naming: PascalCase files, descriptive names',
    agents: ['leader', 'worker-2'],
    status: 'conflict',
    updatedAt: '2024-01-15T15:00:00Z',
  },
  {
    id: 't4',
    fact: 'Error handling: try-catch with proper error responses',
    agents: ['worker-1', 'worker-2'],
    status: 'resolved',
    updatedAt: '2024-01-15T15:30:00Z',
  },
];

// ─── Helpers ──────────────────────────────────
const categoryColors: Record<string, { text: string; bg: string; border: string }> = {
  preference: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  pattern: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  decision: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  error: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

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
  'team-sync': {
    label: 'Team Sync',
    icon: Users,
    color: 'purple',
    desc: 'Shared context across multi-agent teams',
  },
};

const tabColorMap: Record<string, { text: string; bg: string; border: string; indicator: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', indicator: 'bg-emerald-500' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', indicator: 'bg-sky-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', indicator: 'bg-amber-500' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', indicator: 'bg-purple-500' },
};

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

// ─── Animation ────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function MemoryView() {
  const { memories } = useChatStore();
  const [activeTab, setActiveTab] = useState<MemoryTab>('session');
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // ── Form State ──────────────────────────────
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('preference');
  const [formImportance, setFormImportance] = useState('5');
  const [formTags, setFormTags] = useState('');

  // ── Stats ───────────────────────────────────
  const stats = useMemo(() => {
    return {
      total: MOCK_SESSION_MEMORIES.length + MOCK_MEMDIR_ITEMS.length + MOCK_MAGIC_DOCS.length + MOCK_TEAM_SYNC.length,
      session: MOCK_SESSION_MEMORIES.length,
      memdir: MOCK_MEMDIR_ITEMS.length,
      magicDoc: MOCK_MAGIC_DOCS.length,
      teamSync: MOCK_TEAM_SYNC.length,
      byCategory: {
        preference: MOCK_SESSION_MEMORIES.filter((m) => m.category === 'preference').length +
                    MOCK_MEMDIR_ITEMS.filter((m) => m.category === 'preference').length,
        pattern: MOCK_SESSION_MEMORIES.filter((m) => m.category === 'pattern').length +
                 MOCK_MEMDIR_ITEMS.filter((m) => m.category === 'pattern').length,
        decision: MOCK_SESSION_MEMORIES.filter((m) => m.category === 'decision').length +
                  MOCK_MEMDIR_ITEMS.filter((m) => m.category === 'decision').length,
        error: MOCK_MEMDIR_ITEMS.filter((m) => m.category === 'error').length,
      },
    };
  }, []);

  const handleAddMemory = () => {
    if (!formContent.trim()) return;
    setAddDialogOpen(false);
    setFormContent('');
    setFormCategory('preference');
    setFormImportance('5');
    setFormTags('');
  };

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
                    4 Layers
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hierarchical memory — from ephemeral session context to persistent team knowledge
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Memory
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-border/50 bg-zinc-900">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Add New Memory</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content</label>
                      <Input
                        placeholder="Enter memory content..."
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        className="text-sm"
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
                            <SelectItem value="preference">Preference</SelectItem>
                            <SelectItem value="pattern">Pattern</SelectItem>
                            <SelectItem value="decision">Decision</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
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
                      disabled={!formContent.trim()}
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" />
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
              Total: {stats.total}
            </Badge>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
              Session: {stats.session}
            </Badge>
            <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-xs text-sky-400">
              Memdir: {stats.memdir}
            </Badge>
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
              Magic Docs: {stats.magicDoc}
            </Badge>
            <Badge variant="outline" className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400">
              Team Sync: {stats.teamSync}
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
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ephemeral in-memory context — lives for the duration of the current conversation
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                        {MOCK_SESSION_MEMORIES.map((mem) => {
                          const cc = categoryColors[mem.category] || categoryColors.pattern;
                          return (
                            <motion.div key={mem.id} variants={item} layout>
                              <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <p className="text-xs text-foreground leading-relaxed flex-1">{mem.content}</p>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <ImportanceStars importance={mem.importance} />
                                  <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                    {mem.category}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
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
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    File-path based memories — CLAUDE.md conventions, project-level facts, per-file context
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                        {MOCK_MEMDIR_ITEMS.map((mem) => {
                          const cc = categoryColors[mem.category] || categoryColors.pattern;
                          return (
                            <motion.div key={mem.id} variants={item} layout>
                              <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <FileCode className="h-3 w-3 text-sky-400/70" />
                                      <code className="text-[10px] text-sky-400">{mem.filePath}</code>
                                    </div>
                                    <p className="text-xs text-foreground leading-relaxed">{mem.content}</p>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`h-5 px-1.5 text-[9px] border ${cc.border} ${cc.bg} ${cc.text}`}>
                                    {mem.category}
                                  </Badge>
                                  {mem.tags.map((tag) => (
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
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-generated documentation — project summaries, architecture decisions, hot entries
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                        {MOCK_MAGIC_DOCS.map((doc) => (
                          <motion.div key={doc.id} variants={item} layout>
                            <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <BookOpen className="h-3.5 w-3.5 text-amber-400/70" />
                                    <h4 className="text-xs font-semibold text-foreground">{doc.title}</h4>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">{doc.content}</p>
                                </div>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap mt-2">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-2.5 w-2.5 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground">{doc.sourceFiles.length} sources</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Database className="h-2.5 w-2.5 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground">{doc.accessCount} accesses</span>
                                </div>
                                {doc.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[9px] border-amber-500/20 bg-amber-500/5 text-amber-400/70">
                                    <Tag className="mr-0.5 h-2 w-2" />
                                    {tag}
                                  </Badge>
                                ))}
                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatDate(doc.generatedAt)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Team Sync Tab ────────────────── */}
            <TabsContent value="team-sync">
              <Card className="border-border/50 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <CardTitle className="text-sm">Team Sync</CardTitle>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Shared facts across multi-agent teams — per-agent context, conflict resolution
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                        {MOCK_TEAM_SYNC.map((teamItem) => (
                          <motion.div key={teamItem.id} variants={item} layout>
                            <div className="rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card/80">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <p className="text-xs text-foreground leading-relaxed flex-1">{teamItem.fact}</p>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-red-400 shrink-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Users className="h-2.5 w-2.5 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground">{teamItem.agents.join(', ')}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[9px] ${
                                    teamItem.status === 'shared'
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                      : teamItem.status === 'conflict'
                                        ? 'border-red-500/20 bg-red-500/10 text-red-400'
                                        : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                  }`}
                                >
                                  {teamItem.status === 'shared' && <CheckCircle className="mr-0.5 h-2 w-2" />}
                                  {teamItem.status === 'conflict' && <AlertCircle className="mr-0.5 h-2 w-2" />}
                                  {teamItem.status}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatDate(teamItem.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
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
                  <p className="text-[11px] text-muted-foreground">How Claude Code manages context across sessions</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Session (L1)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Volatile in-memory context. System prompt, recent messages, active tool calls, and inferred preferences. Cleared when the session ends.
                  </p>
                </div>
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FolderTree className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-xs font-medium text-sky-400">Memdir (L2)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Persistent file-scoped memories. CLAUDE.md conventions, project facts, per-file context stored on disk. Survives across sessions.
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">Magic Docs (L3)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Auto-generated documentation. Project summaries, architecture decisions, and frequently accessed context entries with hot-entry tracking.
                  </p>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">Team Sync (L4)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Shared multi-agent context. Facts visible to all agents, per-agent private context, and conflict resolution log for consistency.
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

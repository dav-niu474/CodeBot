'use client';

import { useChatStore } from '@/store/chat-store';
import type { ToolCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Wrench,
  FileText,
  FileEdit,
  FolderOpen,
  Search,
  ScanSearch,
  Globe,
  Link,
  Image as ImageIcon,
  Code,
  Terminal,
  Brain,
  Save,
  Eye,
  Pencil,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const categoryLabels: Record<ToolCategory, string> = {
  'file-operations': 'File Operations',
  search: 'Search',
  web: 'Web',
  generation: 'Generation',
  system: 'System',
  general: 'General',
};

const categoryColors: Record<ToolCategory, { text: string; bg: string }> = {
  'file-operations': { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  search: { text: 'text-sky-400', bg: 'bg-sky-500/10' },
  web: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  generation: { text: 'text-purple-400', bg: 'bg-purple-500/10' },
  system: { text: 'text-rose-400', bg: 'bg-rose-500/10' },
  general: { text: 'text-zinc-400', bg: 'bg-zinc-500/10' },
};

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-4 w-4" />,
  FileEdit: <FileEdit className="h-4 w-4" />,
  FolderOpen: <FolderOpen className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  ScanSearch: <ScanSearch className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Link: <Link className="h-4 w-4" />,
  Image: <ImageIcon className="h-4 w-4" />,
  Code: <Code className="h-4 w-4" />,
  Terminal: <Terminal className="h-4 w-4" />,
  Brain: <Brain className="h-4 w-4" />,
  Save: <Save className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
};

export function ToolsView() {
  const { tools, toggleTool } = useChatStore();

  // Group by category
  const groupedTools = tools.reduce<Record<ToolCategory, typeof tools>>((acc, tool) => {
    const cat = tool.category as ToolCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {} as Record<ToolCategory, typeof tools>);

  const enabledCount = tools.filter((t) => t.isEnabled).length;
  const readOnlyCount = tools.filter((t) => t.isReadOnly).length;

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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Wrench className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Tools</h1>
              <p className="text-xs text-muted-foreground">
                Manage agent tools and capabilities
              </p>
            </div>
          </div>
        </motion.div>

        {/* Summary Bar */}
        <motion.div variants={item} className="mb-6">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
              {enabledCount} Active
            </Badge>
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
              {tools.length - enabledCount} Disabled
            </Badge>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {readOnlyCount} Read-only
              </div>
              <div className="flex items-center gap-1">
                <Pencil className="h-3 w-3" />
                {tools.length - readOnlyCount} State-changing
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tool Categories */}
        <div className="space-y-6">
          {Object.entries(groupedTools).map(([category, categoryTools]) => {
            const colors = categoryColors[category as ToolCategory];
            return (
              <motion.div key={category} variants={item}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`rounded-md p-1 ${colors.bg}`}>
                    <span className={`text-xs font-semibold ${colors.text}`}>
                      {categoryLabels[category as ToolCategory]}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {categoryTools.filter((t) => t.isEnabled).length}/{categoryTools.length}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryTools.map((tool) => (
                    <TooltipProvider key={tool.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card
                            className={`group cursor-pointer border-border/50 bg-card/50 transition-all hover:bg-card/80 ${
                              tool.isEnabled
                                ? 'ring-1 ring-inset ring-emerald-500/10'
                                : 'opacity-60'
                            }`}
                            onClick={() => toggleTool(tool.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className={`rounded-lg p-2 ${colors.bg}`}>
                                  <span className={colors.text}>
                                    {iconMap[tool.icon] || <Wrench className="h-4 w-4" />}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-foreground truncate">
                                      {tool.name}
                                    </span>
                                    {tool.isReadOnly && (
                                      <Eye className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                                    )}
                                    {!tool.isReadOnly && (
                                      <ShieldAlert className="h-3 w-3 shrink-0 text-amber-500/40" />
                                    )}
                                  </div>
                                  <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                                    {tool.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={tool.isEnabled}
                                  onCheckedChange={() => toggleTool(tool.id)}
                                  className="shrink-0"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {tool.isReadOnly ? 'Read-only tool' : 'Can modify state'} · Click to toggle
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

'use client';

import { useChatStore } from '@/store/chat-store';
import type { RunningMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Sparkles, Wrench, Brain, ChevronDown,
  Cpu, Star, Check,
} from 'lucide-react';
import {
  Code, Server, RefreshCw, LayoutGrid, Layers, Monitor, Database,
  Boxes, Zap, ShieldCheck, BookOpen, Package,
  AlertTriangle, Building, GitBranch, GitCompare, DollarSign, FileSearch,
  Wand2, FolderPlus, ArrowRightLeft, TestTube2, FileText, Table,
  Bug, AlertCircle, HardDrive, Gauge, AlertOctagon,
  TestTube, GitMerge, Workflow, Target, PieChart, Activity,
  GitPullRequest, Container, Eye, FileCode, Rocket, Settings,
  Shield, Lock, KeyRound, ScanFace,
  Globe, Languages, PenTool, Palette, Video, Music, Image,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Mode config for the switcher
const QUICK_MODES: Array<{
  mode: RunningMode;
  label: string;
  emoji: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = [
  {
    mode: 'interactive',
    label: 'Interactive',
    emoji: '💬',
    description: 'Standard chat mode',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
  },
  {
    mode: 'coordinator',
    label: 'Coordinator',
    emoji: '🧩',
    description: 'Leader-Worker parallel agents',
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
  },
  {
    mode: 'swarm',
    label: 'Swarm',
    emoji: '🐝',
    description: 'Multi-agent collaboration',
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
  },
  {
    mode: 'teammate',
    label: 'Teammate',
    emoji: '🤝',
    description: 'AI as your team member',
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
  },
];

// Map skill icon names to Lucide components
const skillIconMap: Record<string, LucideIcon> = {
  Code, Server, RefreshCw, LayoutGrid, Layers, Monitor, Database,
  Boxes, Zap, ShieldCheck, BookOpen, Package,
  AlertTriangle, Building, GitBranch, GitCompare, DollarSign, FileSearch,
  Wand2, FolderPlus, ArrowRightLeft, TestTube2, FileText, Table,
  Sparkles: Sparkles,
  Bug, AlertCircle, HardDrive, Gauge, AlertOctagon,
  Wrench: Wrench,
  TestTube, GitMerge, Workflow, Target, PieChart, Activity,
  GitPullRequest, Container, Eye, FileCode, Rocket, Settings: Settings,
  Shield, Lock, KeyRound, ScanFace,
  Globe, Languages, PenTool, Palette, Video, Music, Image,
};

// Provider color map for model avatars
const providerColorMap: Record<string, string> = {
  meta: 'bg-blue-500',
  mistral: 'bg-orange-500',
  google: 'bg-red-500',
  microsoft: 'bg-sky-500',
  nvidia: 'bg-green-500',
  openai: 'bg-emerald-400',
  qwen: 'bg-cyan-500',
  deepseek: 'bg-teal-500',
  moonshotai: 'bg-rose-500',
  stepfun: 'bg-fuchsia-500',
  default: 'bg-zinc-500',
};

export function ChatToolbar() {
  const {
    activeMode,
    setActiveMode,
    skills,
    tools,
    setActiveView,
    selectedModel,
    setSelectedModel,
    models,
    bookmarkedModels,
  } = useChatStore();

  // Bookmarked models list
  const bookmarkedModelItems = models.filter(m => bookmarkedModels.includes(m.id));

  // Helper: get display name for a model
  const getModelDisplayName = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) return model.name;
    return modelId.split('/').pop()?.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') ?? modelId;
  };

  // Helper: get provider color class
  const getProviderColor = (provider: string) => {
    const key = provider.toLowerCase();
    return providerColorMap[key] || providerColorMap.default;
  };

  // Helper: get provider initial
  const getProviderInitial = (provider: string) => {
    return provider.charAt(0).toUpperCase();
  };

  // Current mode config
  const currentMode = QUICK_MODES.find(m => m.mode === activeMode) || QUICK_MODES[0];

  // Enabled skills and tools counts
  const enabledSkills = skills.filter(s => s.isEnabled);
  const enabledTools = tools.filter(t => t.isEnabled);

  // Handle skill click → inject prompt into chat input
  const handleSkillClick = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('quick-action', { detail: prompt }));
  };

  return (
    <div className="mx-auto flex max-w-4xl items-center gap-2 px-1 py-1.5">
      {/* Model Quick Switcher */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline max-w-[120px] truncate">{getModelDisplayName(selectedModel)}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start" side="top">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="mr-1 inline h-2.5 w-2.5 text-amber-400" />
              Pinned Models
            </span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] text-amber-400">
              {bookmarkedModelItems.length}
            </Badge>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-0.5">
              {bookmarkedModelItems.length === 0 ? (
                <div className="px-2 py-4 text-center text-[10px] text-muted-foreground/50">
                  No models pinned. Visit Model Hub to pin models.
                </div>
              ) : (
                bookmarkedModelItems.map(model => {
                  const isActive = model.id === selectedModel;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all',
                        isActive
                          ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                          : 'hover:bg-muted/60'
                      )}
                    >
                      <div className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                        getProviderColor(model.provider)
                      )}>
                        {getProviderInitial(model.provider)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          'truncate text-[11px] font-medium',
                          isActive ? 'text-emerald-400' : 'text-foreground'
                        )}>
                          {model.name}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground/60">
                          {model.provider}
                        </div>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-1.5 border-t border-border/30 pt-1.5">
            <button
              onClick={() => setActiveView('model-hub')}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Manage in Model Hub →
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Separator */}
      <div className="h-4 w-px bg-border/40" />

      {/* Mode Switcher */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-all',
              currentMode.bgClass,
              currentMode.colorClass,
              'hover:opacity-80',
              activeMode !== 'interactive' && currentMode.borderClass
            )}
          >
            <span className="text-xs">{currentMode.emoji}</span>
            <span>{currentMode.label}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start" side="top">
          <div className="space-y-1">
            {QUICK_MODES.map(m => (
              <button
                key={m.mode}
                onClick={() => setActiveMode(m.mode)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all',
                  activeMode === m.mode
                    ? cn(m.bgClass, 'ring-1', m.borderClass)
                    : 'hover:bg-muted/60'
                )}
              >
                <span className="text-base">{m.emoji}</span>
                <div className="flex-1">
                  <div className={cn(
                    'text-xs font-semibold',
                    activeMode === m.mode ? m.colorClass : 'text-foreground'
                  )}>
                    {m.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{m.description}</div>
                </div>
                {activeMode === m.mode && (
                  <div className={cn('h-1.5 w-1.5 rounded-full', m.colorClass.replace('text-', 'bg-'))} />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Separator */}
      <div className="h-4 w-px bg-border/40" />

      {/* Skills Quick Access */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Skills</span>
            <Badge
              variant="secondary"
              className="h-4 min-w-4 px-1 text-[9px] tabular-nums text-emerald-400"
            >
              {enabledSkills.length}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start" side="top">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Skills
            </span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] text-emerald-400">
              {enabledSkills.length}/{skills.length}
            </Badge>
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-0.5">
              {enabledSkills.length === 0 ? (
                <div className="px-2 py-4 text-center text-[10px] text-muted-foreground/50">
                  No skills enabled. Visit Skills page to enable.
                </div>
              ) : (
                enabledSkills.map(skill => {
                  const IconComp = skillIconMap[skill.icon];
                  return (
                    <button
                      key={skill.id}
                      onClick={() => {
                        const prompt = `[${skill.name}] ${skill.description}\n\n`;
                        handleSkillClick(prompt);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-emerald-500/8 group"
                    >
                      {IconComp ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/15">
                          <IconComp className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-foreground">
                          {skill.name}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground/60">
                          {skill.description}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <div className="mt-1.5 border-t border-border/30 pt-1.5">
            <button
              onClick={() => setActiveView('skills')}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Manage All Skills →
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Separator */}
      <div className="h-4 w-px bg-border/40" />

      {/* Tools Indicator */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-sky-500/10"
        onClick={() => setActiveView('tools')}
        title={`${enabledTools.length} tools enabled — click to manage`}
      >
        <Wrench className="h-3.5 w-3.5" />
        <span>Tools</span>
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] tabular-nums text-sky-400">
          {enabledTools.length}
        </Badge>
      </Button>

      {/* Memory Indicator */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-purple-500/10"
        onClick={() => setActiveView('memory')}
        title="View and manage memories"
      >
        <Brain className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Memory</span>
      </Button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { RunningMode, FeatureFlag } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquare,
  Activity,
  Map,
  GitBranch,
  Mic,
  Network,
  Waypoints,
  UserCheck,
  Compass,
  Moon,
  Play,
  MessageCircle,
  Zap,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Mode Configuration ───────────────────────
interface ModeConfigEntry {
  mode: RunningMode;
  label: string;
  icon: LucideIcon;
  description: string;
  fullDescription: string;
  allowsExecution: boolean;
  isConversational: boolean;
  isAutonomous: boolean;
  requiredFlags: FeatureFlag[];
  color: string;
  relatedTools: string[];
}

const MODE_CONFIGS: ModeConfigEntry[] = [
  {
    mode: 'interactive',
    label: 'Interactive',
    icon: MessageSquare,
    description: 'Default chat mode with full tool access and multi-turn conversation.',
    fullDescription: 'The standard interactive mode. User and agent take turns in a conversational loop. The agent has access to all core tools and can execute commands, read/write files, search the web, and more. This is the default mode that works out of the box with no feature flags required.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
    requiredFlags: [],
    color: 'emerald',
    relatedTools: ['BashTool', 'FileReadTool', 'FileWriteTool', 'WebSearchTool', 'AgentTool'],
  },
  {
    mode: 'kairos',
    label: 'KAIROS',
    icon: Activity,
    description: '7×24 proactive autonomous agent that acts independently without user prompting.',
    fullDescription: 'KAIROS mode enables the agent to operate autonomously around the clock. It can proactively identify tasks, execute workflows, monitor systems, and take actions without waiting for user input. Uses the PROACTIVE feature flag for continuous background operation.',
    allowsExecution: true,
    isConversational: false,
    isAutonomous: true,
    requiredFlags: ['KAIROS', 'PROACTIVE'],
    color: 'amber',
    relatedTools: ['BashTool', 'AgentTool', 'WebSearchTool', 'DreamTaskTool', 'ScheduleCronTool'],
  },
  {
    mode: 'plan',
    label: 'Plan Mode',
    icon: Map,
    description: 'Planning without execution — the agent creates detailed plans.',
    fullDescription: 'In plan mode, the agent analyzes the codebase and creates detailed implementation plans without executing any changes. Tools that modify state are disabled. The agent focuses on understanding the codebase, identifying patterns, and proposing structured approaches before switching back to interactive mode for execution.',
    allowsExecution: false,
    isConversational: true,
    isAutonomous: false,
    requiredFlags: [],
    color: 'blue',
    relatedTools: ['FileReadTool', 'GrepTool', 'GlobTool', 'BriefTool', 'EnterPlanModeTool'],
  },
  {
    mode: 'worktree',
    label: 'Worktree',
    icon: GitBranch,
    description: 'Git worktree isolation for safe parallel development branches.',
    fullDescription: 'Worktree mode creates and manages isolated git worktrees, allowing the agent to work on multiple branches simultaneously without conflicts. Each worktree has its own working directory and staging area, enabling safe experimentation and parallel development workflows.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
    requiredFlags: [],
    color: 'teal',
    relatedTools: ['EnterWorktreeTool', 'ExitWorktreeTool', 'BashTool', 'FileWriteTool', 'GitBranch'],
  },
  {
    mode: 'voice',
    label: 'Voice',
    icon: Mic,
    description: 'Voice interaction mode with speech-to-text and text-to-speech.',
    fullDescription: 'Voice mode enables hands-free interaction with the agent. Speech input is transcribed to text and processed normally, while responses can be spoken back via text-to-speech. Ideal for accessibility, mobile use, and situations where typing is impractical.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
    requiredFlags: ['VOICE'],
    color: 'purple',
    relatedTools: ['VoiceTool', 'BashTool', 'FileReadTool', 'WebSearchTool'],
  },
  {
    mode: 'coordinator',
    label: 'Coordinator',
    icon: Network,
    description: 'Leader-Worker multi-agent orchestration for complex tasks.',
    fullDescription: 'Coordinator mode enables hierarchical multi-agent coordination. The leader agent decomposes complex tasks, delegates subtasks to worker agents, and synthesizes results. Workers can be specialized (code review, testing, documentation) and work in parallel under the coordinator supervision.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: true,
    requiredFlags: ['COORDINATOR'],
    color: 'orange',
    relatedTools: ['AgentTool', 'TeamCreateTool', 'TaskCreateTool', 'TaskListTool', 'SendMessageTool'],
  },
  {
    mode: 'swarm',
    label: 'Swarm',
    icon: Waypoints,
    description: 'Peer-to-peer parallel agent execution for maximum throughput.',
    fullDescription: 'Swarm mode launches multiple agents as peers that work in parallel on different aspects of a task. Unlike the hierarchical coordinator mode, swarm agents communicate directly with each other and self-organize. Best suited for large-scale codebase analysis, bulk refactoring, and parallel testing.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: true,
    requiredFlags: ['SWARM'],
    color: 'red',
    relatedTools: ['AgentTool', 'TeamCreateTool', 'TaskCreateTool', 'TaskGetTool', 'TeamDeleteTool'],
  },
  {
    mode: 'teammate',
    label: 'Teammate',
    icon: UserCheck,
    description: 'In-process agent teammate collaborating alongside the user.',
    fullDescription: 'Teammate mode positions the agent as a collaborative team member rather than an assistant. The agent proactively suggests changes, reviews your code in real-time, and works alongside you on the same codebase. Maintains a shared context and follows team conventions.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
    requiredFlags: [],
    color: 'cyan',
    relatedTools: ['SendMessageTool', 'AskUserQuestionTool', 'BriefTool', 'TodoWriteTool', 'ToolSearchTool'],
  },
  {
    mode: 'ultraplan',
    label: 'UltraPlan',
    icon: Compass,
    description: 'Deep multi-step planning with dependency analysis and execution paths.',
    fullDescription: 'UltraPlan extends the basic plan mode with deep multi-step analysis. The agent performs dependency analysis, risk assessment, resource estimation, and creates multiple alternative execution paths. Each plan includes rollback strategies and milestone checkpoints. Supports iterative plan refinement.',
    allowsExecution: true,
    isConversational: true,
    isAutonomous: true,
    requiredFlags: ['ULTRAPLAN'],
    color: 'indigo',
    relatedTools: ['EnterPlanModeTool', 'ToolSearchTool', 'BriefTool', 'AgentTool', 'FileReadTool'],
  },
  {
    mode: 'dream',
    label: 'Dream',
    icon: Moon,
    description: 'Background async memory consolidation and learning.',
    fullDescription: 'Dream mode runs asynchronous background tasks that consolidate memory, learn patterns from the codebase, and generate documentation. The agent processes information while idle, building a richer context for future interactions. Dream tasks run independently and update the memory system.',
    allowsExecution: true,
    isConversational: false,
    isAutonomous: true,
    requiredFlags: ['DREAM'],
    color: 'pink',
    relatedTools: ['DreamTaskTool', 'MagicDocsTool', 'BriefTool', 'SkillTool', 'ConfigTool'],
  },
];

// ─── Color Helpers ────────────────────────────
const colorMap: Record<string, { bg: string; border: string; text: string; ring: string; badgeBg: string; badgeText: string; glow: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/30', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/30', badgeBg: 'bg-amber-500/10', badgeText: 'text-amber-400', glow: 'shadow-amber-500/10' },
  blue: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', ring: 'ring-sky-500/30', badgeBg: 'bg-sky-500/10', badgeText: 'text-sky-400', glow: 'shadow-sky-500/10' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', ring: 'ring-teal-500/30', badgeBg: 'bg-teal-500/10', badgeText: 'text-teal-400', glow: 'shadow-teal-500/10' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', ring: 'ring-purple-500/30', badgeBg: 'bg-purple-500/10', badgeText: 'text-purple-400', glow: 'shadow-purple-500/10' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30', badgeBg: 'bg-orange-500/10', badgeText: 'text-orange-400', glow: 'shadow-orange-500/10' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30', badgeBg: 'bg-red-500/10', badgeText: 'text-red-400', glow: 'shadow-red-500/10' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', ring: 'ring-cyan-500/30', badgeBg: 'bg-cyan-500/10', badgeText: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', ring: 'ring-indigo-500/30', badgeBg: 'bg-indigo-500/10', badgeText: 'text-indigo-400', glow: 'shadow-indigo-500/10' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', ring: 'ring-pink-500/30', badgeBg: 'bg-pink-500/10', badgeText: 'text-pink-400', glow: 'shadow-pink-500/10' },
};

// ─── Animation ────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function ModesView() {
  const { activeMode, setActiveMode, featureFlags, setActiveView } = useChatStore();
  const [selectedMode, setSelectedMode] = useState<ModeConfigEntry | null>(null);

  const currentConfig = MODE_CONFIGS.find((m) => m.mode === activeMode) || MODE_CONFIGS[0];
  const colors = colorMap[currentConfig.color] || colorMap.emerald;

  const isFlagEnabled = (flag: FeatureFlag): boolean => {
    return featureFlags[flag] ?? false;
  };

  const areFlagsMet = (mode: ModeConfigEntry): boolean => {
    return mode.requiredFlags.every((f) => isFlagEnabled(f));
  };

  const handleActivate = (mode: ModeConfigEntry) => {
    setActiveMode(mode.mode);
    setSelectedMode(mode);
    setActiveView('chat');
    toast.success(`${mode.label} mode activated`, { description: 'You are now in the chat view' });
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Zap className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Running Modes</h1>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400">
                  10 Modes
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Select how the agent operates — from interactive chat to autonomous swarms
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Current Active Mode ────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className={`border ${colors.border} ${colors.bg} shadow-lg ${colors.glow}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} ring-1 ${colors.ring}`}>
                  <currentConfig.icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">{currentConfig.label}</h2>
                    <Badge className={`${colors.badgeBg} ${colors.badgeText} border ${colors.border} text-[10px]`}>
                      Active
                    </Badge>
                    {currentConfig.isAutonomous && (
                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                        <Zap className="mr-0.5 h-2.5 w-2.5 animate-pulse" />
                        Autonomous
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{currentConfig.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentConfig.isConversational && (
                  <Badge variant="outline" className="h-6 text-[10px] border-border/50">
                    <MessageCircle className="mr-1 h-3 w-3 text-emerald-400" />
                    Conversational
                  </Badge>
                )}
                {currentConfig.allowsExecution && (
                  <Badge variant="outline" className="h-6 text-[10px] border-border/50">
                    <Play className="mr-1 h-3 w-3 text-emerald-400" />
                    Execution
                  </Badge>
                )}
                {currentConfig.isAutonomous && (
                  <Badge variant="outline" className="h-6 text-[10px] border-border/50">
                    <Zap className="mr-1 h-3 w-3 text-amber-400" />
                    Autonomous
                  </Badge>
                )}
                {currentConfig.requiredFlags.length > 0 && (
                  <Badge variant="outline" className="h-6 text-[10px] border-border/50">
                    <Shield className="mr-1 h-3 w-3 text-purple-400" />
                    {currentConfig.requiredFlags.length} flags required
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Mode Cards Grid ────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:grid-cols-2"
        >
          {MODE_CONFIGS.map((mode) => {
            const isActive = activeMode === mode.mode;
            const isSelected = selectedMode?.mode === mode.mode;
            const mc = colorMap[mode.color] || colorMap.emerald;
            const flagsMet = areFlagsMet(mode);
            const IconComp = mode.icon;

            return (
              <motion.div key={mode.mode} variants={item}>
                <Card
                  className={`group relative border cursor-pointer transition-all duration-200 ${
                    isActive
                      ? `border ${mc.border} ${mc.bg} ring-1 ${mc.ring} shadow-md ${mc.glow}`
                      : isSelected
                        ? `border-border bg-card/80`
                        : 'border-border/50 bg-card/50 hover:bg-card/80 hover:border-border'
                  }`}
                  onClick={() => setSelectedMode(mode)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`rounded-xl p-2.5 ${mc.bg} ring-1 ${mc.border} shrink-0`}>
                        <IconComp className={`h-5 w-5 ${mc.text}`} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-foreground">{mode.label}</h3>
                          {mode.isConversational && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400/60" />
                                </TooltipTrigger>
                                <TooltipContent>Conversational</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {mode.isAutonomous && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                                </TooltipTrigger>
                                <TooltipContent>Autonomous</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {mode.allowsExecution && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Play className="h-3.5 w-3.5 text-emerald-400/60" />
                                </TooltipTrigger>
                                <TooltipContent>Allows Execution</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                          {mode.description}
                        </p>

                        {/* Required Flags */}
                        {mode.requiredFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {mode.requiredFlags.map((flag) => {
                              const enabled = isFlagEnabled(flag);
                              return (
                                <Badge
                                  key={flag}
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[9px] ${
                                    enabled
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                      : 'border-red-500/20 bg-red-500/10 text-red-400'
                                  }`}
                                >
                                  {flag}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Activate Button */}
                        <Button
                          size="sm"
                          variant={isActive ? 'default' : 'outline'}
                          className={`h-7 text-xs ${
                            isActive
                              ? `bg-emerald-600 text-white hover:bg-emerald-700`
                              : !flagsMet
                                ? 'opacity-40 cursor-not-allowed'
                                : 'border-border/50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (flagsMet) handleActivate(mode);
                          }}
                        >
                          {isActive ? 'Currently Active' : flagsMet ? 'Activate' : 'Flags Required'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Mode Details Panel ─────────────── */}
        <AnimatePresence mode="wait">
          {selectedMode && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-6"
            >
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const mc = colorMap[selectedMode.color] || colorMap.emerald;
                      const IconComp = selectedMode.icon;
                      return (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${mc.bg}`}>
                          <IconComp className={`h-4 w-4 ${mc.text}`} />
                        </div>
                      );
                    })()}
                    <h3 className="text-sm font-semibold text-foreground">{selectedMode.label}</h3>
                    <Badge variant="outline" className="text-[10px] border-border/50">
                      Details
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {selectedMode.fullDescription}
                  </p>

                  <Separator className="my-3" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Required Feature Flags */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Required Feature Flags</h4>
                      {selectedMode.requiredFlags.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No flags required — available by default.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedMode.requiredFlags.map((flag) => {
                            const enabled = isFlagEnabled(flag);
                            return (
                              <div key={flag} className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <code className="text-[11px] text-muted-foreground">{flag}</code>
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[9px] ${
                                    enabled
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                      : 'border-red-500/20 bg-red-500/10 text-red-400'
                                  }`}
                                >
                                  {enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Related Tools */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Related Tools</h4>
                      <div className="space-y-1.5">
                        {selectedMode.relatedTools.map((tool) => (
                          <div key={tool} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500/60" />
                            <code className="text-[11px] text-muted-foreground">{tool}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

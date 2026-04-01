'use client';

import { useChatStore } from '@/store/chat-store';
import type { SkillCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  LayoutGrid,
  Server,
  Database,
  GitPullRequest,
  Bug,
  FileText,
  TestTube,
  Container,
  Code,
  Brain,
  Lightbulb,
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

const categoryLabels: Record<SkillCategory, string> = {
  coding: 'Coding & Development',
  analysis: 'Analysis & Review',
  generation: 'Content Generation',
  communication: 'Communication',
  general: 'General',
};

const categoryColors: Record<SkillCategory, { text: string; bg: string; border: string }> = {
  coding: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  analysis: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  generation: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  communication: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  general: { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

const iconMap: Record<string, React.ReactNode> = {
  LayoutGrid: <LayoutGrid className="h-5 w-5" />,
  Server: <Server className="h-5 w-5" />,
  Database: <Database className="h-5 w-5" />,
  GitPullRequest: <GitPullRequest className="h-5 w-5" />,
  Bug: <Bug className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  TestTube: <TestTube className="h-5 w-5" />,
  Container: <Container className="h-5 w-5" />,
  Code: <Code className="h-5 w-5" />,
  Brain: <Brain className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Lightbulb: <Lightbulb className="h-5 w-5" />,
};

export function SkillsView() {
  const { skills, toggleSkill } = useChatStore();

  // Group by category
  const groupedSkills = skills.reduce<Record<SkillCategory, typeof skills>>(
    (acc, skill) => {
      const cat = skill.category as SkillCategory;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {} as Record<SkillCategory, typeof skills>
  );

  const enabledCount = skills.filter((s) => s.isEnabled).length;

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
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Skills</h1>
              <p className="text-xs text-muted-foreground">
                Manage specialized coding skills and workflows
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
              {skills.length - enabledCount} Disabled
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {skills.length} total skills
            </span>
          </div>
        </motion.div>

        {/* Skill Categories */}
        <div className="space-y-6">
          {Object.entries(groupedSkills).map(([category, categorySkills]) => {
            const colors = categoryColors[category as SkillCategory];
            return (
              <motion.div key={category} variants={item}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`rounded-md px-2 py-1 ${colors.bg}`}>
                    <span className={`text-xs font-semibold ${colors.text}`}>
                      {categoryLabels[category as SkillCategory]}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {categorySkills.filter((s) => s.isEnabled).length}/
                    {categorySkills.length}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {categorySkills.map((skill) => (
                    <TooltipProvider key={skill.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card
                            className={`group cursor-pointer border-border/50 bg-card/50 transition-all hover:bg-card/80 ${
                              skill.isEnabled
                                ? `ring-1 ring-inset ${colors.border}`
                                : 'opacity-60'
                            }`}
                            onClick={() => toggleSkill(skill.id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`rounded-xl p-2.5 ${colors.bg}`}>
                                  <span className={colors.text}>
                                    {iconMap[skill.icon] || (
                                      <Sparkles className="h-5 w-5" />
                                    )}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-foreground">
                                      {skill.name}
                                    </span>
                                  </div>
                                  <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                                    {skill.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={skill.isEnabled}
                                  onCheckedChange={() => toggleSkill(skill.id)}
                                  className="shrink-0 mt-1"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          Click to {skill.isEnabled ? 'disable' : 'enable'} skill
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {skills.length === 0 && (
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">
                  No skills configured
                </p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  Skills will appear here once configured
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

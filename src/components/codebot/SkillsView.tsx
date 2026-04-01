'use client';

import { useState, useMemo } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { SkillCategory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Search,
  Layers,
  Zap,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ────────────────────────────────────────────
// Category metadata
// ────────────────────────────────────────────

const ALL_CATEGORIES: SkillCategory[] = [
  'coding',
  'analysis',
  'generation',
  'debugging',
  'testing',
  'devops',
  'security',
  'data',
  'communication',
  'general',
];

const categoryLabels: Record<SkillCategory, string> = {
  coding: 'Coding & Dev',
  analysis: 'Analysis',
  generation: 'Generation',
  debugging: 'Debugging',
  testing: 'Testing',
  devops: 'DevOps',
  security: 'Security',
  data: 'Data & AI',
  communication: 'Communication',
  general: 'General',
};

const categoryColors: Record<SkillCategory, { text: string; bg: string; border: string }> = {
  coding: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  analysis: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  generation: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  debugging: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  testing: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  devops: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  security: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  data: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  communication: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  general: { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

// ────────────────────────────────────────────
// Icon helper — dynamic Lucide icon resolution
// ────────────────────────────────────────────

function getIcon(iconName: string, className: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  if (!Icon) return <Sparkles className={className} />;
  return <Icon className={className} />;
}

// ────────────────────────────────────────────
// Animation variants
// ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────

export function SkillsView() {
  const { skills, toggleSkill } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all');

  // ── Derived stats ────────────────────────
  const enabledCount = skills.filter((s) => s.isEnabled).length;
  const disabledCount = skills.length - enabledCount;

  // ── Category counts ──────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: skills.length };
    for (const skill of skills) {
      counts[skill.category] = (counts[skill.category] || 0) + 1;
    }
    return counts;
  }, [skills]);

  // ── Filtered skills ──────────────────────
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Category filter
      if (activeCategory !== 'all' && skill.category !== activeCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [skills, activeCategory, searchQuery]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {/* ── Header ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Skills
                </h1>
                <p className="text-xs text-muted-foreground">
                  Manage specialized coding skills and workflows
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Summary Stats ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mb-6"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-emerald-400">{enabledCount}</span>
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="h-4 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-500/10">
                  <Layers className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <span className="text-sm font-medium text-zinc-400">{disabledCount}</span>
                <span className="text-xs text-muted-foreground">Disabled</span>
              </div>
              <div className="h-4 w-px bg-border/50" />
              <span className="ml-auto text-xs text-muted-foreground">
                {skills.length} total skills across {ALL_CATEGORIES.length} categories
              </span>
            </div>
          </motion.div>

          {/* ── Search Bar ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-5"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Search skills by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-4 text-sm border-border/50 bg-card/50 focus-visible:ring-emerald-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>

          {/* ── Category Filter Tabs ───────────── */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mb-6"
          >
            <div className="flex flex-wrap gap-2">
              {/* All tab */}
              <button
                onClick={() => setActiveCategory('all')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  activeCategory === 'all'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-card/80 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground'
                }`}
              >
                All
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    activeCategory === 'all'
                      ? 'bg-background/20 text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {categoryCounts.all || 0}
                </span>
              </button>

              {/* Category tabs */}
              {ALL_CATEGORIES.map((cat) => {
                const colors = categoryColors[cat];
                const count = categoryCounts[cat] || 0;
                const isActive = activeCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? `${colors.bg} ${colors.text} ring-1 ${colors.border} shadow-sm`
                        : 'bg-card/80 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground'
                    }`}
                  >
                    {categoryLabels[cat]}
                    <span
                      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                        isActive
                          ? `${colors.bg} ${colors.text}`
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Skill Grid ──────────────────────── */}
          {filteredSkills.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              key={`${activeCategory}-${searchQuery}`}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filteredSkills.map((skill) => {
                  const colors = categoryColors[skill.category as SkillCategory] || categoryColors.general;
                  return (
                    <motion.div
                      key={skill.id}
                      variants={cardVariants}
                      layout
                      exit="exit"
                    >
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Card
                              className={`group relative cursor-pointer border-border/50 bg-card/50 transition-all duration-200 hover:bg-card/80 hover:border-border ${
                                skill.isEnabled
                                  ? `ring-1 ring-inset ${colors.border}`
                                  : 'opacity-60 hover:opacity-80'
                              }`}
                              onClick={() => toggleSkill(skill.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  {/* Icon */}
                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.bg} transition-transform duration-200 group-hover:scale-110`}
                                  >
                                    <span className={colors.text}>
                                      {getIcon(skill.icon, 'h-4 w-4')}
                                    </span>
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold text-foreground truncate">
                                        {skill.name}
                                      </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                                      {skill.description}
                                    </p>
                                    <div className="mt-2">
                                      <span
                                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${colors.text} ${colors.bg} ${colors.border}`}
                                      >
                                        {categoryLabels[skill.category as SkillCategory]}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Toggle */}
                                  <Switch
                                    checked={skill.isEnabled}
                                    onCheckedChange={() => toggleSkill(skill.id)}
                                    className="shrink-0 mt-0.5 data-[state=checked]:bg-emerald-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {skill.isEnabled ? 'Click to disable' : 'Click to enable'} skill
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── Empty State ───────────────────── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="border-border/50 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                    <Search className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No skills found
                  </p>
                  <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground/60">
                    {searchQuery
                      ? `No skills match "${searchQuery}". Try a different search term or clear the filter.`
                      : `No skills in the "${categoryLabels[activeCategory as SkillCategory] || activeCategory}" category.`
                    }
                  </p>
                  {(searchQuery || activeCategory !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory('all');
                      }}
                      className="mt-4 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Results summary ─────────────────── */}
          {filteredSkills.length > 0 && (searchQuery || activeCategory !== 'all') && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground/50">
                Showing {filteredSkills.length} of {skills.length} skills
              </p>
            </div>
          )}

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </motion.div>
  );
}

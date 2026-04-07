'use client';

import { useChatStore } from '@/store/chat-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Cpu,
  MessageSquare,
  Brain,
  Eye,
  Globe,
  GitPullRequest,
  Code,
  BookOpen,
  Bug,
  Sparkles,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useMemo } from 'react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Brain,
  Eye,
  Globe,
  GitPullRequest,
  Code,
  BookOpen,
  Bug,
};

const categoryGroups = [
  {
    title: 'Chat & Reasoning',
    categories: ['chat', 'reasoning'],
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    title: 'Vision',
    categories: ['vision'],
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    title: 'Web & Search',
    categories: ['search'],
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    title: 'Code Intelligence',
    categories: ['code'],
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
];

export function AICapabilitiesView() {
  const { aiCapabilities, toggleAICapability, setActiveView } = useChatStore();

  const enabledCount = useMemo(
    () => aiCapabilities.filter((c) => c.isEnabled).length,
    [aiCapabilities]
  );

  const handleToggle = (id: string, name: string, isEnabled: boolean) => {
    toggleAICapability(id);
    toast(isEnabled ? `${name} disabled` : `${name} enabled`, {
      description: isEnabled
        ? 'Capability has been turned off'
        : 'Capability is now active',
    });
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Cpu className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                AI Capabilities
              </h1>
              <p className="text-xs text-muted-foreground">
                Configure the AI features and capabilities available to your agent
              </p>
            </div>
          </div>
        </motion.div>

        {/* Summary Badges */}
        <motion.div variants={item} className="mb-6 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400"
          >
            <Zap className="h-3 w-3" />
            {enabledCount} Active
          </Badge>
          <Badge
            variant="outline"
            className="border-border/50 text-xs text-muted-foreground"
          >
            {aiCapabilities.length} Total Capabilities
          </Badge>
          <Badge
            variant="outline"
            className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400"
          >
            <Shield className="h-3 w-3" />
            All Systems Operational
          </Badge>
        </motion.div>

        {/* Category Groups */}
        <div className="space-y-6">
          {categoryGroups.map((group) => {
            const groupCaps = aiCapabilities.filter((c) =>
              group.categories.includes(c.category)
            );
            if (groupCaps.length === 0) return null;

            return (
              <motion.div key={group.title} variants={item}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-1 w-1 rounded-full ${group.bg}`} />
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.title}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${group.color} border-opacity-30`}
                  >
                    {groupCaps.filter((c) => c.isEnabled).length}/{groupCaps.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupCaps.map((cap) => {
                    const IconComponent = iconMap[cap.icon] || Sparkles;
                    return (
                      <motion.div
                        key={cap.id}
                        variants={item}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <Card
                          className={`border-border/50 bg-card/50 transition-all hover:bg-card/80 ${
                            cap.isEnabled ? group.border : ''
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${group.bg} transition-colors ${
                                    cap.isEnabled ? '' : 'opacity-40'
                                  }`}
                                >
                                  <IconComponent className={`h-4 w-4 ${group.color}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {cap.name}
                                    </span>
                                    <div
                                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                        cap.isEnabled
                                          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                          : 'bg-zinc-600'
                                      }`}
                                    />
                                  </div>
                                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                    {cap.description}
                                  </p>
                                </div>
                              </div>
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Switch
                                        checked={cap.isEnabled}
                                        onCheckedChange={() =>
                                          handleToggle(cap.id, cap.name, cap.isEnabled)
                                        }
                                        disabled={!cap.isAvailable}
                                        className="scale-90"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">
                                    {cap.isEnabled ? 'Disable' : 'Enable'}{' '}
                                    {cap.name}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Apply to Chat CTA */}
        <motion.div variants={item} className="mt-6 flex justify-center">
          <button
            onClick={() => {
              const enabled = aiCapabilities.filter(c => c.isEnabled);
              setActiveView('chat');
              toast.success('Capabilities applied', {
                description: `${enabled.length} capabilities active in chat`,
              });
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30"
          >
            <MessageSquare className="h-4 w-4" />
            Start Chat with Current Settings
          </button>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

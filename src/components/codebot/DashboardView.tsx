'use client';

import { useChatStore } from '@/store/chat-store';
import { DEFAULT_AI_CAPABILITIES } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  MessageSquare,
  Wrench,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  Activity,
  Cpu,
  Brain,
  Eye,
  Globe,
  GitPullRequest,
  Code,
  BookOpen,
  Bug,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
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

const capColorMap: Record<string, { color: string; bg: string; border: string }> = {
  chat: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  reasoning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  vision: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  search: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  code: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
};

export function DashboardView() {
  const {
    sessions,
    messages,
    tools,
    skills,
    agentConfig,
    aiCapabilities,
    setActiveView,
    setActiveSession,
  } = useChatStore();

  const enabledTools = tools.filter((t) => t.isEnabled).length;
  const enabledSkills = skills.filter((s) => s.isEnabled).length;
  const enabledCaps = aiCapabilities.filter((c) => c.isEnabled).length;
  const totalTokens = messages.reduce((acc, m) => acc + m.tokens, 0);

  const stats = [
    {
      label: 'Total Sessions',
      value: sessions.length,
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Total Messages',
      value: messages.length,
      icon: <Activity className="h-4 w-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'AI Capabilities',
      value: enabledCaps,
      icon: <Cpu className="h-4 w-4" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      sub: `of ${aiCapabilities.length}`,
    },
    {
      label: 'Tools Active',
      value: enabledTools,
      icon: <Wrench className="h-4 w-4" />,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <motion.div variants={item} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20 codebot-glow">
              <span className="text-2xl">{agentConfig.avatar}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome to {agentConfig.agentName}
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered coding assistant inspired by Claude Code architecture
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={item} className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <Card
                key={stat.label}
                className="border-border/50 bg-card/50 transition-colors hover:border-border"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`rounded-md p-1.5 ${stat.bg}`}>
                      <span className={stat.color}>{stat.icon}</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </div>
                    {stat.sub && (
                      <span className="text-xs text-muted-foreground/50">{stat.sub}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* AI Capabilities Section */}
        <motion.div variants={item} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                AI Capabilities
              </h2>
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400"
              >
                {enabledCaps} active
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setActiveView('ai-capabilities')}
            >
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {DEFAULT_AI_CAPABILITIES.map((cap) => {
              const IconComponent = iconMap[cap.icon] || Sparkles;
              const colors = capColorMap[cap.category] || capColorMap.chat;
              const storeCap = aiCapabilities.find((c) => c.id === cap.id);
              const isEnabled = storeCap?.isEnabled ?? cap.isEnabled;

              return (
                <motion.div
                  key={cap.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="cursor-pointer"
                  onClick={() => setActiveView('ai-capabilities')}
                >
                  <Card
                    className={`border-border/50 bg-card/50 transition-all hover:bg-card/80 ${
                      isEnabled ? colors.border : ''
                    } hover:shadow-[0_0_16px_rgba(16,185,129,0.06)]`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${
                            isEnabled ? '' : 'opacity-40'
                          }`}
                        >
                          <IconComponent className={`h-3.5 w-3.5 ${colors.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground truncate">
                              {cap.name}
                            </span>
                            <div
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                isEnabled
                                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                  : 'bg-zinc-600'
                              }`}
                            />
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/60">
                            {cap.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Recent Sessions
              </h2>
            </div>
            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setActiveView('chat')}
              >
                View All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground">
                  No sessions yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  Create a new session to start coding
                </p>
                <Button
                  onClick={() => {
                    const newSession = {
                      id: `session-${Date.now()}`,
                      title: `Session 1`,
                      model: 'default',
                      systemPrompt: null,
                      isActive: true,
                      tokenCount: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    useChatStore.getState().addSession(newSession);
                  }}
                  className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500"
                  size="sm"
                >
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  Start First Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 5).map((session) => (
                <Card
                  key={session.id}
                  className="group cursor-pointer border-border/50 bg-card/50 transition-all hover:border-emerald-500/20 hover:bg-card/80"
                  onClick={() => setActiveSession(session.id)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {session.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(session.createdAt), {
                            addSuffix: true,
                          })}{' '}
                          · {session.tokenCount.toLocaleString()} tokens
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        {session.model}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

'use client';

import { useChatStore } from '@/store/chat-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  User,
  Cpu,
  Database,
  Gauge,
  Palette,
  Save,
  RotateCcw,
  Brain,
  GitPullRequest,
  BookOpen,
  Globe,
  Bug,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const quickActions = [
  {
    label: 'Code Review',
    prompt: 'Review the code in my current file',
    icon: <GitPullRequest className="h-4 w-4" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Explain Code',
    prompt: 'Explain this code step by step',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'Web Search',
    prompt: 'Search the web for the latest React best practices',
    icon: <Globe className="h-4 w-4" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    label: 'Debug Issue',
    prompt: 'Help me debug this error',
    icon: <Bug className="h-4 w-4" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
];

export function SettingsView() {
  const { agentConfig, setAgentConfig, setActiveView } = useChatStore();
  const [localConfig, setLocalConfig] = useState({ ...agentConfig });

  const handleSave = () => {
    setAgentConfig(localConfig);
    toast.success('Settings saved', {
      description: 'Agent configuration updated successfully.',
    });
  };

  const handleReset = () => {
    setLocalConfig({ ...agentConfig });
    toast.info('Settings reset', {
      description: 'Changes have been discarded.',
    });
  };

  const handleQuickAction = (prompt: string) => {
    const event = new CustomEvent('quick-action', { detail: prompt });
    window.dispatchEvent(event);
    setActiveView('chat');
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Settings className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">
                Configure agent behavior and appearance
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          {/* AI Capabilities Section - TOP */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold">
                    AI Capabilities
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Active Model */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Active Model
                  </Label>
                  <Select
                    value={localConfig.activeModel}
                    onValueChange={(val) =>
                      setLocalConfig({ ...localConfig, activeModel: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-emerald-400" />
                          Default
                        </div>
                      </SelectItem>
                      <SelectItem value="reasoning">
                        <div className="flex items-center gap-2">
                          <Brain className="h-3 w-3 text-amber-400" />
                          Reasoning
                        </div>
                      </SelectItem>
                      <SelectItem value="fast">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-purple-400" />
                          Fast
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                {/* Thinking Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Thinking Mode
                      </Label>
                      {localConfig.thinkingEnabled && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/20 bg-amber-500/10 text-[9px] text-amber-400"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      Enable step-by-step reasoning for complex problems
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.thinkingEnabled}
                    onCheckedChange={(val) =>
                      setLocalConfig({ ...localConfig, thinkingEnabled: val })
                    }
                  />
                </div>

                <Separator className="opacity-50" />

                {/* Temperature */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Temperature
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-border/50 text-[10px] tabular-nums"
                    >
                      {localConfig.temperature.toFixed(1)}
                    </Badge>
                  </div>
                  <Slider
                    value={[localConfig.temperature]}
                    onValueChange={([val]) =>
                      setLocalConfig({ ...localConfig, temperature: val })
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>Precise (0)</span>
                    <span>Creative (2)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick AI Actions */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold">
                    Quick AI Actions
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto flex-col items-start gap-2 border-border/50 bg-card/50 px-3 py-3 text-left transition-all hover:border-emerald-500/20 hover:bg-emerald-500/5"
                      onClick={() => handleQuickAction(action.prompt)}
                    >
                      <div className={`rounded-md p-1.5 ${action.bg}`}>
                        <span className={action.color}>{action.icon}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-foreground">
                          {action.label}
                        </span>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/60">
                          {action.prompt}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Identity Section */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold">Identity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name" className="text-xs text-muted-foreground">
                      Agent Name
                    </Label>
                    <Input
                      id="agent-name"
                      value={localConfig.agentName}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, agentName: e.target.value })
                      }
                      className="h-9 text-sm"
                      placeholder="CodeBot"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-avatar" className="text-xs text-muted-foreground">
                      Avatar Emoji
                    </Label>
                    <Input
                      id="agent-avatar"
                      value={localConfig.avatar}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, avatar: e.target.value })
                      }
                      className="h-9 text-sm"
                      placeholder="🤖"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personality" className="text-xs text-muted-foreground">
                    Personality
                  </Label>
                  <Select
                    value={localConfig.personality}
                    onValueChange={(val) =>
                      setLocalConfig({ ...localConfig, personality: val })
                    }
                  >
                    <SelectTrigger id="personality" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helpful">Helpful & Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Model Section */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold">Model</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Max Tokens</Label>
                    <Badge
                      variant="outline"
                      className="border-border/50 text-[10px] tabular-nums"
                    >
                      {localConfig.maxTokens.toLocaleString()}
                    </Badge>
                  </div>
                  <Slider
                    value={[localConfig.maxTokens]}
                    onValueChange={([val]) =>
                      setLocalConfig({ ...localConfig, maxTokens: val })
                    }
                    min={256}
                    max={16384}
                    step={256}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>256</span>
                    <span>16,384</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Context Section */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold">Context</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Auto-Compact Context
                    </Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      Automatically compress long conversations
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.autoCompact}
                    onCheckedChange={(val) =>
                      setLocalConfig({ ...localConfig, autoCompact: val })
                    }
                  />
                </div>
                <Separator className="opacity-50" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Compact Threshold
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-border/50 text-[10px] tabular-nums"
                    >
                      {localConfig.compactThreshold.toLocaleString()} tokens
                    </Badge>
                  </div>
                  <Slider
                    value={[localConfig.compactThreshold]}
                    onValueChange={([val]) =>
                      setLocalConfig({ ...localConfig, compactThreshold: val })
                    }
                    min={10000}
                    max={200000}
                    step={5000}
                    className="py-1"
                    disabled={!localConfig.autoCompact}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>10K</span>
                    <span>200K</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Performance Section */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-purple-400" />
                  <CardTitle className="text-sm font-semibold">Performance</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Tool Concurrency
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-border/50 text-[10px] tabular-nums"
                    >
                      {localConfig.toolConcurrency}
                    </Badge>
                  </div>
                  <Slider
                    value={[localConfig.toolConcurrency]}
                    onValueChange={([val]) =>
                      setLocalConfig({ ...localConfig, toolConcurrency: val })
                    }
                    min={1}
                    max={10}
                    step={1}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>1 (Sequential)</span>
                    <span>10 (Parallel)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Appearance Section */}
          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-rose-400" />
                  <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Theme</Label>
                    <Select
                      value={localConfig.theme}
                      onValueChange={(val) =>
                        setLocalConfig({
                          ...localConfig,
                          theme: val as 'dark' | 'light',
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <Select
                      value={localConfig.language}
                      onValueChange={(val) =>
                        setLocalConfig({ ...localConfig, language: val })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh-CN">中文</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                        <SelectItem value="ja-JP">日本語</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div
            variants={item}
            className="flex items-center justify-between pt-2 pb-4"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Discard Changes
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              size="sm"
            >
              <Save className="mr-1.5 h-3 w-3" />
              Save Settings
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

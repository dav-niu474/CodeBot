'use client';

import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { SecurityRule, PermissionLevel } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Lock,
  Eye,
  FileWarning,
  Brain,
  Terminal,
  FolderLock,
  KeyRound,
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Layers,
  GitFork,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// ── Animation Variants ──────────────────────────
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

// ── Permission Badge Styles ─────────────────────
const permissionStyles: Record<
  PermissionLevel,
  { color: string; bg: string; border: string; icon: LucideIcon }
> = {
  allow: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: ShieldCheck,
  },
  deny: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: ShieldAlert,
  },
  ask: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: ShieldQuestion,
  },
};

// ── Security Layers ─────────────────────────────
interface SecurityLayer {
  id: number;
  name: string;
  description: string;
  details: string[];
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SECURITY_LAYERS: SecurityLayer[] = [
  {
    id: 1,
    name: 'Permission Triple',
    description: 'Allow / Deny / Ask 三级判断系统',
    details: [
      '三级权限判定: allow、deny、ask',
      '优先级顺序: settings > CLI > command > session state',
      '支持通配符匹配和条件表达式',
      '会话级别权限状态覆盖全局设置',
    ],
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    id: 2,
    name: 'Policy Fallback',
    description: '自动降级策略',
    details: [
      '连续3次deny后自动降级到ask模式',
      '累计20次deny后触发全局降级',
      '防止agent因权限问题陷入死循环',
      '降级后需用户手动确认才能恢复',
    ],
    icon: ShieldQuestion,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    id: 3,
    name: 'Hook Interception',
    description: 'PreToolUse / PostToolUse 钩子拦截',
    details: [
      'PreToolUse: 工具执行前安全检查',
      'PostToolUse: 工具执行后结果验证',
      '支持自定义安全策略注入',
      '可以修改、阻止或记录工具调用',
    ],
    icon: GitFork,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  {
    id: 4,
    name: 'AI Classifier',
    description: 'TRANSCRIPT_CLASSIFIER 失败安全设计',
    details: [
      'TRANSCRIPT_CLASSIFIER 智能分类器',
      'Fail-closed 设计: 分类失败时默认拒绝',
      '自动检测可疑的提示注入攻击',
      '基于对话历史的风险评估',
    ],
    icon: Brain,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
  },
  {
    id: 5,
    name: 'Bash Sandbox',
    description: 'Shell 命令安全沙箱',
    details: [
      '25项安全检查覆盖常见攻击向量',
      '迭代定点算法验证命令安全性',
      'Zsh 防御: 防止zsh特有语法利用',
      '环境变量劫持检测',
    ],
    icon: Terminal,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  {
    id: 6,
    name: 'File System Protection',
    description: '文件系统安全防护',
    details: [
      '路径遍历攻击预防',
      'Symlink 保护 (O_NOFOLLOW)',
      '细粒度权限控制设置',
      '文件操作审计日志',
    ],
    icon: FolderLock,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  {
    id: 7,
    name: 'Secret Scanning',
    description: 'API Key / 密码 / Token 检测',
    details: [
      'Team Sync 上传前自动扫描',
      '检测 API Key、密码、Token',
      '防止敏感信息泄露到团队',
      '正则表达式 + 启发式双重检测',
    ],
    icon: KeyRound,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
  },
];

// ── Default Security Rules ──────────────────────
const DEFAULT_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'rule-1',
    target: 'bash',
    permission: 'ask',
    description: 'Shell commands require user confirmation',
    priority: 10,
  },
  {
    id: 'rule-2',
    target: 'file-read',
    permission: 'allow',
    description: 'Read-only file access is safe',
    priority: 5,
  },
  {
    id: 'rule-3',
    target: 'file-write',
    permission: 'ask',
    description: 'File modifications require confirmation',
    priority: 8,
  },
  {
    id: 'rule-4',
    target: 'file-edit',
    permission: 'ask',
    description: 'File edits require confirmation',
    priority: 8,
  },
  {
    id: 'rule-5',
    target: 'web-search',
    permission: 'allow',
    description: 'Web search is safe and read-only',
    priority: 3,
  },
  {
    id: 'rule-6',
    target: 'web-fetch',
    permission: 'allow',
    description: 'Web page fetching is read-only',
    priority: 3,
  },
  {
    id: 'rule-7',
    target: 'agent',
    permission: 'ask',
    description: 'Sub-agent spawning requires confirmation',
    priority: 9,
  },
  {
    id: 'rule-8',
    target: 'mcp',
    permission: 'deny',
    description: 'External MCP connections denied by default',
    priority: 10,
  },
  {
    id: 'rule-9',
    target: 'glob',
    permission: 'allow',
    description: 'File pattern search is safe',
    priority: 2,
  },
  {
    id: 'rule-10',
    target: 'grep',
    permission: 'allow',
    description: 'Content search is safe',
    priority: 2,
  },
  {
    id: 'rule-11',
    target: 'team-create',
    permission: 'deny',
    description: 'Team creation denied in safe mode',
    priority: 10,
  },
  {
    id: 'rule-12',
    target: '*',
    permission: 'ask',
    description: 'All other tools require user confirmation',
    priority: 1,
  },
];

// ── Mock Audit Events ───────────────────────────
interface AuditEvent {
  id: string;
  timestamp: string;
  tool: string;
  action: PermissionLevel;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'evt-1',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    tool: 'bash',
    action: 'allow',
    riskLevel: 'medium',
    reason: 'User explicitly approved command: npm install',
  },
  {
    id: 'evt-2',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    tool: 'bash',
    action: 'deny',
    riskLevel: 'critical',
    reason: 'Detected destructive command: rm -rf /',
  },
  {
    id: 'evt-3',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    tool: 'file-write',
    action: 'ask',
    riskLevel: 'medium',
    reason: 'Writing to system file: /etc/config',
  },
  {
    id: 'evt-4',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    tool: 'file-read',
    action: 'allow',
    riskLevel: 'low',
    reason: 'Read-only operation auto-approved',
  },
  {
    id: 'evt-5',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    tool: 'mcp',
    action: 'deny',
    riskLevel: 'high',
    reason: 'MCP connections denied by default policy',
  },
  {
    id: 'evt-6',
    timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    tool: 'web-search',
    action: 'allow',
    riskLevel: 'low',
    reason: 'Web search is safe and read-only',
  },
  {
    id: 'evt-7',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    tool: 'bash',
    action: 'ask',
    riskLevel: 'high',
    reason: 'Command contains environment variable assignment: export API_KEY=...',
  },
  {
    id: 'evt-8',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    tool: 'agent',
    action: 'allow',
    riskLevel: 'medium',
    reason: 'User approved sub-agent for code review task',
  },
  {
    id: 'evt-9',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    tool: 'file-write',
    action: 'allow',
    riskLevel: 'low',
    reason: 'Writing to project file: src/index.ts',
  },
  {
    id: 'evt-10',
    timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
    tool: 'bash',
    action: 'deny',
    riskLevel: 'critical',
    reason: 'Detected sudo command execution attempt',
  },
];

const riskLevelStyles: Record<string, { color: string; bg: string }> = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/10' },
};

// ── Component ───────────────────────────────────
export function SecurityView() {
  const [rules, setRules] = useState<SecurityRule[]>(DEFAULT_SECURITY_RULES);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    target: '',
    permission: 'ask' as PermissionLevel,
    description: '',
    priority: 5,
  });

  const events = MOCK_AUDIT_EVENTS;

  const totalEvents = events.length;
  const allowCount = events.filter((e) => e.action === 'allow').length;
  const denyCount = events.filter((e) => e.action === 'deny').length;
  const askCount = events.filter((e) => e.action === 'ask').length;

  const deniedTools = events
    .filter((e) => e.action === 'deny')
    .map((e) => e.tool);
  const mostBlocked = deniedTools.length > 0
    ? deniedTools.sort(
        (a, b) =>
          deniedTools.filter((t) => t === b).length -
          deniedTools.filter((t) => t === a).length
      )[0]
    : 'none';

  const handleAddRule = () => {
    if (!newRule.target.trim() || !newRule.description.trim()) return;
    const rule: SecurityRule = {
      id: `rule-${Date.now()}`,
      target: newRule.target,
      permission: newRule.permission,
      description: newRule.description,
      priority: newRule.priority,
    };
    setRules([...rules, rule].sort((a, b) => b.priority - a.priority));
    setAddRuleOpen(false);
    setNewRule({ target: '', permission: 'ask', description: '', priority: 5 });
  };

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Security & Permissions
                </h1>
                <p className="text-xs text-muted-foreground">
                  7-layer defense system inspired by Claude Code architecture
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            >
              <Layers className="mr-1 h-3 w-3" />
              7 Layers
            </Badge>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={item} className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-foreground">
                  {totalEvents}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Total Events
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">
                  {allowCount}
                </div>
                <div className="text-[10px] text-muted-foreground">Allowed</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-red-400">
                  {denyCount}
                </div>
                <div className="text-[10px] text-muted-foreground">Denied</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-amber-400">
                  {askCount}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Asked
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50 col-span-2 sm:col-span-1">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-rose-400">
                  {mostBlocked}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Most Blocked
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Security Architecture - 7 Layers */}
        <motion.div variants={item} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Security Architecture
            </h2>
          </div>

          <div className="space-y-2">
            {SECURITY_LAYERS.map((layer, i) => {
              const Icon = layer.icon;
              return (
                <motion.div
                  key={layer.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <Card className="border-border/50 bg-card/50 transition-colors hover:border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 items-center justify-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
                            <Icon className={`h-5 w-5 ${layer.color}`} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-mono ${layer.bgColor} ${layer.color} ${layer.borderColor}`}
                            >
                              L{layer.id}
                            </Badge>
                            <h3 className="text-sm font-semibold text-foreground">
                              {layer.name}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {layer.description}
                          </p>
                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {layer.details.map((detail, di) => (
                              <div
                                key={di}
                                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                              >
                                <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${layer.color.replace('text-', 'bg-')}`} />
                                <span>{detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Security Rules Table */}
        <motion.div variants={item} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Security Rules
              </h2>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {rules.length} rules
              </Badge>
            </div>

            <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border/50 bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Add Security Rule
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Target (Tool ID or * for all)
                    </Label>
                    <Input
                      placeholder="e.g. bash or file-* or *"
                      value={newRule.target}
                      onChange={(e) =>
                        setNewRule({ ...newRule, target: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Permission
                    </Label>
                    <Select
                      value={newRule.permission}
                      onValueChange={(v) =>
                        setNewRule({
                          ...newRule,
                          permission: v as PermissionLevel,
                        })
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            Allow
                          </span>
                        </SelectItem>
                        <SelectItem value="deny">
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                            Deny
                          </span>
                        </SelectItem>
                        <SelectItem value="ask">
                          <span className="flex items-center gap-2">
                            <ShieldQuestion className="h-3.5 w-3.5 text-amber-400" />
                            Ask
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <Input
                      placeholder="Rule description..."
                      value={newRule.description}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Priority (1-10, higher = evaluated first)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={newRule.priority}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          priority: parseInt(e.target.value) || 5,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddRuleOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={handleAddRule}
                    disabled={
                      !newRule.target.trim() || !newRule.description.trim()
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-border/50 bg-card/50">
            <div className="max-h-72 overflow-y-auto">
              <div className="min-w-[600px]">
                {/* Table Header */}
                <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="w-28 shrink-0">Target</span>
                  <span className="w-20 shrink-0">Permission</span>
                  <span className="w-16 shrink-0">Priority</span>
                  <span className="flex-1">Description</span>
                </div>
                {/* Table Rows */}
                {rules.map((rule) => {
                  const ps = permissionStyles[rule.permission];
                  const PermIcon = ps.icon;
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 transition-colors hover:bg-muted/30 last:border-0"
                    >
                      <span className="w-28 shrink-0 font-mono text-xs text-foreground">
                        {rule.target}
                      </span>
                      <span className="w-20 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${ps.bg} ${ps.color} ${ps.border}`}
                        >
                          <PermIcon className="mr-1 h-2.5 w-2.5" />
                          {rule.permission}
                        </Badge>
                      </span>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">
                        {rule.priority}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground truncate">
                        {rule.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Audit Log */}
        <motion.div variants={item} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {events.length} events
            </Badge>
          </div>

          <Card className="border-border/50 bg-card/50">
            <div className="max-h-96 overflow-y-auto">
              <div className="min-w-[600px]">
                {/* Table Header */}
                <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="w-28 shrink-0">Time</span>
                  <span className="w-24 shrink-0">Tool</span>
                  <span className="w-20 shrink-0">Action</span>
                  <span className="w-20 shrink-0">Risk Level</span>
                  <span className="flex-1">Reason</span>
                </div>
                {/* Table Rows */}
                {events.map((event, i) => {
                  const ps = permissionStyles[event.action];
                  const PermIcon = ps.icon;
                  const rl = riskLevelStyles[event.riskLevel];

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 transition-colors hover:bg-muted/30 last:border-0"
                    >
                      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                      <span className="w-24 shrink-0 font-mono text-xs text-foreground">
                        {event.tool}
                      </span>
                      <span className="w-20 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${ps.bg} ${ps.color} ${ps.border}`}
                        >
                          <PermIcon className="mr-1 h-2.5 w-2.5" />
                          {event.action}
                        </Badge>
                      </span>
                      <span className="w-20 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${rl.bg} ${rl.color}`}
                        >
                          {event.riskLevel}
                        </Badge>
                      </span>
                      <span className="flex-1 text-[11px] text-muted-foreground truncate">
                        {event.reason}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

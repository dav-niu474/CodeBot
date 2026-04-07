'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/lib/i18n/use-locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Zap,
  GitBranch,
  FolderOpen,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Animation variants ──────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ─── Types ───────────────────────────────────
interface MonitoredSource {
  id: string;
  type: 'git' | 'files' | 'scheduled';
  name: string;
  description: string;
  enabled: boolean;
  lastChecked: string | null;
}

interface ProactiveAction {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  details: string;
}

interface KairosData {
  isActive: boolean;
  activatedAt: string | null;
  uptime: string;
  sources: MonitoredSource[];
  recentActions: ProactiveAction[];
  stats: {
    totalChecks: number;
    actionsTaken: number;
    issuesFound: number;
  };
  checkInterval: number;
  nextCheckAt: string | null;
}

const sourceIconMap: Record<string, React.ReactNode> = {
  git: <GitBranch className="h-4 w-4" />,
  files: <FolderOpen className="h-4 w-4" />,
  scheduled: <Clock className="h-4 w-4" />,
};

const actionTypeMap: Record<string, { icon: React.ReactNode; color: string }> = {
  'git-detect': { icon: <GitBranch className="h-3.5 w-3.5" />, color: 'text-emerald-400' },
  'file-analyze': { icon: <FolderOpen className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  'health-check': { icon: <ShieldCheck className="h-3.5 w-3.5" />, color: 'text-emerald-400' },
  'cron-complete': { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-400' },
  'security-scan': { icon: <ShieldCheck className="h-3.5 w-3.5" />, color: 'text-purple-400' },
  'dependency-check': { icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-cyan-400' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

// ─── Main Component ─────────────────────────
export function KairosView() {
  const { t } = useLocale();
  const [data, setData] = useState<KairosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/kairos');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    refreshRef.current = setInterval(fetchData, 5000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [fetchData]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch('/api/kairos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(json.isActive ? t.kairos.toggleOn : t.kairos.toggleOff);
        await fetchData();
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setToggling(false);
    }
  };

  const handleToggleSource = async (sourceId: string) => {
    try {
      await fetch('/api/kairos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-source', sourceId }),
      });
      await fetchData();
    } catch {
      toast.error(t.common.error);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    try {
      await fetch('/api/kairos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-source', sourceId }),
      });
      await fetchData();
    } catch {
      toast.error(t.common.error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  // ── Empty / Not Configured State ──────────
  if (!data || !data.isActive && data.recentActions.length === 0 && data.stats.totalChecks === 0) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <motion.div variants={item} className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{t.kairos.title}</h1>
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
                    KAIROS
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.kairos.subtitle}</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Activity className="h-8 w-8 text-amber-400" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground">{t.kairos.notConfigured}</h2>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">{t.kairos.notConfiguredDesc}</p>
                <Button
                  onClick={handleToggle}
                  disabled={toggling}
                  className="gap-2 bg-amber-600 text-white hover:bg-amber-500"
                >
                  <Zap className="h-4 w-4" />
                  {t.kairos.activateKairos}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const nextCheckTime = data.nextCheckAt
    ? formatRelativeTime(data.nextCheckAt)
    : t.kairos.inactive;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ───────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{t.kairos.title}</h1>
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
                    KAIROS
                  </Badge>
                  <Badge className="border-border/50 text-[10px] text-muted-foreground">
                    PROACTIVE
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.kairos.subtitle}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="gap-1.5 border-border/50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.common.loading.replace('...', '')}</span>
            </Button>
          </div>
        </motion.div>

        {/* ── Status Card ─────────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className={`border transition-colors duration-500 ${
            data.isActive
              ? 'border-amber-500/30 bg-amber-500/5 shadow-lg shadow-amber-500/5'
              : 'border-border/50 bg-card/50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Animated status indicator */}
                <div className="relative">
                  <motion.div
                    animate={data.isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      data.isActive
                        ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                        : 'bg-muted ring-1 ring-border'
                    }`}
                  >
                    {data.isActive
                      ? <Activity className="h-6 w-6 text-emerald-400" />
                      : <Activity className="h-6 w-6 text-muted-foreground" />
                    }
                  </motion.div>
                  {data.isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-xl bg-emerald-500/20"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{t.kairos.status}</span>
                    <Badge className={
                      data.isActive
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]'
                        : 'border-border/50 bg-muted text-muted-foreground text-[10px]'
                    }>
                      {data.isActive ? t.kairos.active : t.kairos.inactive}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>⏱ {t.kairos.uptime}: {data.uptime}</span>
                    <span>🕐 {t.kairos.nextCheck}: {nextCheckTime}</span>
                    <span>🔄 {t.kairos.checkInterval}: {data.checkInterval}s</span>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={data.isActive}
                    onCheckedChange={handleToggle}
                    disabled={toggling}
                  />
                  <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                    {data.isActive ? t.kairos.active : t.kairos.inactive}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Stats Cards ─────────────────── */}
        <motion.div variants={item} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t.kairos.totalChecks, value: data.stats.totalChecks.toLocaleString(), icon: <Activity className="h-4 w-4 text-amber-400" />, color: 'amber' },
            { label: t.kairos.actionsTaken, value: data.stats.actionsTaken.toLocaleString(), icon: <Zap className="h-4 w-4 text-emerald-400" />, color: 'emerald' },
            { label: t.kairos.issuesFound, value: data.stats.issuesFound.toLocaleString(), icon: <AlertTriangle className="h-4 w-4 text-red-400" />, color: 'red' },
            { label: t.kairos.uptime, value: data.uptime, icon: <Clock className="h-4 w-4 text-sky-400" />, color: 'sky' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50 bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-[10px] font-medium text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* ── Monitored Sources ────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold">{t.kairos.monitoredSources}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {data.sources.filter(s => s.enabled).length}/{data.sources.length}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {data.sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      source.enabled ? 'bg-amber-500/10 text-amber-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {sourceIconMap[source.type] || <Eye className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{source.name}</span>
                        <Badge variant="outline" className="text-[9px] border-border/50">
                          {source.type}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{source.description}</p>
                      {source.lastChecked && (
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          Last checked: {formatRelativeTime(source.lastChecked)}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={() => handleToggleSource(source.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                      onClick={() => handleRemoveSource(source.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Activity Timeline ────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold">{t.kairos.activityTimeline}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {data.recentActions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-96 overflow-y-auto space-y-2">
                <AnimatePresence mode="popLayout">
                  {data.recentActions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      {t.kairos.noActivity}
                    </div>
                  ) : (
                    data.recentActions.map((action, idx) => {
                      const typeInfo = actionTypeMap[action.type] || {
                        icon: <Activity className="h-3.5 w-3.5" />,
                        color: 'text-muted-foreground',
                      };
                      return (
                        <motion.div
                          key={action.id}
                          initial={idx === 0 ? { opacity: 0, x: -10, height: 0 } : false}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="group flex items-start gap-3 rounded-lg border border-border/20 p-3 transition-colors hover:bg-muted/30"
                        >
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-foreground">{action.description}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                              {action.details}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">
                            {formatRelativeTime(action.timestamp)}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Configuration ────────────────── */}
        <motion.div variants={item} className="mb-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold">{t.kairos.configuration}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Check Interval */}
                <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{t.kairos.checkInterval}</span>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { label: `5 ${t.kairos.minutes}`, value: 300 },
                      { label: `10 ${t.kairos.minutes}`, value: 600 },
                      { label: `30 ${t.kairos.minutes}`, value: 1800 },
                      { label: `1 ${t.kairos.hours}`, value: 3600 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={async () => {
                          await fetch('/api/kairos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'set-interval', checkInterval: opt.value }),
                          });
                          fetchData();
                          toast.success(t.common.success);
                        }}
                        className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                          data.checkInterval === opt.value
                            ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Feature Flags</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { flag: 'KAIROS', color: 'amber' },
                      { flag: 'PROACTIVE', color: 'emerald' },
                      { flag: 'CRON', color: 'sky' },
                    ].map((f) => (
                      <div key={f.flag} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <code className="text-[10px] text-muted-foreground">{f.flag}</code>
                        <Badge variant="outline" className="h-4 px-1 text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                          {t.kairos.enabled}
                        </Badge>
                      </div>
                    ))}
                  </div>
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

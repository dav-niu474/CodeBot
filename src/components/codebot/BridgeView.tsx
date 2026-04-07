'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from '@/lib/i18n/use-locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Radio,
  Wifi,
  WifiOff,
  Terminal,
  Send,
  Trash2,
  Info,
  Plug,
  Zap,
  Star,
  Settings2,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Activity,
  RadioTower,
  Smartphone,
  Webhook,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';

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
interface REPLMessage {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'webhook';
  content: string;
  timestamp: string;
  duration?: string;
  channel?: string;
  userName?: string;
}

interface ChannelConfig {
  id: string;
  name: string;
  nameZh: string;
  platform: string;
  color: string;
  enabled: boolean;
  hasSecret: boolean;
  webhookUrl: string;
  messageCount: number;
  lastActivity: string | null;
}

interface ServiceStats {
  version: string;
  uptime: string;
  wsConnections: number;
  totalMessages: number;
  activeChannels: number;
  totalChannels: number;
  channels: ChannelConfig[];
}

const BRIDGE_URL = '/?XTransformPort=3004';

// ─── Channel Icons (SVG inline for crisp rendering) ──────────────────────
const channelIcons: Record<string, React.ReactNode> = {
  feishu: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10.5 2.5l-4 2.2v3.5l4-2.2V2.5zm-7 5.1l4 2.2V14l-4-2.2V7.6zm9.3 1.9L8.8 12v3.5l4-2.2V9.5zm1.7-.6L14.5 7v3.5l4-2.2V5.1l-4.2 2.3zm3.1 3.8l-4 2.2v3.5l4-2.2v-3.5z"/></svg>
  ),
  wechat: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.97 3.258c-1.976-.168-3.756.34-5.07 1.395-1.462 1.17-2.352 2.93-2.352 4.794 0 .514.073 1.013.194 1.49.09.35-.046.72-.35.927-.63.415-1.17.925-1.572 1.518a5.09 5.09 0 001.466-.083.864.864 0 01.717.098l1.903 1.114a.326.326 0 00.167.054.295.295 0 00.29-.295c0-.072-.03-.144-.048-.213l-.39-1.48a.59.59 0 01.213-.666c1.545-1.134 2.574-2.86 2.574-4.8 0-.432-.046-.855-.132-1.268l.4-.085zM14.5 12.407c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/></svg>
  ),
  qq: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M21.395 15.035a39.548 39.548 0 00-1.51-4.686c.37-1.384.65-2.87.65-4.099C20.535 3.262 17.58 0 12 0S3.465 3.262 3.465 6.25c0 1.229.28 2.715.65 4.099a39.548 39.548 0 00-1.51 4.686c-.81 3.078-.522 4.286-.313 4.397.598.314 2.347-1.186 3.463-2.438.083.114.17.227.26.337C5.312 19.39 5 21.742 5.257 23.067c.083.416.24.682.49.769.218.076.485-.02.845-.28.67-.475 1.735-1.544 2.85-3.009A15.95 15.95 0 0012 20.929c1.003 0 1.97-.093 2.898-.268.997 1.328 2.015 2.35 2.66 2.808.36.26.627.356.845.28.25-.088.407-.353.49-.77.257-1.324-.055-3.676-.496-5.736.09-.11.177-.223.26-.337 1.116 1.252 2.865 2.752 3.463 2.438.21-.111.497-1.319-.313-4.397z"/></svg>
  ),
  dingtalk: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>
  ),
  slack: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.313A2.528 2.528 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"/></svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  ),
  webhook: (
    <Webhook className="h-5 w-5" />
  ),
};

// ─── Main Component ─────────────────────────
export function BridgeView() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState('channels');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<REPLMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll ──
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Fetch channels & stats from API ──
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status?XTransformPort=3004');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setStats(data);
      }
    } catch { /* use WS data */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status?XTransformPort=3004');
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    const load = () => { fetchChannels(); fetchStats(); };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [fetchChannels, fetchStats]);

  // ── WebSocket connect ──
  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: `sys-${Date.now()}`, type: 'system', content, timestamp: new Date().toISOString() }]);
  }, []);

  const connect = useCallback(() => {
    if (connecting || connected) return;
    setConnecting(true);
    addSystemMessage('Connecting to Bridge Hub...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}${BRIDGE_URL}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setMessages([]);
        addSystemMessage(`${t.bridge.connected} — Bridge v2.0 Multi-Channel Hub`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'welcome') {
            addSystemMessage(data.message);
            if (data.channels) setChannels(data.channels);
          } else if (data.type === 'result') {
            setMessages(prev => [...prev, {
              id: `out-${Date.now()}`, type: 'output', content: data.result || '(no result)',
              timestamp: data.timestamp || new Date().toISOString(), duration: data.duration,
            }]);
          } else if (data.type === 'webhook-message') {
            setMessages(prev => [...prev, {
              id: `hook-${Date.now()}`, type: 'webhook',
              content: data.data.content, timestamp: data.data.timestamp,
              channel: data.channel, userName: data.data.userName,
            }]);
            fetchChannels();
          } else if (data.type === 'channel-updated') {
            fetchChannels();
          }
        } catch {
          setMessages(prev => [...prev, {
            id: `out-${Date.now()}`, type: 'output',
            content: event.data, timestamp: new Date().toISOString(),
          }]);
        }
      };

      ws.onerror = () => {
        addSystemMessage(`${t.bridge.error}: Bridge service not running`);
        setConnecting(false);
        setConnected(false);
        ws.close();
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch {
      addSystemMessage('Failed to create WebSocket');
      setConnecting(false);
    }
  }, [connecting, connected, addSystemMessage, fetchChannels, t]);

  const disconnect = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setConnected(false);
  }, []);

  const sendCommand = useCallback((cmd?: string) => {
    const command = (cmd || inputValue).trim();
    if (!command || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages(prev => [...prev, { id: `in-${Date.now()}`, type: 'input', content: command, timestamp: new Date().toISOString() }]);
    wsRef.current.send(command);
    setInputValue('');
  }, [inputValue]);

  const clearTerminal = useCallback(() => setMessages([]), []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); }
  };

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const toggleChannel = async (channelId: string) => {
    try {
      const res = await fetch(`/api/bridge/status?XTransformPort=3004&action=toggle&id=${channelId}`, { method: 'POST' });
      if (res.ok) fetchChannels();
    } catch {
      toast.error('Failed to toggle channel');
    }
  };

  const saveSecret = async () => {
    if (!selectedChannel || !secretInput.trim()) return;
    try {
      const res = await fetch(`/api/bridge/status?XTransformPort=3004&action=config&id=${selectedChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSecret: secretInput.trim() }),
      });
      if (res.ok) {
        toast.success('Secret saved');
        setSecretInput('');
        setSelectedChannel(null);
        fetchChannels();
      }
    } catch {
      toast.error('Failed to save secret');
    }
  };

  const sendTestWebhook = async (channelId: string) => {
    try {
      await fetch(`/api/bridge/status?XTransformPort=3004&action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelId, content: `Test message from ${channelId} at ${new Date().toLocaleTimeString()}` }),
      });
      toast.success(`Test webhook sent to ${channelId}`);
    } catch {
      toast.error('Failed to send test webhook');
    }
  };

  const copyWebhookUrl = (channelId: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/webhook/${channelId}?XTransformPort=3004`;
    navigator.clipboard.writeText(url);
    setCopiedId(channelId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Webhook URL copied');
  };

  const uptimeDisplay = stats ? (() => {
    const s = parseInt(stats.uptime);
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  })() : '—';

  const commandRef = [
    { cmd: 'ping', desc: t.bridge.cmdPingDesc },
    { cmd: 'channels', desc: 'Show channel status' },
    { cmd: 'logs', desc: 'Show recent webhook logs' },
    { cmd: 'status', desc: t.bridge.cmdStatusDesc },
    { cmd: 'help', desc: t.bridge.cmdHelpDesc },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ───────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <RadioTower className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{t.bridge.title}</h1>
                  <Badge className="border-violet-500/20 bg-violet-500/10 text-xs text-violet-400">v2.0</Badge>
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400">
                    <Smartphone className="mr-1 h-2.5 w-2.5" />
                    Multi-Channel
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.bridge.subtitle}</p>
              </div>
            </div>

            {/* Connection status + Connect button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  connected ? 'bg-emerald-500 animate-pulse' : connecting ? 'bg-amber-500 animate-pulse' : 'bg-zinc-400'
                )} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {connected ? t.bridge.connected : connecting ? t.bridge.connecting : t.bridge.disconnected}
                </span>
              </div>
              <Button
                onClick={connected ? disconnect : connect}
                disabled={connecting}
                variant={connected ? 'outline' : 'default'}
                size="sm"
                className={cn(
                  'gap-1.5',
                  connected ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'bg-violet-600 text-white hover:bg-violet-500'
                )}
              >
                {connected ? <><Plug className="h-3.5 w-3.5" />{t.bridge.disconnect}</> : <><Radio className="h-3.5 w-3.5" />{t.bridge.connect}</>}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Bar ──────────────────── */}
        {stats && (
          <motion.div variants={item} className="mb-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Service Uptime', value: uptimeDisplay, icon: Activity, color: 'text-emerald-400' },
                { label: 'Active Channels', value: `${stats.activeChannels}/${stats.totalChannels}`, icon: RadioTower, color: 'text-violet-400' },
                { label: 'Messages Received', value: String(stats.totalMessages), icon: ArrowDownLeft, color: 'text-sky-400' },
                { label: 'WS Connections', value: String(stats.wsConnections), icon: Wifi, color: 'text-amber-400' },
              ].map((s, i) => (
                <Card key={i} className="border-border/50 bg-card/50">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50', s.color)}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold text-foreground">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Main Tabs ───────────────────── */}
        <motion.div variants={item}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="channels" className="gap-1.5 text-xs">
                <RadioTower className="h-3.5 w-3.5" />
                {t.bridge.channelsTab}
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                {t.bridge.messageLog}
              </TabsTrigger>
              <TabsTrigger value="terminal" className="gap-1.5 text-xs">
                <Terminal className="h-3.5 w-3.5" />
                {t.bridge.terminal}
              </TabsTrigger>
            </TabsList>

            {/* ══════════════════════════════════════ */}
            {/* Tab 1: Channel Management            */}
            {/* ══════════════════════════════════════ */}
            <TabsContent value="channels">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {channels.map((channel, idx) => (
                    <motion.div
                      key={channel.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={cn(
                        'relative overflow-hidden transition-all',
                        channel.enabled
                          ? 'border-emerald-500/30 bg-emerald-500/[0.03] ring-1 ring-emerald-500/10'
                          : 'border-border/50 bg-card/50 hover:border-border/80'
                      )}>
                        {/* Color accent bar */}
                        <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: channel.color }} />

                        <CardContent className="p-4 pl-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                                style={{ backgroundColor: channel.color }}
                              >
                                {channelIcons[channel.id] || <Webhook className="h-5 w-5" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{channel.name}</p>
                                <p className="text-[10px] text-muted-foreground">{channel.nameZh}</p>
                              </div>
                            </div>
                            <Switch
                              checked={channel.enabled}
                              onCheckedChange={() => toggleChannel(channel.id)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </div>

                          {/* Webhook URL */}
                          <div className="mt-3 rounded-md bg-muted/50 px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">
                                {channel.webhookUrl}
                              </span>
                              <button
                                onClick={() => copyWebhookUrl(channel.id)}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {copiedId === channel.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground">
                                <ArrowDownLeft className="mr-0.5 inline h-2.5 w-2.5 text-sky-400" />
                                {channel.messageCount} {t.bridge.msgs}
                              </span>
                              {channel.lastActivity && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(channel.lastActivity).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setSelectedChannel(channel.id); setSecretInput(''); }}
                                  >
                                    <Settings2 className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: channel.color }}>
                                        {channelIcons[channel.id] || <Webhook className="h-3.5 w-3.5" />}
                                      </div>
                                      {channel.name} Settings
                                    </DialogTitle>
                                    <DialogDescription>
                                      Configure webhook secret for {channel.nameZh} channel
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-foreground">App Secret / Token</label>
                                      <Input
                                        value={secretInput}
                                        onChange={e => setSecretInput(e.target.value)}
                                        placeholder={channel.hasSecret ? '••••••••' : 'Enter app secret or token'}
                                        type="password"
                                        className="font-mono text-xs"
                                      />
                                      <p className="text-[10px] text-muted-foreground">
                                        Used for signature verification. Leave empty to skip verification.
                                      </p>
                                    </div>
                                    <div className="rounded-md bg-muted/50 p-3">
                                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Full Webhook URL</p>
                                      <code className="text-[10px] font-mono text-foreground break-all">
                                        {typeof window !== 'undefined' ? `${window.location.origin}${channel.webhookUrl}?XTransformPort=3004` : ''}
                                      </code>
                                    </div>
                                  </div>
                                  <DialogFooter className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => sendTestWebhook(channel.id)}>
                                      <Zap className="mr-1.5 h-3 w-3" />
                                      Send Test
                                    </Button>
                                    <Button size="sm" onClick={saveSecret} className="bg-violet-600 hover:bg-violet-500">
                                      <Check className="mr-1.5 h-3 w-3" />
                                      Save
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════ */}
            {/* Tab 2: Message Log                    */}
            {/* ══════════════════════════════════════ */}
            <TabsContent value="logs">
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-violet-400" />
                      <CardTitle className="text-sm font-semibold">{t.bridge.messageLog}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearTerminal}
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t.bridge.clear}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">message-log</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {connected && (
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-mono text-emerald-500/80">live</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div ref={terminalRef} className="h-[420px] overflow-y-auto p-3 font-mono text-xs">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                          <RadioTower className="h-8 w-8 mb-2" />
                          <p className="text-xs">{t.bridge.noMessages}</p>
                          <p className="text-[10px] mt-1">{t.bridge.noMessagesDesc}</p>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {messages.map((msg) => (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.1 }}
                              className="mb-2"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-[9px] text-zinc-600 shrink-0 mt-0.5">
                                  {formatTime(msg.timestamp)}
                                </span>

                                {msg.type === 'webhook' && (
                                  <>
                                    <span
                                      className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                                      style={{ backgroundColor: (channels.find(c => c.id === msg.channel) || channels[0])?.color || '#6366f1' }}
                                    >
                                      {msg.channel?.toUpperCase()}
                                    </span>
                                    <span className="text-amber-300 shrink-0">{msg.userName}:</span>
                                    <span className="text-zinc-200 break-all">{msg.content}</span>
                                    <button
                                      onClick={() => {
                                        const event = new CustomEvent('bridge-to-chat', { detail: msg.content });
                                        window.dispatchEvent(event);
                                        useChatStore.getState().setActiveView('chat');
                                        toast.success('Message forwarded to chat');
                                      }}
                                      className="ml-auto shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                                      title="Send to Chat"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      <span>Chat</span>
                                    </button>
                                  </>
                                )}

                                {msg.type === 'input' && (
                                  <>
                                    <span className="text-violet-400 shrink-0">$</span>
                                    <span className="text-zinc-200 break-all">{msg.content}</span>
                                  </>
                                )}
                                {msg.type === 'output' && (
                                  <pre className="text-emerald-400/90 whitespace-pre-wrap break-all m-0 font-mono text-xs">
                                    {msg.content}
                                  </pre>
                                )}
                                {msg.type === 'error' && (
                                  <span className="text-red-400 break-all">{msg.content}</span>
                                )}
                                {msg.type === 'system' && (
                                  <span className="text-zinc-500 italic break-all">{msg.content}</span>
                                )}

                                {msg.duration && (
                                  <span className="text-zinc-700 text-[9px] ml-auto shrink-0">{msg.duration}</span>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>

                    {/* REPL Input */}
                    <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/50 px-3 py-2">
                      <span className="text-violet-400 font-mono text-xs">$</span>
                      <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={connected ? t.bridge.commandPlaceholder : 'Connect to start...'}
                        disabled={!connected}
                        className="h-7 flex-1 border-0 bg-transparent px-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Button
                        onClick={() => sendCommand()}
                        disabled={!connected || !inputValue.trim()}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-violet-400"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══════════════════════════════════════ */}
            {/* Tab 3: Terminal REPL                  */}
            {/* ══════════════════════════════════════ */}
            <TabsContent value="terminal">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Terminal */}
                <motion.div variants={item} className="lg:col-span-2">
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-violet-400" />
                          <CardTitle className="text-sm font-semibold">{t.bridge.terminal}</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearTerminal} className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Trash2 className="h-3 w-3" />
                          {t.bridge.clear}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
                          <div className="flex gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500">bridge-repl</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {connected && (
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-mono text-emerald-500/80">connected</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div ref={terminalRef} className="h-80 overflow-y-auto p-3 font-mono text-xs">
                          {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                              <Terminal className="h-8 w-8 mb-2" />
                              <p className="text-xs">{t.bridge.welcome}</p>
                              <p className="text-[10px] mt-1">{t.bridge.welcomeDesc}</p>
                            </div>
                          )}
                          <AnimatePresence mode="popLayout">
                            {messages.filter(m => m.type !== 'webhook').map((msg) => (
                              <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1 }} className="mb-1.5">
                                <div className="flex items-start gap-2">
                                  <span className="text-[9px] text-zinc-600 shrink-0 mt-0.5">{formatTime(msg.timestamp)}</span>
                                  {msg.type === 'input' && <><span className="text-violet-400 shrink-0">$</span><span className="text-zinc-200 break-all">{msg.content}</span></>}
                                  {msg.type === 'output' && <pre className="text-emerald-400/90 whitespace-pre-wrap break-all m-0 font-mono text-xs">{msg.content}</pre>}
                                  {msg.type === 'error' && <span className="text-red-400 break-all">{msg.content}</span>}
                                  {msg.type === 'system' && <span className="text-zinc-500 italic break-all">{msg.content}</span>}
                                  {msg.duration && <span className="text-zinc-700 text-[9px] ml-auto shrink-0">{msg.duration}</span>}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/50 px-3 py-2">
                          <span className="text-violet-400 font-mono text-xs">$</span>
                          <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={connected ? t.bridge.commandPlaceholder : 'Connect to start...'}
                            disabled={!connected}
                            className="h-7 flex-1 border-0 bg-transparent px-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          <Button onClick={() => sendCommand()} disabled={!connected || !inputValue.trim()} size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-500 hover:text-violet-400">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Right sidebar */}
                <div className="space-y-4">
                  {/* Connection Info */}
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-violet-400" />
                        <CardTitle className="text-sm font-semibold">{t.bridge.connectionInfo}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t.bridge.url}</span>
                          <code className="text-[10px] font-mono text-foreground">ws://localhost:3004</code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t.bridge.uptime}</span>
                          <span className="text-[10px] font-mono text-foreground">{uptimeDisplay}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Active Channels</span>
                          <Badge variant="secondary" className="text-[10px]">{stats?.activeChannels ?? 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t.bridge.messagesReceived}</span>
                          <Badge variant="secondary" className="text-[10px]">{stats?.totalMessages ?? 0}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Commands */}
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-violet-400" />
                        <CardTitle className="text-sm font-semibold">{t.bridge.commands}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {commandRef.map(c => (
                          <button
                            key={c.cmd}
                            onClick={() => { if (connected) { setInputValue(c.cmd.split(' ')[0]); inputRef.current?.focus(); } }}
                            disabled={!connected}
                            className="flex w-full items-start gap-2 rounded-md border border-border/20 p-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                          >
                            <span className="text-[10px] font-mono font-medium text-violet-400">{c.cmd}</span>
                            <span className="text-[9px] text-muted-foreground">{c.desc}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-3.5 w-3.5 text-violet-400" />
                        <span className="text-xs font-medium text-foreground">Quick Actions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['ping', 'channels', 'logs', 'status'].map(cmd => (
                          <button
                            key={cmd}
                            onClick={() => connected && sendCommand(cmd)}
                            disabled={!connected}
                            className="rounded-md border border-border/20 bg-muted/30 px-2 py-1.5 text-[10px] font-mono text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from '@/lib/i18n/use-locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Radio,
  Wifi,
  WifiOff,
  Terminal,
  Send,
  Trash2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
  HelpCircle,
  Info,
  Plug,
  Zap,
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
interface REPLMessage {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
  duration?: string;
}

const BRIDGE_URL = '/?XTransformPort=3004';

// ─── Main Component ─────────────────────────
export function BridgeView() {
  const { t } = useLocale();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<REPLMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [stats, setStats] = useState({ sent: 0, received: 0 });
  const [connectTime, setConnectTime] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  // Update uptime display
  const getUptime = useCallback((): string => {
    if (!connectTime) return '—';
    const diff = Date.now() - connectTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, [connectTime]);

  // Update uptime every second
  const [uptimeDisplay, setUptimeDisplay] = useState('—');
  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeDisplay(getUptime());
    }, 1000);
    return () => clearInterval(interval);
  }, [getUptime]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        type: 'system',
        content,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const connect = useCallback(() => {
    if (connecting || connected) return;

    setConnecting(true);
    addSystemMessage('Connecting to Bridge service...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}${BRIDGE_URL}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setConnectTime(new Date());
        setStats({ sent: 0, received: 0 });
        setMessages([]);
        addSystemMessage(`${t.bridge.connected} — ${wsUrl}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'welcome') {
            addSystemMessage(`Welcome: ${data.message}`);
            addSystemMessage(data.hint || '');
          } else if (data.type === 'result') {
            setMessages((prev) => [
              ...prev,
              {
                id: `out-${Date.now()}`,
                type: 'output',
                content: data.result || '(no result)',
                timestamp: data.timestamp || new Date().toISOString(),
                duration: data.duration,
              },
            ]);
            setStats((prev) => ({ ...prev, received: prev.received + 1 }));
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: `out-${Date.now()}`,
              type: 'output',
              content: event.data,
              timestamp: new Date().toISOString(),
            },
          ]);
          setStats((prev) => ({ ...prev, received: prev.received + 1 }));
        }
      };

      ws.onerror = () => {
        addSystemMessage(`${t.bridge.error}: ${t.bridge.serviceNotRunning}`);
        setConnecting(false);
        setConnected(false);
        ws.close();
      };

      ws.onclose = () => {
        if (connected) {
          addSystemMessage(t.bridge.disconnected);
        }
        setConnected(false);
        setConnecting(false);
        setConnectTime(null);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch {
      addSystemMessage(`${t.bridge.error}: Failed to create WebSocket`);
      setConnecting(false);
    }
  }, [connecting, connected, addSystemMessage, t]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnectTime(null);
  }, []);

  const sendCommand = useCallback((cmd?: string) => {
    const command = (cmd || inputValue).trim();
    if (!command || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Add input message
    setMessages((prev) => [
      ...prev,
      {
        id: `in-${Date.now()}`,
        type: 'input',
        content: command,
        timestamp: new Date().toISOString(),
      },
    ]);

    wsRef.current.send(command);
    setInputValue('');
    setStats((prev) => ({ ...prev, sent: prev.sent + 1 }));
  }, [inputValue]);

  const clearTerminal = useCallback(() => {
    setMessages([]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    }
  };

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const commandRef = [
    { cmd: t.bridge.cmdPing, desc: t.bridge.cmdPingDesc },
    { cmd: t.bridge.cmdEcho, desc: t.bridge.cmdEchoDesc },
    { cmd: t.bridge.cmdStatus, desc: t.bridge.cmdStatusDesc },
    { cmd: t.bridge.cmdHelp, desc: t.bridge.cmdHelpDesc },
    { cmd: t.bridge.cmdListFiles, desc: t.bridge.cmdListFilesDesc },
    { cmd: t.bridge.cmdGetFile, desc: t.bridge.cmdGetFileDesc },
    { cmd: t.bridge.cmdEval, desc: t.bridge.cmdEvalDesc },
  ];

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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <Radio className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{t.bridge.title}</h1>
                  <Badge className="border-violet-500/20 bg-violet-500/10 text-xs text-violet-400">
                    REPL
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.bridge.subtitle}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Connection Status Card ──────── */}
        <motion.div variants={item} className="mb-6">
          <Card className={`border transition-colors duration-300 ${
            connected
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : connecting
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-border/50 bg-card/50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Status indicator */}
                <div className="relative">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    connected
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                      : connecting
                        ? 'bg-amber-500/15 ring-1 ring-amber-500/30'
                        : 'bg-muted ring-1 ring-border'
                  }`}>
                    {connected
                      ? <Wifi className="h-6 w-6 text-emerald-400" />
                      : connecting
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Wifi className="h-6 w-6 text-amber-400" />
                          </motion.div>
                        : <WifiOff className="h-6 w-6 text-muted-foreground" />
                    }
                  </div>
                  {connected && (
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-xl bg-emerald-500/20"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{t.bridge.connectionStatus}</span>
                    <Badge className={
                      connected
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]'
                        : connecting
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400 text-[10px]'
                          : 'border-border/50 bg-muted text-muted-foreground text-[10px]'
                    }>
                      {connected ? t.bridge.connected : connecting ? t.bridge.connecting : t.bridge.disconnected}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">ws://localhost:3004</p>
                </div>

                {/* Connect/Disconnect button */}
                <Button
                  onClick={connected ? disconnect : connect}
                  disabled={connecting}
                  variant={connected ? 'outline' : 'default'}
                  className={
                    connected
                      ? 'gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400'
                      : 'gap-1.5 bg-violet-600 text-white hover:bg-violet-500'
                  }
                >
                  {connected ? (
                    <>
                      <Plug className="h-3.5 w-3.5" />
                      {t.bridge.disconnect}
                    </>
                  ) : (
                    <>
                      <Radio className="h-3.5 w-3.5" />
                      {t.bridge.connect}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Terminal (main column) ─────── */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-violet-400" />
                    <CardTitle className="text-sm font-semibold">{t.bridge.terminal}</CardTitle>
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
                {/* Terminal display */}
                <div className="rounded-lg border border-border/50 bg-zinc-950 dark:bg-zinc-950 overflow-hidden">
                  {/* Terminal header bar */}
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

                  {/* Terminal output */}
                  <div
                    ref={terminalRef}
                    className="h-80 overflow-y-auto p-3 font-mono text-xs"
                  >
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                        <Terminal className="h-8 w-8 mb-2" />
                        <p className="text-xs">{t.bridge.welcome}</p>
                        <p className="text-[10px] mt-1">{t.bridge.welcomeDesc}</p>
                      </div>
                    )}
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.1 }}
                          className="mb-1.5"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-[9px] text-zinc-600 shrink-0 mt-0.5">
                              {formatTime(msg.timestamp)}
                            </span>
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
                              <span className="text-zinc-700 text-[9px] ml-auto shrink-0">
                                {msg.duration}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Terminal input */}
                  <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/50 px-3 py-2">
                    <span className="text-violet-400 font-mono text-xs">$</span>
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
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
          </motion.div>

          {/* ── Right sidebar ───────────────── */}
          <div className="space-y-6">
            {/* Connection Info */}
            <motion.div variants={item}>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                        <span className="text-xs text-muted-foreground">{t.bridge.messagesSent}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{stats.sent}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <ArrowDownLeft className="h-3 w-3 text-sky-400" />
                        <span className="text-xs text-muted-foreground">{t.bridge.messagesReceived}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{stats.received}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Available Commands */}
            <motion.div variants={item}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-violet-400" />
                    <CardTitle className="text-sm font-semibold">{t.bridge.commands}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-[10px] text-muted-foreground mb-3">{t.bridge.commandsDesc}</p>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {commandRef.map((c) => (
                      <button
                        key={c.cmd}
                        onClick={() => {
                          if (connected) {
                            setInputValue(c.cmd.split(' ')[0]);
                            inputRef.current?.focus();
                          }
                        }}
                        disabled={!connected}
                        className="flex w-full items-start gap-2 rounded-md border border-border/20 p-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                      >
                        <Hash className="h-3 w-3 mt-0.5 shrink-0 text-violet-400/60" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono font-medium text-foreground">{c.cmd}</p>
                          <p className="text-[9px] text-muted-foreground">{c.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={item}>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-xs font-medium text-foreground">Quick Actions</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['ping', 'status', 'help'].map((cmd) => (
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
            </motion.div>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </motion.div>
  );
}

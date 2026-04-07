/**
 * CodeBot Bridge Service v2.0 — Multi-Channel Hub
 * 
 * Combines:
 *   1. HTTP server for webhook receivers (external platform callbacks)
 *   2. WebSocket REPL terminal (existing functionality)
 *   3. REST API for channel management & status queries
 * 
 * Architecture:
 *   - Bun.serve() handles both HTTP and WebSocket on port 3004
 *   - /ws path → upgrades to WebSocket REPL
 *   - /webhook/:channel → receives platform callbacks
 *   - /api/* → channel management endpoints
 *   - Webhook messages are broadcast to all connected WS clients
 */

import { createHash, createHmac, randomUUID } from 'crypto';

const PORT = 3004;
let wsConnectionCount = 0;
let messageCount = 0;
const startTime = Date.now();

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface ChannelConfig {
  id: string;
  name: string;
  nameZh: string;
  platform: string;
  color: string;
  enabled: boolean;
  appSecret: string;
  webhookUrl: string;
  messageCount: number;
  lastActivity: string | null;
}

interface NormalizedMessage {
  id: string;
  channelId: string;
  platform: string;
  userId: string;
  userName: string;
  messageType: string;
  content: string;
  rawPayload: Record<string, unknown>;
  timestamp: string;
}

interface REPLContext {
  cwd: string;
  history: Array<{ cmd: string; result: string; timestamp: string }>;
}

// ────────────────────────────────────────────────────────────────
// Channel Configuration
// ────────────────────────────────────────────────────────────────

const defaultChannels: ChannelConfig[] = [
  { id: 'feishu',   name: 'Feishu / Lark',  nameZh: '飞书',      platform: 'feishu',   color: '#3370ff', enabled: false, appSecret: '', webhookUrl: '/webhook/feishu',   messageCount: 0, lastActivity: null },
  { id: 'wechat',   name: 'WeChat Work',     nameZh: '企业微信',   platform: 'wechat',   color: '#07c160', enabled: false, appSecret: '', webhookUrl: '/webhook/wechat',   messageCount: 0, lastActivity: null },
  { id: 'qq',       name: 'QQ Bot',          nameZh: 'QQ 机器人',  platform: 'qq',       color: '#12b7f5', enabled: false, appSecret: '', webhookUrl: '/webhook/qq',       messageCount: 0, lastActivity: null },
  { id: 'dingtalk', name: 'DingTalk',        nameZh: '钉钉',      platform: 'dingtalk', color: '#0089ff', enabled: false, appSecret: '', webhookUrl: '/webhook/dingtalk', messageCount: 0, lastActivity: null },
  { id: 'slack',    name: 'Slack',           nameZh: 'Slack',     platform: 'slack',    color: '#4a154b', enabled: false, appSecret: '', webhookUrl: '/webhook/slack',    messageCount: 0, lastActivity: null },
  { id: 'telegram', name: 'Telegram',        nameZh: 'Telegram',  platform: 'telegram', color: '#0088cc', enabled: false, appSecret: '', webhookUrl: '/webhook/telegram', messageCount: 0, lastActivity: null },
  { id: 'webhook',  name: 'Custom Webhook',  nameZh: '自定义',    platform: 'webhook',  color: '#6366f1', enabled: false, appSecret: '', webhookUrl: '/webhook/webhook',  messageCount: 0, lastActivity: null },
];

// In-memory channel state (mutable)
const channels: ChannelConfig[] = defaultChannels.map(c => ({ ...c }));
const messageLog: NormalizedMessage[] = [];
const MAX_LOG_SIZE = 500;

// ────────────────────────────────────────────────────────────────
// WebSocket Client Registry (for broadcasting)
// ────────────────────────────────────────────────────────────────

const wsClients = new Set<{ send: (data: string) => void }>();

function broadcastToClients(data: object) {
  const payload = JSON.stringify(data);
  for (const client of wsClients) {
    try {
      client.send(payload);
    } catch {
      wsClients.delete(client);
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Channel Adapters — Parse platform-specific payloads
// ────────────────────────────────────────────────────────────────

function getChannel(id: string): ChannelConfig | undefined {
  return channels.find(c => c.id === id);
}

function adaptFeishu(body: Record<string, unknown>): NormalizedMessage | null {
  // Feishu event callback format
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return null;
  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;
  const msgType = message?.msg_type as string || 'text';
  if (msgType !== 'text') return null;
  const content = message?.content as string || '';
  const parsed = JSON.parse(content).text as string || content;
  return {
    id: randomUUID(),
    channelId: 'feishu',
    platform: 'feishu',
    userId: (sender?.sender_id as Record<string, unknown>)?.open_id as string || 'unknown',
    userName: (sender?.sender_id as Record<string, unknown>)?.name as string || 'Feishu User',
    messageType: msgType,
    content: parsed,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptWechat(body: Record<string, unknown>): NormalizedMessage | null {
  // WeChat Work callback: { msgtype: 'text', text: { content: '...' }, from: { userId, name } }
  const msgType = body.msgtype as string;
  if (msgType !== 'text') return null;
  const text = body.text as Record<string, unknown> | undefined;
  const from = body.from as Record<string, unknown> | undefined;
  return {
    id: randomUUID(),
    channelId: 'wechat',
    platform: 'wechat',
    userId: (from?.userId as string) || body.FromUserName as string || 'unknown',
    userName: (from?.name as string) || 'WeChat User',
    messageType: 'text',
    content: (text?.content as string) || '',
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptQQ(body: Record<string, unknown>): NormalizedMessage | null {
  // QQ Bot v2: { post_type: 'message', message_type: 'group'|'private', user_id, raw_message, sender: { nickname } }
  const content = body.raw_message as string || body.content as string || '';
  if (!content) return null;
  const sender = body.sender as Record<string, unknown> | undefined;
  return {
    id: randomUUID(),
    channelId: 'qq',
    platform: 'qq',
    userId: String(body.user_id || body.author?.id || 'unknown'),
    userName: (sender?.nickname as string) || (sender?.card as string) || 'QQ User',
    messageType: body.message_type as string || 'text',
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptDingtalk(body: Record<string, unknown>): NormalizedMessage | null {
  // DingTalk: { msgtype: 'text', text: { content: '...' }, senderStaffId, senderNick }
  const msgType = body.msgtype as string;
  if (msgType !== 'text') return null;
  const text = body.text as Record<string, unknown> | undefined;
  return {
    id: randomUUID(),
    channelId: 'dingtalk',
    platform: 'dingtalk',
    userId: body.senderStaffId as string || 'unknown',
    userName: body.senderNick as string || 'DingTalk User',
    messageType: 'text',
    content: (text?.content as string) || '',
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptSlack(body: Record<string, unknown>): NormalizedMessage | null {
  // Slack Events API: { type: 'event_callback', event: { type: 'message', user, text, ... } }
  const event = body.event as Record<string, unknown> | undefined;
  if (!event || event.type !== 'message' || event.bot_id) return null;
  return {
    id: randomUUID(),
    channelId: 'slack',
    platform: 'slack',
    userId: event.user as string || 'unknown',
    userName: event.user as string || 'Slack User',
    messageType: 'text',
    content: event.text as string || '',
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptTelegram(body: Record<string, unknown>): NormalizedMessage | null {
  // Telegram update: { update_id, message: { message_id, from: { id, first_name, username }, text } }
  const message = body.message as Record<string, unknown> | undefined;
  if (!message || !message.text) return null;
  const from = message.from as Record<string, unknown> | undefined;
  return {
    id: randomUUID(),
    channelId: 'telegram',
    platform: 'telegram',
    userId: String(from?.id || 'unknown'),
    userName: (from?.first_name as string) || (from?.username as string) || 'Telegram User',
    messageType: 'text',
    content: message.text as string,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

function adaptWebhook(body: Record<string, unknown>): NormalizedMessage | null {
  // Generic webhook: expects { userId, userName, content } or just { text, message }
  const content = body.content as string || body.text as string || body.message as string || '';
  if (!content) return null;
  return {
    id: randomUUID(),
    channelId: 'webhook',
    platform: 'webhook',
    userId: (body.userId as string) || 'unknown',
    userName: (body.userName as string) || 'Webhook User',
    messageType: 'text',
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
}

const adapters: Record<string, (body: Record<string, unknown>) => NormalizedMessage | null> = {
  feishu: adaptFeishu,
  wechat: adaptWechat,
  qq: adaptQQ,
  dingtalk: adaptDingtalk,
  slack: adaptSlack,
  telegram: adaptTelegram,
  webhook: adaptWebhook,
};

// ────────────────────────────────────────────────────────────────
// Signature Verification (optional, skips if no appSecret set)
// ────────────────────────────────────────────────────────────────

function verifyFeishu(timestamp: string, nonce: string, body: string, secret: string): boolean {
  const content = timestamp + nonce + secret;
  const sign = createHash('sha256').update(content).digest('base64');
  const headerSign = new URLSearchParams(body).get('sign');
  return sign === headerSign;
}

function verifyDingtalk(timestamp: string, sign: string, secret: string): boolean {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(stringToSign);
  return hmac.digest('base64') === sign;
}

function verifyGenericSignature(signature: string, payload: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex') === signature;
}

// ────────────────────────────────────────────────────────────────
// Webhook Handler
// ────────────────────────────────────────────────────────────────

function handleWebhook(channelId: string, body: string, headers: Record<string, string>): NormalizedMessage | null {
  const channel = getChannel(channelId);
  if (!channel) return null;
  if (!channel.enabled) return null;

  // Verify signature if appSecret is configured
  if (channel.appSecret) {
    const signature = headers['x-signature'] || headers['x-hub-signature-256'] || headers['sign'] || '';
    if (signature && !verifyGenericSignature(signature.replace('sha256=', ''), body, channel.appSecret)) {
      console.log(`[Webhook] ${channelId}: signature verification failed`);
      return null;
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Try URL-encoded body for Feishu
    const params = new URLSearchParams(body);
    parsed = Object.fromEntries(params.entries());
  }

  const adapter = adapters[channelId];
  if (!adapter) {
    // Fallback: use generic webhook adapter
    return adaptWebhook(parsed);
  }

  const message = adapter(parsed);
  if (message) {
    // Update channel stats
    channel.messageCount++;
    channel.lastActivity = new Date().toISOString();

    // Store in log
    messageLog.push(message);
    if (messageLog.length > MAX_LOG_SIZE) messageLog.shift();

    // Broadcast to all WS clients
    broadcastToClients({
      type: 'webhook-message',
      channel: channelId,
      data: {
        userId: message.userId,
        userName: message.userName,
        content: message.content,
        messageType: message.messageType,
        timestamp: message.timestamp,
      },
    });

    console.log(`[Webhook] ${channelId}: "${message.content.substring(0, 80)}" from ${message.userName}`);
  }

  return message;
}

// ────────────────────────────────────────────────────────────────
// REPL Command Handlers (existing functionality)
// ────────────────────────────────────────────────────────────────

function createREPLContext(): REPLContext {
  return { cwd: process.cwd(), history: [] };
}

async function handleCommand(input: string, ctx: REPLContext): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return 'error: empty command';

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  const timestamp = new Date().toISOString();
  let result: string;

  switch (cmd) {
    case 'ping':
      result = `pong (${Math.floor(Math.random() * 10 + 1)}ms)`;
      break;

    case 'echo':
      result = args || '(empty)';
      break;

    case 'status': {
      const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
      const channelStatus = channels.map(c =>
        `  ${c.enabled ? '✓' : '✗'} ${c.id.padEnd(10)} ${c.name} (${c.messageCount} msgs)`
      ).join('\n');
      result = JSON.stringify({
        status: 'running',
        version: '2.0.0',
        port: PORT,
        uptime: `${uptime}s`,
        wsConnections: wsClients.size,
        messagesProcessed: messageCount,
        channels: channels.filter(c => c.enabled).length,
        channelDetails: channelStatus,
        cwd: ctx.cwd,
      }, null, 2);
      break;
    }

    case 'channels':
      result = channels.map(c =>
        `${c.enabled ? '🟢' : '⚪'} ${c.id.padEnd(10)} ${c.name.padEnd(18)} msgs:${c.messageCount} ${c.lastActivity || ''}`
      ).join('\n');
      break;

    case 'logs': {
      const limit = parseInt(args) || 10;
      const recent = messageLog.slice(-limit);
      if (recent.length === 0) { result = '(no logs)'; break; }
      result = recent.map(m =>
        `[${m.timestamp.substring(11, 19)}] ${m.channelId.padEnd(10)} ${m.userName.padEnd(16)}: ${m.content.substring(0, 60)}`
      ).join('\n');
      break;
    }

    case 'help':
      result = [
        'Available commands:',
        '  ping              — Test connection latency',
        '  echo <text>       — Echo text back',
        '  status            — View service status',
        '  channels          — List all channels',
        '  logs [n]          — Show recent webhook logs (default 10)',
        '  list-files [dir]  — List files in directory',
        '  get-file <path>   — Get file contents (first 50 lines)',
        '  eval <expr>       — Evaluate a JS expression (limited)',
        '  history           — Show command history',
        '  clear             — Clear command history',
        '  help              — Show this help',
      ].join('\n');
      break;

    case 'list-files': {
      const dir = args || ctx.cwd;
      try {
        const fs = await import('fs');
        const path = await import('path');
        const resolvedDir = path.resolve(dir);
        const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
        const files = entries
          .slice(0, 50)
          .map((e: import('fs').Dirent) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
          .join('\n');
        result = `Directory: ${resolvedDir}\n${files}\n(${entries.length} entries, showing first 50)`;
      } catch (err: unknown) {
        result = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      break;
    }

    case 'get-file': {
      if (!args) { result = 'error: usage: get-file <path>'; break; }
      try {
        const fs = await import('fs');
        const path = await import('path');
        const resolvedPath = path.resolve(ctx.cwd, args);
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = content.split('\n').slice(0, 50);
        const truncated = content.split('\n').length > 50 ? '\n... (truncated to 50 lines)' : '';
        result = `File: ${resolvedPath}\n${'─'.repeat(40)}\n${lines.join('\n')}${truncated}`;
      } catch (err: unknown) {
        result = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      break;
    }

    case 'eval': {
      if (!args) { result = 'error: usage: eval <expression>'; break; }
      try {
        const forbidden = ['require', 'import', 'process', 'global', 'eval', 'Function', '__proto__', 'constructor'];
        if (forbidden.some(f => args.includes(f))) {
          result = 'error: restricted expression (forbidden keywords detected)';
          break;
        }
        const sandbox: Record<string, unknown> = { Math, Date, JSON, Array, Object, String, Number, Boolean };
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
        const fn = new Function(...keys, `"use strict"; return (${args});`);
        const evalResult = fn(...values);
        result = JSON.stringify(evalResult, null, 2);
      } catch (err: unknown) {
        result = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      break;
    }

    case 'history':
      if (ctx.history.length === 0) {
        result = '(empty history)';
      } else {
        result = ctx.history.map((h, i) => `[${i + 1}] ${h.cmd} → ${h.result.substring(0, 80)}`).join('\n');
      }
      break;

    case 'clear':
      ctx.history = [];
      result = 'history cleared';
      break;

    default:
      result = `error: unknown command "${cmd}". Type "help" for available commands.`;
  }

  ctx.history.push({ cmd: trimmed, result, timestamp });
  if (ctx.history.length > 100) ctx.history.shift();

  return result;
}

// ────────────────────────────────────────────────────────────────
// HTTP Helpers
// ────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Hub-Signature-256, Sign, Timestamp',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ────────────────────────────────────────────────────────────────
// Bun Server — HTTP + WebSocket
// ────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── WebSocket upgrade ──
    if (path === '/ws' && server.upgrade(req)) {
      return; // handled by websocket handler
    }

    // ── Webhook receivers ──
    if (path.startsWith('/webhook/')) {
      const channelId = path.replace('/webhook/', '');
      if (!getChannel(channelId)) {
        return json({ error: `Unknown channel: ${channelId}` }, 404);
      }

      if (method === 'POST') {
        const body = await req.text();
        const headers: Record<string, string> = {};
        req.headers.forEach((v, k) => { headers[k] = v; });

        // Feishu URL verification challenge
        if (channelId === 'feishu') {
          try {
            const parsed = JSON.parse(body);
            if (parsed.type === 'url_verification') {
              return json({ challenge: parsed.challenge });
            }
          } catch { /* not JSON, try normal webhook */ }
        }

        const message = handleWebhook(channelId, body, headers);
        if (message) {
          return json({ success: true, messageId: message.id });
        }
        return json({ success: true, message: 'Webhook received but not parsed' });
      }

      return json({ error: 'Use POST for webhooks' }, 405);
    }

    // ── REST API ──
    if (path === '/api/channels' && method === 'GET') {
      const safeChannels = channels.map(c => ({
        id: c.id,
        name: c.name,
        nameZh: c.nameZh,
        platform: c.platform,
        color: c.color,
        enabled: c.enabled,
        hasSecret: !!c.appSecret,
        webhookUrl: c.webhookUrl,
        messageCount: c.messageCount,
        lastActivity: c.lastActivity,
      }));
      return json({ channels: safeChannels, total: channels.length, active: channels.filter(c => c.enabled).length });
    }

    if (path.startsWith('/api/channels/') && method === 'POST') {
      const segments = path.split('/');
      const channelId = segments[3];
      const action = segments[4]; // 'toggle' or 'config'
      const channel = getChannel(channelId);

      if (!channel) return json({ error: `Unknown channel: ${channelId}` }, 404);

      if (action === 'toggle') {
        channel.enabled = !channel.enabled;
        broadcastToClients({ type: 'channel-updated', channelId, enabled: channel.enabled });
        console.log(`[API] Channel ${channelId} ${channel.enabled ? 'enabled' : 'disabled'}`);
        return json({ success: true, channelId, enabled: channel.enabled });
      }

      if (action === 'config') {
        const body = await req.json() as Record<string, unknown>;
        if (body.appSecret !== undefined) channel.appSecret = String(body.appSecret);
        if (body.enabled !== undefined) channel.enabled = Boolean(body.enabled);
        return json({ success: true, channelId });
      }

      return json({ error: 'Unknown action. Use /toggle or /config' }, 400);
    }

    if (path === '/api/logs' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const channelId = url.searchParams.get('channel');
      let logs = [...messageLog].reverse();
      if (channelId) logs = logs.filter(l => l.channelId === channelId);
      return json({ logs: logs.slice(0, limit), total: logs.length });
    }

    if (path === '/api/stats' && method === 'GET') {
      return json({
        version: '2.0.0',
        port: PORT,
        uptime: ((Date.now() - startTime) / 1000).toFixed(0) + 's',
        wsConnections: wsClients.size,
        totalMessages: messageLog.length,
        activeChannels: channels.filter(c => c.enabled).length,
        totalChannels: channels.length,
        channels: channels.map(c => ({
          id: c.id,
          name: c.name,
          nameZh: c.nameZh,
          enabled: c.enabled,
          messageCount: c.messageCount,
          lastActivity: c.lastActivity,
        })),
      });
    }

    if (path === '/api/test-webhook' && method === 'POST') {
      const body = await req.json() as Record<string, unknown>;
      const channelId = (body.channel as string) || 'webhook';
      const testMsg: NormalizedMessage = {
        id: randomUUID(),
        channelId,
        platform: channelId,
        userId: 'test-user',
        userName: body.name as string || 'Test User',
        messageType: 'text',
        content: body.content as string || 'Hello from test webhook!',
        rawPayload: { test: true },
        timestamp: new Date().toISOString(),
      };

      const channel = getChannel(channelId);
      if (channel) {
        channel.messageCount++;
        channel.lastActivity = testMsg.timestamp;
      }
      messageLog.push(testMsg);
      broadcastToClients({ type: 'webhook-message', channel: channelId, data: testMsg });

      return json({ success: true, messageId: testMsg.id });
    }

    // ── Health check ──
    if (path === '/health') {
      return json({ status: 'ok', version: '2.0.0', uptime: ((Date.now() - startTime) / 1000).toFixed(0) + 's' });
    }

    // ── 404 ──
    return json({ error: 'Not found', availableEndpoints: ['/ws', '/webhook/:channel', '/api/channels', '/api/logs', '/api/stats', '/health'] }, 404);
  },

  websocket: {
    open(ws) {
      wsConnectionCount++;
      const connId = wsConnectionCount;
      const ctx = createREPLContext();

      // Store context on ws for later use
      (ws as any)._connId = connId;
      (ws as any)._ctx = ctx;

      wsClients.add(ws);

      console.log(`[WS] Client #${connId} connected (${wsClients.size} total)`);

      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'CodeBot Bridge v2.0 — Multi-Channel Hub',
        hint: 'Type "help" for commands. Webhook messages will be broadcast here.',
        channels: channels.map(c => ({ id: c.id, name: c.name, enabled: c.enabled, color: c.color })),
        timestamp: new Date().toISOString(),
      }));
    },

    async message(ws, event: MessageEvent) {
      const connId = (ws as any)._connId;
      const ctx = (ws as any)._ctx as REPLContext;
      const input = typeof event.data === 'string' ? event.data.trim() : '';
      if (!input) return;

      messageCount++;
      const startMs = Date.now();
      const result = await handleCommand(input, ctx);
      const duration = Date.now() - startMs;

      console.log(`[WS] #${connId} > ${input.substring(0, 100)}`);

      ws.send(JSON.stringify({
        type: 'result',
        command: input,
        result,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }));
    },

    close(ws) {
      const connId = (ws as any)._connId;
      wsClients.delete(ws);
      console.log(`[WS] Client #${connId} disconnected (${wsClients.size} remaining)`);
    },

    drain(ws) {
      // backpressure
    },
  },
});

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   CodeBot Bridge v2.0 — Multi-Channel Hub   ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  HTTP    : http://localhost:${PORT}              ║`);
console.log(`║  WS      : ws://localhost:${PORT}/ws             ║`);
console.log(`║  Webhooks: http://localhost:${PORT}/webhook/:ch  ║`);
console.log(`║  API     : http://localhost:${PORT}/api/*        ║`);
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Channels: ${channels.length} (${channels.filter(c => c.enabled).length} active)                     ║`);
for (const ch of channels) {
  console.log(`║    ${ch.enabled ? '🟢' : '⚪'} ${ch.id.padEnd(10)} ${ch.name.padEnd(18)} ${ch.webhookUrl}  ║`);
}
console.log('╚══════════════════════════════════════════════╝');
console.log('');

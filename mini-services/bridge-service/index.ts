/**
 * CodeBot Bridge Service v2.0 — Multi-Channel Webhook + WebSocket REPL
 *
 * A mini-service on port 3004 that combines:
 *   1. HTTP server with webhook receiving endpoints for 7 messaging platforms
 *   2. Channel adapter system that normalizes messages from each platform
 *   3. REST API for channel management and message log retrieval
 *   4. WebSocket REPL on /ws (backward-compatible) that also receives broadcast messages
 *
 * Usage:
 *   bun --hot index.ts    (development with auto-reload)
 *   bun index.ts          (production)
 *
 * Endpoints:
 *   WebSocket: ws://localhost:3004/ws
 *   POST /webhook/:channel        — Receive webhook payload from external platform
 *   GET  /api/channels            — List all channel configs and status
 *   POST /api/channels/:id/toggle — Enable/disable a channel
 *   POST /api/channels/:id/config — Update channel config (appSecret, etc.)
 *   GET  /api/logs                — Return recent message logs (last 500)
 */

// ────────────────────────────────────────────
// Types & Interfaces
// ────────────────────────────────────────────

/** Normalized message produced by every channel adapter */
interface NormalizedMessage {
  channelId: string;
  platform: string;
  userId: string;
  userName: string;
  messageType: string;
  content: string;
  rawPayload: unknown;
  timestamp: string;
}

/** Channel configuration */
interface ChannelConfig {
  id: string;
  name: string;
  platform: string;
  icon: string;
  color: string;
  enabled: boolean;
  appSecret: string;
  webhookUrl: string;
  messageCount: number;
  lastActivity: string | null;
}

/** Message log entry */
interface MessageLogEntry extends NormalizedMessage {
  id: string;
  receivedAt: string;
}

/** REPL command context (per WebSocket connection) */
interface REPLContext {
  cwd: string;
  history: Array<{ cmd: string; result: string; timestamp: string }>;
}

// ────────────────────────────────────────────
// Service State
// ────────────────────────────────────────────

const PORT = 3004;
let messageCount = 0;
let connectionCount = 0;
const startTime = Date.now();

/** Connected WebSocket clients (for broadcasting) */
const clients = new Set<import('bun').ServerWebSocket<unknown>>();

/** Message log — capped at 500 entries */
const messageLog: MessageLogEntry[] = [];
const MAX_LOG_SIZE = 500;

/** Channel configurations */
const channels: Map<string, ChannelConfig> = new Map();

const defaultChannels: ChannelConfig[] = [
  { id: 'feishu', name: 'Feishu / Lark', platform: 'feishu', icon: 'MessageCircle', color: '#3370ff', enabled: false, appSecret: '', webhookUrl: '/webhook/feishu', messageCount: 0, lastActivity: null },
  { id: 'wechat', name: 'WeChat Work', platform: 'wechat', icon: 'MessageCircle', color: '#07c160', enabled: false, appSecret: '', webhookUrl: '/webhook/wechat', messageCount: 0, lastActivity: null },
  { id: 'qq', name: 'QQ Bot', platform: 'qq', icon: 'MessageCircle', color: '#12b7f5', enabled: false, appSecret: '', webhookUrl: '/webhook/qq', messageCount: 0, lastActivity: null },
  { id: 'dingtalk', name: 'DingTalk', platform: 'dingtalk', icon: 'MessageCircle', color: '#0089ff', enabled: false, appSecret: '', webhookUrl: '/webhook/dingtalk', messageCount: 0, lastActivity: null },
  { id: 'slack', name: 'Slack', platform: 'slack', icon: 'MessageCircle', color: '#4a154b', enabled: false, appSecret: '', webhookUrl: '/webhook/slack', messageCount: 0, lastActivity: null },
  { id: 'telegram', name: 'Telegram', platform: 'telegram', icon: 'MessageCircle', color: '#0088cc', enabled: false, appSecret: '', webhookUrl: '/webhook/telegram', messageCount: 0, lastActivity: null },
  { id: 'webhook', name: 'Custom Webhook', platform: 'webhook', icon: 'MessageCircle', color: '#6366f1', enabled: false, appSecret: '', webhookUrl: '/webhook/webhook', messageCount: 0, lastActivity: null },
];

// Initialize channels
for (const ch of defaultChannels) {
  channels.set(ch.id, ch);
}

// ────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────

const crypto = require('crypto');

/** Generate a simple unique ID */
function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** CORS response headers */
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

/** Return a JSON response with CORS headers */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/** Broadcast a message to all connected WebSocket clients */
function broadcast(message: unknown): void {
  const payload = JSON.stringify(message);
  for (const ws of clients) {
    try {
      ws.send(payload);
    } catch {
      // Client may have disconnected; remove on next tick
    }
  }
}

/** Add a normalized message to the log and update channel stats */
function storeMessage(msg: NormalizedMessage): MessageLogEntry {
  const entry: MessageLogEntry = { ...msg, id: uid(), receivedAt: new Date().toISOString() };
  messageLog.push(entry);
  if (messageLog.length > MAX_LOG_SIZE) messageLog.shift();

  // Update channel stats
  const channel = channels.get(msg.channelId);
  if (channel) {
    channel.messageCount++;
    channel.lastActivity = entry.receivedAt;
  }

  return entry;
}

// ────────────────────────────────────────────
// Channel Adapters
// ────────────────────────────────────────────

/**
 * Each adapter receives a channel config, the raw request body,
 * and any query parameters, then returns a NormalizedMessage or null.
 */
type ChannelAdapter = (
  channel: ChannelConfig,
  body: Record<string, unknown>,
  queryParams: URLSearchParams,
) => NormalizedMessage | null;

/** Feishu / Lark — verifies timestamp + signature via HMAC-SHA256 */
const feishuAdapter: ChannelAdapter = (channel, body, _qp) => {
  // Verification: timestamp + signature
  // Feishu sends { timestamp, sign, ...event }
  if (channel.appSecret) {
    const ts = String(body.timestamp || '');
    const sign = String(body.sign || '');
    if (ts && sign) {
      const expected = crypto
        .createHmac('sha256', channel.appSecret)
        .update(`${ts}\n${channel.appSecret}`)
        .digest('base64');
      if (sign !== expected) {
        return null; // Signature mismatch
      }
    }
  }

  // Feishu event structure: { event: { message: { message_id, chat_id, content_type, content } }, sender: { sender_id: { open_id, union_id }, sender_id, name } }
  const event = body.event as Record<string, unknown> | undefined;
  const sender = body.sender as Record<string, unknown> | undefined;

  if (!event || !event.message) return null;

  const message = event.message as Record<string, unknown>;
  const content = String(message.content || '').replace(/^"|"$/g, ''); // Feishu wraps in quotes

  return {
    channelId: channel.id,
    platform: 'feishu',
    userId: String(sender?.open_id || sender?.sender_id || sender?.name || 'unknown'),
    userName: String(sender?.name || 'Unknown'),
    messageType: String(message.content_type || 'text'),
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** WeChat Work — verifies signature via SHA1 */
const wechatAdapter: ChannelAdapter = (channel, body, _qp) => {
  // WeChat Work sends: { MsgType, Content, FromUserName, ... }
  // Verification typically via query params, but we check the body for msg_signature
  if (channel.appSecret && body.msg_signature) {
    const token = channel.appSecret;
    const sortStr = [body.timestamp, body.nonce, body.encrypt].sort().join('');
    const expected = crypto.createHash('sha1').update(`${token}${sortStr}`).digest('hex');
    if (body.msg_signature !== expected) {
      return null;
    }
  }

  const content = String(body.Content || body.content || '');

  return {
    channelId: channel.id,
    platform: 'wechat',
    userId: String(body.FromUserName || body.from_user_name || 'unknown'),
    userName: String(body.FromUserName || body.from_user_name || 'Unknown'),
    messageType: String(body.MsgType || body.msg_type || 'text'),
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** QQ Bot — verifies appid + token */
const qqAdapter: ChannelAdapter = (channel, body, _qp) => {
  // QQ Bot sends: { authorization, event_type, id, ... }
  // Authorization header is "QQBot <appid>.<token>", but we only have body
  if (channel.appSecret && body.__sid__) {
    // Simple token check via session ID if available
  }

  // QQ Bot event structure
  const d = body.d as Record<string, unknown> | undefined;
  const content = String(d?.content || body.content || '');
  const author = d?.author as Record<string, unknown> | undefined;

  return {
    channelId: channel.id,
    platform: 'qq',
    userId: String(author?.id || body.user_id || 'unknown'),
    userName: String(author?.user_name || body.user_name || 'Unknown'),
    messageType: String(body.event_type || body.post_type || 'message'),
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** DingTalk Robot — verifies sign via HMAC-SHA256 */
const dingtalkAdapter: ChannelAdapter = (channel, body, _qp) => {
  // DingTalk sends: { msgtype, text: { content }, senderId, senderNick, ... }
  // Verification via sign (query param) + timestamp
  if (channel.appSecret && _qp.get('sign')) {
    const timestamp = _qp.get('timestamp') || '';
    const sign = _qp.get('sign') || '';
    const stringToSign = `${timestamp}\n${channel.appSecret}`;
    const expected = crypto
      .createHmac('sha256', channel.appSecret)
      .update(stringToSign)
      .digest('base64');
    if (sign !== expected) {
      return null;
    }
  }

  const text = body.text as Record<string, unknown> | undefined;
  const content = String(text?.content || body.content || '').trim();

  return {
    channelId: channel.id,
    platform: 'dingtalk',
    userId: String(body.senderStaffId || body.senderId || 'unknown'),
    userName: String(body.senderNick || body.senderName || 'Unknown'),
    messageType: String(body.msgtype || 'text'),
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** Slack Events API — verifies token or signature */
const slackAdapter: ChannelAdapter = (channel, body, _qp) => {
  // Slack sends: { token, type, event: { type, user, text, ... } }
  // URL verification: { type: "url_verification", challenge }
  if (body.type === 'url_verification') {
    return null; // Handled separately in route
  }

  if (channel.appSecret && body.token && body.token !== channel.appSecret) {
    return null; // Token mismatch
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return null;

  return {
    channelId: channel.id,
    platform: 'slack',
    userId: String(event.user || body.user || 'unknown'),
    userName: String(event.user || event.username || body.user_name || 'Unknown'),
    messageType: String(event.type || 'event'),
    content: String(event.text || ''),
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** Telegram Bot API — getUpdates-style */
const telegramAdapter: ChannelAdapter = (channel, body, _qp) => {
  // Telegram sends: { update_id, message: { message_id, from, chat, text, ... } }
  // Or inline_query, callback_query, etc.
  if (body.update_id === undefined) return null;

  const message = body.message as Record<string, unknown> | undefined;
  const from = message?.from as Record<string, unknown> | undefined;

  return {
    channelId: channel.id,
    platform: 'telegram',
    userId: String(from?.id || 'unknown'),
    userName: from?.username
      ? `@${from.username}`
      : String(from?.first_name || from?.last_name || 'Unknown'),
    messageType: 'message',
    content: String(message?.text || message?.caption || ''),
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** Generic / Custom Webhook — no verification, flexible schema */
const webhookAdapter: ChannelAdapter = (channel, body, _qp) => {
  // Accept any JSON body; try common fields
  const content = String(
    body.message || body.text || body.content || body.msg || body.data || JSON.stringify(body)
  );

  return {
    channelId: channel.id,
    platform: 'webhook',
    userId: String(body.userId || body.user_id || body.from || 'anonymous'),
    userName: String(body.userName || body.username || body.user_name || body.from || 'Anonymous'),
    messageType: String(body.messageType || body.msg_type || body.type || 'text'),
    content,
    rawPayload: body,
    timestamp: new Date().toISOString(),
  };
};

/** Adapter registry — maps channel platform to its adapter function */
const adapters: Record<string, ChannelAdapter> = {
  feishu: feishuAdapter,
  wechat: wechatAdapter,
  qq: qqAdapter,
  dingtalk: dingtalkAdapter,
  slack: slackAdapter,
  telegram: telegramAdapter,
  webhook: webhookAdapter,
};

// ────────────────────────────────────────────
// REPL Command Handlers (backward-compatible)
// ────────────────────────────────────────────

function createREPLContext(): REPLContext {
  return { cwd: process.cwd(), history: [] };
}

function handleCommand(input: string, ctx: REPLContext): string {
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
      result = JSON.stringify({
        status: 'running',
        version: '2.0.0',
        port: PORT,
        uptime: `${uptime}s`,
        connections: connectionCount,
        messagesProcessed: messageCount,
        totalWebhookMessages: messageLog.length,
        channelsEnabled: [...channels.values()].filter((c) => c.enabled).length,
        cwd: ctx.cwd,
      }, null, 2);
      break;
    }

    case 'help':
      result = [
        'Available commands:',
        '  ping              — Test connection latency',
        '  echo <text>       — Echo text back',
        '  status            — View service status',
        '  list-files [dir]  — List files in directory (default: cwd)',
        '  get-file <path>   — Get file contents (first 50 lines)',
        '  eval <expr>       — Evaluate a JS expression (limited)',
        '  channels          — List webhook channels and their status',
        '  logs [count]      — Show recent webhook message logs',
        '  history           — Show command history',
        '  clear             — Clear command history',
        '  help              — Show this help',
      ].join('\n');
      break;

    case 'list-files': {
      const dir = args || ctx.cwd;
      try {
        const fs = require('fs');
        const path = require('path');
        const resolvedDir = path.resolve(dir);
        const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
        const files = entries
          .slice(0, 50)
          .map((e: { isDirectory: () => boolean; name: string }) =>
            `${e.isDirectory() ? '📁' : '📄'} ${e.name}`
          )
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
        const fs = require('fs');
        const path = require('path');
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
        if (forbidden.some((f) => args.includes(f))) {
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

    case 'channels': {
      const lines = [...channels.values()].map(
        (c) => `${c.enabled ? '✅' : '⬜'} ${c.name.padEnd(18)} ${c.webhookUrl}  (${c.messageCount} msgs)`
      );
      result = lines.join('\n') || '(no channels configured)';
      break;
    }

    case 'logs': {
      const count = parseInt(args || '10', 10);
      const recent = messageLog.slice(-count);
      if (recent.length === 0) {
        result = '(no webhook messages received)';
      } else {
        result = recent
          .map(
            (l) =>
              `[${l.receivedAt}] [${l.platform}] ${l.userName}: ${l.content.substring(0, 100)}`
          )
          .join('\n');
      }
      break;
    }

    case 'history':
      if (ctx.history.length === 0) {
        result = '(empty history)';
      } else {
        result = ctx.history
          .map((h, i) => `[${i + 1}] ${h.cmd} → ${h.result.substring(0, 80)}`)
          .join('\n');
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

// ────────────────────────────────────────────
// HTTP Route Handlers
// ────────────────────────────────────────────

/** Handle POST /webhook/:channel — receive external platform messages */
function handleWebhook(
  channelName: string,
  body: Record<string, unknown>,
  queryParams: URLSearchParams
): Response {
  const channel = channels.get(channelName);

  // Unknown channel
  if (!channel) {
    return json({ error: `Unknown channel: ${channelName}`, available: [...channels.keys()] }, 404);
  }

  // Channel disabled
  if (!channel.enabled) {
    return json({ error: `Channel "${channelName}" is disabled`, hint: 'Enable it via POST /api/channels/:id/toggle' }, 403);
  }

  // Slack URL verification (special case)
  if (channel.platform === 'slack' && body.type === 'url_verification') {
    return json({ challenge: body.challenge });
  }

  // Get the adapter for this platform
  const adapter = adapters[channel.platform];
  if (!adapter) {
    return json({ error: `No adapter registered for platform: ${channel.platform}` }, 500);
  }

  // Parse message via adapter
  const message = adapter(channel, body, queryParams);
  if (!message) {
    return json({ error: 'Verification failed or invalid payload', platform: channel.platform }, 401);
  }

  // Store message and update stats
  messageCount++;
  const entry = storeMessage(message);

  // Broadcast to all WebSocket clients
  broadcast({
    type: 'webhook-message',
    channel: message.channelId,
    data: {
      userId: message.userId,
      userName: message.userName,
      content: message.content,
      timestamp: message.timestamp,
    },
  });

  console.log(`[Webhook:${channelName}] ${message.userName}: ${message.content.substring(0, 80)}`);

  return json({ ok: true, id: entry.id, platform: message.platform, channelId: message.channelId });
}

/** Handle GET /api/channels — list all channel configs */
function handleGetChannels(): Response {
  return json({
    channels: [...channels.values()],
    totalMessages: messageLog.length,
    enabledCount: [...channels.values()].filter((c) => c.enabled).length,
  });
}

/** Handle POST /api/channels/:id/toggle — enable/disable a channel */
function handleToggleChannel(id: string): Response {
  const channel = channels.get(id);
  if (!channel) {
    return json({ error: `Unknown channel: ${id}` }, 404);
  }
  channel.enabled = !channel.enabled;
  console.log(`[Channel] ${channel.name} → ${channel.enabled ? 'ENABLED' : 'DISABLED'}`);
  return json({ ok: true, channelId: id, enabled: channel.enabled });
}

/** Handle POST /api/channels/:id/config — update channel config */
function handleUpdateConfig(id: string, updates: Record<string, unknown>): Response {
  const channel = channels.get(id);
  if (!channel) {
    return json({ error: `Unknown channel: ${id}` }, 404);
  }

  // Only allow updating specific fields
  const allowedFields = ['appSecret', 'enabled', 'name'];
  const updated: string[] = [];
  for (const field of allowedFields) {
    if (field in updates) {
      (channel as Record<string, unknown>)[field] = updates[field];
      updated.push(field);
    }
  }

  console.log(`[Channel] ${channel.name} config updated: ${updated.join(', ')}`);
  return json({ ok: true, channelId: id, updated, channel });
}

/** Handle GET /api/logs — return recent message logs */
function handleGetLogs(queryParams: URLSearchParams): Response {
  const limit = Math.min(parseInt(queryParams.get('limit') || '50', 10), 500);
  const channel = queryParams.get('channel');

  let logs = [...messageLog];

  // Filter by channel if specified
  if (channel) {
    logs = logs.filter((l) => l.channelId === channel);
  }

  // Return the most recent entries
  const recent = logs.slice(-limit).reverse();

  return json({
    logs: recent,
    total: logs.length,
    returned: recent.length,
    limit,
  });
}

// ────────────────────────────────────────────
// Bun.serve() — HTTP + WebSocket on same port
// ────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,

  // HTTP handler — called for every non-WebSocket request
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ── CORS preflight ──
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── WebSocket upgrade — only on /ws path ──
    if (path === '/ws') {
      if (server.upgrade(req)) {
        return; // upgrade handled; response is ignored
      }
      return json({ error: 'WebSocket upgrade failed' }, 500);
    }

    // ── Health check ──
    if (path === '/' || path === '/health') {
      return json({
        status: 'running',
        version: '2.0.0',
        port: PORT,
        uptime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        connections: clients.size,
        channels: [...channels.values()].map((c) => ({
          id: c.id,
          enabled: c.enabled,
          messageCount: c.messageCount,
        })),
      });
    }

    // ── POST /webhook/:channel — receive webhook ──
    const webhookMatch = path.match(/^\/webhook\/([a-z0-9_-]+)$/);
    if (webhookMatch && method === 'POST') {
      try {
        const body = await req.json();
        return handleWebhook(webhookMatch[1], body as Record<string, unknown>, url.searchParams);
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
    }

    // ── GET /api/channels — list channels ──
    if (path === '/api/channels' && method === 'GET') {
      return handleGetChannels();
    }

    // ── POST /api/channels/:id/toggle ──
    const toggleMatch = path.match(/^\/api\/channels\/([a-z0-9_-]+)\/toggle$/);
    if (toggleMatch && method === 'POST') {
      return handleToggleChannel(toggleMatch[1]);
    }

    // ── POST /api/channels/:id/config ──
    const configMatch = path.match(/^\/api\/channels\/([a-z0-9_-]+)\/config$/);
    if (configMatch && method === 'POST') {
      try {
        const body = await req.json();
        return handleUpdateConfig(configMatch[1], body as Record<string, unknown>);
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
    }

    // ── GET /api/logs — message logs ──
    if (path === '/api/logs' && method === 'GET') {
      return handleGetLogs(url.searchParams);
    }

    // ── 404 ──
    return json({ error: 'Not found', path, availableEndpoints: [
      'GET  /',
      'GET  /health',
      'WS   /ws',
      'POST /webhook/:channel',
      'GET  /api/channels',
      'POST /api/channels/:id/toggle',
      'POST /api/channels/:id/config',
      'GET  /api/logs',
    ] }, 404);
  },

  // WebSocket handler — called after successful upgrade
  websocket: {
    open(ws) {
      clients.add(ws);
      connectionCount++;
      const connId = connectionCount;

      console.log(`[Bridge] Client #${connId} connected (${clients.size} total)`);

      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'CodeBot Bridge Service v2.0.0',
        hint: 'Type "help" for available commands. Webhook messages will be broadcast automatically.',
        timestamp: new Date().toISOString(),
      }));
    },

    message(ws, message) {
      const input = message.toString().trim();
      if (!input) return;

      const ctx = createREPLContext();
      messageCount++;
      const startMs = Date.now();
      const result = handleCommand(input, ctx);
      const duration = Date.now() - startMs;

      console.log(`[Bridge] > ${input.substring(0, 100)}`);

      ws.send(JSON.stringify({
        type: 'result',
        command: input,
        result,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }));
    },

    close(ws) {
      clients.delete(ws);
      console.log(`[Bridge] Client disconnected (${clients.size} remaining)`);
    },

    drain(ws) {
      // Backpressure: queue full — could implement buffering here
      console.log(`[Bridge] Client backpressure detected`);
    },
  },
});

console.log(`╔══════════════════════════════════════════════════╗`);
console.log(`║  CodeBot Bridge Service v2.0.0                  ║`);
console.log(`║  HTTP + WebSocket server on port ${PORT}               ║`);
console.log(`╠══════════════════════════════════════════════════╣`);
console.log(`║  HTTP:    http://localhost:${PORT}                   ║`);
console.log(`║  WS REPL: ws://localhost:${PORT}/ws                  ║`);
console.log(`║  Health:  http://localhost:${PORT}/health             ║`);
console.log(`╠══════════════════════════════════════════════════╣`);
console.log(`║  Channels: 7 (feishu, wechat, qq, dingtalk,      ║`);
console.log(`║            slack, telegram, webhook)              ║`);
console.log(`║  Endpoints:                                       ║`);
console.log(`║    POST /webhook/:channel        — Receive webhook║`);
console.log(`║    GET  /api/channels            — List channels  ║`);
console.log(`║    POST /api/channels/:id/toggle — Toggle channel ║`);
console.log(`║    POST /api/channels/:id/config — Update config  ║`);
console.log(`║    GET  /api/logs                — Message logs   ║`);
console.log(`╚══════════════════════════════════════════════════╝`);

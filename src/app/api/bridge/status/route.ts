import { NextRequest, NextResponse } from 'next/server';

/**
 * API proxy for Bridge multi-channel service (port 3004)
 * 
 * Handles:
 *   GET  ?action=stats                → /api/stats
 *   GET  ?action=channels             → /api/channels
 *   POST ?action=toggle&id=feishu     → /api/channels/feishu/toggle
 *   POST ?action=config&id=feishu     → /api/channels/feishu/config
 *   POST ?action=test                 → /api/test-webhook
 *   GET  ?action=logs&channel=feishu  → /api/logs
 */

const BRIDGE_PORT = 3004;
const BRIDGE_BASE = `http://localhost:${BRIDGE_PORT}`;

async function proxyRequest(method: string, path: string, body?: unknown) {
  try {
    const url = `${BRIDGE_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Bridge service unavailable', hint: 'Start with: cd mini-services/bridge-service && bun run dev' },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'stats';
  const channelId = searchParams.get('id');
  const limit = searchParams.get('limit') || '50';
  const channel = searchParams.get('channel');

  switch (action) {
    case 'channels':
      return proxyRequest('GET', '/api/channels');
    case 'logs':
      return proxyRequest('GET', `/api/logs?limit=${limit}${channel ? `&channel=${channel}` : ''}`);
    case 'stats':
    default:
      return proxyRequest('GET', '/api/stats');
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || '';
  const channelId = searchParams.get('id') || '';
  const body = await req.json().catch(() => ({}));

  switch (action) {
    case 'toggle':
      return proxyRequest('POST', `/api/channels/${channelId}/toggle`);
    case 'config':
      return proxyRequest('POST', `/api/channels/${channelId}/config`, body);
    case 'test':
      return proxyRequest('POST', '/api/test-webhook', body);
    default:
      return NextResponse.json({ error: 'Unknown action. Use: toggle, config, or test' }, { status: 400 });
  }
}

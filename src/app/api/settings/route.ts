import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_CONFIG = {
  agentName: 'CodeBot',
  avatar: '🤖',
  personality: 'helpful',
  maxTokens: 4096,
  temperature: 0.7,
  autoCompact: true,
  compactThreshold: 100000,
  toolConcurrency: 5,
  theme: 'dark',
  language: 'zh-CN',
  thinkingEnabled: false,
  activeModel: 'meta/llama-3.3-70b-instruct',
  activeMode: 'interactive',
};

async function getConfig() {
  const count = await db.agentConfig.count();
  if (count === 0) {
    return await db.agentConfig.create({ data: DEFAULT_CONFIG });
  }
  return await db.agentConfig.findFirst();
}

// GET /api/settings - Get agent config
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    console.error('Settings GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: message },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update agent config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Ensure a config exists
    let config = await db.agentConfig.findFirst();

    if (!config) {
      config = await db.agentConfig.create({ data: DEFAULT_CONFIG });
    }

    // Build update data - only include fields that are provided
    const updateData: Record<string, unknown> = {};
    const fields = [
      'agentName', 'avatar', 'personality', 'maxTokens', 'temperature',
      'autoCompact', 'compactThreshold', 'toolConcurrency', 'theme', 'language',
      'thinkingEnabled', 'activeModel', 'activeMode', 'nvidiaApiKey',
    ] as const;

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updatedConfig = await db.agentConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    return NextResponse.json(updatedConfig);
  } catch (error: unknown) {
    console.error('Settings PUT error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: message },
      { status: 500 }
    );
  }
}

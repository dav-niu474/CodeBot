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
    const {
      agentName,
      avatar,
      personality,
      maxTokens,
      temperature,
      autoCompact,
      compactThreshold,
      toolConcurrency,
      theme,
      language,
    } = body;

    // Ensure a config exists
    let config = await db.agentConfig.findFirst();

    if (!config) {
      config = await db.agentConfig.create({ data: DEFAULT_CONFIG });
    }

    const updatedConfig = await db.agentConfig.update({
      where: { id: config.id },
      data: {
        ...(agentName !== undefined && { agentName }),
        ...(avatar !== undefined && { avatar }),
        ...(personality !== undefined && { personality }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(temperature !== undefined && { temperature }),
        ...(autoCompact !== undefined && { autoCompact }),
        ...(compactThreshold !== undefined && { compactThreshold }),
        ...(toolConcurrency !== undefined && { toolConcurrency }),
        ...(theme !== undefined && { theme }),
        ...(language !== undefined && { language }),
      },
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

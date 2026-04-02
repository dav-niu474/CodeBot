import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface DefaultTool {
  name: string;
  description: string;
  icon: string;
  category: string;
  isReadOnly: boolean;
}

const DEFAULT_TOOLS: DefaultTool[] = [
  {
    name: 'FileRead',
    description: 'Read file contents from the filesystem',
    icon: 'FileText',
    category: 'files',
    isReadOnly: true,
  },
  {
    name: 'FileWrite',
    description: 'Write or modify files on the filesystem',
    icon: 'FileEdit',
    category: 'files',
    isReadOnly: false,
  },
  {
    name: 'BashExecute',
    description: 'Execute bash commands and shell scripts',
    icon: 'Terminal',
    category: 'execution',
    isReadOnly: false,
  },
  {
    name: 'CodeSearch',
    description: 'Search for code patterns, symbols, and text across the codebase',
    icon: 'Search',
    category: 'search',
    isReadOnly: true,
  },
  {
    name: 'WebSearch',
    description: 'Search the web for information, documentation, and resources',
    icon: 'Globe',
    category: 'web',
    isReadOnly: true,
  },
  {
    name: 'WebPageRead',
    description: 'Read and extract content from web pages',
    icon: 'Link',
    category: 'web',
    isReadOnly: true,
  },
  {
    name: 'ImageGenerate',
    description: 'Generate images from text descriptions using AI',
    icon: 'Image',
    category: 'ai',
    isReadOnly: false,
  },
  {
    name: 'CodeReview',
    description: 'Analyze and review code for quality, bugs, and best practices',
    icon: 'ShieldCheck',
    category: 'ai',
    isReadOnly: true,
  },
  {
    name: 'GitOperation',
    description: 'Perform Git operations such as commit, diff, log, and branch management',
    icon: 'GitBranch',
    category: 'vcs',
    isReadOnly: true,
  },
  {
    name: 'LLMChat',
    description: 'General-purpose LLM chat for answering questions and generating text',
    icon: 'MessageSquare',
    category: 'ai',
    isReadOnly: true,
  },
];

async function ensureDefaultTools() {
  const count = await db.toolDef.count();
  if (count === 0) {
    await db.toolDef.createMany({
      data: DEFAULT_TOOLS.map((tool) => ({
        name: tool.name,
        displayName: tool.name,
        description: tool.description,
        icon: tool.icon,
        category: tool.category,
        isReadOnly: tool.isReadOnly,
        isEnabled: true,
      })),
    });
  }
}

// GET /api/tools - List all tools
export async function GET() {
  try {
    await ensureDefaultTools();
    const tools = await db.toolDef.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(tools);
  } catch (error: unknown) {
    console.error('Tools GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to fetch tools', details: message },
      { status: 500 }
    );
  }
}

// POST /api/tools - Create or update a tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, icon, category, isEnabled, isReadOnly, config } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }

    const tool = await db.toolDef.upsert({
      where: { name },
      update: {
        description: description ?? undefined,
        icon: icon ?? undefined,
        category: category ?? undefined,
        isEnabled: isEnabled ?? undefined,
        isReadOnly: isReadOnly ?? undefined,
        config: config ? JSON.stringify(config) : undefined,
      },
      create: {
        name,
        description,
        icon: icon || 'Wrench',
        category: category || 'general',
        isEnabled: isEnabled ?? true,
        isReadOnly: isReadOnly ?? false,
        config: config ? JSON.stringify(config) : null,
      },
    });

    return NextResponse.json(tool, { status: 201 });
  } catch (error: unknown) {
    console.error('Tools POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to create/update tool', details: message },
      { status: 500 }
    );
  }
}

// PUT /api/tools - Toggle tool enabled status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isEnabled } = body;

    if (!id || isEnabled === undefined) {
      return NextResponse.json(
        { error: 'id and isEnabled are required' },
        { status: 400 }
      );
    }

    const tool = await db.toolDef.update({
      where: { id },
      data: { isEnabled },
    });

    return NextResponse.json(tool);
  } catch (error: unknown) {
    console.error('Tools PUT error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to update tool', details: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface DefaultSkill {
  name: string;
  description: string;
  icon: string;
  category: string;
  prompt: string;
}

const DEFAULT_SKILLS: DefaultSkill[] = [
  {
    name: 'CodeGeneration',
    description: 'Generate code from natural language descriptions, scaffolding, boilerplate, and implementations',
    icon: 'Code',
    category: 'coding',
    prompt:
      'You are a code generation expert. Generate clean, efficient, and well-structured code based on user requirements. Follow best practices and include appropriate error handling.',
  },
  {
    name: 'CodeReview',
    description: 'Review code for bugs, performance issues, security vulnerabilities, and style improvements',
    icon: 'ShieldCheck',
    category: 'coding',
    prompt:
      'You are a senior code reviewer. Analyze code thoroughly for bugs, performance bottlenecks, security vulnerabilities, and maintainability issues. Provide constructive feedback with specific suggestions.',
  },
  {
    name: 'CodeExplanation',
    description: 'Explain code logic, architecture, and design patterns in clear language',
    icon: 'BookOpen',
    category: 'learning',
    prompt:
      'You are a code explanation specialist. Break down complex code into understandable parts. Explain the logic, architecture decisions, and design patterns used. Use clear language and examples.',
  },
  {
    name: 'BugDetection',
    description: 'Detect and diagnose bugs, suggest fixes and root cause analysis',
    icon: 'Bug',
    category: 'debugging',
    prompt:
      'You are a bug detection expert. Analyze code to identify potential bugs, edge cases, and error conditions. Provide root cause analysis and suggest specific fixes with explanations.',
  },
  {
    name: 'Refactoring',
    description: 'Suggest and implement code refactoring for better readability, performance, and maintainability',
    icon: 'RefreshCw',
    category: 'coding',
    prompt:
      'You are a refactoring specialist. Suggest improvements to code structure, readability, and maintainability. Apply design patterns, SOLID principles, and DRY practices. Show before/after comparisons.',
  },
  {
    name: 'Documentation',
    description: 'Generate and improve code documentation, README files, and API docs',
    icon: 'FileText',
    category: 'writing',
    prompt:
      'You are a documentation expert. Generate comprehensive documentation including README files, API docs, inline comments, and architectural documentation. Use clear, concise language.',
  },
  {
    name: 'Testing',
    description: 'Generate unit tests, integration tests, and test strategies for codebases',
    icon: 'CheckCircle',
    category: 'quality',
    prompt:
      'You are a testing specialist. Generate comprehensive test suites including unit tests, integration tests, and edge case tests. Follow testing best practices and cover critical paths.',
  },
  {
    name: 'Deployment',
    description: 'Help with deployment configurations, CI/CD pipelines, and DevOps automation',
    icon: 'Rocket',
    category: 'devops',
    prompt:
      'You are a DevOps and deployment expert. Help with deployment configurations, CI/CD pipeline setup, Docker containerization, cloud deployments, and infrastructure-as-code.',
  },
];

async function ensureDefaultSkills() {
  const count = await db.skillDef.count();
  if (count === 0) {
    await db.skillDef.createMany({
      data: DEFAULT_SKILLS.map((skill) => ({
        name: skill.name,
        displayName: skill.name,
        description: skill.description,
        icon: skill.icon,
        category: skill.category,
        prompt: skill.prompt,
        isEnabled: true,
      })),
    });
  }
}

// GET /api/skills - List all skills
export async function GET() {
  try {
    await ensureDefaultSkills();
    const skills = await db.skillDef.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(skills);
  } catch (error: unknown) {
    console.error('Skills GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to fetch skills', details: message },
      { status: 500 }
    );
  }
}

// POST /api/skills - Create or update a skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, icon, category, isEnabled, prompt, config } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }

    const skill = await db.skillDef.upsert({
      where: { name },
      update: {
        description: description ?? undefined,
        icon: icon ?? undefined,
        category: category ?? undefined,
        isEnabled: isEnabled ?? undefined,
        prompt: prompt ?? undefined,
        config: config ? JSON.stringify(config) : undefined,
      },
      create: {
        name,
        displayName: name,
        description,
        icon: icon || 'Sparkles',
        category: category || 'general',
        isEnabled: isEnabled ?? true,
        prompt: prompt || null,
        config: config ? JSON.stringify(config) : null,
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error: unknown) {
    console.error('Skills POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to create/update skill', details: message },
      { status: 500 }
    );
  }
}

// PUT /api/skills - Toggle skill enabled status
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

    const skill = await db.skillDef.update({
      where: { id },
      data: { isEnabled },
    });

    return NextResponse.json(skill);
  } catch (error: unknown) {
    console.error('Skills PUT error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to update skill', details: message },
      { status: 500 }
    );
  }
}

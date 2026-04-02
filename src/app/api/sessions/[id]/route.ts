import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Allowed fields for partial update
const ALLOWED_UPDATE_FIELDS = ['title', 'model', 'systemPrompt', 'isActive', 'mode'] as const;
type AllowedField = (typeof ALLOWED_UPDATE_FIELDS)[number];

// GET /api/sessions/[id] - Get a single session with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Session id is required' },
        { status: 400 }
      );
    }

    const session = await db.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error('Session GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to fetch session', details: message },
      { status: 500 }
    );
  }
}

// PUT /api/sessions/[id] - Update a session (partial update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Session id is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Filter to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // Ensure at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed fields: ' + ALLOWED_UPDATE_FIELDS.join(', ') },
        { status: 400 }
      );
    }

    // Verify session exists
    const existing = await db.session.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Perform the update
    const session = await db.session.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error('Session PUT error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to update session', details: message },
      { status: 500 }
    );
  }
}

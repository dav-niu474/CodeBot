import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sessions - List all sessions
export async function GET() {
  try {
    const sessions = await db.session.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error: unknown) {
    console.error('Sessions GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to fetch sessions', details: message },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, model } = body;

    const session = await db.session.create({
      data: {
        title: title || 'New Session',
        model: model || 'default',
        systemPrompt:
          'You are CodeBot, a helpful AI coding assistant. You help users write, debug, explain, and review code.',
        isActive: true,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    console.error('Sessions POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to create session', details: message },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions - Delete a session by id
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Session id is required' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.session.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Delete session (messages are deleted via cascade)
    await db.session.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    console.error('Sessions DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to delete session', details: message },
      { status: 500 }
    );
  }
}

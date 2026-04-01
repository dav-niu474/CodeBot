import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/agents/[id]
 * Get a single agent session by ID with full details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await db.agentSession.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const response = {
      ...agent,
      config: agent.config ? JSON.parse(agent.config) : null,
    };

    return NextResponse.json({ success: true, agent: response });
  } catch (error: unknown) {
    console.error("[/api/agents/[id]] GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get agent";
    return NextResponse.json(
      { error: "Failed to get agent", details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]
 * Update an agent session.
 * Body: { name?, role?, status?, task?, config? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, status, task, config } = body;

    // Verify agent exists
    const existing = await db.agentSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Validate role if provided
    if (role && !["leader", "worker", "scout"].includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !["idle", "running", "completed", "failed"].includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (task !== undefined) updateData.task = task;
    if (config !== undefined) updateData.config = JSON.stringify(config);

    const updated = await db.agentSession.update({
      where: { id },
      data: updateData,
    });

    const response = {
      ...updated,
      config: updated.config ? JSON.parse(updated.config) : null,
    };

    return NextResponse.json({ success: true, agent: response });
  } catch (error: unknown) {
    console.error("[/api/agents/[id]] PUT error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update agent";
    return NextResponse.json(
      { error: "Failed to update agent", details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * Delete an agent session and its associated sessions.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify agent exists
    const existing = await db.agentSession.findUnique({
      where: { id },
      include: { sessions: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Delete all associated sessions (cascade will delete messages)
    if (existing.sessions.length > 0) {
      await db.session.deleteMany({
        where: { agentId: id },
      });
    }

    // Delete the agent
    await db.agentSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        id: existing.id,
        name: existing.name,
        sessionsDeleted: existing.sessions.length,
      },
    });
  } catch (error: unknown) {
    console.error("[/api/agents/[id]] DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete agent";
    return NextResponse.json(
      { error: "Failed to delete agent", details: message },
      { status: 500 }
    );
  }
}

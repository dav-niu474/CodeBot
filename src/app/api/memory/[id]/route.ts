import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/memory/[id]
 * Retrieve a single memory entry by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const memory = await db.memory.findUnique({
      where: { id },
    });

    if (!memory) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    // Parse tags JSON if present
    const response = {
      ...memory,
      tags: memory.tags ? JSON.parse(memory.tags) : null,
    };

    // Increment access count
    await db.memory.update({
      where: { id },
      data: { accessCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, memory: response });
  } catch (error: unknown) {
    console.error("[/api/memory/[id]] GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get memory";
    return NextResponse.json(
      { error: "Failed to get memory", details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/memory/[id]
 * Update an existing memory entry.
 * Body: { content?, category?, tags?, importance?, file_path?, expires_at? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, category, tags, importance, filePath, expiresAt } = body;

    // Verify memory exists
    const existing = await db.memory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (importance !== undefined)
      updateData.importance = Math.max(1, Math.min(10, importance));
    if (filePath !== undefined) updateData.filePath = filePath;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);

    const updated = await db.memory.update({
      where: { id },
      data: updateData,
    });

    const response = {
      ...updated,
      tags: updated.tags ? JSON.parse(updated.tags) : null,
    };

    return NextResponse.json({ success: true, memory: response });
  } catch (error: unknown) {
    console.error("[/api/memory/[id]] PUT error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update memory";
    return NextResponse.json(
      { error: "Failed to update memory", details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory/[id]
 * Delete a memory entry by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify memory exists
    const existing = await db.memory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    await db.memory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted: { id: existing.id, layer: existing.layer },
    });
  } catch (error: unknown) {
    console.error("[/api/memory/[id]] DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete memory";
    return NextResponse.json(
      { error: "Failed to delete memory", details: message },
      { status: 500 }
    );
  }
}

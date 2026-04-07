import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processConversationForMemory, getMemoryStats } from "@/lib/memory/memory-manager";

const VALID_LAYERS = [
  "session",
  "memdir",
  "magic-doc",
  "magic_doc",
  "team-sync",
  "team",
];
const VALID_CATEGORIES = [
  "preference",
  "pattern",
  "decision",
  "error",
  "fact",
  "task",
  "convention",
  "architecture",
  "context",
  "knowledge",
];

function isValidLayer(layer: string): boolean {
  return VALID_LAYERS.includes(layer);
}

function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category);
}

/**
 * GET /api/memory?sessionId=xxx&layer=session|memdir|magic-doc|team-sync&category=preference&limit=50&offset=0
 * GET /api/memory/stats — Get memory statistics
 *
 * List memory entries with optional filtering, or return memory stats.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Stats endpoint
    if (searchParams.get("action") === "stats") {
      const stats = await getMemoryStats();
      return NextResponse.json({ success: true, stats });
    }

    const sessionId = searchParams.get("session_id") || searchParams.get("sessionId");
    const layer = searchParams.get("layer");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const minImportance = searchParams.get("minImportance");

    const where: Record<string, unknown> = {};

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (layer) {
      if (!isValidLayer(layer)) {
        return NextResponse.json(
          {
            error: `Invalid layer: ${layer}. Must be one of: ${VALID_LAYERS.join(", ")}`,
          },
          { status: 400 }
        );
      }
      where.layer = layer;
    }

    if (category) {
      if (!isValidCategory(category)) {
        return NextResponse.json(
          {
            error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      where.category = category;
    }

    if (minImportance) {
      const impVal = parseInt(minImportance, 10);
      if (!isNaN(impVal)) {
        where.importance = { gte: impVal };
      }
    }

    const memories = await db.memory.findMany({
      where,
      orderBy: [
        { importance: "desc" },
        { accessCount: "desc" },
        { updatedAt: "desc" },
      ],
      take: Math.min(limit, 200),
      skip: offset,
    });

    // Parse tags JSON for each memory
    const parsedMemories = memories.map((m) => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags) : null,
    }));

    const total = await db.memory.count({ where });

    return NextResponse.json({
      success: true,
      memories: parsedMemories,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("[/api/memory] GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list memories";
    return NextResponse.json(
      { error: "Failed to list memories", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory
 * Create a new memory entry.
 * Body: { sessionId?, layer, category?, content, filePath?, tags?, importance? }
 *
 * POST /api/memory?action=process
 * Process conversation for memory extraction.
 * Body: { sessionId, messages: Array<{role, content}>, projectRoot? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Process conversation for memory extraction
    if (action === "process") {
      const { sessionId, messages, projectRoot } = body;

      if (!sessionId || !Array.isArray(messages)) {
        return NextResponse.json(
          { error: "sessionId and messages are required for action=process" },
          { status: 400 }
        );
      }

      const result = await processConversationForMemory(
        sessionId,
        messages,
        projectRoot
      );

      return NextResponse.json({ success: true, ...result });
    }

    // Default: Create a new memory entry
    const { sessionId, layer, category, content, filePath, tags, importance } = body;

    if (!layer) {
      return NextResponse.json(
        { error: "layer is required" },
        { status: 400 }
      );
    }

    if (!isValidLayer(layer)) {
      return NextResponse.json(
        { error: `Invalid layer: ${layer}. Must be one of: ${VALID_LAYERS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category && !isValidCategory(category)) {
      return NextResponse.json(
        { error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate importance range
    const finalImportance = typeof importance === "number"
      ? Math.max(1, Math.min(10, importance))
      : 5;

    // Validate and serialize tags
    let serializedTags: string | null = null;
    if (tags !== undefined && tags !== null) {
      if (Array.isArray(tags)) {
        serializedTags = JSON.stringify(tags.filter((t: unknown) => typeof t === "string"));
      } else if (typeof tags === "string") {
        // If tags is already a JSON string, validate it
        try {
          const parsed = JSON.parse(tags);
          if (Array.isArray(parsed)) {
            serializedTags = JSON.stringify(parsed.filter((t: unknown) => typeof t === "string"));
          } else {
            serializedTags = null;
          }
        } catch {
          // If it's a plain string, wrap it in an array
          serializedTags = JSON.stringify([tags]);
        }
      }
    }

    const memory = await db.memory.create({
      data: {
        sessionId: sessionId || null,
        layer,
        category: category || null,
        content,
        filePath: filePath || null,
        tags: serializedTags,
        importance: finalImportance,
      },
    });

    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (error: unknown) {
    console.error("[/api/memory] POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create memory";
    return NextResponse.json(
      { error: "Failed to create memory", details: message },
      { status: 500 }
    );
  }
}

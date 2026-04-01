import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_LAYERS = ["session", "memdir", "magic_doc", "team"];
const VALID_CATEGORIES = [
  "preference",
  "pattern",
  "decision",
  "error",
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
 * GET /api/memory?session_id=xxx&layer=session|memdir|magic_doc|team
 * List memory entries with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const layer = searchParams.get("layer");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

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

    const total = await db.memory.count({ where });

    return NextResponse.json({
      success: true,
      memories,
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
 * Body: { session_id?, layer, category?, content, file_path?, tags?, importance? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    const memory = await db.memory.create({
      data: {
        sessionId: sessionId || null,
        layer,
        category: category || null,
        content,
        filePath: filePath || null,
        tags: tags ? JSON.stringify(tags) : null,
        importance: importance ?? 5,
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

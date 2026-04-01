import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatCompletion, getDefaultModel } from "@/lib/nvidia";

const VALID_LAYERS = ["session", "memdir", "magic_doc", "team"];

/**
 * POST /api/memory/dream
 * Trigger dream task — consolidate and summarize memories using the AI.
 *
 * The dream process:
 * 1. Loads memories from specified layers (or all)
 * 2. Sends them to the AI for consolidation
 * 3. Stores the summary as a new magic_doc memory
 * 4. Returns the consolidated summary
 *
 * Body: { session_id?, layers?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, layers } = body;

    const targetLayers =
      layers && Array.isArray(layers) && layers.length > 0 ? layers : VALID_LAYERS;

    // Validate layers
    for (const l of targetLayers) {
      if (!VALID_LAYERS.includes(l)) {
        return NextResponse.json(
          { error: `Invalid layer: ${l}. Must be one of: ${VALID_LAYERS.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const where: Record<string, unknown> = {
      layer: { in: targetLayers },
    };
    if (sessionId) {
      where.sessionId = sessionId;
    }

    const memories = await db.memory.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    if (memories.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No memories to consolidate",
        summary: null,
        consolidatedCount: 0,
      });
    }

    // Build a structured context of memories for the AI
    const memoryContext = memories
      .map(
        (m, i) =>
          `[${i + 1}] (${m.layer}/${m.category || "general"}, importance: ${m.importance}) ${m.content}`
      )
      .join("\n");

    const dreamPrompt = `You are a memory consolidation agent. Analyze the following memories and produce a concise, structured summary that captures the key insights, patterns, and important facts. Group related items together. Focus on high-importance entries and recurring patterns. Keep the summary under 500 words.

Memories:
${memoryContext}

Provide your consolidation as a structured summary with sections: Key Facts, Patterns, Decisions, and Open Items.`;

    const response = await chatCompletion({
      model: getDefaultModel(),
      messages: [
        {
          role: "system",
          content:
            "You are a memory consolidation agent. You summarize and structure memories into useful knowledge.",
        },
        { role: "user", content: dreamPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const summary =
      response.choices?.[0]?.message?.content ||
      "Consolidation produced no output.";

    // Store the consolidated summary as a magic_doc memory
    const consolidatedMemory = await db.memory.create({
      data: {
        sessionId: sessionId || null,
        layer: "magic_doc",
        category: "knowledge",
        content: summary,
        tags: JSON.stringify(["dream-consolidated", "auto-generated"]),
        importance: 8,
      },
    });

    // Update access counts for the source memories
    const memoryIds = memories.map((m) => m.id);
    await db.memory.updateMany({
      where: { id: { in: memoryIds } },
      data: { accessCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      summary,
      consolidatedMemory,
      consolidatedCount: memories.length,
      layersProcessed: targetLayers,
      usage: response.usage,
    });
  } catch (error: unknown) {
    console.error("[/api/memory/dream] Error:", error);
    const message =
      error instanceof Error ? error.message : "Dream task failed";
    return NextResponse.json(
      { error: "Dream task failed", details: message },
      { status: 500 }
    );
  }
}

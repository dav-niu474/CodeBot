import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatCompletion, getDefaultModel } from "@/lib/nvidia";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/memory/compact
 * Trigger session compression — summarize old messages in a session.
 *
 * The compact process:
 * 1. Loads messages from the session, excluding the most recent N
 * 2. Sends them to AI for summarization
 * 3. Stores the summary as a session-layer memory
 * 4. Returns compression stats
 *
 * Body: { session_id, keep_recent?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, keepRecent } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const keep = typeof keepRecent === "number" ? keepRecent : 10;

    // Load all messages in the session
    const allMessages = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    // Separate messages to compress (old) from messages to keep (recent)
    const messagesToCompress = allMessages.slice(
      0,
      Math.max(0, allMessages.length - keep)
    );

    if (messagesToCompress.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No messages to compress",
        compressedCount: 0,
        savedTokens: 0,
      });
    }

    // Build message context for AI
    const messageContext = messagesToCompress
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");

    const totalOriginalTokens = messagesToCompress.reduce(
      (sum, m) => sum + m.tokens,
      0
    );

    const compactPrompt = `You are a context compression agent. Summarize the following conversation history into a concise, structured context that preserves:
1. Key decisions and conclusions reached
2. Important code snippets or commands discussed
3. User preferences and requirements expressed
4. Any errors encountered and their solutions
5. Pending tasks or unresolved questions

Keep the summary under 300 words. Focus on actionable information.

Conversation:
${messageContext}`;

    const response = await chatCompletion({
      model: getDefaultModel(),
      messages: [
        {
          role: "system",
          content:
            "You compress conversation history into dense, structured context summaries.",
        },
        { role: "user", content: compactPrompt },
      ],
      temperature: 0.2,
      maxTokens: 1024,
    });

    const summary =
      response.choices?.[0]?.message?.content ||
      "Compression produced no output.";
    const summaryTokens = estimateTokens(summary);
    const savedTokens = totalOriginalTokens - summaryTokens;

    // Store compression summary as session memory
    const compactMemory = await db.memory.create({
      data: {
        sessionId,
        layer: "session",
        category: "context",
        content: `[COMPRESSED CONTEXT - ${new Date().toISOString()}]\n\n${summary}`,
        tags: JSON.stringify([
          "auto-compacted",
          `original-messages:${messagesToCompress.length}`,
        ]),
        importance: 7,
      },
    });

    // Update session token count to reflect compression savings
    await db.session.update({
      where: { id: sessionId },
      data: {
        tokenCount: Math.max(0, session.tokenCount - savedTokens),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      summary,
      compressedCount: messagesToCompress.length,
      keptCount: allMessages.length - messagesToCompress.length,
      originalTokens: totalOriginalTokens,
      summaryTokens,
      savedTokens: Math.max(0, savedTokens),
      compactMemory,
      usage: response.usage,
    });
  } catch (error: unknown) {
    console.error("[/api/memory/compact] Error:", error);
    const message =
      error instanceof Error ? error.message : "Compact task failed";
    return NextResponse.json(
      { error: "Compact task failed", details: message },
      { status: 500 }
    );
  }
}

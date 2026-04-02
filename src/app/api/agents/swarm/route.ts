import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultModel } from "@/lib/nvidia";
import { runSwarmMode } from "@/lib/agents/swarm";

/**
 * POST /api/agents/swarm
 * Start swarm mode (peer-to-peer parallel execution) with SSE streaming.
 *
 * Spawns multiple peer agents that independently work on the same task
 * with different focus angles, then aggregates via consensus.
 *
 * Body: { task, agentCount?: number, model?, sessionId? }
 * Returns: SSE stream with events from each swarm agent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, agentCount, model, sessionId } = body;

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "task is required and must be a string" },
        { status: 400 }
      );
    }

    const agents = Math.min(Math.max(agentCount || 3, 2), 6);
    const effectiveModel = model || getDefaultModel();
    const effectiveSessionId = sessionId || "default";

    // Verify session exists if provided
    if (sessionId) {
      const session = await db.session.findUnique({ where: { id: sessionId } });
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
    }

    // Set up SSE stream
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    function sendSSE(data: Record<string, unknown>) {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }

    // Run swarm mode asynchronously
    (async () => {
      try {
        const result = await runSwarmMode({
          task,
          model: effectiveModel,
          agentCount: agents,
          sessionId: effectiveSessionId,
          sendEvent: sendSSE,
        });

        // Send final content as stream paragraphs
        if (result.content) {
          const paragraphs = result.content.split(/(\n\n+)/);
          for (const para of paragraphs) {
            if (para.trim()) {
              sendSSE({ content: para });
            }
          }
        }

        sendSSE({
          done: true,
          tokens: result.totalTokens,
          mode: "swarm",
          confidence: result.confidence,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Swarm mode failed";
        console.error("[/api/agents/swarm] Error:", err);
        sendSSE({ error: errorMsg });
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/agents/swarm] Error:", error);
    const message =
      error instanceof Error ? error.message : "Swarm mode failed";
    return NextResponse.json(
      { error: "Swarm mode failed", details: message },
      { status: 500 }
    );
  }
}

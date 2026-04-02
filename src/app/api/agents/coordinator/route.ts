import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultModel } from "@/lib/nvidia";
import { runCoordinatorMode } from "@/lib/agents/coordinator";

/**
 * POST /api/agents/coordinator
 * Start coordinator mode (leader-worker pattern) with SSE streaming.
 *
 * Receives a complex task, decomposes it into sub-tasks,
 * executes workers in parallel, and aggregates results.
 *
 * Body: { task, num_workers?: number, model?, sessionId? }
 * Returns: SSE stream with events: agent_spawned, task_assigned, agent_status,
 *          agent_result, aggregation_start, aggregation_complete
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, numWorkers, model, sessionId } = body;

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "task is required and must be a string" },
        { status: 400 }
      );
    }

    const workers = Math.min(Math.max(numWorkers || 3, 1), 6);
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

    // Run coordinator mode asynchronously
    (async () => {
      try {
        const result = await runCoordinatorMode({
          task,
          model: effectiveModel,
          maxWorkers: workers,
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
          mode: "coordinator",
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Coordinator mode failed";
        console.error("[/api/agents/coordinator] Error:", err);
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
    console.error("[/api/agents/coordinator] Error:", error);
    const message =
      error instanceof Error ? error.message : "Coordinator mode failed";
    return NextResponse.json(
      { error: "Coordinator mode failed", details: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatCompletionStreamRaw,
  getDefaultModel,
  getModelInfo,
  type ChatMessage,
  type ToolDefinition,
} from "@/lib/nvidia";

const SYSTEM_PROMPT =
  "You are CodeBot, a helpful AI coding assistant. You help users write, debug, explain, and review code. You are knowledgeable in multiple programming languages and software engineering best practices. Respond in the same language the user uses.";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      message,
      model,
      temperature,
      maxTokens,
      thinkingEnabled,
    } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
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

    // Load agent config for defaults
    const agentConfig = await db.agentConfig.findFirst();

    // Determine effective values
    const effectiveModel = model || agentConfig?.activeModel || getDefaultModel();
    const effectiveTemperature = temperature ?? agentConfig?.temperature ?? 0.7;
    const effectiveMaxTokens = maxTokens ?? agentConfig?.maxTokens ?? 8192;
    const modelInfo = getModelInfo(effectiveModel);

    // Save user message
    const userTokens = estimateTokens(message);
    await db.message.create({
      data: {
        sessionId,
        role: "user",
        content: message,
        tokens: userTokens,
      },
    });

    // Load conversation history (last 30 messages for richer context)
    const history = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    // Build messages array for NVIDIA API
    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: (msg.role as "user" | "assistant" | "system" | "tool") || "user",
        content: msg.content,
      })),
    ];

    // Tool-calling placeholder: define available tools if any
    const tools: ToolDefinition[] | undefined = undefined;
    // Future: load tools from DB and convert to OpenAI function format
    // const enabledTools = await db.toolDef.findMany({ where: { isEnabled: true } });
    // if (enabledTools.length > 0) { tools = enabledTools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: {} } })); }

    // Call NVIDIA streaming API
    let nvidiaResponse: Response;
    try {
      nvidiaResponse = await chatCompletionStreamRaw({
        model: effectiveModel,
        messages: chatMessages,
        temperature: effectiveTemperature,
        maxTokens: effectiveMaxTokens,
        tools,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to connect to NVIDIA API";
      return NextResponse.json(
        { error: "NVIDIA API error", details: errorMsg },
        { status: 502 }
      );
    }

    if (!nvidiaResponse.body) {
      return NextResponse.json(
        { error: "NVIDIA API returned no stream body" },
        { status: 502 }
      );
    }

    // Create a TransformStream that converts NVIDIA SSE to our format and saves to DB
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Forward NVIDIA's SSE chunks directly to the client
        controller.enqueue(chunk);
      },

      async flush(controller) {
        // After streaming is done, we need to save the full response.
        // The client will send the accumulated content back or we reconstruct here.
        // Since we're passing through, we save on the client side or use a different approach.
        // For now, we rely on the client to handle the stream content.
        controller.terminate();
      },
    });

    // We need to collect the full content for DB persistence.
    // Use a tee approach: one branch goes to client, one for collection.
    const [clientStream, collectStream] = nvidiaResponse.body.tee();

    // Fire-and-forget: collect content and save to DB
    (async () => {
      try {
        const reader = collectStream.getReader();
        let fullContent = "";
        let usageData: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        } | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
              }
              if (parsed.usage) {
                usageData = parsed.usage;
              }
            } catch {
              // skip unparseable chunks
            }
          }
        }

        reader.releaseLock();

        // Only save if we got content
        if (fullContent.trim()) {
          const assistantTokens =
            usageData?.completion_tokens || estimateTokens(fullContent);
          const promptTokens =
            usageData?.prompt_tokens || userTokens;

          const assistantMsg = await db.message.create({
            data: {
              sessionId,
              role: "assistant",
              content: fullContent,
              tokens: assistantTokens,
              modelId: effectiveModel,
            },
          });

          // Update session token count
          const newTokenCount = session.tokenCount + promptTokens + assistantTokens;
          await db.session.update({
            where: { id: sessionId },
            data: {
              tokenCount: newTokenCount,
              updatedAt: new Date(),
            },
          });

          // Track token usage
          await db.tokenUsage.create({
            data: {
              sessionId,
              modelId: effectiveModel,
              inputTokens: promptTokens,
              outputTokens: assistantTokens,
            },
          });

          console.log(
            `[stream] Saved message ${assistantMsg.id} (${assistantTokens} tokens) for session ${sessionId}`
          );
        }
      } catch (err) {
        console.error("[stream] Error saving streamed response:", err);
      }
    })();

    // Return the client-facing stream with proper SSE headers
    // Add metadata event before the actual NVIDIA stream
    const metadataEvent = `data: ${JSON.stringify({
      type: "meta",
      model: effectiveModel,
      modelName: modelInfo?.name || effectiveModel,
      temperature: effectiveTemperature,
      maxTokens: effectiveMaxTokens,
      thinkingEnabled: thinkingEnabled || false,
      provider: modelInfo?.provider || "NVIDIA",
      supportsVision: modelInfo?.supportsVision || false,
    })}\n\n`;

    const metadataStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(metadataEvent));
        controller.close();
      },
    });

    const combinedStream = new ReadableStream({
      async start(controller) {
        const metadataReader = metadataStream.getReader();
        const clientReader = clientStream.getReader();

        try {
          // First send metadata
          while (true) {
            const { done, value } = await metadataReader.read();
            if (done) break;
            controller.enqueue(value);
          }

          // Then stream NVIDIA chunks
          while (true) {
            const { done, value } = await clientReader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`
            )
          );
        } finally {
          metadataReader.releaseLock();
          clientReader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(combinedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/chat/stream] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to process chat message", details: message },
      { status: 500 }
    );
  }
}

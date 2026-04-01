import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT =
  'You are CodeBot, a helpful AI coding assistant. You help users write, debug, explain, and review code. You are knowledgeable in multiple programming languages and software engineering best practices. Respond in the same language the user uses.';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message, thinkingEnabled } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId and message are required' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Save user message
    const userTokens = estimateTokens(message);
    await db.message.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
        tokens: userTokens,
      },
    });

    // Load conversation history (last 20 messages)
    const history = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Build messages array for LLM
    const chatMessages = [
      { role: 'assistant' as const, content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: (msg.role as 'user' | 'assistant' | 'system') || 'user',
        content: msg.content,
      })),
    ];

    // Call LLM (get full response, then simulate streaming)
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: chatMessages,
      thinking: thinkingEnabled
        ? { type: 'enabled' }
        : { type: 'disabled' },
    });

    const fullContent = completion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Create a ReadableStream for SSE (simulate streaming by sending chunks)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'meta', thinking: thinkingEnabled })}\n\n`)
          );

          // Stream the response in small chunks
          const chunkSize = 3;
          for (let i = 0; i < fullContent.length; i += chunkSize) {
            const chunk = fullContent.slice(i, i + chunkSize);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
            // Small delay to simulate streaming feel
            await new Promise((r) => setTimeout(r, 15));
          }

          // Send done signal
          const assistantTokens = estimateTokens(fullContent);

          // Save assistant message to DB
          const assistantMsg = await db.message.create({
            data: {
              sessionId,
              role: 'assistant',
              content: fullContent,
              tokens: assistantTokens,
            },
          });

          // Update session token count
          const newTokenCount = session.tokenCount + userTokens + assistantTokens;
          await db.session.update({
            where: { id: sessionId },
            data: {
              tokenCount: newTokenCount,
              updatedAt: new Date(),
            },
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                messageId: assistantMsg.id,
                tokens: assistantTokens,
                totalTokens: newTokenCount,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMsg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Chat stream API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to process chat message', details: message },
      { status: 500 }
    );
  }
}

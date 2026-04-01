import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT =
  'You are CodeBot, a helpful AI coding assistant. You help users write, debug, explain, and review code. You are knowledgeable in multiple programming languages and software engineering best practices. Respond in the same language the user uses.';

const SEARCH_KEYWORDS = ['search', 'latest', 'lookup', 'find', 'look up', 'current', 'recent', 'news', 'today'];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function shouldSearchWeb(message: string): boolean {
  const lower = message.toLowerCase();
  return SEARCH_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function performWebSearch(query: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query,
      num: 5,
    });

    if (!results || results.length === 0) {
      return '';
    }

    let context = '\n\n--- Web Search Results ---\n';
    for (const result of results) {
      context += `\n[Title: ${result.name}](${result.url})\n${result.snippet}\nHost: ${result.host_name}\n`;
    }
    context += '\n--- End Web Search Results ---\n';
    return context;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      message,
      thinkingEnabled,
      model,
      temperature,
    } = body;

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

    // Load agent config for temperature/thinking defaults
    const agentConfig = await db.agentConfig.findFirst();

    // Determine effective values
    const effectiveThinking = thinkingEnabled ?? agentConfig?.thinkingEnabled ?? false;
    const effectiveTemperature = temperature ?? agentConfig?.temperature ?? 0.7;
    const effectiveModel = model || agentConfig?.activeModel || 'default';

    // Save user message
    const userTokens = estimateTokens(message);
    const userMsg = await db.message.create({
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
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'assistant', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: (msg.role as 'user' | 'assistant' | 'system') || 'user',
        content: msg.content,
      })),
    ];

    // Web search enhancement: if message contains search keywords, prepend results
    if (shouldSearchWeb(message)) {
      const searchContext = await performWebSearch(message);
      if (searchContext) {
        // Prepend search results to the last user message
        const lastUserMsg = chatMessages[chatMessages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          chatMessages[chatMessages.length - 1] = {
            ...lastUserMsg,
            content: lastUserMsg.content + searchContext,
          };
        }
      }
    }

    // Call LLM
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: chatMessages,
      thinking: { type: effectiveThinking ? 'enabled' : 'disabled' },
      temperature: effectiveTemperature,
    });

    const responseContent = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    const assistantTokens = estimateTokens(responseContent);

    // Save assistant message
    const assistantMsg = await db.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: responseContent,
        tokens: assistantTokens,
      },
    });

    // Update session token count and timestamp
    const newTokenCount = session.tokenCount + userTokens + assistantTokens;
    await db.session.update({
      where: { id: sessionId },
      data: {
        tokenCount: newTokenCount,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      totalTokens: newTokenCount,
      model: effectiveModel,
      thinkingEnabled: effectiveThinking,
      temperature: effectiveTemperature,
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to process chat message', details: message },
      { status: 500 }
    );
  }
}

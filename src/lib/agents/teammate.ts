// ============================================================
// Teammate Mode Engine (V4.0.0)
// In-process agent teammate with shared context
// ============================================================

import { chatCompletion, type ChatMessage } from '@/lib/nvidia';
import { db } from '@/lib/db';
import { estimateTokens } from './protocol';

/** Maximum messages a teammate can process in a single session */
const TEAMMATE_MESSAGE_LIMIT = 50;

interface TeammateParams {
  message: string;
  model: string;
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  sendEvent: (event: Record<string, unknown>) => void;
}

interface TeammateResult {
  content: string;
  tokensUsed: number;
}

/**
 * Run teammate mode: a lightweight in-process assistant that shares
 * the same conversation context. Simple request-response pattern.
 */
export async function runTeammateMode(
  params: TeammateParams
): Promise<TeammateResult> {
  const { message, model, sessionId, conversationHistory, sendEvent } = params;

  sendEvent({
    type: 'agent_status',
    agentId: 'teammate',
    agentName: 'Teammate',
    status: 'thinking',
    task: 'Processing request...',
  });

  // Build context from recent conversation (last 20 messages)
  const recentHistory = conversationHistory.slice(-20);

  // Check message limit
  const totalMessages = recentHistory.length + 1; // +1 for current message
  const isNearLimit = totalMessages > TEAMMATE_MESSAGE_LIMIT * 0.8;

  const systemPrompt = `You are a helpful teammate AI assistant. You work alongside the main AI agent.

Rules:
- Be concise and direct
- Help with specific tasks the user or main agent needs
- You have access to the recent conversation context
- Focus on being a helpful collaborator${isNearLimit ? '\n- Note: You are approaching your message limit. Consider wrapping up.' : ''}

Teammate mode: ${totalMessages}/${TEAMMATE_MESSAGE_LIMIT} messages processed.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    // Include recent context as user/assistant pairs
    ...recentHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user', content },
  ];

  const response = await chatCompletion({
    model,
    messages,
    temperature: 0.6,
    maxTokens: 2048,
  });

  const content = response.choices[0]?.message?.content || 'I was unable to process that request.';
  const inputTokens = response.usage?.prompt_tokens || estimateTokens(systemPrompt + message);
  const outputTokens = response.usage?.completion_tokens || estimateTokens(content);
  const totalTokens = inputTokens + outputTokens;

  // Save teammate interaction to DB
  try {
    await db.message.create({
      data: {
        sessionId,
        role: 'user',
        content: `[TEAMMATE] ${message}`,
        tokens: inputTokens,
      },
    });

    await db.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: `[TEAMMATE] ${content}`,
        tokens: outputTokens,
      },
    });
  } catch {
    // Ignore DB errors - teammate is a lightweight helper
  }

  sendEvent({
    type: 'agent_result',
    agentId: 'teammate',
    agentName: 'Teammate',
    status: 'done',
    result: content,
    tokens: { input: inputTokens, output: outputTokens },
  });

  sendEvent({
    type: 'aggregation_complete',
    finalContent: content,
    totalTokens,
    totalAgents: 1,
    metadata: { messagesProcessed: totalMessages, nearLimit: isNearLimit },
  });

  return { content, tokensUsed: totalTokens };
}

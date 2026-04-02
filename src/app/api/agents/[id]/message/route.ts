import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatCompletion,
  getDefaultModel,
  type ChatMessage,
} from "@/lib/nvidia";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/agents/[id]/message
 * Send a message to an agent and get a response.
 * Body: { message, model?, temperature? }
 *
 * This creates a chat session for the agent (or reuses existing),
 * sends the message via NVIDIA API, and returns the response.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, model, temperature } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await db.agentSession.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get or create session for this agent
    let session = agent.sessions[0];
    if (!session) {
      session = await db.session.create({
        data: {
          title: `Agent: ${agent.name}`,
          agentId: agent.id,
          mode: agent.role === "leader" ? "coordinator" : "teammate",
        },
      });
    }

    const effectiveModel = model || getDefaultModel();
    const effectiveTemperature = temperature ?? 0.7;

    // Build system prompt based on agent role and task
    let systemPrompt = "You are CodeBot, a helpful AI coding assistant.";

    if (agent.task) {
      systemPrompt += `\n\nYour assigned task: ${agent.task}`;
    }

    switch (agent.role) {
      case "leader":
        systemPrompt +=
          "\n\nYou are operating as a LEADER agent. You coordinate tasks, delegate work to worker agents, and synthesize results. Break complex tasks into sub-tasks and provide clear instructions.";
        break;
      case "worker":
        systemPrompt +=
          "\n\nYou are operating as a WORKER agent. You focus on executing your assigned task efficiently. Report results clearly and flag any blockers.";
        break;
      case "scout":
        systemPrompt +=
          "\n\nYou are operating as a SCOUT agent. You explore, research, and gather information. Provide concise findings and recommendations.";
        break;
    }

    // Save user message
    const userTokens = estimateTokens(message);
    await db.message.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
        tokens: userTokens,
      },
    });

    // Load conversation history
    const history = await db.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((msg) => ({
        role: (msg.role as "user" | "assistant" | "system" | "tool") || "user",
        content: msg.content,
      })),
    ];

    // Update agent status to running
    await db.agentSession.update({
      where: { id },
      data: { status: "running" },
    });

    // Call NVIDIA API
    let responseContent: string;
    try {
      const response = await chatCompletion({
        model: effectiveModel,
        messages: chatMessages,
        temperature: effectiveTemperature,
        maxTokens: 4096,
      });

      responseContent =
        response.choices?.[0]?.message?.content ||
        "I was unable to generate a response.";
    } catch (err) {
      // Update agent status to failed
      await db.agentSession.update({
        where: { id },
        data: {
          status: "failed",
          result: `API error: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      });

      throw err;
    }

    const assistantTokens = estimateTokens(responseContent);

    // Save assistant message
    const assistantMsg = await db.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: responseContent,
        tokens: assistantTokens,
        modelId: effectiveModel,
      },
    });

    // Update session token count
    await db.session.update({
      where: { id: session.id },
      data: {
        tokenCount: session.tokenCount + userTokens + assistantTokens,
        updatedAt: new Date(),
      },
    });

    // Track token usage
    await db.tokenUsage.create({
      data: {
        sessionId: session.id,
        modelId: effectiveModel,
        inputTokens: userTokens,
        outputTokens: assistantTokens,
      },
    });

    // Update agent status back to idle
    await db.agentSession.update({
      where: { id },
      data: { status: "idle" },
    });

    return NextResponse.json({
      success: true,
      message: assistantMsg,
      sessionId: session.id,
      model: effectiveModel,
      tokens: {
        user: userTokens,
        assistant: assistantTokens,
        total: userTokens + assistantTokens,
      },
    });
  } catch (error: unknown) {
    console.error("[/api/agents/[id]/message] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process message";
    return NextResponse.json(
      { error: "Failed to process agent message", details: message },
      { status: 500 }
    );
  }
}

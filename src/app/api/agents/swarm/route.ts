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
 * POST /api/agents/swarm
 * Start swarm mode (peer-to-peer parallel execution).
 *
 * In swarm mode, multiple agents tackle the same problem independently,
 * then their results are aggregated through a consensus process.
 *
 * Body: { task, num_agents?: number, model?, consensus_threshold?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, numAgents, model, consensusThreshold } = body;

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "task is required and must be a string" },
        { status: 400 }
      );
    }

    const agents = Math.min(Math.max(numAgents || 4, 2), 8);
    const effectiveModel = model || getDefaultModel();
    const threshold = consensusThreshold ?? 0.6;

    // Create the swarm session (a special meta-session)
    const swarmSession = await db.session.create({
      data: {
        title: `Swarm: ${task.slice(0, 50)}`,
        mode: "swarm",
      },
    });

    // Create swarm agents
    const swarmAgents: Array<Awaited<ReturnType<typeof db.agentSession.create>>> = [];
    for (let i = 0; i < agents; i++) {
      const agent = await db.agentSession.create({
        data: {
          name: `Swarm Agent ${i + 1}`,
          role: "worker",
          status: "idle",
          task,
          config: JSON.stringify({
            mode: "swarm",
            model: effectiveModel,
            swarmIndex: i,
            totalAgents: agents,
          }),
        },
      });

      await db.session.create({
        data: {
          title: `Swarm ${i + 1}: ${task.slice(0, 30)}`,
          agentId: agent.id,
          mode: "swarm",
        },
      });

      swarmAgents.push(agent);
    }

    // Save swarm start message
    await db.message.create({
      data: {
        sessionId: swarmSession.id,
        role: "system",
        content: `[SWARM MODE] Task: ${task}\nAgents: ${agents}\nConsensus threshold: ${threshold}`,
        tokens: estimateTokens(task),
      },
    });

    // Each agent independently tackles the task
    const agentResults: Array<{ agentId: string; agentName: string; angle: string; result?: string; error?: string }> = [];
    for (let i = 0; i < swarmAgents.length; i++) {
      const agent = swarmAgents[i];

      await db.agentSession.update({
        where: { id: agent.id },
        data: { status: "running" },
      });

      try {
        const agentSession = await db.session.findFirst({
          where: { agentId: agent.id },
        });

        if (!agentSession) continue;

        // Each agent gets a slightly different angle to promote diversity
        const angles = [
          "Focus on correctness and edge cases.",
          "Focus on simplicity and readability.",
          "Focus on performance and optimization.",
          "Focus on best practices and design patterns.",
          "Focus on error handling and robustness.",
          "Focus on testability and maintainability.",
          "Focus on scalability and extensibility.",
          "Focus on user experience and documentation.",
        ];

        const angle = angles[i % angles.length];

        const prompt = `You are swarm agent ${i + 1} of ${agents}. Independently solve the following task.

${angle}

Task: ${task}

Provide your solution clearly and concisely. Include code if applicable.`;

        const response = await chatCompletion({
          model: effectiveModel,
          messages: [
            {
              role: "system",
              content:
                "You are an independent swarm agent. Solve the task with your assigned focus area.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.6 + i * 0.05, // Slightly different temperatures for diversity
          maxTokens: 4096,
        });

        const resultContent =
          response.choices?.[0]?.message?.content || "No result produced.";

        // Save agent messages
        await db.message.create({
          data: {
            sessionId: agentSession.id,
            role: "user",
            content: prompt,
            tokens: estimateTokens(prompt),
          },
        });

        await db.message.create({
          data: {
            sessionId: agentSession.id,
            role: "assistant",
            content: resultContent,
            tokens: estimateTokens(resultContent),
          },
        });

        agentResults.push({
          agentId: agent.id,
          agentName: agent.name,
          angle,
          result: resultContent,
        });

        await db.agentSession.update({
          where: { id: agent.id },
          data: { status: "completed", result: resultContent },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        agentResults.push({
          agentId: agent.id,
          agentName: agent.name,
          angle: "unknown",
          error: errorMsg,
        });

        await db.agentSession.update({
          where: { id: agent.id },
          data: { status: "failed", result: errorMsg },
        });
      }
    }

    // Consensus phase: aggregate results
    const successfulResults = agentResults.filter((r) => !r.error);
    const failedCount = agentResults.filter((r) => r.error).length;

    let consensus: string;
    let confidence = 0;

    if (successfulResults.length === 0) {
      consensus = "All swarm agents failed. No consensus could be reached.";
    } else {
      confidence = successfulResults.length / agents;

      const consensusPrompt = `You are a swarm consensus engine. Review the following ${successfulResults.length} independent solutions to the same task and produce the best consensus answer.

Original task: ${task}

${successfulResults
  .map((r, i) => `[Agent ${i + 1} (${r.angle})]:\n${r.result}`)
  .join("\n\n---\n\n")}

${failedCount > 0 ? `\nNote: ${failedCount} agent(s) failed and were excluded from consensus.` : ""}

Produce the BEST consensus answer by:
1. Identifying common elements across solutions
2. Incorporating the best unique insights from each
3. Resolving any contradictions
4. Presenting a clear, final answer

Confidence score: ${confidence.toFixed(2)} (${successfulResults.length}/${agents} agents succeeded)`;

      const consensusResponse = await chatCompletion({
        model: effectiveModel,
        messages: [
          {
            role: "system",
            content:
              "You are a swarm consensus engine that synthesizes multiple independent solutions.",
          },
          { role: "user", content: consensusPrompt },
        ],
        temperature: 0.3,
        maxTokens: 4096,
      });

      consensus =
        consensusResponse.choices?.[0]?.message?.content ||
        "Consensus failed.";
    }

    // Save consensus
    await db.message.create({
      data: {
        sessionId: swarmSession.id,
        role: "assistant",
        content: `[CONSENSUS - Confidence: ${(confidence * 100).toFixed(0)}%]\n\n${consensus}`,
        tokens: estimateTokens(consensus),
      },
    });

    return NextResponse.json({
      success: true,
      swarmSessionId: swarmSession.id,
      totalAgents: agents,
      successfulAgents: successfulResults.length,
      failedAgents: failedCount,
      confidence: confidence,
      consensus,
      agentSummaries: agentResults.map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName,
        success: !r.error,
        angle: r.angle,
      })),
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

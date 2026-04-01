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
 * POST /api/agents/coordinator
 * Start coordinator mode (leader-worker pattern).
 *
 * Creates a leader agent and worker agents, then orchestrates them:
 * 1. Leader analyzes the task and creates a plan
 * 2. Workers are spawned for each sub-task
 * 3. Each worker executes independently
 * 4. Leader synthesizes results
 *
 * Body: { task, num_workers?: number, model? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, numWorkers, model } = body;

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "task is required and must be a string" },
        { status: 400 }
      );
    }

    const workers = Math.min(Math.max(numWorkers || 3, 1), 10);
    const effectiveModel = model || getDefaultModel();

    // Step 1: Create the leader agent
    const leader = await db.agentSession.create({
      data: {
        name: `Coordinator Leader`,
        role: "leader",
        status: "running",
        task,
        config: JSON.stringify({
          mode: "coordinator",
          model: effectiveModel,
          numWorkers: workers,
        }),
      },
    });

    // Create leader's planning session
    const leaderSession = await db.session.create({
      data: {
        title: `Coordinator: ${task.slice(0, 50)}`,
        agentId: leader.id,
        mode: "coordinator",
      },
    });

    // Step 2: Leader plans the task
    const planningPrompt = `You are a coordinator agent. Break the following task into ${workers} sub-tasks. For each sub-task, provide:
1. A clear task description
2. Required tools or approach
3. Expected output format

Task: ${task}

Respond ONLY with a JSON array of objects, each with: { "name": "string", "task": "string", "approach": "string" }
Do not include any other text outside the JSON array.`;

    const planningResponse = await chatCompletion({
      model: effectiveModel,
      messages: [
        {
          role: "system",
          content:
            "You are a task planning coordinator. You break complex tasks into clear sub-tasks.",
        },
        { role: "user", content: planningPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const planContent =
      planningResponse.choices?.[0]?.message?.content || "[]";

    // Save planning messages
    await db.message.create({
      data: {
        sessionId: leaderSession.id,
        role: "system",
        content: `[COORDINATOR MODE] Task: ${task}\nWorkers: ${workers}`,
        tokens: estimateTokens(task),
      },
    });

    await db.message.create({
      data: {
        sessionId: leaderSession.id,
        role: "assistant",
        content: `[PLAN]\n${planContent}`,
        tokens: estimateTokens(planContent),
      },
    });

    // Parse the plan
    let subTasks: Array<{ name: string; task: string; approach: string }> = [];
    try {
      const jsonMatch = planContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subTasks = JSON.parse(jsonMatch[0]);
      }
    } catch {
      subTasks = [
        { name: "Worker 1", task, approach: "Direct execution" },
      ];
    }

    // Step 3: Create worker agents
    const workerAgents: Array<Awaited<ReturnType<typeof db.agentSession.create>>> = [];
    for (let i = 0; i < Math.min(subTasks.length, workers); i++) {
      const subTask = subTasks[i];
      const worker = await db.agentSession.create({
        data: {
          name: subTask.name || `Worker ${i + 1}`,
          role: "worker",
          status: "idle",
          task: subTask.task,
          parentId: leader.id,
          config: JSON.stringify({
            mode: "teammate",
            model: effectiveModel,
            approach: subTask.approach,
            taskIndex: i,
          }),
        },
      });

      await db.session.create({
        data: {
          title: `Worker ${i + 1}: ${subTask.name || subTask.task.slice(0, 30)}`,
          agentId: worker.id,
          mode: "teammate",
        },
      });

      workerAgents.push(worker);
    }

    // Step 4: Execute each worker's task
    const workerResults: Array<{ workerId: string; workerName: string; task: string; result?: string; error?: string }> = [];
    for (let i = 0; i < workerAgents.length; i++) {
      const worker = workerAgents[i];
      const subTask = subTasks[i];

      // Update worker status
      await db.agentSession.update({
        where: { id: worker.id },
        data: { status: "running" },
      });

      try {
        const workerSession = await db.session.findFirst({
          where: { agentId: worker.id },
        });

        if (!workerSession) continue;

        // Worker execution prompt
        const workerPrompt = `You are a worker agent. Execute the following task precisely.

Task: ${subTask.task}
Approach: ${subTask.approach || "Use your best judgment"}

Provide a clear, concise result. Include any relevant code, data, or findings.`;

        const workerResponse = await chatCompletion({
          model: effectiveModel,
          messages: [
            {
              role: "system",
              content:
                "You are a focused worker agent. Execute tasks precisely and report results.",
            },
            { role: "user", content: workerPrompt },
          ],
          temperature: 0.4,
          maxTokens: 4096,
        });

        const resultContent =
          workerResponse.choices?.[0]?.message?.content || "No result produced.";

        // Save worker messages
        await db.message.create({
          data: {
            sessionId: workerSession.id,
            role: "user",
            content: workerPrompt,
            tokens: estimateTokens(workerPrompt),
          },
        });

        await db.message.create({
          data: {
            sessionId: workerSession.id,
            role: "assistant",
            content: resultContent,
            tokens: estimateTokens(resultContent),
          },
        });

        workerResults.push({
          workerId: worker.id,
          workerName: worker.name,
          task: subTask.task,
          result: resultContent,
        });

        await db.agentSession.update({
          where: { id: worker.id },
          data: { status: "completed", result: resultContent },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        workerResults.push({
          workerId: worker.id,
          workerName: worker.name,
          task: subTask.task,
          error: errorMsg,
        });

        await db.agentSession.update({
          where: { id: worker.id },
          data: { status: "failed", result: errorMsg },
        });
      }
    }

    // Step 5: Leader synthesizes results
    const synthesisPrompt = `You are the coordinator leader. Synthesize the following worker results into a comprehensive final answer.

Original task: ${task}

Worker results:
${workerResults
  .map(
    (r, i) =>
      `[${r.workerName}]:\nTask: ${r.task}\n${r.error ? `Error: ${r.error}` : `Result: ${r.result}`}`
  )
  .join("\n\n")}

Provide a clear, structured synthesis that addresses the original task. Include key findings, any issues encountered, and the final answer.`;

    const synthesisResponse = await chatCompletion({
      model: effectiveModel,
      messages: [
        {
          role: "system",
          content:
            "You are a coordinator synthesizing worker results into a final comprehensive answer.",
        },
        { role: "user", content: synthesisPrompt },
      ],
      temperature: 0.5,
      maxTokens: 4096,
    });

    const synthesisContent =
      synthesisResponse.choices?.[0]?.message?.content ||
      "Synthesis failed.";

    // Save synthesis
    await db.message.create({
      data: {
        sessionId: leaderSession.id,
        role: "assistant",
        content: `[SYNTHESIS]\n${synthesisContent}`,
        tokens: estimateTokens(synthesisContent),
      },
    });

    // Update leader status
    await db.agentSession.update({
      where: { id: leader.id },
      data: {
        status: "completed",
        result: synthesisContent,
      },
    });

    // Update session token counts
    await db.session.update({
      where: { id: leaderSession.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      leader: {
        id: leader.id,
        name: leader.name,
        sessionId: leaderSession.id,
      },
      workers: workerAgents.map((w) => ({
        id: w.id,
        name: w.name,
      })),
      workerResults: workerResults.map((r) => ({
        workerId: r.workerId,
        workerName: r.workerName,
        success: !r.error,
      })),
      synthesis: synthesisContent,
      totalAgents: 1 + workerAgents.length,
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

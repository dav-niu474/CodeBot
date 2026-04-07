import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatCompletion,
  getDefaultModel,
  type ChatMessage,
} from "@/lib/nvidia";

const VALID_ROLES = ["leader", "worker", "scout"];
const VALID_STATUSES = [
  "idle",
  "running",
  "completed",
  "failed",
];

/**
 * GET /api/agents
 * List all agent sessions with optional filtering.
 * Query params: status, role, parent_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const role = searchParams.get("role");
    const parentId = searchParams.get("parent_id");

    const where: Record<string, unknown> = {};

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      where.status = status;
    }

    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          {
            error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      where.role = role;
    }

    if (parentId) {
      where.parentId = parentId;
    }

    const agents = await db.agentSession.findMany({
      where,
      include: {
        sessions: {
          select: {
            id: true,
            title: true,
            isActive: true,
            tokenCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = await db.agentSession.count({ where });

    // Parse config JSON for each agent
    const parsedAgents = agents.map((agent) => ({
      ...agent,
      config: agent.config ? JSON.parse(agent.config) : null,
    }));

    return NextResponse.json({
      success: true,
      agents: parsedAgents,
      total,
    });
  } catch (error: unknown) {
    console.error("[/api/agents] GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list agents";
    return NextResponse.json(
      { error: "Failed to list agents", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents
 * Create a new agent session.
 * Body: { name, role?, task?, parent_id?, config?, allowed_tools?, token_budget? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, task, parentId, config, allowedTools, tokenBudget } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required and must be a string" },
        { status: 400 }
      );
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify parent exists if parentId is provided
    if (parentId) {
      const parent = await db.agentSession.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent agent not found" },
          { status: 404 }
        );
      }
    }

    // Build config object
    const agentConfig = {
      allowedTools: allowedTools || [],
      tokenBudget: tokenBudget || 8192,
      mode: "interactive",
      ...(config || {}),
    };

    const agent = await db.agentSession.create({
      data: {
        name,
        role: role || "worker",
        status: "idle",
        task: task || "",
        parentId: parentId || null,
        config: JSON.stringify(agentConfig),
      },
    });

    // Create an initial session for the agent
    const session = await db.session.create({
      data: {
        title: `Agent: ${name}`,
        agentId: agent.id,
        mode: role === "leader" ? "coordinator" : "teammate",
      },
    });

    const response = {
      ...agent,
      config: agentConfig,
      session,
    };

    return NextResponse.json({ success: true, agent: response }, { status: 201 });
  } catch (error: unknown) {
    console.error("[/api/agents] POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create agent";
    return NextResponse.json(
      { error: "Failed to create agent", details: message },
      { status: 500 }
    );
  }
}

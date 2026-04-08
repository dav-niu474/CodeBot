// ============================================================
// MCP API — Tools
// GET  /api/mcp/tools?server=name  — List tools from a server
// POST /api/mcp/tools              — Call a tool on a server
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { mcpClient } from "@/lib/mcp/client";
import type { CallToolRequest } from "@/lib/mcp/types";

// ────────────────────────────────────────────
// GET /api/mcp/tools — List tools
// ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const serverName = searchParams.get("server") ?? undefined;

    const tools = mcpClient.listTools(serverName);

    return NextResponse.json({
      success: true,
      tools,
      total: tools.length,
      server: serverName ?? "all",
    });
  } catch (error: unknown) {
    console.error("[MCP/Tools] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to list MCP tools", details: message },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// POST /api/mcp/tools — Call a tool
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: CallToolRequest = await request.json();
    const { serverName, toolName, arguments: toolArgs } = body;

    if (!serverName || !toolName) {
      return NextResponse.json(
        { success: false, error: "serverName and toolName are required" },
        { status: 400 },
      );
    }

    const result = await mcpClient.callTool(
      serverName,
      toolName,
      toolArgs ?? {},
    );

    return NextResponse.json({
      success: true,
      result,
      serverName,
      toolName,
    });
  } catch (error: unknown) {
    console.error("[MCP/Tools] POST error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to call MCP tool", details: message },
      { status: 500 },
    );
  }
}

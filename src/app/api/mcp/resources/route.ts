// ============================================================
// MCP API — Resources
// GET  /api/mcp/resources?server=name  — List resources
// POST /api/mcp/resources              — Read a resource
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { mcpClient } from "@/lib/mcp/client";
import type { ReadResourceRequest } from "@/lib/mcp/types";

// ────────────────────────────────────────────
// GET /api/mcp/resources — List resources
// ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const serverName = searchParams.get("server") ?? undefined;

    const resources = mcpClient.listResources(serverName);

    return NextResponse.json({
      success: true,
      resources,
      total: resources.length,
      server: serverName ?? "all",
    });
  } catch (error: unknown) {
    console.error("[MCP/Resources] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to list MCP resources", details: message },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// POST /api/mcp/resources — Read a resource
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ReadResourceRequest = await request.json();
    const { serverName, resourceUri } = body;

    if (!serverName || !resourceUri) {
      return NextResponse.json(
        { success: false, error: "serverName and resourceUri are required" },
        { status: 400 },
      );
    }

    const content = await mcpClient.readResource(serverName, resourceUri);

    return NextResponse.json({
      success: true,
      content,
      serverName,
      resourceUri,
    });
  } catch (error: unknown) {
    console.error("[MCP/Resources] POST error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to read MCP resource", details: message },
      { status: 500 },
    );
  }
}

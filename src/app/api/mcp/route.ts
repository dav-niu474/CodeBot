// ============================================================
// MCP API — Server Management
// GET    /api/mcp   — List all configured MCP servers
// POST   /api/mcp   — Add a new MCP server
// DELETE /api/mcp   — Remove an MCP server
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { mcpClient } from "@/lib/mcp/client";
import { getServers } from "@/lib/mcp/store";
import type { AddServerRequest, RemoveServerRequest } from "@/lib/mcp/types";

// ────────────────────────────────────────────
// GET /api/mcp — List all servers
// ────────────────────────────────────────────

export async function GET() {
  try {
    const servers = getServers();

    // Sanitise output: never expose auth tokens
    const safeServers = servers.map((s) => ({
      name: s.name,
      url: s.url,
      authType: s.authType ?? "none",
      status: s.status,
      toolCount: s.tools?.length ?? 0,
      resourceCount: s.resources?.length ?? 0,
      lastError: s.lastError ?? null,
      lastConnectedAt: s.lastConnectedAt ?? null,
    }));

    return NextResponse.json({
      success: true,
      servers: safeServers,
      total: safeServers.length,
    });
  } catch (error: unknown) {
    console.error("[MCP] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to list MCP servers", details: message },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// POST /api/mcp — Add a new server
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: AddServerRequest = await request.json();
    const { name, url, authType, authToken } = body;

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: "name and url are required" },
        { status: 400 },
      );
    }

    // Basic URL validation
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { success: false, error: "url must use HTTP or HTTPS protocol" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 },
      );
    }

    if (authType && !["none", "bearer"].includes(authType)) {
      return NextResponse.json(
        { success: false, error: 'authType must be "none" or "bearer"' },
        { status: 400 },
      );
    }

    if (authType === "bearer" && !authToken) {
      return NextResponse.json(
        { success: false, error: "authToken is required when authType is bearer" },
        { status: 400 },
      );
    }

    await mcpClient.addServer({
      name,
      url,
      authType: authType ?? "none",
      authToken,
    });

    const server = mcpClient.servers.get(name);

    return NextResponse.json(
      {
        success: true,
        server: {
          name: server?.name,
          url: server?.url,
          authType: server?.authType ?? "none",
          status: server?.status,
          toolCount: server?.tools?.length ?? 0,
          resourceCount: server?.resources?.length ?? 0,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("[MCP] POST error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to add MCP server", details: message },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// DELETE /api/mcp — Remove a server
// ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const body: RemoveServerRequest = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 },
      );
    }

    await mcpClient.removeServer(name);

    return NextResponse.json({
      success: true,
      message: `Server "${name}" removed`,
    });
  } catch (error: unknown) {
    console.error("[MCP] DELETE error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: "Failed to remove MCP server", details: message },
      { status: 500 },
    );
  }
}

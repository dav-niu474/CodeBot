// ============================================================
// MCP Tool Bridge — Executor functions for MCP-related tools
// ============================================================
//
// Provides `ToolExecutionResult`-compatible executor functions
// for the four MCP tools defined in the tool system:
//   - mcp               → call a remote tool
//   - list-mcp-resources → list resources from servers
//   - read-mcp-resource  → read a specific resource
//   - mcp-auth           → authentication operations
//
// These can be wired into the executor map in executor.ts.
// ============================================================

import type { ToolExecutionResult, ToolExecutionContext } from "@/lib/tools/types";
import { mcpClient } from "./client";
import { getServer, updateServer } from "./store";

// ────────────────────────────────────────────
// mcp — Call a remote tool on an MCP server
// ────────────────────────────────────────────

export async function executeMcpTool(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string | undefined;
  const toolName = args.toolName as string | undefined;
  const toolArgs = (args.arguments as Record<string, unknown>) ?? {};

  if (!serverName) {
    return {
      output: 'Error: "serverName" is required for the mcp tool.',
      isError: true,
    };
  }
  if (!toolName) {
    return {
      output: 'Error: "toolName" is required for the mcp tool.',
      isError: true,
    };
  }

  try {
    const result = await mcpClient.callTool(serverName, toolName, toolArgs);
    return {
      output: result,
      metadata: { serverName, toolName },
    };
  } catch (err) {
    return {
      output: `MCP tool call failed on "${serverName}": ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
      metadata: { serverName, toolName },
    };
  }
}

// ────────────────────────────────────────────
// list-mcp-resources — List resources from MCP servers
// ────────────────────────────────────────────

export async function executeListMcpResources(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string | undefined;

  try {
    const resources = mcpClient.listResources(serverName);

    if (resources.length === 0) {
      const scope = serverName
        ? `server "${serverName}"`
        : "all connected MCP servers";
      return {
        output: `No resources found on ${scope}. Make sure servers are connected.`,
      };
    }

    const lines: string[] = [
      `MCP Resources (${serverName ? `from ${serverName}` : "all servers"})`,
      "=".repeat(50),
    ];

    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      lines.push(`${i + 1}. ${r.name}`);
      lines.push(`   URI: ${r.uri}`);
      if (r.description) {
        lines.push(`   Description: ${r.description}`);
      }
      if (r.mimeType) {
        lines.push(`   MIME: ${r.mimeType}`);
      }
      lines.push("");
    }

    lines.push(`--- ${resources.length} resource(s) ---`);

    return {
      output: lines.join("\n"),
      metadata: { serverName, count: resources.length },
    };
  } catch (err) {
    return {
      output: `Failed to list MCP resources: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ────────────────────────────────────────────
// read-mcp-resource — Read a specific resource
// ────────────────────────────────────────────

export async function executeReadMcpResource(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string | undefined;
  const resourceUri = args.resourceUri as string | undefined;

  if (!serverName) {
    return {
      output: 'Error: "serverName" is required for read-mcp-resource.',
      isError: true,
    };
  }
  if (!resourceUri) {
    return {
      output: 'Error: "resourceUri" is required for read-mcp-resource.',
      isError: true,
    };
  }

  try {
    const content = await mcpClient.readResource(serverName, resourceUri);
    return {
      output: content,
      metadata: { serverName, resourceUri },
    };
  } catch (err) {
    return {
      output: `Failed to read MCP resource "${resourceUri}" from "${serverName}": ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
      metadata: { serverName, resourceUri },
    };
  }
}

// ────────────────────────────────────────────
// mcp-auth — Authentication operations
// ────────────────────────────────────────────

export async function executeMcpAuth(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string | undefined;
  const action = args.action as string | undefined;
  const callbackCode = args.callbackCode as string | undefined;

  if (!serverName) {
    return {
      output: 'Error: "serverName" is required for mcp-auth.',
      isError: true,
    };
  }
  if (!action) {
    return {
      output: 'Error: "action" is required for mcp-auth (one of: login, logout, status, callback).',
      isError: true,
    };
  }

  const validActions = ["login", "logout", "status", "callback"];
  if (!validActions.includes(action)) {
    return {
      output: `Error: Invalid action "${action}". Must be one of: ${validActions.join(", ")}`,
      isError: true,
    };
  }

  const server = getServer(serverName);
  if (!server) {
    return {
      output: `Error: MCP server "${serverName}" not found. Add it first with the server management API.`,
      isError: true,
    };
  }

  switch (action) {
    case "status": {
      const lines: string[] = [
        `MCP Auth Status: ${serverName}`,
        "=".repeat(30),
        `Status: ${server.status}`,
        `Auth Type: ${server.authType ?? "none"}`,
        `Has Token: ${server.authToken ? "yes" : "no"}`,
        `URL: ${server.url}`,
      ];
      if (server.lastError) {
        lines.push(`Last Error: ${server.lastError}`);
      }
      if (server.lastConnectedAt) {
        lines.push(`Last Connected: ${server.lastConnectedAt}`);
      }
      return { output: lines.join("\n") };
    }

    case "login": {
      if (!callbackCode) {
        return {
          output: `To authenticate with "${serverName}", provide an OAuth callback code via the "callbackCode" parameter.\n\nThis would typically come from completing an OAuth flow with the MCP server.`,
          isError: true,
        };
      }

      // Store the token as a bearer token
      updateServer(serverName, {
        authType: "bearer",
        authToken: callbackCode,
      });

      return {
        output: `Successfully stored auth token for MCP server "${serverName}". The server will use Bearer token authentication for all future requests.`,
        metadata: { serverName, action },
      };
    }

    case "logout": {
      updateServer(serverName, {
        authType: "none",
        authToken: undefined,
      });

      return {
        output: `Cleared auth token for MCP server "${serverName}". Authentication is now set to "none".`,
        metadata: { serverName, action },
      };
    }

    case "callback": {
      if (!callbackCode) {
        return {
          output: 'Error: "callbackCode" is required for the callback action.',
          isError: true,
        };
      }

      // Treat callback the same as login — store the code as bearer token
      updateServer(serverName, {
        authType: "bearer",
        authToken: callbackCode,
      });

      return {
        output: `OAuth callback processed for "${serverName}". Auth token stored successfully.`,
        metadata: { serverName, action },
      };
    }

    default:
      return {
        output: `Unknown auth action: ${action}`,
        isError: true,
      };
  }
}

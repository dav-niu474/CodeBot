// ============================================================
// MCP Client — HTTP/SSE client for external MCP servers
// ============================================================
//
// Provides a singleton `mcpClient` that manages connections to
// one or more remote MCP (Model Context Protocol) servers.
//
// Protocol overview (HTTP binding):
//   GET  {url}/tools             → discover tools
//   POST {url}/tools/{name}      → call a tool
//   GET  {url}/resources         → list resources
//   GET  {url}/resources/{uri}   → read a resource
//
// All requests use native `fetch` with a 10-second timeout and
// optional Bearer token authentication.
// ============================================================

import type {
  MCPClient,
  MCPServerConfig,
  MCPToolInfo,
  MCPResourceInfo,
} from "./types";

import {
  getServers as storeGetServers,
  getServer as storeGetServer,
  addServer as storeAddServer,
  removeServer as storeRemoveServer,
  updateServer as storeUpdateServer,
} from "./store";

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * Build headers for an outgoing request, including optional
 * Bearer token when the server is configured for auth.
 */
function buildHeaders(config: MCPServerConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.authType === "bearer" && config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken}`;
  }
  return headers;
}

/**
 * Create an AbortController that auto-aborts after the timeout.
 */
function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  // Store the timeout id so callers can clear it
  (controller as AbortController & { _timeoutId?: NodeJS.Timeout })._timeoutId = id;
  return controller;
}

/**
 * Generic JSON fetch wrapper with timeout and error handling.
 */
async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeout?: number },
): Promise<T> {
  const timeoutMs = init.timeout ?? REQUEST_TIMEOUT_MS;
  const controller = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${body || "no body"}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    const timeoutId = (controller as AbortController & { _timeoutId?: NodeJS.Timeout })._timeoutId;
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ────────────────────────────────────────────
// MCP Client Implementation
// ────────────────────────────────────────────

class MCPClientImpl implements MCPClient {
  servers: Map<string, MCPServerConfig>;

  constructor() {
    // Sync from the in-memory store on creation
    this.servers = new Map<string, MCPServerConfig>();
    this._syncFromStore();
  }

  // ── Store sync ────────────────────────────────

  /** Pull the latest config from the store into the local map */
  private _syncFromStore(): void {
    for (const cfg of storeGetServers()) {
      this.servers.set(cfg.name, cfg);
    }
  }

  /** Push a server config back to the store */
  private _syncToStore(name: string, config: MCPServerConfig): void {
    storeUpdateServer(name, config);
  }

  // ── Public API ────────────────────────────────

  /**
   * Add a new MCP server and discover its tools & resources.
   * On success the server status is set to `"connected"`.
   */
  async addServer(
    config: Omit<MCPServerConfig, "status">,
  ): Promise<void> {
    const full: MCPServerConfig = {
      ...config,
      status: "disconnected",
      tools: config.tools ?? [],
      resources: config.resources ?? [],
    };

    // Store immediately (disconnected)
    storeAddServer(full);
    this.servers.set(full.name, full);

    // Discover tools & resources
    const headers = buildHeaders(full);
    const baseUrl = full.url.replace(/\/+$/, ""); // strip trailing slash

    // Fetch tools
    try {
      const toolsResp = await fetchJson<{ tools?: MCPToolInfo[] }>(
        `${baseUrl}/tools`,
        {
          method: "GET",
          headers,
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      full.tools = toolsResp.tools ?? [];
    } catch (err) {
      // Non-fatal: some servers may not expose /tools
      full.tools = [];
    }

    // Fetch resources
    try {
      const resourcesResp = await fetchJson<{ resources?: MCPResourceInfo[] }>(
        `${baseUrl}/resources`,
        {
          method: "GET",
          headers,
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      full.resources = resourcesResp.resources ?? [];
    } catch (err) {
      // Non-fatal
      full.resources = [];
    }

    // If we got here without exception, mark as connected
    full.status = "connected";
    full.lastError = undefined;
    full.lastConnectedAt = new Date().toISOString();

    this.servers.set(full.name, full);
    this._syncToStore(full.name, full);
  }

  /**
   * Remove an MCP server by name.
   */
  async removeServer(name: string): Promise<void> {
    this.servers.delete(name);
    storeRemoveServer(name);
  }

  /**
   * List tools. Optionally filter by server name.
   */
  listTools(serverName?: string): MCPToolInfo[] {
    this._syncFromStore(); // refresh

    if (serverName) {
      const server = this.servers.get(serverName);
      if (!server) return [];
      return server.tools ?? [];
    }

    // Aggregate tools across all servers
    const result: MCPToolInfo[] = [];
    for (const server of this.servers.values()) {
      if (server.tools) {
        for (const tool of server.tools) {
          result.push(tool);
        }
      }
    }
    return result;
  }

  /**
   * Call a tool on a remote MCP server.
   * POSTs to `{url}/tools/{toolName}` with the arguments as JSON body.
   * Returns the response body as a string.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    this._syncFromStore();

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found`);
    }
    if (server.status === "error") {
      throw new Error(
        `MCP server "${serverName}" is in error state: ${server.lastError ?? "unknown error"}`,
      );
    }

    const headers = buildHeaders(server);
    const baseUrl = server.url.replace(/\/+$/, "");

    try {
      const resp = await fetchJson<MCPToolCallResponse>(
        `${baseUrl}/tools/${encodeURIComponent(toolName)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ arguments: args }),
          timeout: REQUEST_TIMEOUT_MS,
        },
      );

      // The MCP response may have `content` or `result` or just be a plain string
      if (typeof resp === "string") return resp;
      if (resp.content) return typeof resp.content === "string" ? resp.content : JSON.stringify(resp.content);
      if (resp.result) return typeof resp.result === "string" ? resp.result : JSON.stringify(resp.result);
      return JSON.stringify(resp, null, 2);
    } catch (err) {
      // Update server status to error
      server.status = "error";
      server.lastError = err instanceof Error ? err.message : String(err);
      this.servers.set(serverName, server);
      this._syncToStore(serverName, server);
      throw err;
    }
  }

  /**
   * List resources. Optionally filter by server name.
   */
  listResources(serverName?: string): MCPResourceInfo[] {
    this._syncFromStore();

    if (serverName) {
      const server = this.servers.get(serverName);
      if (!server) return [];
      return server.resources ?? [];
    }

    const result: MCPResourceInfo[] = [];
    for (const server of this.servers.values()) {
      if (server.resources) {
        for (const res of server.resources) {
          result.push(res);
        }
      }
    }
    return result;
  }

  /**
   * Read a specific resource from an MCP server.
   * GETs `{url}/resources/{encodeURIComponent(uri)}`.
   * Returns the resource content as a string.
   */
  async readResource(
    serverName: string,
    resourceUri: string,
  ): Promise<string> {
    this._syncFromStore();

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found`);
    }

    const headers = buildHeaders(server);
    const baseUrl = server.url.replace(/\/+$/, "");

    try {
      const resp = await fetchJson<MCPResourceReadResponse>(
        `${baseUrl}/resources/${encodeURIComponent(resourceUri)}`,
        {
          method: "GET",
          headers,
          timeout: REQUEST_TIMEOUT_MS,
        },
      );

      if (typeof resp === "string") return resp;
      if (resp.content) return typeof resp.content === "string" ? resp.content : JSON.stringify(resp.content);
      if (resp.contents && Array.isArray(resp.contents)) {
        // MCP resource read may return an array of content blocks
        return resp.contents
          .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
          .join("\n");
      }
      return JSON.stringify(resp, null, 2);
    } catch (err) {
      server.status = "error";
      server.lastError = err instanceof Error ? err.message : String(err);
      this.servers.set(serverName, server);
      this._syncToStore(serverName, server);
      throw err;
    }
  }

  /**
   * Mark a server as disconnected.
   */
  disconnect(serverName: string): void {
    const server = this.servers.get(serverName);
    if (!server) return;

    server.status = "disconnected";
    this.servers.set(serverName, server);
    this._syncToStore(serverName, server);
  }
}

// ────────────────────────────────────────────
// Response shape helpers (loosely typed to be
// compatible with various MCP server impls)
// ────────────────────────────────────────────

/** Shape for tool call responses */
interface MCPToolCallResponse {
  content?: unknown;
  result?: unknown;
  [key: string]: unknown;
}

/** Shape for resource read responses */
interface MCPResourceReadResponse {
  content?: unknown;
  contents?: unknown[];
  [key: string]: unknown;
}

// ────────────────────────────────────────────
// Singleton Export
// ────────────────────────────────────────────

export const mcpClient: MCPClient = new MCPClientImpl();

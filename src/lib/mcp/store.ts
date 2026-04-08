// ============================================================
// MCP Server Configuration Store
// In-memory store for MCP server configurations with CRUD ops
// ============================================================

import type { MCPServerConfig } from "./types";

/** In-memory map of server name → configuration */
const servers = new Map<string, MCPServerConfig>();

// ────────────────────────────────────────────
// Seed a demo/example server (disabled by default)
// ────────────────────────────────────────────
const DEMO_SERVER: MCPServerConfig = {
  name: "demo-mcp-server",
  url: "https://demo.mcp.example.com",
  authType: "none",
  status: "disconnected",
  tools: [],
  resources: [],
};

/** Initialise the store with seed data */
function seed(): void {
  if (!servers.has(DEMO_SERVER.name)) {
    servers.set(DEMO_SERVER.name, { ...DEMO_SERVER });
  }
}
seed();

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/** Get all server configurations */
export function getServers(): MCPServerConfig[] {
  return Array.from(servers.values());
}

/** Get a single server by name (undefined if not found) */
export function getServer(name: string): MCPServerConfig | undefined {
  return servers.get(name);
}

/** Add or replace a server configuration */
export function addServer(config: Omit<MCPServerConfig, "status">): MCPServerConfig {
  const full: MCPServerConfig = {
    ...config,
    status: "disconnected",
    tools: config.tools ?? [],
    resources: config.resources ?? [],
  };
  servers.set(config.name, full);
  return full;
}

/** Remove a server by name. Returns true if the server existed. */
export function removeServer(name: string): boolean {
  return servers.delete(name);
}

/** Partially update a server configuration (merge into existing) */
export function updateServer(
  name: string,
  patch: Partial<Omit<MCPServerConfig, "name">>,
): MCPServerConfig | undefined {
  const existing = servers.get(name);
  if (!existing) return undefined;

  const updated: MCPServerConfig = { ...existing, ...patch };
  servers.set(name, updated);
  return updated;
}

/** Check whether a server with the given name exists */
export function hasServer(name: string): boolean {
  return servers.has(name);
}

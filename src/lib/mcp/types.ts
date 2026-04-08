// ============================================================
// MCP (Model Context Protocol) — Shared Types
// ============================================================

// ────────────────────────────────────────────
// Server Configuration
// ────────────────────────────────────────────

export interface MCPServerConfig {
  /** Human-readable server name (used as unique key) */
  name: string;
  /** HTTP endpoint of the MCP server */
  url: string;
  /** Authentication type */
  authType?: "none" | "bearer";
  /** Bearer token (only when authType === "bearer") */
  authToken?: string;
  /** Current connection status */
  status: "connected" | "disconnected" | "error";
  /** Tools discovered on this server (populated after addServer) */
  tools?: MCPToolInfo[];
  /** Resources discovered on this server */
  resources?: MCPResourceInfo[];
  /** Last error message (when status === "error") */
  lastError?: string;
  /** Timestamp of last successful connection (ISO 8601) */
  lastConnectedAt?: string;
}

// ────────────────────────────────────────────
// Tool & Resource Info
// ────────────────────────────────────────────

export interface MCPToolInfo {
  /** Tool name on the remote server */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema describing the tool's input parameters */
  inputSchema: Record<string, unknown>;
}

export interface MCPResourceInfo {
  /** URI identifying the resource (e.g. "file:///path/to/doc") */
  uri: string;
  /** Human-readable resource name */
  name: string;
  /** Optional description */
  description?: string;
  /** MIME type of the resource content */
  mimeType?: string;
}

// ────────────────────────────────────────────
// MCP Client Interface
// ────────────────────────────────────────────

export interface MCPClient {
  /** All registered server configs keyed by name */
  servers: Map<string, MCPServerConfig>;
  /** Add a server and discover its tools/resources */
  addServer(config: Omit<MCPServerConfig, "status">): Promise<void>;
  /** Remove a server by name */
  removeServer(name: string): Promise<void>;
  /** List tools (optionally filtered by server) */
  listTools(serverName?: string): MCPToolInfo[];
  /** Call a remote tool on a specific server */
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string>;
  /** List resources (optionally filtered by server) */
  listResources(serverName?: string): MCPResourceInfo[];
  /** Read a specific resource from a server */
  readResource(serverName: string, resourceUri: string): Promise<string>;
  /** Mark a server as disconnected */
  disconnect(serverName: string): void;
}

// ────────────────────────────────────────────
// API route request / response shapes
// ────────────────────────────────────────────

export interface AddServerRequest {
  name: string;
  url: string;
  authType?: "none" | "bearer";
  authToken?: string;
}

export interface RemoveServerRequest {
  name: string;
}

export interface CallToolRequest {
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface ReadResourceRequest {
  serverName: string;
  resourceUri: string;
}

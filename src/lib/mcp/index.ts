// ============================================================
// MCP Module — Barrel Export
// ============================================================

// Types
export type {
  MCPServerConfig,
  MCPToolInfo,
  MCPResourceInfo,
  MCPClient,
  AddServerRequest,
  RemoveServerRequest,
  CallToolRequest,
  ReadResourceRequest,
} from "./types";

// Client
export { mcpClient } from "./client";

// Store
export {
  getServers,
  getServer,
  addServer,
  removeServer,
  updateServer,
  hasServer,
} from "./store";

// Tool bridge (executor functions)
export {
  executeMcpTool,
  executeListMcpResources,
  executeReadMcpResource,
  executeMcpAuth,
} from "./tool-bridge";

/** Result of a tool execution */
export interface ToolExecutionResult {
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/** Tool execution context passed to every executor */
export interface ToolExecutionContext {
  sessionId: string;
  workingDirectory?: string;
  /** Callback to send real-time progress to the client via SSE */
  onProgress?: (event: string, data: Record<string, unknown>) => void;
}

/** A tool executor function */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

/** Permission level for a tool execution */
export type ToolPermission = 'allow' | 'deny' | 'ask';

/** Tool permission check result */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: ToolPermission;
  reason?: string;
}

import type { ToolExecutionResult, ToolExecutionContext } from './types';

// Import all executors
import { executeFileRead, executeFileWrite, executeFileEdit } from './executors/file-operations';
import { executeBash } from './executors/bash';
import { executeGlob, executeGrep } from './executors/search';
import { executeWebSearch, executeWebFetch } from './executors/web';
import {
  executeTodoWrite,
  executeSendMessage,
  executeAskUser,
  executeBrief,
  executeAgent,
  executeNotebookEdit,
} from './executors/general';

/** Map tool IDs to executor functions */
const executorMap: Record<
  string,
  (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>
> = {
  'file-read': executeFileRead,
  'file-write': executeFileWrite,
  'file-edit': executeFileEdit,
  bash: executeBash,
  glob: executeGlob,
  grep: executeGrep,
  'web-search': executeWebSearch,
  'web-fetch': executeWebFetch,
  'todo-write': executeTodoWrite,
  'send-message': executeSendMessage,
  'ask-user': executeAskUser,
  agent: executeAgent,
  'notebook-edit': executeNotebookEdit,
  brief: executeBrief,
};

/**
 * Execute a tool by name with given arguments and context.
 * This is the main dispatcher — all tool calls flow through here.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const executor = executorMap[toolName];
  if (!executor) {
    return {
      output: `Unknown tool: ${toolName}. Available tools: ${Object.keys(executorMap).join(', ')}`,
      isError: true,
    };
  }

  try {
    return await executor(args, context);
  } catch (error) {
    return {
      output: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * Check if a tool is available
 */
export function isToolAvailable(toolName: string): boolean {
  return toolName in executorMap;
}

/**
 * Get list of all available tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(executorMap);
}

/**
 * Get the executor map (useful for permissions, documentation, etc.)
 */
export function getExecutorMap(): typeof executorMap {
  return executorMap;
}

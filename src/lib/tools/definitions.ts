// ============================================================
// Tool Schema Definitions — NVIDIA Function-Calling Format
// Converts the 44 Claude Code tools into JSON Schema for the
// NVIDIA API `tools` parameter.
// ============================================================

import type { ToolDefinition as NvidiaToolDef } from "@/lib/nvidia";
import { ALL_CLAUDE_TOOLS } from "@/lib/types";
import type { ToolDefinition as ClaudeToolDef } from "@/lib/types";

// ────────────────────────────────────────────
// Helper: build a single tool schema
// ────────────────────────────────────────────

function toolSchema(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): NvidiaToolDef {
  return {
    type: "function",
    function: { name, description, parameters },
  };
}

// ────────────────────────────────────────────
// JSON Schema definitions for all 44 tools
// ────────────────────────────────────────────

/** Complete registry: tool id → NVIDIA function-calling schema */
const TOOL_SCHEMAS: Record<string, NvidiaToolDef> = {
  // ── Core Tools (14) ──────────────────────────────────────

  bash: toolSchema(
    "bash",
    "Execute shell commands in a persistent sandboxed environment with timeout control",
    {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (max 120000)",
          default: 30000,
        },
        workingDirectory: {
          type: "string",
          description: "Working directory for the command",
        },
      },
      required: ["command"],
    }
  ),

  "file-read": toolSchema(
    "file-read",
    "Read file contents from the local filesystem",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to read" },
        offset: { type: "number", description: "Line number to start reading from" },
        limit: { type: "number", description: "Maximum number of lines to read" },
      },
      required: ["path"],
    }
  ),

  "file-write": toolSchema(
    "file-write",
    "Write or create files on the filesystem",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to write" },
        content: { type: "string", description: "Content to write to the file" },
        description: {
          type: "string",
          description: "Brief description of what this file does",
        },
      },
      required: ["path", "content"],
    }
  ),

  "file-edit": toolSchema(
    "file-edit",
    "Edit existing files with exact find-and-replace operations",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to edit" },
        oldText: { type: "string", description: "Exact text to find and replace" },
        newText: { type: "string", description: "Replacement text" },
        replaceAll: {
          type: "boolean",
          description: "Replace all occurrences",
          default: false,
        },
      },
      required: ["path", "oldText", "newText"],
    }
  ),

  glob: toolSchema(
    "glob",
    "Fast file pattern matching using glob syntax to find files by name",
    {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.tsx')",
        },
        path: { type: "string", description: "Base directory to search in" },
      },
      required: ["pattern"],
    }
  ),

  grep: toolSchema(
    "grep",
    "Search file contents with full regex support across the codebase",
    {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Directory to search in" },
        include: {
          type: "string",
          description: "File glob to include (e.g. '*.ts')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results",
          default: 50,
        },
      },
      required: ["pattern"],
    }
  ),

  agent: toolSchema(
    "agent",
    "Spawn specialized sub-agents for delegated task execution. Supports Explore (read-only codebase analysis), Plan (architecture design), and general-purpose (full tool access) sub-agent types.",
    {
      type: "object",
      properties: {
        task: { type: "string", description: "Task description for the sub-agent to complete" },
        description: { type: "string", description: "Short description of the sub-agent's goal (3-5 words)" },
        subagent_type: {
          type: "string",
          description: "Type of sub-agent to spawn",
          enum: ["general-purpose", "Explore", "Plan"],
        },
        model: { type: "string", description: "Model to use for the sub-agent (optional, uses default if not specified)" },
      },
      required: ["task"],
    }
  ),

  "web-search": toolSchema(
    "web-search",
    "Search the web for up-to-date information, documentation, and solutions",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: {
          type: "number",
          description: "Maximum results",
          default: 5,
        },
      },
      required: ["query"],
    }
  ),

  "web-fetch": toolSchema(
    "web-fetch",
    "Fetch and extract content from web pages including metadata",
    {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch content from" },
        raw: {
          type: "boolean",
          description: "Return raw HTML",
          default: false,
        },
      },
      required: ["url"],
    }
  ),

  "send-message": toolSchema(
    "send-message",
    "Send messages to the user or other agents in the conversation",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to send" },
      },
      required: ["message"],
    }
  ),

  "todo-write": toolSchema(
    "todo-write",
    "Manage a structured task list with status tracking for complex workflows",
    {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "Array of todo items to set",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique identifier for the todo item" },
              content: { type: "string", description: "Task description" },
              status: {
                type: "string",
                description: "Current status of the task",
                enum: ["pending", "in_progress", "completed"],
              },
              priority: {
                type: "string",
                description: "Priority level of the task",
                enum: ["high", "medium", "low"],
              },
            },
            required: ["id", "content", "status"],
          },
        },
      },
      required: ["todos"],
    }
  ),

  "ask-user": toolSchema(
    "ask-user",
    "Ask the user a question and wait for their response before proceeding",
    {
      type: "object",
      properties: {
        question: { type: "string", description: "Question to ask the user" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Optional multiple choice options",
        },
      },
      required: ["question"],
    }
  ),

  "notebook-edit": toolSchema(
    "notebook-edit",
    "Edit Jupyter notebook (.ipynb) cells with proper cell-level operations",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the notebook" },
        cellIndex: { type: "number", description: "Cell index to edit" },
        newSource: { type: "string", description: "New cell source code" },
        cellType: {
          type: "string",
          enum: ["code", "markdown"],
          description: "Cell type",
        },
      },
      required: ["path", "cellIndex", "newSource"],
    }
  ),

  brief: toolSchema(
    "brief",
    "Generate a concise brief or summary of the current context and task state",
    {
      type: "object",
      properties: {
        context: { type: "string", description: "Context to summarize" },
        maxLength: {
          type: "number",
          description: "Maximum length of brief",
          default: 500,
        },
      },
      required: ["context"],
    }
  ),

  // ── Lazy-loaded Tools (25) ────────────────────────────────

  mcp: toolSchema(
    "mcp",
    "Model Context Protocol — connect to external tool servers via MCP",
    {
      type: "object",
      properties: {
        serverName: { type: "string", description: "Name of the MCP server to connect to" },
        toolName: { type: "string", description: "Name of the tool to invoke on the server" },
        arguments: {
          type: "object",
          description: "Arguments to pass to the MCP tool",
          additionalProperties: true,
        },
      },
      required: ["serverName", "toolName"],
    }
  ),

  lsp: toolSchema(
    "lsp",
    "Language Server Protocol — code intelligence, diagnostics, and symbol resolution",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "LSP action to perform",
          enum: ["diagnostics", "symbols", "definition", "references", "hover", "rename"],
        },
        filePath: { type: "string", description: "Path to the file to analyze" },
        position: {
          type: "object",
          description: "Line and column position in the file",
          properties: {
            line: { type: "number" },
            character: { type: "number" },
          },
          required: ["line", "character"],
        },
        newName: { type: "string", description: "New name for rename operations" },
      },
      required: ["action", "filePath"],
    }
  ),

  skill: toolSchema(
    "skill",
    "Load and execute specialized skill prompts for domain-specific workflows",
    {
      type: "object",
      properties: {
        skillId: { type: "string", description: "Identifier of the skill to invoke" },
        input: { type: "string", description: "Input or prompt for the skill" },
      },
      required: ["skillId"],
    }
  ),

  "list-mcp-resources": toolSchema(
    "list-mcp-resources",
    "List all available resources from connected MCP servers",
    {
      type: "object",
      properties: {
        serverName: {
          type: "string",
          description: "Name of the MCP server (omit for all servers)",
        },
      },
    }
  ),

  "read-mcp-resource": toolSchema(
    "read-mcp-resource",
    "Read a specific resource from a connected MCP server",
    {
      type: "object",
      properties: {
        serverName: { type: "string", description: "Name of the MCP server" },
        resourceUri: { type: "string", description: "URI of the resource to read" },
      },
      required: ["serverName", "resourceUri"],
    }
  ),

  "mcp-auth": toolSchema(
    "mcp-auth",
    "Handle OAuth and authentication flows for MCP servers",
    {
      type: "object",
      properties: {
        serverName: { type: "string", description: "Name of the MCP server" },
        action: {
          type: "string",
          description: "Auth action to perform",
          enum: ["login", "logout", "status", "callback"],
        },
        callbackCode: {
          type: "string",
          description: "OAuth callback code for authentication",
        },
      },
      required: ["serverName", "action"],
    }
  ),

  "tool-search": toolSchema(
    "tool-search",
    "Search across all available tools by name, description, or capability",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query to find tools" },
        category: {
          type: "string",
          description: "Optional category filter",
        },
      },
      required: ["query"],
    }
  ),

  "enter-plan-mode": toolSchema(
    "enter-plan-mode",
    "Switch to plan mode where the agent creates plans without executing changes",
    {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of what needs to be planned",
        },
      },
    }
  ),

  "exit-plan-mode": toolSchema(
    "exit-plan-mode",
    "Exit plan mode and return to normal execution mode",
    {
      type: "object",
      properties: {},
    }
  ),

  "enter-worktree": toolSchema(
    "enter-worktree",
    "Create and switch to a git worktree for isolated file operations",
    {
      type: "object",
      properties: {
        branchName: { type: "string", description: "Name for the new worktree branch" },
        basePath: {
          type: "string",
          description: "Base path for the worktree directory",
        },
      },
      required: ["branchName"],
    }
  ),

  "exit-worktree": toolSchema(
    "exit-worktree",
    "Leave the current git worktree and return to the main working tree",
    {
      type: "object",
      properties: {
        mergeChanges: {
          type: "boolean",
          description: "Whether to merge changes back to main branch",
          default: false,
        },
      },
    }
  ),

  "task-create": toolSchema(
    "task-create",
    "Create a new background task for async execution by the agent",
    {
      type: "object",
      properties: {
        description: { type: "string", description: "Description of the task to create" },
        priority: {
          type: "string",
          description: "Task priority",
          enum: ["low", "medium", "high"],
          default: "medium",
        },
        parentTaskId: {
          type: "string",
          description: "Optional parent task ID for subtasks",
        },
      },
      required: ["description"],
    }
  ),

  "task-get": toolSchema(
    "task-get",
    "Get the current status and details of a specific background task",
    {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID of the task to retrieve" },
      },
      required: ["taskId"],
    }
  ),

  "task-list": toolSchema(
    "task-list",
    "List all background tasks with their status and metadata",
    {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status",
          enum: ["pending", "running", "completed", "failed"],
        },
      },
    }
  ),

  "task-output": toolSchema(
    "task-output",
    "Retrieve the output or result produced by a completed background task",
    {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID of the task to get output from" },
      },
      required: ["taskId"],
    }
  ),

  "task-stop": toolSchema(
    "task-stop",
    "Cancel or stop a running background task",
    {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID of the task to stop" },
        reason: { type: "string", description: "Reason for stopping the task" },
      },
      required: ["taskId"],
    }
  ),

  "task-update": toolSchema(
    "task-update",
    "Update the properties or priority of an existing background task",
    {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID of the task to update" },
        priority: {
          type: "string",
          description: "New priority level",
          enum: ["low", "medium", "high"],
        },
        description: { type: "string", description: "Updated task description" },
      },
      required: ["taskId"],
    }
  ),

  "team-create": toolSchema(
    "team-create",
    "Create a new multi-agent team with assigned roles and shared context",
    {
      type: "object",
      properties: {
        teamName: { type: "string", description: "Name for the new team" },
        members: {
          type: "array",
          description: "Team member definitions",
          items: {
            type: "object",
            properties: {
              role: {
                type: "string",
                description: "Role of the team member",
                enum: ["leader", "worker", "scout"],
              },
              task: { type: "string", description: "Task assigned to this member" },
            },
            required: ["role", "task"],
          },
        },
      },
      required: ["teamName"],
    }
  ),

  "team-delete": toolSchema(
    "team-delete",
    "Disband an existing multi-agent team and clean up shared resources",
    {
      type: "object",
      properties: {
        teamId: { type: "string", description: "ID of the team to disband" },
      },
      required: ["teamId"],
    }
  ),

  "synthetic-output": toolSchema(
    "synthetic-output",
    "Generate synthetic file outputs or structured data for testing",
    {
      type: "object",
      properties: {
        outputPath: { type: "string", description: "Path where output should be written" },
        template: {
          type: "string",
          description: "Template or format for the synthetic output",
        },
        size: { type: "number", description: "Approximate size of the output" },
      },
      required: ["outputPath"],
    }
  ),

  config: toolSchema(
    "config",
    "Read and modify agent configuration, settings, and preferences",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Config operation to perform",
          enum: ["get", "set", "list", "reset"],
        },
        key: { type: "string", description: "Configuration key to read or modify" },
        value: {
          type: "string",
          description: "New value for the configuration key",
        },
      },
      required: ["action"],
    }
  ),

  "remote-trigger": toolSchema(
    "remote-trigger",
    "Trigger actions or workflows on remote services and webhooks",
    {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the remote service or webhook" },
        method: {
          type: "string",
          description: "HTTP method",
          enum: ["GET", "POST", "PUT", "DELETE"],
          default: "POST",
        },
        payload: {
          type: "object",
          description: "Payload to send with the request",
          additionalProperties: true,
        },
        headers: {
          type: "object",
          description: "Custom HTTP headers",
          additionalProperties: { type: "string" },
        },
      },
      required: ["url"],
    }
  ),

  "schedule-cron": toolSchema(
    "schedule-cron",
    "Create and manage scheduled cron jobs for recurring tasks",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Cron operation",
          enum: ["create", "list", "delete", "enable", "disable"],
        },
        cronId: { type: "string", description: "ID of the cron job" },
        schedule: { type: "string", description: "Cron expression (e.g. '0 * * * *')" },
        task: { type: "string", description: "Task to execute on schedule" },
      },
      required: ["action"],
    }
  ),

  powershell: toolSchema(
    "powershell",
    "Execute PowerShell commands on Windows systems",
    {
      type: "object",
      properties: {
        command: { type: "string", description: "PowerShell command to execute" },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (max 120000)",
          default: 30000,
        },
      },
      required: ["command"],
    }
  ),

  // ── Feature-flagged Tools (5) ─────────────────────────────

  sleep: toolSchema(
    "sleep",
    "Pause execution for a specified duration, useful for rate limiting and timing",
    {
      type: "object",
      properties: {
        duration: {
          type: "number",
          description: "Duration to sleep in milliseconds",
        },
      },
      required: ["duration"],
    }
  ),

  repl: toolSchema(
    "repl",
    "Interactive Read-Eval-Print Loop for live code experimentation",
    {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language for the REPL session",
          default: "javascript",
        },
        code: { type: "string", description: "Code to evaluate in the REPL" },
        session: {
          type: "string",
          description: "REPL session ID to continue an existing session",
        },
      },
      required: ["code"],
    }
  ),

  voice: toolSchema(
    "voice",
    "Speech-to-text input and text-to-speech output for voice interaction",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Voice action to perform",
          enum: ["transcribe", "speak", "listen"],
        },
        text: { type: "string", description: "Text to convert to speech" },
        audioData: { type: "string", description: "Base64-encoded audio data for transcription" },
        voice: { type: "string", description: "Voice ID for text-to-speech" },
      },
      required: ["action"],
    }
  ),

  "dream-task": toolSchema(
    "dream-task",
    "Spawn background dream-mode tasks that process asynchronously while the agent continues",
    {
      type: "object",
      properties: {
        task: { type: "string", description: "Background task description for dream processing" },
        priority: {
          type: "string",
          description: "Priority of the dream task",
          enum: ["low", "medium", "high"],
          default: "low",
        },
      },
      required: ["task"],
    }
  ),

  "magic-docs": toolSchema(
    "magic-docs",
    "Auto-generate and maintain living documentation from code analysis",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Documentation action to perform",
          enum: ["generate", "update", "query", "delete"],
        },
        target: {
          type: "string",
          description: "File path, module, or scope to document",
        },
        format: {
          type: "string",
          description: "Output documentation format",
          enum: ["markdown", "json", "html"],
          default: "markdown",
        },
      },
      required: ["action"],
    }
  ),
};

// ────────────────────────────────────────────
// Core tool ID set (for fast lookup)
// ────────────────────────────────────────────

const CORE_TOOL_IDS = new Set([
  "bash",
  "file-read",
  "file-write",
  "file-edit",
  "glob",
  "grep",
  "agent",
  "web-search",
  "web-fetch",
  "send-message",
  "todo-write",
  "ask-user",
  "notebook-edit",
  "brief",
]);

// ────────────────────────────────────────────
// Expandable tool IDs (lazy + flag tools that can be
// dynamically loaded on demand via tool-search)
// ────────────────────────────────────────────

const EXPANDABLE_TOOL_IDS = new Set([
  "tool-search", "config", "enter-plan-mode", "exit-plan-mode",
  "schedule-cron", "remote-trigger", "sleep", "mcp",
  "list-mcp-resources", "read-mcp-resource", "mcp-auth",
  "skill", "synthetic-output", "team-create", "team-delete",
  "task-create", "task-get", "task-list", "task-output",
  "task-stop", "task-update", "enter-worktree", "exit-worktree",
  "powershell", "voice", "dream-task", "magic-docs", "repl",
]);

// ────────────────────────────────────────────
// Exported Functions
// ────────────────────────────────────────────

/**
 * Get NVIDIA function-calling schemas for the 14 core tools only.
 * These are always loaded into the model context.
 */
export function getCoreToolSchemas(): NvidiaToolDef[] {
  return ALL_CLAUDE_TOOLS.filter((t) => CORE_TOOL_IDS.has(t.id)).map(
    (t) => TOOL_SCHEMAS[t.id]
  );
}

/**
 * Get NVIDIA function-calling schemas for all 44 tools.
 */
export function getAllToolSchemas(): NvidiaToolDef[] {
  return ALL_CLAUDE_TOOLS.map((t) => TOOL_SCHEMAS[t.id]);
}

/**
 * Get NVIDIA function-calling schemas for a specific subset of tools by ID.
 * Useful for dynamic loading of lazy/flag tools on demand.
 */
export function getToolSchemasByIds(ids: string[]): NvidiaToolDef[] {
  const idSet = new Set(ids);
  return ALL_CLAUDE_TOOLS.filter((t) => idSet.has(t.id)).map(
    (t) => TOOL_SCHEMAS[t.id]
  );
}

/**
 * Get the original Claude ToolDefinition metadata for a tool by name/id.
 * Returns undefined if the tool is not found.
 */
export function getToolMeta(toolName: string): ClaudeToolDef | undefined {
  return ALL_CLAUDE_TOOLS.find((t) => t.id === toolName || t.name === toolName);
}

/**
 * Get NVIDIA function-calling schemas for all expandable (lazy + flag) tools.
 * These can be dynamically loaded on demand via tool-search.
 */
export function getExpandableToolSchemas(): NvidiaToolDef[] {
  return ALL_CLAUDE_TOOLS.filter((t) => EXPANDABLE_TOOL_IDS.has(t.id)).map(
    (t) => TOOL_SCHEMAS[t.id]
  );
}

/**
 * Get a single tool schema by name/id.
 */
export function getToolSchemaById(id: string): NvidiaToolDef | undefined {
  return TOOL_SCHEMAS[id];
}

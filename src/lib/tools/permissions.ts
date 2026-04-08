// ============================================================
// Tool Permission System — Claude Code inspired
// Read tools auto-allow, write/destructive tools require approval
// ============================================================

import type { ToolExecutionResult } from './types';

// ────────────────────────────────────────────
// Permission Types
// ────────────────────────────────────────────

export type ToolPermission = 'allow' | 'deny' | 'ask';

export interface PermissionCheckResult {
  permission: ToolPermission;
  reason?: string;
  /** For 'ask': message to show to user */
  askMessage?: string;
  /** For 'ask': suggested options (allow once, allow always, deny) */
  suggestions?: string[];
}

export type ToolRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

// ────────────────────────────────────────────
// Tool Permission Definitions
// Claude Code pattern: conservative defaults
// ────────────────────────────────────────────

/** Permission config per tool */
const TOOL_PERMISSIONS: Record<string, {
  defaultPermission: ToolPermission;
  riskLevel: ToolRiskLevel;
  description: string;
  isReadOnly: boolean;
  isDestructive: boolean;
  /** Patterns in args that escalate permission to 'ask' */
  dangerousPatterns?: RegExp[];
}> = {
  // ── Safe / Read-only: auto-allow ──
  'file-read':  { defaultPermission: 'allow', riskLevel: 'safe', description: 'Read file contents', isReadOnly: true, isDestructive: false },
  'glob':       { defaultPermission: 'allow', riskLevel: 'safe', description: 'Search files by pattern', isReadOnly: true, isDestructive: false },
  'grep':       { defaultPermission: 'allow', riskLevel: 'safe', description: 'Search file contents', isReadOnly: true, isDestructive: false },
  'web-search': { defaultPermission: 'allow', riskLevel: 'low', description: 'Search the web', isReadOnly: true, isDestructive: false },
  'web-fetch':  { defaultPermission: 'allow', riskLevel: 'low', description: 'Fetch web page content', isReadOnly: true, isDestructive: false },
  'brief':      { defaultPermission: 'allow', riskLevel: 'safe', description: 'Generate a summary', isReadOnly: true, isDestructive: false },
  'tool-search':{ defaultPermission: 'allow', riskLevel: 'safe', description: 'Discover available tools', isReadOnly: true, isDestructive: false },

  // ── Write / Medium risk ──
  'file-edit':  { defaultPermission: 'allow', riskLevel: 'medium', description: 'Edit existing files', isReadOnly: false, isDestructive: false },
  'file-write': { defaultPermission: 'allow', riskLevel: 'medium', description: 'Write/create files', isReadOnly: false, isDestructive: false },
  'notebook-edit': { defaultPermission: 'allow', riskLevel: 'medium', description: 'Edit notebook cells', isReadOnly: false, isDestructive: false },
  'todo-write': { defaultPermission: 'allow', riskLevel: 'low', description: 'Update task list', isReadOnly: false, isDestructive: false },
  'ask-user':   { defaultPermission: 'allow', riskLevel: 'low', description: 'Ask user a question', isReadOnly: true, isDestructive: false },

  // ── Bash: high risk, needs approval for dangerous commands ──
  'bash': {
    defaultPermission: 'allow',
    riskLevel: 'high',
    description: 'Execute shell commands',
    isReadOnly: false,
    isDestructive: false,
    dangerousPatterns: [
      /rm\s+(-rf|--recursive)\s/,     // rm -rf
      /git\s+push\s+.*--force/,        // git push --force
      /sudo\s/,                         // sudo commands
      /chmod\s+777/,                    // chmod 777
      />\s*\/dev\//,                    // redirect to /dev/
      /mkfs/,                           // format filesystem
      /dd\s+if=/,                       // disk operations
      /curl.*\|\s*(ba)?sh/,            // curl | sh (remote script execution)
      /wget.*\|\s*(ba)?sh/,            // wget | sh
      /DROP\s+TABLE/i,                 // SQL DROP TABLE
      /DELETE\s+FROM/i,                // SQL DELETE
    ],
  },

  // ── Agent spawning: medium-high risk ──
  'agent':      { defaultPermission: 'allow', riskLevel: 'medium', description: 'Spawn sub-agent', isReadOnly: false, isDestructive: false },

  // ── System tools ──
  'config':       { defaultPermission: 'allow', riskLevel: 'medium', description: 'Modify configuration', isReadOnly: false, isDestructive: false },
  'skill':        { defaultPermission: 'allow', riskLevel: 'low', description: 'Execute a skill', isReadOnly: true, isDestructive: false },
  'send-message': { defaultPermission: 'allow', riskLevel: 'low', description: 'Send message to user', isReadOnly: true, isDestructive: false },
  'enter-plan-mode': { defaultPermission: 'allow', riskLevel: 'safe', description: 'Switch to plan mode', isReadOnly: true, isDestructive: false },
  'exit-plan-mode':  { defaultPermission: 'allow', riskLevel: 'safe', description: 'Exit plan mode', isReadOnly: true, isDestructive: false },
};

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Check permission for a tool execution.
 * Claude Code pattern: conservative defaults, pattern-based escalation.
 *
 * Returns 'allow' for safe/read operations.
 * Returns 'ask' for dangerous patterns detected in args.
 * Falls back to tool's defaultPermission for unknown tools.
 */
export function checkToolPermission(
  toolName: string,
  args: Record<string, unknown>,
): PermissionCheckResult {
  const config = TOOL_PERMISSIONS[toolName];

  // Unknown tool: allow by default (fail-open for extensibility)
  if (!config) {
    return { permission: 'allow', reason: 'Unknown tool, allowing by default' };
  }

  // Check dangerous patterns in arguments (mainly for bash)
  if (config.dangerousPatterns && config.dangerousPatterns.length > 0) {
    const argsStr = JSON.stringify(args).toLowerCase();
    for (const pattern of config.dangerousPatterns) {
      if (pattern.test(argsStr)) {
        return {
          permission: 'ask',
          reason: `Dangerous pattern detected in ${toolName} arguments`,
          askMessage: `⚠️ The command contains a potentially dangerous operation:\n\n\`${argsStr.slice(0, 200)}\`\n\nDo you want to proceed?`,
          suggestions: ['Allow once', 'Deny'],
        };
      }
    }
  }

  return {
    permission: config.defaultPermission,
    reason: config.isReadOnly ? 'Read-only operation' : `${config.riskLevel} risk tool`,
  };
}

/**
 * Get the risk level for a tool.
 */
export function getToolRiskLevel(toolName: string): ToolRiskLevel {
  return TOOL_PERMISSIONS[toolName]?.riskLevel ?? 'medium';
}

/**
 * Check if a tool is read-only.
 */
export function isToolReadOnly(toolName: string): boolean {
  return TOOL_PERMISSIONS[toolName]?.isReadOnly ?? false;
}

/**
 * Get all tool names that have dangerous patterns.
 */
export function getDangerousTools(): string[] {
  return Object.entries(TOOL_PERMISSIONS)
    .filter(([, c]) => c.dangerousPatterns && c.dangerousPatterns.length > 0)
    .map(([name]) => name);
}

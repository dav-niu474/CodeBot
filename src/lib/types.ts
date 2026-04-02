// ============================================================
// CodeBot Agent - Comprehensive Type System
// Inspired by Claude Code's full architecture (v2.1.88)
// ============================================================
//
// Table of Contents:
//   §1  Database / Core Entity Types
//   §2  Tool System — 44 Tools across Core / Lazy / Flag
//   §3  Skill System
//   §4  Running Modes — 10 modes
//   §5  Memory System — 4-layer architecture
//   §6  NVIDIA API Models
//   §7  Multi-Agent System
//   §8  Feature Flags — 16 flags
//   §9  Security & Permission Types
//   §10 Token Compression & Budget
//   §11 UI Types (ActiveView, ToolCall, ToolResult, AICapability)
//   §12 Default Data & Constants
//

// ============================================================
// §1  Database / Core Entity Types
// ============================================================

/** A chat session with conversation history */
export interface Session {
  id: string;
  title: string;
  model: string;
  systemPrompt: string | null;
  isActive: boolean;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

/** A single message within a session */
export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls: string | null;
  toolResults: string | null;
  tokens: number;
  createdAt: string;
  isStreaming?: boolean;
  thinkingContent?: string | null;
}

/**
 * Tool definition stored in DB / used across the app.
 * Extended fields (displayName, loadStrategy, riskLevel) are optional
 * for full backward compatibility with existing API routes and components.
 */
export interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ToolCategory;
  isEnabled: boolean;
  isReadOnly: boolean;
  config: string | null;
  createdAt: string;
  updatedAt: string;
  /** Human-friendly display name (optional, falls back to `name`) */
  displayName?: string;
  /** How the tool is loaded: always available, on demand, or behind a flag */
  loadStrategy?: ToolLoadStrategy;
  /** Risk level for security scoring */
  riskLevel?: RiskLevel;
}

/** Skill definition stored in DB */
export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  isEnabled: boolean;
  prompt: string | null;
  config: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Agent configuration persisted in DB */
export interface AgentConfig {
  id: string;
  agentName: string;
  avatar: string;
  personality: string;
  maxTokens: number;
  temperature: number;
  autoCompact: boolean;
  compactThreshold: number;
  toolConcurrency: number;
  theme: "dark" | "light";
  language: string;
  thinkingEnabled: boolean;
  activeModel: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// §2  Tool System — 44 Tools
// ============================================================

/** How a tool is loaded into the runtime */
export type ToolLoadStrategy = "core" | "lazy" | "flag";

/** Security risk level for tools */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Tool category for UI grouping (backward-compatible — used by ToolsView) */
export type ToolCategory =
  | "file-operations"
  | "search"
  | "web"
  | "generation"
  | "system"
  | "general";

/** Extended tool categories used by the 44-tool Claude Code registry */
export type ClaudeToolCategory =
  | ToolCategory
  | "shell"
  | "editing"
  | "collaboration"
  | "mcp"
  | "lsp"
  | "planning"
  | "worktree"
  | "task"
  | "team"
  | "output"
  | "config"
  | "automation"
  | "experimental";

/**
 * Canonical tool registry entry — describes every tool the agent can use.
 * This is the *source-of-truth* type for the 44-tool system.
 * The DB-facing `ToolDef` is a projection of this.
 */
export interface ToolDefinition {
  /** Unique identifier, e.g. "bash" or "mcp" */
  id: string;
  /** Machine-readable name, e.g. "BashTool" */
  name: string;
  /** Human-friendly display name */
  displayName: string;
  /** Detailed description of what the tool does */
  description: string;
  /** Lucide icon name for UI rendering */
  icon: string;
  /** UI grouping category (extended Claude Code categories) */
  category: ClaudeToolCategory;
  /** Loading strategy */
  loadStrategy: ToolLoadStrategy;
  /** Whether the tool is enabled by default */
  isEnabled: boolean;
  /** Whether the tool only reads data (no side effects) */
  isReadOnly: boolean;
  /** Security risk classification */
  riskLevel: RiskLevel;
}

// ────────────────────────────────────────────
// Core Tools (14) — always loaded
// ────────────────────────────────────────────

export interface BashTool extends ToolDefinition {
  id: "bash";
  name: "BashTool";
  loadStrategy: "core";
}

export interface FileReadTool extends ToolDefinition {
  id: "file-read";
  name: "FileReadTool";
  loadStrategy: "core";
}

export interface FileWriteTool extends ToolDefinition {
  id: "file-write";
  name: "FileWriteTool";
  loadStrategy: "core";
}

export interface FileEditTool extends ToolDefinition {
  id: "file-edit";
  name: "FileEditTool";
  loadStrategy: "core";
}

export interface GlobTool extends ToolDefinition {
  id: "glob";
  name: "GlobTool";
  loadStrategy: "core";
}

export interface GrepTool extends ToolDefinition {
  id: "grep";
  name: "GrepTool";
  loadStrategy: "core";
}

export interface AgentTool extends ToolDefinition {
  id: "agent";
  name: "AgentTool";
  loadStrategy: "core";
}

export interface WebSearchTool extends ToolDefinition {
  id: "web-search";
  name: "WebSearchTool";
  loadStrategy: "core";
}

export interface WebFetchTool extends ToolDefinition {
  id: "web-fetch";
  name: "WebFetchTool";
  loadStrategy: "core";
}

export interface SendMessageTool extends ToolDefinition {
  id: "send-message";
  name: "SendMessageTool";
  loadStrategy: "core";
}

export interface TodoWriteTool extends ToolDefinition {
  id: "todo-write";
  name: "TodoWriteTool";
  loadStrategy: "core";
}

export interface AskUserQuestionTool extends ToolDefinition {
  id: "ask-user";
  name: "AskUserQuestionTool";
  loadStrategy: "core";
}

export interface NotebookEditTool extends ToolDefinition {
  id: "notebook-edit";
  name: "NotebookEditTool";
  loadStrategy: "core";
}

export interface BriefTool extends ToolDefinition {
  id: "brief";
  name: "BriefTool";
  loadStrategy: "core";
}

// ────────────────────────────────────────────
// Lazy-loaded Tools (25) — loaded on demand
// ────────────────────────────────────────────

export interface MCPTool extends ToolDefinition {
  id: "mcp";
  name: "MCPTool";
  loadStrategy: "lazy";
}

export interface LSPTool extends ToolDefinition {
  id: "lsp";
  name: "LSPTool";
  loadStrategy: "lazy";
}

export interface SkillTool extends ToolDefinition {
  id: "skill";
  name: "SkillTool";
  loadStrategy: "lazy";
}

export interface ListMcpResourcesTool extends ToolDefinition {
  id: "list-mcp-resources";
  name: "ListMcpResourcesTool";
  loadStrategy: "lazy";
}

export interface ReadMcpResourceTool extends ToolDefinition {
  id: "read-mcp-resource";
  name: "ReadMcpResourceTool";
  loadStrategy: "lazy";
}

export interface McpAuthTool extends ToolDefinition {
  id: "mcp-auth";
  name: "McpAuthTool";
  loadStrategy: "lazy";
}

export interface ToolSearchTool extends ToolDefinition {
  id: "tool-search";
  name: "ToolSearchTool";
  loadStrategy: "lazy";
}

export interface EnterPlanModeTool extends ToolDefinition {
  id: "enter-plan-mode";
  name: "EnterPlanModeTool";
  loadStrategy: "lazy";
}

export interface ExitPlanModeTool extends ToolDefinition {
  id: "exit-plan-mode";
  name: "ExitPlanModeTool";
  loadStrategy: "lazy";
}

export interface EnterWorktreeTool extends ToolDefinition {
  id: "enter-worktree";
  name: "EnterWorktreeTool";
  loadStrategy: "lazy";
}

export interface ExitWorktreeTool extends ToolDefinition {
  id: "exit-worktree";
  name: "ExitWorktreeTool";
  loadStrategy: "lazy";
}

export interface TaskCreateTool extends ToolDefinition {
  id: "task-create";
  name: "TaskCreateTool";
  loadStrategy: "lazy";
}

export interface TaskGetTool extends ToolDefinition {
  id: "task-get";
  name: "TaskGetTool";
  loadStrategy: "lazy";
}

export interface TaskListTool extends ToolDefinition {
  id: "task-list";
  name: "TaskListTool";
  loadStrategy: "lazy";
}

export interface TaskOutputTool extends ToolDefinition {
  id: "task-output";
  name: "TaskOutputTool";
  loadStrategy: "lazy";
}

export interface TaskStopTool extends ToolDefinition {
  id: "task-stop";
  name: "TaskStopTool";
  loadStrategy: "lazy";
}

export interface TaskUpdateTool extends ToolDefinition {
  id: "task-update";
  name: "TaskUpdateTool";
  loadStrategy: "lazy";
}

export interface TeamCreateTool extends ToolDefinition {
  id: "team-create";
  name: "TeamCreateTool";
  loadStrategy: "lazy";
}

export interface TeamDeleteTool extends ToolDefinition {
  id: "team-delete";
  name: "TeamDeleteTool";
  loadStrategy: "lazy";
}

export interface SyntheticOutputTool extends ToolDefinition {
  id: "synthetic-output";
  name: "SyntheticOutputTool";
  loadStrategy: "lazy";
}

export interface ConfigTool extends ToolDefinition {
  id: "config";
  name: "ConfigTool";
  loadStrategy: "lazy";
}

export interface RemoteTriggerTool extends ToolDefinition {
  id: "remote-trigger";
  name: "RemoteTriggerTool";
  loadStrategy: "lazy";
}

export interface ScheduleCronTool extends ToolDefinition {
  id: "schedule-cron";
  name: "ScheduleCronTool";
  loadStrategy: "lazy";
}

export interface PowerShellTool extends ToolDefinition {
  id: "powershell";
  name: "PowerShellTool";
  loadStrategy: "lazy";
}

// ────────────────────────────────────────────
// Feature-flagged Tools (5) — behind a flag
// ────────────────────────────────────────────

export interface SleepTool extends ToolDefinition {
  id: "sleep";
  name: "SleepTool";
  loadStrategy: "flag";
}

export interface REPLTool extends ToolDefinition {
  id: "repl";
  name: "REPLTool";
  loadStrategy: "flag";
}

export interface VoiceTool extends ToolDefinition {
  id: "voice";
  name: "VoiceTool";
  loadStrategy: "flag";
}

export interface DreamTaskTool extends ToolDefinition {
  id: "dream-task";
  name: "DreamTaskTool";
  loadStrategy: "flag";
}

export interface MagicDocsTool extends ToolDefinition {
  id: "magic-docs";
  name: "MagicDocsTool";
  loadStrategy: "flag";
}

/** Union of all tool types */
export type ClaudeTool =
  | BashTool
  | FileReadTool
  | FileWriteTool
  | FileEditTool
  | GlobTool
  | GrepTool
  | AgentTool
  | WebSearchTool
  | WebFetchTool
  | SendMessageTool
  | TodoWriteTool
  | AskUserQuestionTool
  | NotebookEditTool
  | BriefTool
  | MCPTool
  | LSPTool
  | SkillTool
  | ListMcpResourcesTool
  | ReadMcpResourceTool
  | McpAuthTool
  | ToolSearchTool
  | EnterPlanModeTool
  | ExitPlanModeTool
  | EnterWorktreeTool
  | ExitWorktreeTool
  | TaskCreateTool
  | TaskGetTool
  | TaskListTool
  | TaskOutputTool
  | TaskStopTool
  | TaskUpdateTool
  | TeamCreateTool
  | TeamDeleteTool
  | SyntheticOutputTool
  | ConfigTool
  | RemoteTriggerTool
  | ScheduleCronTool
  | PowerShellTool
  | SleepTool
  | REPLTool
  | VoiceTool
  | DreamTaskTool
  | MagicDocsTool;

// ============================================================
// §3  Skill System
// ============================================================

/** Skill category for UI grouping */
export type SkillCategory =
  | "coding"          // Code development & refactoring
  | "analysis"        // Code analysis & review
  | "generation"      // Content & code generation
  | "debugging"       // Bug fixing & troubleshooting
  | "testing"         // Testing & quality assurance
  | "devops"          // DevOps & deployment
  | "security"        // Security & auditing
  | "data"            // Data processing & AI/ML
  | "communication"   // Documentation & communication
  | "general";        // General utilities

/** A loaded skill with its full prompt and metadata */
export interface LoadedSkill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: SkillCategory;
  isEnabled: boolean;
  /** The system prompt injected when this skill is active */
  prompt: string;
  /** Tools this skill provides access to */
  tools: string[];
  /** Whether this skill was auto-detected from the project */
  isAutoDetected: boolean;
}

// ============================================================
// §4  Running Modes — 10 Modes
// ============================================================

/** All running modes the agent supports */
export type RunningMode =
  | "interactive"   // Default chat mode — user ↔ agent conversation
  | "kairos"        // Proactive autonomous mode — agent acts independently
  | "plan"          // Plan mode — agent creates plans without executing
  | "worktree"      // Git worktree mode — isolated workspace operations
  | "voice"         // Voice mode — speech-to-text / text-to-speech
  | "coordinator"   // Multi-agent coordinator — orchestrates workers
  | "swarm"         // Swarm mode — parallel agent execution
  | "teammate"      // Teammate mode — agent acts as a team member
  | "ultraplan"     // Extended planning — deep multi-step planning
  | "dream";        // Dream mode — background async task processing

/** Configuration for a running mode */
export interface ModeConfig {
  mode: RunningMode;
  label: string;
  description: string;
  icon: string;
  /** Feature flags required for this mode */
  requiredFlags: FeatureFlag[];
  /** Whether this mode allows tool execution */
  allowsExecution: boolean;
  /** Whether this mode supports multi-turn conversation */
  isConversational: boolean;
  /** Whether this mode runs autonomously without user input */
  isAutonomous: boolean;
}

// ============================================================
// §5  Memory System — 4-Layer Architecture
// ============================================================

/** The four layers of the memory system, ordered by persistence */
export type MemoryLayer = "session" | "memdir" | "magic-doc" | "team-sync";

/** In-memory session context — lives for the duration of a conversation */
export interface SessionMemory {
  layer: "session";
  /** System prompt and accumulated context for the current session */
  systemContext: string;
  /** Rolling window of recent messages */
  recentMessages: Message[];
  /** Active tool calls and their results in the current turn */
  activeToolCalls: ToolCall[];
  /** User preferences inferred during this session */
  inferredPreferences: Record<string, unknown>;
}

/** Persistent memdir — CLAUDE.md files and project-level memory */
export interface MemdirMemory {
  layer: "memdir";
  /** Key-value store of project-level facts */
  facts: Map<string, string>;
  /** List of CLAUDE.md file paths loaded */
  claudeMdPaths: string[];
  /** Project conventions and rules extracted from CLAUDE.md */
  conventions: string[];
  /** File-scoped memories keyed by file path */
  fileMemories: Record<string, string>;
}

/** Magic documents — auto-generated documentation and summaries */
export interface MagicDocMemory {
  layer: "magic-doc";
  /** Auto-generated project summaries */
  summaries: MagicDocEntry[];
  /** Architecture decisions log */
  decisions: ArchitectureDecision[];
  /** Frequently accessed context entries */
  hotEntries: MagicDocEntry[];
}

/** A single entry in the Magic Doc memory */
export interface MagicDocEntry {
  id: string;
  title: string;
  content: string;
  /** When this entry was generated */
  generatedAt: string;
  /** Source files that contributed to this entry */
  sources: string[];
  /** Relevance tags for fast lookup */
  tags: string[];
  /** Access count for hot-entry tracking */
  accessCount: number;
}

/** An architecture decision record */
export interface ArchitectureDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  decidedAt: string;
  decidedBy: "agent" | "user" | "team";
}

/** Team sync memory — shared context across agents */
export interface TeamSyncMemory {
  layer: "team-sync";
  /** Shared facts visible to all agents */
  sharedFacts: Map<string, string>;
  /** Per-agent private context */
  agentContexts: Map<string, string>;
  /** Conflict resolution log */
  conflictLog: ConflictEntry[];
  /** Last sync timestamp */
  lastSyncAt: string;
}

/** A conflict between agent contexts */
export interface ConflictEntry {
  id: string;
  agents: string[];
  field: string;
  values: string[];
  resolvedValue: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/** Union of all memory layers */
export type MemoryLayerData =
  | SessionMemory
  | MemdirMemory
  | MagicDocMemory
  | TeamSyncMemory;

// ============================================================
// §6  NVIDIA API Models
// ============================================================

/** Model category for filtering in the model hub */
export type ModelCategory =
  | "chat"           // General chat / instruction-following
  | "reasoning"      // Chain-of-thought / deep reasoning
  | "vision"         // Multi-modal (image + text)
  | "code"           // Code-specific models
  | "embedding"      // Text embedding models
  | "audio"          // Speech / audio models
  | "fast"           // Low-latency lightweight models;

/** An NVIDIA API model available for use */
export interface NvidiaModel {
  /** Unique model identifier, e.g. "nvidia/llama-3.1-405b-instruct" */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Model provider / family */
  provider: string;
  /** Maximum context window in tokens */
  contextLength: number;
  /** Whether the model supports streaming responses */
  supportsStreaming: boolean;
  /** Whether the model supports vision / image inputs */
  supportsVision: boolean;
  /** Whether the model is free to use */
  isFree: boolean;
  /** Model category for filtering */
  category: ModelCategory;
}

// ============================================================
// §7  Multi-Agent System
// ============================================================

/** Role of an agent within a multi-agent session */
export type AgentRole = "leader" | "worker" | "scout";

/** Lifecycle status of an agent */
export type AgentStatus =
  | "initializing"   // Agent is starting up
  | "idle"           // Agent is ready for tasks
  | "working"        // Agent is actively processing a task
  | "waiting"        // Agent is waiting for input / response
  | "blocked"        // Agent is blocked on a dependency
  | "completed"      // Agent has finished its task
  | "failed"         // Agent encountered an error
  | "terminated";    // Agent was stopped

/** A session involving multiple coordinated agents */
export interface AgentSession {
  id: string;
  /** The parent session ID (null for top-level) */
  parentId: string | null;
  /** Human-readable name for this agent session */
  name: string;
  /** Role of the agent in the hierarchy */
  role: AgentRole;
  /** Current lifecycle status */
  status: AgentStatus;
  /** The task or objective assigned to this agent */
  task: string;
  /** IDs of sub-agent sessions spawned by this agent */
  childIds: string[];
  /** Tools available to this agent */
  allowedTools: string[];
  /** Running mode for this agent */
  mode: RunningMode;
  /** Token budget allocated to this agent */
  tokenBudget: number;
  /** Tokens consumed so far */
  tokensUsed: number;
  /** When the agent started */
  startedAt: string;
  /** When the agent completed (null if still running) */
  completedAt: string | null;
  /** Error message if status is 'failed' */
  errorMessage: string | null;
}

/** Message passed between agents */
export interface AgentMessage {
  id: string;
  /** Source agent session ID */
  fromAgentId: string;
  /** Target agent session ID (null for broadcast) */
  toAgentId: string | null;
  /** The message content */
  content: string;
  /** Message type */
  type: "task" | "result" | "question" | "error" | "status" | "cancel";
  /** Timestamp */
  sentAt: string;
}

// ============================================================
// §8  Feature Flags — 16 Flags
// ============================================================

/** All feature flag identifiers */
export type FeatureFlag =
  | "KAIROS"          // Proactive autonomous mode
  | "PROACTIVE"       // Proactive suggestions and actions
  | "VOICE"           // Voice input/output support
  | "COORDINATOR"     // Multi-agent coordination
  | "SWARM"           // Parallel swarm execution
  | "BRIDGE"          // Bridge mode for cross-project work
  | "DREAM"           // Dream mode — background async tasks
  | "MAGIC_DOCS"      // Auto-generated magic documentation
  | "TEAM_SYNC"       // Team memory synchronization
  | "ULTRAPLAN"       // Extended multi-step planning
  | "MCP"             // Model Context Protocol support
  | "LSP"             // Language Server Protocol integration
  | "POWER_SHELL"     // PowerShell command execution
  | "REPL"            // Read-Eval-Print Loop
  | "SLEEP"           // Sleep / delay tool
  | "CRON"            // Scheduled cron jobs;

/** Status of a feature flag */
export interface FeatureFlagStatus {
  flag: FeatureFlag;
  isEnabled: boolean;
  /** Optional description explaining what the flag controls */
  description: string;
  /** Whether the flag is available in the current environment */
  isAvailable: boolean;
  /** Optional — flag is enabled by default */
  isDefault: boolean;
}

// ============================================================
// §9  Security & Permission Types
// ============================================================

/** Log level for security audit events */
export type SecurityLogLevel =
  | "silent"    // No security logging
  | "error"     // Log only errors and violations
  | "warn"      // Log warnings and errors
  | "info"      // Log all permission decisions
  | "debug"     // Verbose logging of all security events
  | "trace";    // Extremely verbose — log every security check

/** Permission decision for a tool or action */
export type PermissionLevel = "allow" | "deny" | "ask";

/** A security rule mapping tools/actions to permission levels */
export interface SecurityRule {
  /** Unique rule identifier */
  id: string;
  /** The tool ID or action this rule applies to (or "*" for all) */
  target: string;
  /** The permission decision */
  permission: PermissionLevel;
  /** Optional condition expression */
  condition?: string;
  /** Human-readable description */
  description: string;
  /** Priority — higher priority rules are evaluated first */
  priority: number;
}

/** A logged security event */
export interface SecurityEvent {
  id: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Log level */
  level: SecurityLogLevel;
  /** Tool or action that triggered the event */
  target: string;
  /** The permission decision made */
  decision: PermissionLevel;
  /** The user or agent that initiated the action */
  actor: string;
  /** Additional context */
  details: string;
}

/** Full security configuration */
export interface SecurityConfig {
  /** Current log level */
  logLevel: SecurityLogLevel;
  /** Ordered list of security rules (evaluated by priority) */
  rules: SecurityRule[];
  /** Whether to enforce rules in autonomous (kairos) mode */
  enforceInAutonomous: boolean;
  /** Whether to allow the agent to request elevated permissions */
  allowPermissionRequests: boolean;
}

// ============================================================
// §10  Token Compression & Budget
// ============================================================

/** Strategy for compressing conversation context */
export type CompressionType =
  | "snip"        // Hard truncate — cut oldest messages
  | "auto"        // AI-powered summarization of old context
  | "responsive"; // Adaptive — summarize based on token pressure

/** Token budget allocation for different parts of the context */
export interface TokenBudget {
  /** Maximum tokens for the entire context window */
  maxTotal: number;
  /** Tokens reserved for the system prompt */
  systemPrompt: number;
  /** Tokens reserved for tool definitions */
  toolDefinitions: number;
  /** Tokens reserved for the user message + response */
  conversation: number;
  /** Tokens reserved for memory context (CLAUDE.md, etc.) */
  memory: number;
  /** Tokens reserved for skill prompts */
  skills: number;
  /** Current tokens used */
  used: number;
}

/** Compression configuration */
export interface CompressionConfig {
  /** Compression strategy */
  type: CompressionType;
  /** Whether auto-compaction is enabled */
  enabled: boolean;
  /** Token threshold that triggers compaction */
  threshold: number;
  /** Target ratio after compaction (e.g. 0.5 = compress to 50%) */
  targetRatio: number;
  /** Whether to preserve the most recent messages as-is */
  preserveRecentCount: number;
}

// ============================================================
// §11  UI Types
// ============================================================

/** All navigable views in the application */
export type ActiveView =
  | "dashboard"         // Overview / welcome page
  | "chat"              // Main chat interface
  | "tools"             // Tool management
  | "skills"            // Skill management
  | "settings"          // Agent configuration
  | "ai-capabilities"   // AI capability toggles
  | "memory"            // Memory system viewer
  | "agents"            // Multi-agent session manager
  | "modes"             // Running mode selector
  | "security"          // Security & permissions dashboard
  | "model-hub"         // NVIDIA model browser / selector
  | "analytics"         // Token usage analytics dashboard
  | "git";              // Git management view

/** A tool invocation within a conversation turn */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Result returned from a tool execution */
export interface ToolResult {
  toolCallId: string;
  output: string;
  isError?: boolean;
}

/** AI capability that can be toggled on/off */
export interface AICapability {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AICapabilityCategory;
  isEnabled: boolean;
  isAvailable: boolean;
}

/** Categories for AI capabilities */
export type AICapabilityCategory =
  | "chat"
  | "vision"
  | "search"
  | "code"
  | "reasoning"
  | "audio"
  | "agent"
  | "memory";

// ============================================================
// §12  Default Data & Constants
// ============================================================

// ────────────────────────────────────────────
// 44-Tool Registry (Claude Code full coverage)
// ────────────────────────────────────────────

export const ALL_CLAUDE_TOOLS: ToolDefinition[] = [
  // ── Core Tools (14) ──────────────────────
  {
    id: "bash",
    name: "BashTool",
    displayName: "Bash / Shell",
    description: "Execute shell commands in a persistent sandboxed environment with timeout control",
    icon: "Terminal",
    category: "shell",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "file-read",
    name: "FileReadTool",
    displayName: "Read File",
    description: "Read file contents from the local filesystem",
    icon: "FileText",
    category: "file-operations",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "file-write",
    name: "FileWriteTool",
    displayName: "Write File",
    description: "Write or create files on the filesystem",
    icon: "FilePlus",
    category: "file-operations",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "file-edit",
    name: "FileEditTool",
    displayName: "Edit File",
    description: "Edit existing files with exact find-and-replace operations",
    icon: "Pencil",
    category: "editing",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "glob",
    name: "GlobTool",
    displayName: "Glob / File Pattern",
    description: "Fast file pattern matching using glob syntax to find files by name",
    icon: "FolderSearch",
    category: "search",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "grep",
    name: "GrepTool",
    displayName: "Grep / Content Search",
    description: "Search file contents with full regex support across the codebase",
    icon: "Search",
    category: "search",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "agent",
    name: "AgentTool",
    displayName: "Sub-Agent",
    description: "Spawn and orchestrate sub-agents for parallel or delegated task execution",
    icon: "Bot",
    category: "system",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "web-search",
    name: "WebSearchTool",
    displayName: "Web Search",
    description: "Search the web for up-to-date information, documentation, and solutions",
    icon: "Globe",
    category: "web",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "web-fetch",
    name: "WebFetchTool",
    displayName: "Web Fetch",
    description: "Fetch and extract content from web pages including metadata",
    icon: "Link",
    category: "web",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "send-message",
    name: "SendMessageTool",
    displayName: "Send Message",
    description: "Send messages to the user or other agents in the conversation",
    icon: "MessageSquare",
    category: "collaboration",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "low",
  },
  {
    id: "todo-write",
    name: "TodoWriteTool",
    displayName: "Todo Write",
    description: "Manage a structured task list with status tracking for complex workflows",
    icon: "ListTodo",
    category: "collaboration",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "low",
  },
  {
    id: "ask-user",
    name: "AskUserQuestionTool",
    displayName: "Ask User",
    description: "Ask the user a question and wait for their response before proceeding",
    icon: "UserQuestion",
    category: "collaboration",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "notebook-edit",
    name: "NotebookEditTool",
    displayName: "Notebook Edit",
    description: "Edit Jupyter notebook (.ipynb) cells with proper cell-level operations",
    icon: "BookOpen",
    category: "editing",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "brief",
    name: "BriefTool",
    displayName: "Brief",
    description: "Generate a concise brief or summary of the current context and task state",
    icon: "FileBarChart",
    category: "system",
    loadStrategy: "core",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },

  // ── Lazy-loaded Tools (25) ───────────────
  {
    id: "mcp",
    name: "MCPTool",
    displayName: "MCP",
    description: "Model Context Protocol — connect to external tool servers via MCP",
    icon: "Plug",
    category: "mcp",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "lsp",
    name: "LSPTool",
    displayName: "LSP",
    description: "Language Server Protocol — code intelligence, diagnostics, and symbol resolution",
    icon: "ScanLine",
    category: "lsp",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "medium",
  },
  {
    id: "skill",
    name: "SkillTool",
    displayName: "Skill",
    description: "Load and execute specialized skill prompts for domain-specific workflows",
    icon: "Sparkles",
    category: "system",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "list-mcp-resources",
    name: "ListMcpResourcesTool",
    displayName: "List MCP Resources",
    description: "List all available resources from connected MCP servers",
    icon: "List",
    category: "mcp",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "read-mcp-resource",
    name: "ReadMcpResourceTool",
    displayName: "Read MCP Resource",
    description: "Read a specific resource from a connected MCP server",
    icon: "FileInput",
    category: "mcp",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "mcp-auth",
    name: "McpAuthTool",
    displayName: "MCP Auth",
    description: "Handle OAuth and authentication flows for MCP servers",
    icon: "Shield",
    category: "mcp",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "tool-search",
    name: "ToolSearchTool",
    displayName: "Tool Search",
    description: "Search across all available tools by name, description, or capability",
    icon: "SearchCode",
    category: "system",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "enter-plan-mode",
    name: "EnterPlanModeTool",
    displayName: "Enter Plan Mode",
    description: "Switch to plan mode where the agent creates plans without executing changes",
    icon: "Plan",
    category: "planning",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "exit-plan-mode",
    name: "ExitPlanModeTool",
    displayName: "Exit Plan Mode",
    description: "Exit plan mode and return to normal execution mode",
    icon: "Play",
    category: "planning",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "enter-worktree",
    name: "EnterWorktreeTool",
    displayName: "Enter Worktree",
    description: "Create and switch to a git worktree for isolated file operations",
    icon: "GitBranch",
    category: "worktree",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "exit-worktree",
    name: "ExitWorktreeTool",
    displayName: "Exit Worktree",
    description: "Leave the current git worktree and return to the main working tree",
    icon: "GitMerge",
    category: "worktree",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "task-create",
    name: "TaskCreateTool",
    displayName: "Create Task",
    description: "Create a new background task for async execution by the agent",
    icon: "PlusCircle",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "task-get",
    name: "TaskGetTool",
    displayName: "Get Task",
    description: "Get the current status and details of a specific background task",
    icon: "ClipboardList",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "task-list",
    name: "TaskListTool",
    displayName: "List Tasks",
    description: "List all background tasks with their status and metadata",
    icon: "ListChecks",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "task-output",
    name: "TaskOutputTool",
    displayName: "Task Output",
    description: "Retrieve the output or result produced by a completed background task",
    icon: "FileOutput",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "task-stop",
    name: "TaskStopTool",
    displayName: "Stop Task",
    description: "Cancel or stop a running background task",
    icon: "CircleStop",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "task-update",
    name: "TaskUpdateTool",
    displayName: "Update Task",
    description: "Update the properties or priority of an existing background task",
    icon: "RefreshCw",
    category: "task",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "low",
  },
  {
    id: "team-create",
    name: "TeamCreateTool",
    displayName: "Create Team",
    description: "Create a new multi-agent team with assigned roles and shared context",
    icon: "Users",
    category: "team",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "team-delete",
    name: "TeamDeleteTool",
    displayName: "Delete Team",
    description: "Disband an existing multi-agent team and clean up shared resources",
    icon: "UserMinus",
    category: "team",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "synthetic-output",
    name: "SyntheticOutputTool",
    displayName: "Synthetic Output",
    description: "Generate synthetic file outputs or structured data for testing",
    icon: "FileCode",
    category: "output",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "config",
    name: "ConfigTool",
    displayName: "Config",
    description: "Read and modify agent configuration, settings, and preferences",
    icon: "Settings",
    category: "config",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "medium",
  },
  {
    id: "remote-trigger",
    name: "RemoteTriggerTool",
    displayName: "Remote Trigger",
    description: "Trigger actions or workflows on remote services and webhooks",
    icon: "Zap",
    category: "automation",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "critical",
  },
  {
    id: "schedule-cron",
    name: "ScheduleCronTool",
    displayName: "Schedule Cron",
    description: "Create and manage scheduled cron jobs for recurring tasks",
    icon: "Clock",
    category: "automation",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "powershell",
    name: "PowerShellTool",
    displayName: "PowerShell",
    description: "Execute PowerShell commands on Windows systems",
    icon: "Monitor",
    category: "shell",
    loadStrategy: "lazy",
    isEnabled: true,
    isReadOnly: false,
    riskLevel: "high",
  },

  // ── Feature-flagged Tools (5) ────────────
  {
    id: "sleep",
    name: "SleepTool",
    displayName: "Sleep",
    description: "Pause execution for a specified duration, useful for rate limiting and timing",
    icon: "Timer",
    category: "system",
    loadStrategy: "flag",
    isEnabled: false,
    isReadOnly: true,
    riskLevel: "low",
  },
  {
    id: "repl",
    name: "REPLTool",
    displayName: "REPL",
    description: "Interactive Read-Eval-Print Loop for live code experimentation",
    icon: "TerminalSquare",
    category: "experimental",
    loadStrategy: "flag",
    isEnabled: false,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "voice",
    name: "VoiceTool",
    displayName: "Voice",
    description: "Speech-to-text input and text-to-speech output for voice interaction",
    icon: "Mic",
    category: "experimental",
    loadStrategy: "flag",
    isEnabled: false,
    isReadOnly: true,
    riskLevel: "medium",
  },
  {
    id: "dream-task",
    name: "DreamTaskTool",
    displayName: "Dream Task",
    description: "Spawn background dream-mode tasks that process asynchronously while the agent continues",
    icon: "Moon",
    category: "experimental",
    loadStrategy: "flag",
    isEnabled: false,
    isReadOnly: false,
    riskLevel: "high",
  },
  {
    id: "magic-docs",
    name: "MagicDocsTool",
    displayName: "Magic Docs",
    description: "Auto-generate and maintain living documentation from code analysis",
    icon: "Wand2",
    category: "experimental",
    loadStrategy: "flag",
    isEnabled: false,
    isReadOnly: false,
    riskLevel: "medium",
  },
];

// ────────────────────────────────────────────
// DEFAULT_TOOLS — kept for backward compatibility
// Maps to the original 12-tool set used by the store & API
// ────────────────────────────────────────────

export const DEFAULT_TOOLS: Omit<ToolDef, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "file-read",
    description: "Read file contents from the filesystem",
    icon: "FileText",
    category: "file-operations",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "file-write",
    description: "Write or create files on the filesystem",
    icon: "FileEdit",
    category: "file-operations",
    isEnabled: true,
    isReadOnly: false,
    config: null,
  },
  {
    name: "directory-list",
    description: "List directory contents and structure",
    icon: "FolderOpen",
    category: "file-operations",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "code-search",
    description: "Search for patterns across codebase files",
    icon: "Search",
    category: "search",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "symbol-search",
    description: "Search for symbols, functions, and classes",
    icon: "ScanSearch",
    category: "search",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "web-search",
    description: "Search the web for information and documentation",
    icon: "Globe",
    category: "web",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "web-read",
    description: "Read and extract content from web pages",
    icon: "Link",
    category: "web",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "image-gen",
    description: "Generate images from text prompts using AI",
    icon: "Image",
    category: "generation",
    isEnabled: true,
    isReadOnly: false,
    config: null,
  },
  {
    name: "code-gen",
    description: "Generate code snippets and implementations",
    icon: "Code",
    category: "generation",
    isEnabled: true,
    isReadOnly: false,
    config: null,
  },
  {
    name: "bash-exec",
    description: "Execute shell commands in a sandboxed environment",
    icon: "Terminal",
    category: "system",
    isEnabled: true,
    isReadOnly: false,
    config: null,
  },
  {
    name: "memory-read",
    description: "Read from agent memory and context",
    icon: "Brain",
    category: "system",
    isEnabled: true,
    isReadOnly: true,
    config: null,
  },
  {
    name: "memory-write",
    description: "Write to agent memory for persistence",
    icon: "Save",
    category: "system",
    isEnabled: true,
    isReadOnly: false,
    config: null,
  },
];

// ────────────────────────────────────────────
// DEFAULT_SKILLS — 70 skills across 10 categories
// ────────────────────────────────────────────

const _now = new Date().toISOString();

export const DEFAULT_SKILLS: SkillDef[] = [
  // ══════════════════════════════════════════
  // CODING (12 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-1",
    name: "code-review",
    description: "Code Review & Quality Analysis — identify bugs, style issues, and improvement opportunities",
    icon: "Code",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-2",
    name: "api-design",
    description: "REST API Design & Best Practices — design clean, scalable, and well-documented APIs",
    icon: "Server",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-3",
    name: "refactoring",
    description: "Code Refactoring Expert — restructure code for readability, maintainability, and performance",
    icon: "RefreshCw",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-4",
    name: "architecture",
    description: "Software Architecture Design — plan and evaluate system architectures for scalability",
    icon: "LayoutGrid",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-5",
    name: "design-patterns",
    description: "Design Patterns Implementation — apply SOLID, GoF, and modern patterns effectively",
    icon: "Layers",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-6",
    name: "frontend-dev",
    description: "Frontend Development Expert — React, Vue, CSS, accessibility, and responsive design",
    icon: "Monitor",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-7",
    name: "backend-dev",
    description: "Backend Development Expert — server-side logic, APIs, auth, and business layer design",
    icon: "Server",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-8",
    name: "database-design",
    description: "Database Schema Design — model relationships, indexes, and constraints for optimal queries",
    icon: "Database",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-9",
    name: "graphql",
    description: "GraphQL API Development — design schemas, resolvers, subscriptions, and best practices",
    icon: "Network",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-10",
    name: "microservices",
    description: "Microservices Architecture — service boundaries, communication patterns, and orchestration",
    icon: "Boxes",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-11",
    name: "performance-opt",
    description: "Performance Optimization — identify and fix bottlenecks in application code and queries",
    icon: "Zap",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-12",
    name: "type-safety",
    description: "TypeScript Type Safety Expert — leverage advanced types, generics, and strict mode effectively",
    icon: "ShieldCheck",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // ANALYSIS (8 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-13",
    name: "code-explain",
    description: "Code Explanation & Comprehension — break down complex code into clear, understandable terms",
    icon: "BookOpen",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-14",
    name: "dependency-audit",
    description: "Dependency Analysis & Updates — review packages for vulnerabilities, outdated versions, and bloat",
    icon: "Package",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-15",
    name: "tech-debt",
    description: "Technical Debt Assessment — quantify and prioritize codebase health improvements",
    icon: "AlertTriangle",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-16",
    name: "architecture-review",
    description: "Architecture Review & Evaluation — assess system design against best practices and scalability needs",
    icon: "Building",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-17",
    name: "complexity-analysis",
    description: "Code Complexity Analysis — measure cyclomatic complexity, cognitive load, and maintainability",
    icon: "GitBranch",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-18",
    name: "api-compatibility",
    description: "API Compatibility Checker — detect breaking changes between API versions and contracts",
    icon: "GitCompare",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-19",
    name: "cost-analysis",
    description: "Cloud Cost Analysis — analyze infrastructure costs and suggest optimization strategies",
    icon: "DollarSign",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-20",
    name: "log-analyzer",
    description: "Log Analysis & Pattern Detection — parse logs to find errors, trends, and anomalies",
    icon: "FileSearch",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // GENERATION (7 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-21",
    name: "code-gen",
    description: "Smart Code Generation — generate production-ready code from specifications and natural language",
    icon: "Wand2",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-22",
    name: "boilerplate",
    description: "Project Boilerplate Generator — scaffold new projects with best-practice configurations",
    icon: "FolderPlus",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-23",
    name: "migration",
    description: "Database Migration Generator — create safe, reversible schema migrations with data transforms",
    icon: "ArrowRightLeft",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-24",
    name: "test-gen",
    description: "Test Case Generator — produce comprehensive test suites covering edge cases and happy paths",
    icon: "TestTube2",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-25",
    name: "doc-gen",
    description: "API Documentation Generator — auto-generate OpenAPI specs, JSDoc, and reference docs",
    icon: "FileText",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-26",
    name: "schema-gen",
    description: "Schema & Model Generator — create TypeScript interfaces, Zod schemas, and ORM models",
    icon: "Table",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-27",
    name: "prompt-engineering",
    description: "Prompt Engineering Expert — craft effective prompts for AI models and LLM integrations",
    icon: "Sparkles",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // DEBUGGING (6 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-28",
    name: "bug-hunter",
    description: "Bug Detection & Diagnosis — systematically identify, reproduce, and classify bugs in code",
    icon: "Bug",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-29",
    name: "error-trace",
    description: "Error Stack Trace Analysis — decode stack traces, pinpoint root causes, and suggest fixes",
    icon: "AlertCircle",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-30",
    name: "memory-debug",
    description: "Memory Leak Detection — identify memory leaks, excessive allocations, and GC pressure",
    icon: "HardDrive",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-31",
    name: "perf-debug",
    description: "Performance Bottleneck Finder — profile and diagnose runtime performance issues",
    icon: "Gauge",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-32",
    name: "crash-analysis",
    description: "Crash Report Analysis — decode crash dumps, minidumps, and panic traces to find root causes",
    icon: "AlertOctagon",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-33",
    name: "hotfix",
    description: "Hotfix & Patch Generator — produce minimal, safe patches for production issues",
    icon: "Wrench",
    category: "debugging",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // TESTING (6 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-34",
    name: "unit-test",
    description: "Unit Testing Expert — write isolated, fast, and reliable unit tests with proper mocks",
    icon: "TestTube",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-35",
    name: "integration-test",
    description: "Integration Testing Strategy — design tests that verify component interactions end-to-end",
    icon: "GitMerge",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-36",
    name: "e2e-test",
    description: "E2E Testing Automation — create browser and API end-to-end tests with Playwright or Cypress",
    icon: "Workflow",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-37",
    name: "tdd",
    description: "Test-Driven Development Coach — guide red-green-refactor cycles with clear test-first steps",
    icon: "Target",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-38",
    name: "coverage",
    description: "Test Coverage Optimization — identify untested paths and maximize meaningful coverage",
    icon: "PieChart",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-39",
    name: "load-test",
    description: "Load Testing & Benchmarking — simulate traffic and measure throughput, latency, and limits",
    icon: "Activity",
    category: "testing",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // DEVOPS (7 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-40",
    name: "ci-cd",
    description: "CI/CD Pipeline Design — build automated build, test, and deployment workflows",
    icon: "GitPullRequest",
    category: "devops",
    isEnabled: true,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-41",
    name: "docker",
    description: "Docker Container Expert — create optimized Dockerfiles, compose files, and multi-stage builds",
    icon: "Container",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-42",
    name: "kubernetes",
    description: "Kubernetes Orchestration — configure deployments, services, ingress, and Helm charts",
    icon: "Network",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-43",
    name: "monitoring",
    description: "System Monitoring & Alerts — set up observability with metrics, logs, and alerting rules",
    icon: "Eye",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-44",
    name: "infra-as-code",
    description: "Infrastructure as Code — define cloud resources with Terraform, Pulumi, or CloudFormation",
    icon: "FileCode",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-45",
    name: "release-mgmt",
    description: "Release Management — versioning strategies, release notes, and deployment coordination",
    icon: "Rocket",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-46",
    name: "env-config",
    description: "Environment Configuration — manage environment variables, feature flags, and config across stages",
    icon: "Settings",
    category: "devops",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // SECURITY (5 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-47",
    name: "security-audit",
    description: "Security Vulnerability Scanner — scan code for XSS, CSRF, SQLi, and other common vulnerabilities",
    icon: "Shield",
    category: "security",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-48",
    name: "auth",
    description: "Authentication & Authorization — implement OAuth, JWT, session management, and RBAC",
    icon: "Lock",
    category: "security",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-49",
    name: "encryption",
    description: "Encryption & Data Protection — apply encryption at rest, in transit, and key management",
    icon: "Key",
    category: "security",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-50",
    name: "owasp",
    description: "OWASP Compliance Checker — verify compliance against OWASP Top 10 and security standards",
    icon: "ShieldAlert",
    category: "security",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-51",
    name: "secret-scan",
    description: "Secrets & Credential Scanner — detect hardcoded API keys, tokens, and passwords in source code",
    icon: "ScanEye",
    category: "security",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // DATA (5 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-52",
    name: "data-pipeline",
    description: "Data Pipeline Design — build reliable ETL and streaming data pipelines",
    icon: "Split",
    category: "data",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-53",
    name: "etl",
    description: "ETL Process Expert — extract, transform, and load data across systems efficiently",
    icon: "ArrowLeftRight",
    category: "data",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-54",
    name: "ml-model",
    description: "ML Model Development — train, evaluate, and deploy machine learning models",
    icon: "Brain",
    category: "data",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-55",
    name: "data-viz",
    description: "Data Visualization Expert — create charts, dashboards, and interactive visualizations",
    icon: "BarChart3",
    category: "data",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-56",
    name: "sql-optimizer",
    description: "SQL Query Optimization — rewrite queries for speed, use proper indexing, and explain plans",
    icon: "Database",
    category: "data",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // COMMUNICATION (6 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-57",
    name: "doc-writer",
    description: "Technical Documentation Writer — produce clear, comprehensive technical docs and guides",
    icon: "PenTool",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-58",
    name: "readme-gen",
    description: "README & Project Docs — create professional README files with badges, examples, and setup guides",
    icon: "FileMarkdown",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-59",
    name: "commit-msg",
    description: "Commit Message Generator — write conventional, descriptive Git commit messages",
    icon: "MessageSquarePlus",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-60",
    name: "changelog",
    description: "Changelog Generator — produce structured changelogs from commit history and PR descriptions",
    icon: "ScrollText",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-61",
    name: "code-comment",
    description: "Code Commenting & Annotations — add meaningful inline comments, JSDoc, and docstrings",
    icon: "MessageCircle",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-62",
    name: "wiki",
    description: "Knowledge Base & Wiki Writer — create and organize team wiki pages and knowledge articles",
    icon: "BookMarked",
    category: "communication",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },

  // ══════════════════════════════════════════
  // GENERAL (8 skills)
  // ══════════════════════════════════════════
  {
    id: "skill-63",
    name: "git-expert",
    description: "Git Workflow Expert — branching strategies, rebasing, conflict resolution, and GitOps",
    icon: "GitBranch",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-64",
    name: "regex",
    description: "Regex Pattern Builder — construct, test, and explain regular expressions for any use case",
    icon: "Regex",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-65",
    name: "cli-tool",
    description: "CLI Tool Development — build command-line tools with argument parsing and rich output",
    icon: "Terminal",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-66",
    name: "monorepo",
    description: "Monorepo Management — configure Turborepo, Nx, or Lerna workspaces and dependencies",
    icon: "FolderTree",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-67",
    name: "localization",
    description: "Internationalization (i18n) — set up multi-language support, locale formatting, and translations",
    icon: "Languages",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-68",
    name: "accessibility",
    description: "Web Accessibility (a11y) — ensure WCAG compliance, screen reader support, and inclusive design",
    icon: "Accessibility",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-69",
    name: "seo",
    description: "SEO Optimization — meta tags, structured data, performance, and search engine best practices",
    icon: "Search",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
  {
    id: "skill-70",
    name: "meeting-notes",
    description: "Meeting Notes & Summarizer — extract action items, decisions, and key points from meeting transcripts",
    icon: "Notebook",
    category: "general",
    isEnabled: false,
    prompt: null,
    config: null,
    createdAt: _now,
    updatedAt: _now,
  },
];

// ────────────────────────────────────────────
// DEFAULT_AI_CAPABILITIES (expanded to 12)
// ────────────────────────────────────────────

export const DEFAULT_AI_CAPABILITIES: AICapability[] = [
  { id: "cap-1", name: "Smart Chat", description: "Advanced conversational AI with context memory", icon: "MessageSquare", category: "chat", isEnabled: true, isAvailable: true },
  { id: "cap-2", name: "Chain-of-Thought", description: "Deep reasoning with step-by-step thinking", icon: "Brain", category: "reasoning", isEnabled: false, isAvailable: true },
  { id: "cap-3", name: "Image Understanding", description: "Analyze screenshots, diagrams, and UI mockups", icon: "Eye", category: "vision", isEnabled: true, isAvailable: true },
  { id: "cap-4", name: "Web Search", description: "Search the web for latest docs and solutions", icon: "Globe", category: "search", isEnabled: true, isAvailable: true },
  { id: "cap-5", name: "Code Review", description: "AI-powered code review and analysis", icon: "GitPullRequest", category: "code", isEnabled: true, isAvailable: true },
  { id: "cap-6", name: "Code Generation", description: "Generate code from natural language", icon: "Code", category: "code", isEnabled: true, isAvailable: true },
  { id: "cap-7", name: "Code Explanation", description: "Explain complex code in simple terms", icon: "BookOpen", category: "code", isEnabled: true, isAvailable: true },
  { id: "cap-8", name: "Bug Detection", description: "Detect bugs and suggest fixes", icon: "Bug", category: "code", isEnabled: true, isAvailable: true },
  { id: "cap-9", name: "Multi-Agent Orchestration", description: "Coordinate multiple AI agents for complex tasks", icon: "Bot", category: "agent", isEnabled: false, isAvailable: true },
  { id: "cap-10", name: "Session Memory", description: "Persistent context across conversation turns", icon: "HardDrive", category: "memory", isEnabled: true, isAvailable: true },
  { id: "cap-11", name: "Voice Interaction", description: "Speech-to-text and text-to-speech support", icon: "Mic", category: "audio", isEnabled: false, isAvailable: false },
  { id: "cap-12", name: "Auto Documentation", description: "Auto-generate living documentation from code", icon: "Wand2", category: "memory", isEnabled: false, isAvailable: true },
];

// ────────────────────────────────────────────
// Mode configurations
// ────────────────────────────────────────────

export const RUNNING_MODE_CONFIGS: ModeConfig[] = [
  {
    mode: "interactive",
    label: "Interactive",
    description: "Standard conversational mode — user and agent take turns",
    icon: "MessageSquare",
    requiredFlags: [],
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "kairos",
    label: "Kairos",
    description: "Proactive autonomous mode — the agent acts independently without waiting for user prompts",
    icon: "Zap",
    requiredFlags: ["KAIROS", "PROACTIVE"],
    allowsExecution: true,
    isConversational: false,
    isAutonomous: true,
  },
  {
    mode: "plan",
    label: "Plan",
    description: "Plan mode — the agent creates detailed plans without executing changes",
    icon: "Plan",
    requiredFlags: [],
    allowsExecution: false,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "worktree",
    label: "Worktree",
    description: "Git worktree mode — isolated workspace for safe experimentation",
    icon: "GitBranch",
    requiredFlags: [],
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "voice",
    label: "Voice",
    description: "Voice mode — interact via speech with STT and TTS",
    icon: "Mic",
    requiredFlags: ["VOICE"],
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "coordinator",
    label: "Coordinator",
    description: "Multi-agent coordinator — orchestrate worker agents for parallel tasks",
    icon: "Users",
    requiredFlags: ["COORDINATOR"],
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "swarm",
    label: "Swarm",
    description: "Swarm mode — spawn many agents for maximum parallelism",
    icon: "Flame",
    requiredFlags: ["SWARM", "COORDINATOR"],
    allowsExecution: true,
    isConversational: false,
    isAutonomous: true,
  },
  {
    mode: "teammate",
    label: "Teammate",
    description: "Teammate mode — agent acts as a collaborative team member",
    icon: "UserCheck",
    requiredFlags: ["TEAM_SYNC"],
    allowsExecution: true,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "ultraplan",
    label: "UltraPlan",
    description: "Extended planning — deep multi-step reasoning with extensive exploration",
    icon: "BrainCircuit",
    requiredFlags: ["ULTRAPLAN"],
    allowsExecution: false,
    isConversational: true,
    isAutonomous: false,
  },
  {
    mode: "dream",
    label: "Dream",
    description: "Dream mode — background async processing while you continue working",
    icon: "Moon",
    requiredFlags: ["DREAM"],
    allowsExecution: true,
    isConversational: false,
    isAutonomous: true,
  },
];

// ────────────────────────────────────────────
// Default Feature Flags
// ────────────────────────────────────────────

export const DEFAULT_FEATURE_FLAGS: FeatureFlagStatus[] = [
  { flag: "KAIROS",          isEnabled: false, description: "Enable proactive autonomous agent mode",                   isAvailable: true, isDefault: false },
  { flag: "PROACTIVE",       isEnabled: false, description: "Allow agent to proactively suggest actions",              isAvailable: true, isDefault: false },
  { flag: "VOICE",           isEnabled: false, description: "Enable voice input/output via STT and TTS",               isAvailable: true, isDefault: false },
  { flag: "COORDINATOR",     isEnabled: false, description: "Enable multi-agent coordination and orchestration",        isAvailable: true, isDefault: false },
  { flag: "SWARM",           isEnabled: false, description: "Enable parallel swarm execution of agents",                isAvailable: true, isDefault: false },
  { flag: "BRIDGE",          isEnabled: false, description: "Enable cross-project bridge mode",                        isAvailable: true, isDefault: false },
  { flag: "DREAM",           isEnabled: false, description: "Enable dream mode for background async tasks",             isAvailable: true, isDefault: false },
  { flag: "MAGIC_DOCS",      isEnabled: false, description: "Enable auto-generated magic documentation",               isAvailable: true, isDefault: false },
  { flag: "TEAM_SYNC",       isEnabled: false, description: "Enable team memory synchronization across agents",        isAvailable: true, isDefault: false },
  { flag: "ULTRAPLAN",       isEnabled: false, description: "Enable extended multi-step deep planning mode",           isAvailable: true, isDefault: false },
  { flag: "MCP",             isEnabled: true,  description: "Model Context Protocol — connect external tool servers",   isAvailable: true, isDefault: true },
  { flag: "LSP",             isEnabled: false, description: "Language Server Protocol — code intelligence integration", isAvailable: true, isDefault: false },
  { flag: "POWER_SHELL",     isEnabled: true,  description: "PowerShell command execution on Windows",                 isAvailable: true, isDefault: true },
  { flag: "REPL",            isEnabled: false, description: "Read-Eval-Print Loop for live code experiments",          isAvailable: true, isDefault: false },
  { flag: "SLEEP",           isEnabled: false, description: "Sleep / delay tool for rate limiting and timing",         isAvailable: true, isDefault: false },
  { flag: "CRON",            isEnabled: false, description: "Scheduled cron jobs for recurring automated tasks",       isAvailable: true, isDefault: false },
];

// ────────────────────────────────────────────
// Default NVIDIA Models
// ────────────────────────────────────────────

export const DEFAULT_NVIDIA_MODELS: NvidiaModel[] = [
  {
    id: "nvidia/llama-3.1-405b-instruct",
    name: "Llama 3.1 405B Instruct",
    provider: "nvidia",
    contextLength: 128000,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "chat",
  },
  {
    id: "nvidia/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B Instruct",
    provider: "nvidia",
    contextLength: 128000,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "chat",
  },
  {
    id: "nvidia/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct",
    provider: "nvidia",
    contextLength: 128000,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "fast",
  },
  {
    id: "nvidia/deepseek-r1",
    name: "DeepSeek R1",
    provider: "nvidia",
    contextLength: 131072,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "reasoning",
  },
  {
    id: "nvidia/nemotron-4-340b-instruct",
    name: "Nemotron 4 340B Instruct",
    provider: "nvidia",
    contextLength: 4096,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "chat",
  },
  {
    id: "nvidia/codellama-70b-instruct",
    name: "CodeLlama 70B Instruct",
    provider: "nvidia",
    contextLength: 16384,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "code",
  },
  {
    id: "nvidia/neva-22b",
    name: "NEVA 22B",
    provider: "nvidia",
    contextLength: 128000,
    supportsStreaming: true,
    supportsVision: true,
    isFree: true,
    category: "vision",
  },
  {
    id: "nvidia/parakeet-ctc-1.1b-asr",
    name: "Parakeet CTC 1.1B ASR",
    provider: "nvidia",
    contextLength: 0,
    supportsStreaming: true,
    supportsVision: false,
    isFree: true,
    category: "audio",
  },
];

// ────────────────────────────────────────────
// Default Security Config
// ────────────────────────────────────────────

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  logLevel: "info",
  rules: [
    {
      id: "rule-allow-read",
      target: "*",
      permission: "ask",
      condition: 'tool.isReadOnly === true',
      description: "Ask permission for all read-only tools",
      priority: 100,
    },
    {
      id: "rule-allow-search",
      target: "grep",
      permission: "allow",
      description: "Always allow grep/search operations",
      priority: 50,
    },
    {
      id: "rule-allow-glob",
      target: "glob",
      permission: "allow",
      description: "Always allow glob file pattern matching",
      priority: 50,
    },
    {
      id: "rule-ask-write",
      target: "file-write",
      permission: "ask",
      description: "Ask before writing files",
      priority: 75,
    },
    {
      id: "rule-ask-bash",
      target: "bash",
      permission: "ask",
      description: "Ask before executing shell commands",
      priority: 80,
    },
  ],
  enforceInAutonomous: true,
  allowPermissionRequests: true,
};

// ────────────────────────────────────────────
// Default Token Budget
// ────────────────────────────────────────────

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  maxTotal: 200000,
  systemPrompt: 8000,
  toolDefinitions: 16000,
  conversation: 140000,
  memory: 16000,
  skills: 8000,
  used: 0,
};

// ────────────────────────────────────────────
// Default Compression Config
// ────────────────────────────────────────────

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  type: "auto",
  enabled: true,
  threshold: 150000,
  targetRatio: 0.5,
  preserveRecentCount: 10,
};

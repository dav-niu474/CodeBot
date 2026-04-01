// ============================================================
// CodeBot Agent - TypeScript Types (matches Prisma schema)
// ============================================================

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
}

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
}

export type ToolCategory =
  | "file-operations"
  | "search"
  | "web"
  | "generation"
  | "system"
  | "general";

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

export type SkillCategory =
  | "coding"
  | "analysis"
  | "generation"
  | "communication"
  | "general";

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

// UI-specific types
export type ActiveView =
  | "dashboard"
  | "chat"
  | "tools"
  | "skills"
  | "settings"
  | "ai-capabilities";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError?: boolean;
}

// AI Capability types
export interface AICapability {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'chat' | 'vision' | 'search' | 'code' | 'reasoning';
  isEnabled: boolean;
  isAvailable: boolean;
}

export const DEFAULT_AI_CAPABILITIES: AICapability[] = [
  { id: 'cap-1', name: 'Smart Chat', description: 'Advanced conversational AI with context memory', icon: 'MessageSquare', category: 'chat', isEnabled: true, isAvailable: true },
  { id: 'cap-2', name: 'Chain-of-Thought', description: 'Deep reasoning with step-by-step thinking', icon: 'Brain', category: 'reasoning', isEnabled: false, isAvailable: true },
  { id: 'cap-3', name: 'Image Understanding', description: 'Analyze screenshots, diagrams, and UI mockups', icon: 'Eye', category: 'vision', isEnabled: true, isAvailable: true },
  { id: 'cap-4', name: 'Web Search', description: 'Search the web for latest docs and solutions', icon: 'Globe', category: 'search', isEnabled: true, isAvailable: true },
  { id: 'cap-5', name: 'Code Review', description: 'AI-powered code review and analysis', icon: 'GitPullRequest', category: 'code', isEnabled: true, isAvailable: true },
  { id: 'cap-6', name: 'Code Generation', description: 'Generate code from natural language', icon: 'Code', category: 'code', isEnabled: true, isAvailable: true },
  { id: 'cap-7', name: 'Code Explanation', description: 'Explain complex code in simple terms', icon: 'BookOpen', category: 'code', isEnabled: true, isAvailable: true },
  { id: 'cap-8', name: 'Bug Detection', description: 'Detect bugs and suggest fixes', icon: 'Bug', category: 'code', isEnabled: true, isAvailable: true },
];

// Default data for initial state
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

export const DEFAULT_SKILLS: Omit<SkillDef, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "fullstack-dev",
    description: "Full-stack web development with Next.js, React, and TypeScript",
    icon: "LayoutGrid",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "api-design",
    description: "REST API and GraphQL schema design",
    icon: "Server",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "database",
    description: "Database schema design, migrations, and query optimization",
    icon: "Database",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "code-review",
    description: "Analyze code for quality, bugs, and best practices",
    icon: "GitPullRequest",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "debugging",
    description: "Systematic debugging and issue resolution",
    icon: "Bug",
    category: "analysis",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "documentation",
    description: "Generate comprehensive documentation and comments",
    icon: "FileText",
    category: "generation",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "testing",
    description: "Write unit, integration, and e2e tests",
    icon: "TestTube",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
  },
  {
    name: "devops",
    description: "CI/CD pipelines, Docker, and deployment configurations",
    icon: "Container",
    category: "coding",
    isEnabled: true,
    prompt: null,
    config: null,
  },
];

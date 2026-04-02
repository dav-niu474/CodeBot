import { create } from "zustand";
import type {
  Session,
  Message,
  ActiveView,
  ToolDef,
  SkillDef,
  AgentConfig,
  AICapability,
  RunningMode,
  NvidiaModel,
  FeatureFlag,
  AgentSession,
  MagicDocEntry,
} from "@/lib/types";
import {
  DEFAULT_TOOLS,
  DEFAULT_SKILLS,
  DEFAULT_AI_CAPABILITIES,
} from "@/lib/types";

// ────────────────────────────────────────────
// Type alias for store usage
// ────────────────────────────────────────────
type NvidiaModelInfo = NvidiaModel;
type Memory = MagicDocEntry;

// ────────────────────────────────────────────
// Default Feature Flags
// ────────────────────────────────────────────
const defaultFeatureFlags: Record<FeatureFlag, boolean> = {
  KAIROS: true,
  PROACTIVE: true,
  VOICE: true,
  COORDINATOR: true,
  SWARM: true,
  BRIDGE: true,
  DREAM: true,
  MAGIC_DOCS: true,
  TEAM_SYNC: true,
  ULTRAPLAN: true,
  MCP: true,
  LSP: true,
  POWER_SHELL: false,
  REPL: false,
  SLEEP: false,
  CRON: true,
};

interface ChatStore {
  // ── Existing State ──────────────────────────
  activeSessionId: string | null;
  sessions: Session[];
  messages: Message[];
  isLoading: boolean;
  activeView: ActiveView;
  tools: ToolDef[];
  skills: SkillDef[];
  agentConfig: AgentConfig;
  sidebarOpen: boolean; // for mobile
  aiCapabilities: AICapability[];
  streamingMessageId: string | null;

  // ── New State ───────────────────────────────
  activeMode: RunningMode;
  models: NvidiaModelInfo[];
  selectedModel: string;
  featureFlags: Record<FeatureFlag, boolean>;
  memories: Memory[];
  agentSessions: AgentSession[];

  // ── Session actions ────────────────────────
  setActiveSession: (id: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  deleteSession: (id: string) => void;

  // ── Message actions ────────────────────────
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // ── Loading ────────────────────────────────
  setLoading: (loading: boolean) => void;

  // ── View ───────────────────────────────────
  setActiveView: (view: ActiveView) => void;

  // ── Tools ──────────────────────────────────
  setTools: (tools: ToolDef[]) => void;
  toggleTool: (id: string) => void;

  // ── Skills ─────────────────────────────────
  setSkills: (skills: SkillDef[]) => void;
  toggleSkill: (id: string) => void;

  // ── Agent Config ───────────────────────────
  setAgentConfig: (config: Partial<AgentConfig>) => void;

  // ── Sidebar ────────────────────────────────
  setSidebarOpen: (open: boolean) => void;

  // ── AI Capabilities ────────────────────────
  setAICapabilities: (caps: AICapability[]) => void;
  toggleAICapability: (id: string) => void;

  // ── Streaming ──────────────────────────────
  setStreamingMessageId: (id: string | null) => void;

  // ── New Actions ────────────────────────────
  setActiveMode: (mode: RunningMode) => void;
  setModels: (models: NvidiaModelInfo[]) => void;
  setSelectedModel: (modelId: string) => void;
  toggleFeatureFlag: (flag: FeatureFlag) => void;
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Memory) => void;
  setAgentSessions: (sessions: AgentSession[]) => void;
}

const defaultAgentConfig: AgentConfig = {
  id: "default",
  agentName: "CodeBot",
  avatar: "🤖",
  personality: "helpful",
  maxTokens: 4096,
  temperature: 0.7,
  autoCompact: true,
  compactThreshold: 100000,
  toolConcurrency: 5,
  theme: "dark",
  language: "zh-CN",
  thinkingEnabled: false,
  activeModel: "default",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // ── Initial State ──────────────────────────
  activeSessionId: null,
  sessions: [],
  messages: [],
  isLoading: false,
  activeView: "dashboard",
  tools: DEFAULT_TOOLS.map((t, i) => ({
    ...t,
    id: `tool-${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  skills: DEFAULT_SKILLS.map((s, i) => ({
    ...s,
    id: `skill-${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  agentConfig: defaultAgentConfig,
  sidebarOpen: false,
  aiCapabilities: [...DEFAULT_AI_CAPABILITIES],
  streamingMessageId: null,

  // ── New State Defaults ─────────────────────
  activeMode: "interactive" as RunningMode,
  models: [] as NvidiaModelInfo[],
  selectedModel: "meta/llama-3.3-70b-instruct",
  featureFlags: { ...defaultFeatureFlags },
  memories: [] as Memory[],
  agentSessions: [] as AgentSession[],

  // ── Session actions ────────────────────────
  setActiveSession: (id) =>
    set({
      activeSessionId: id,
      activeView: id ? "chat" : get().activeView,
      messages: [],
    }),

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      activeView: "chat",
      messages: [],
    })),

  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  deleteSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
      messages: state.activeSessionId === id ? [] : state.messages,
      activeView: state.activeSessionId === id ? "dashboard" : state.activeView,
    })),

  // ── Message actions ────────────────────────
  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  clearMessages: () => set({ messages: [] }),

  // ── Loading ────────────────────────────────
  setLoading: (loading) => set({ isLoading: loading }),

  // ── View ───────────────────────────────────
  setActiveView: (view) => set({ activeView: view }),

  // ── Tools ──────────────────────────────────
  setTools: (tools) => set({ tools }),
  toggleTool: (id) =>
    set((state) => ({
      tools: state.tools.map((t) =>
        t.id === id ? { ...t, isEnabled: !t.isEnabled } : t
      ),
    })),

  // ── Skills ─────────────────────────────────
  setSkills: (skills) => set({ skills }),
  toggleSkill: (id) =>
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
      ),
    })),

  // ── Agent Config ───────────────────────────
  setAgentConfig: (config) =>
    set((state) => ({
      agentConfig: {
        ...state.agentConfig,
        ...config,
        updatedAt: new Date().toISOString(),
      },
    })),

  // ── Sidebar ────────────────────────────────
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // ── AI Capabilities ────────────────────────
  setAICapabilities: (caps) => set({ aiCapabilities: caps }),
  toggleAICapability: (id) =>
    set((state) => ({
      aiCapabilities: state.aiCapabilities.map((cap) =>
        cap.id === id ? { ...cap, isEnabled: !cap.isEnabled } : cap
      ),
    })),

  // ── Streaming ──────────────────────────────
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),

  // ── New Actions ────────────────────────────
  setActiveMode: (mode) => set({ activeMode: mode }),

  setModels: (models) => set({ models: models as NvidiaModelInfo[] }),

  setSelectedModel: (modelId) => set({ selectedModel: modelId }),

  toggleFeatureFlag: (flag) =>
    set((state) => ({
      featureFlags: {
        ...state.featureFlags,
        [flag]: !state.featureFlags[flag],
      },
    })),

  setMemories: (memories) => set({ memories: memories as Memory[] }),

  addMemory: (memory) =>
    set((state) => ({
      memories: [...state.memories, memory as Memory],
    })),

  setAgentSessions: (sessions) => set({ agentSessions: sessions }),
}));

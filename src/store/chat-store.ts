import { create } from "zustand";
import type { Session, Message, ActiveView, ToolDef, SkillDef, AgentConfig, AICapability } from "@/lib/types";
import { DEFAULT_TOOLS, DEFAULT_SKILLS, DEFAULT_AI_CAPABILITIES } from "@/lib/types";

interface ChatStore {
  // State
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

  // Session actions
  setActiveSession: (id: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  deleteSession: (id: string) => void;

  // Message actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // View
  setActiveView: (view: ActiveView) => void;

  // Tools
  setTools: (tools: ToolDef[]) => void;
  toggleTool: (id: string) => void;

  // Skills
  setSkills: (skills: SkillDef[]) => void;
  toggleSkill: (id: string) => void;

  // Agent Config
  setAgentConfig: (config: Partial<AgentConfig>) => void;

  // Sidebar
  setSidebarOpen: (open: boolean) => void;

  // AI Capabilities
  setAICapabilities: (caps: AICapability[]) => void;
  toggleAICapability: (id: string) => void;

  // Streaming
  setStreamingMessageId: (id: string | null) => void;
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
  // Initial state
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

  // Session actions
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

  // Message actions
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

  // Loading
  setLoading: (loading) => set({ isLoading: loading }),

  // View
  setActiveView: (view) => set({ activeView: view }),

  // Tools
  setTools: (tools) => set({ tools }),
  toggleTool: (id) =>
    set((state) => ({
      tools: state.tools.map((t) =>
        t.id === id ? { ...t, isEnabled: !t.isEnabled } : t
      ),
    })),

  // Skills
  setSkills: (skills) => set({ skills }),
  toggleSkill: (id) =>
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
      ),
    })),

  // Agent Config
  setAgentConfig: (config) =>
    set((state) => ({
      agentConfig: { ...state.agentConfig, ...config, updatedAt: new Date().toISOString() },
    })),

  // Sidebar
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // AI Capabilities
  setAICapabilities: (caps) => set({ aiCapabilities: caps }),
  toggleAICapability: (id) =>
    set((state) => ({
      aiCapabilities: state.aiCapabilities.map((cap) =>
        cap.id === id ? { ...cap, isEnabled: !cap.isEnabled } : cap
      ),
    })),

  // Streaming
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
}));

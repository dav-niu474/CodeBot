'use client';

import { cn } from '@/lib/utils';
import type { Message, Session } from '@/lib/types';
import { useChatStore } from '@/store/chat-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageBubble, MessageListLoading, WelcomeState } from './MessageBubble';
import { PlanPanel } from './PlanPanel';
import { ChatToolbar } from './ChatToolbar';
import { AgentProgressPanel } from './AgentProgressPanel';
import {
  SendHorizontal,
  Square,
  Zap,
  Brain,
  ImagePlus,
  X,
  Download,
  Mic,
  Volume2,
  VolumeX,
  History,
  Plus,
  Trash2,
  LayoutTemplate,
  Search,
  GitPullRequest,
  BookOpen,
  Bug,
  RefreshCw,
  FlaskConical,
  FileText,
  Globe,
  Database,
  Table,
  Hash,
  Layers,
  ArrowLeftRight,
  Loader2,
  Info,
  Users,
  Network,
  UserCheck,
  ChevronDown,
  Minus,
  PlusCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { translations } from '@/lib/i18n/translations';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ────────────────────────────────────────────
// Template Library Data
// ────────────────────────────────────────────

interface TemplateItem {
  id: string;
  icon: LucideIcon;
  label: string;
  prompt: string;
  category: string;
  color: string;
}

const TEMPLATES: TemplateItem[] = [
  { id: 'code-review', icon: GitPullRequest, label: 'Code Review', prompt: 'Review the following code for bugs, performance issues, and best practices. Provide specific suggestions:\n\n', category: 'review', color: 'emerald' },
  { id: 'explain', icon: BookOpen, label: 'Explain Code', prompt: 'Explain this code step by step in simple terms:\n\n', category: 'learning', color: 'sky' },
  { id: 'debug', icon: Bug, label: 'Debug Issue', prompt: 'Help me debug this error. Here\'s the error message:\n\n', category: 'debug', color: 'red' },
  { id: 'refactor', icon: RefreshCw, label: 'Refactor Code', prompt: 'Refactor this code to improve readability, performance, and maintainability:\n\n', category: 'optimize', color: 'amber' },
  { id: 'test', icon: FlaskConical, label: 'Write Tests', prompt: 'Write comprehensive unit tests for this code using a testing framework:\n\n', category: 'testing', color: 'cyan' },
  { id: 'doc', icon: FileText, label: 'Generate Docs', prompt: 'Generate documentation for this code (JSDoc / TSDoc format):\n\n', category: 'docs', color: 'purple' },
  { id: 'api', icon: Globe, label: 'REST API', prompt: 'Design and implement a REST API for the following requirements:\n\n', category: 'api', color: 'orange' },
  { id: 'db', icon: Database, label: 'DB Schema', prompt: 'Design a database schema for the following requirements (include tables, columns, relationships, indexes):\n\n', category: 'database', color: 'pink' },
  { id: 'sql', icon: Table, label: 'SQL Query', prompt: 'Write an optimized SQL query for:\n\n', category: 'database', color: 'teal' },
  { id: 'regex', icon: Hash, label: 'Regex Pattern', prompt: 'Create a regular expression for:\n\n', category: 'utility', color: 'lime' },
  { id: 'arch', icon: Layers, label: 'System Design', prompt: 'Design a system architecture for:\n\n', category: 'architecture', color: 'indigo' },
  { id: 'convert', icon: ArrowLeftRight, label: 'Code Convert', prompt: 'Convert this code to a different language/framework:\n\n', category: 'utility', color: 'fuchsia' },
];

const templateColorMap: Record<string, string> = {
  emerald: 'text-emerald-400 hover:bg-emerald-500/10',
  sky: 'text-sky-400 hover:bg-sky-500/10',
  red: 'text-red-400 hover:bg-red-500/10',
  amber: 'text-amber-400 hover:bg-amber-500/10',
  cyan: 'text-cyan-400 hover:bg-cyan-500/10',
  purple: 'text-purple-400 hover:bg-purple-500/10',
  orange: 'text-orange-400 hover:bg-orange-500/10',
  pink: 'text-pink-400 hover:bg-pink-500/10',
  teal: 'text-teal-400 hover:bg-teal-500/10',
  lime: 'text-lime-400 hover:bg-lime-500/10',
  indigo: 'text-indigo-400 hover:bg-indigo-500/10',
  fuchsia: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
};

// ────────────────────────────────────────────
// Agentic Loop Status Types
// ────────────────────────────────────────────

type AgenticPhase = 'idle' | 'thinking' | 'executing_tools' | 'generating' | 'compressing';

// ────────────────────────────────────────────
// Multi-Agent Status Types
// ────────────────────────────────────────────

type MultiAgentMode = 'coordinator' | 'swarm' | 'teammate';

interface MultiAgentAgentInfo {
  id: string;
  name: string;
  status: 'spawning' | 'thinking' | 'executing' | 'done' | 'failed';
  tokens?: { input: number; output: number };
  result?: string;
  error?: string;
}

interface MultiAgentState {
  phase: 'idle' | 'spawning' | 'executing' | 'aggregating' | 'done';
  mode: MultiAgentMode | null;
  agents: MultiAgentAgentInfo[];
  totalAgents: number;
  completedAgents: number;
  totalTokens: number;
  configOpen: boolean;
  workerCount: number;
}

const defaultMultiAgentState: MultiAgentState = {
  phase: 'idle',
  mode: null,
  agents: [],
  totalAgents: 0,
  completedAgents: 0,
  totalTokens: 0,
  configOpen: false,
  workerCount: 3,
};

interface AgenticStatus {
  phase: AgenticPhase;
  detail?: string;
  toolName?: string;
  loopIteration?: number;
}

const phaseConfig: Record<AgenticPhase, { icon: string; label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  idle: { icon: '', label: '', colorClass: '', bgClass: '', borderClass: '' },
  thinking: {
    icon: '🧠',
    label: 'Thinking...',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/5',
    borderClass: 'border-amber-500/20',
  },
  executing_tools: {
    icon: '🔧',
    label: 'Executing tool',
    colorClass: 'text-sky-400',
    bgClass: 'bg-sky-500/5',
    borderClass: 'border-sky-500/20',
  },
  generating: {
    icon: '✍️',
    label: 'Generating response...',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/5',
    borderClass: 'border-emerald-500/20',
  },
  compressing: {
    icon: '📦',
    label: 'Compressing context...',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/5',
    borderClass: 'border-purple-500/20',
  },
};

// ────────────────────────────────────────────
// Helper: Create a new session via API
// ────────────────────────────────────────────

async function createSessionAPI(
  model: string,
  title?: string
): Promise<Session | null> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'New Chat',
        model,
      }),
    });
    const data = await res.json();
    if (data.error) return null;
    return {
      id: data.id,
      title: data.title,
      model: data.model,
      systemPrompt: data.systemPrompt,
      isActive: data.isActive,
      tokenCount: 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as Session;
  } catch {
    return null;
  }
}

export function ChatView() {
  const {
    activeSessionId,
    sessions,
    messages,
    isLoading,
    setLoading,
    addMessage,
    updateMessage,
    addSession,
    setActiveSession,
    deleteSession,
    updateSession,
    setSessions,
    setMessagesForSession,
    messagesMap,
    agentConfig,
    setAgentConfig,
    streamingMessageId,
    setStreamingMessageId,
    selectedModel,
    activeMode,
    featureFlags,
    isRecording,
    setIsRecording,
    ttsVoice,
    ttsSpeed,
    isPlayingTTS,
    setIsPlayingTTS,
  } = useChatStore();

  // ── i18n ──────────────────────────────────
  const locale = (typeof window !== 'undefined' ? document.documentElement.lang || 'en' : 'en') as 'en' | 'zh';
  const t = translations[locale] || translations.en;

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  // Session panel enhancement states
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [agenticStatus, setAgenticStatus] = useState<AgenticStatus>({ phase: 'idle' });
  const [streamingCharsPerSec, setStreamingCharsPerSec] = useState<number | null>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [multiAgent, setMultiAgent] = useState<MultiAgentState>(defaultMultiAgentState);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // ── Load sessions from DB on mount ─────────
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const loadedSessions: Session[] = data.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            title: s.title as string,
            model: (s.model as string) || 'default',
            systemPrompt: (s.systemPrompt as string) || null,
            isActive: (s.isActive as boolean) ?? true,
            tokenCount: (s.tokenCount as number) || 0,
            createdAt: (s.createdAt as string) || new Date().toISOString(),
            updatedAt: (s.updatedAt as string) || new Date().toISOString(),
          }));
          setSessions(loadedSessions);
        }
      } catch {
        // silently fail — offline or DB not available
      } finally {
        setSessionsLoaded(true);
      }
    }
    loadSessions();
  }, [setSessions]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingMessageId]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [input]);

  // Listen for quick actions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setInput(detail);
      textareaRef.current?.focus();
    };
    window.addEventListener('quick-action', handler);
    return () => window.removeEventListener('quick-action', handler);
  }, []);

  // Listen for bridge-to-chat handoff
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setInput(detail);
      textareaRef.current?.focus();
      toast.success('Message forwarded to chat');
    };
    window.addEventListener('bridge-to-chat', handler);
    return () => window.removeEventListener('bridge-to-chat', handler);
  }, []);

  // Cleanup streaming speed on unmount
  useEffect(() => {
    return () => {
      setStreamingCharsPerSec(null);
    };
  }, []);

  const sendToAPI = useCallback(
    async (userMessage: string, sessionId: string) => {
      setLoading(true);

      // Create placeholder assistant message for streaming
      const streamMsgId = `msg-stream-${Date.now()}`;
      const streamMsg: Message = {
        id: streamMsgId,
        sessionId,
        role: 'assistant',
        content: '',
        toolCalls: null,
        toolCallsDisplay: null,
        toolResults: null,
        tokens: 0,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(streamMsg);
      setStreamingMessageId(streamMsgId);

      // Reset agentic status
      setAgenticStatus({ phase: 'idle' });
      setStreamingCharsPerSec(null);

      // Track V3 tool call displays
      const toolCallDisplays: Array<{
        toolCallId: string;
        toolName: string;
        arguments: string;
        riskLevel?: string;
        status: string;
        result?: string;
        duration?: number;
        startedAt?: string;
        completedAt?: string;
      }> = [];

      // ── AbortController ─────────────────
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Streaming speed tracking
      let lastContentLength = 0;
      let lastSpeedTime = Date.now();
      const speedInterval = setInterval(() => {
        const now = Date.now();
        const currentMsg = useChatStore.getState().messages.find(m => m.id === streamMsgId);
        const currentLength = currentMsg?.content?.length || 0;
        const elapsed = (now - lastSpeedTime) / 1000;
        if (elapsed > 0.5) {
          const charsPerSec = Math.round((currentLength - lastContentLength) / elapsed);
          if (charsPerSec > 0 && currentLength > 0) {
            setStreamingCharsPerSec(charsPerSec);
          }
          lastContentLength = currentLength;
          lastSpeedTime = now;
        }
      }, 600);

      // Helper to update toolCallsDisplay on the message
      const syncToolDisplays = () => {
        updateMessage(streamMsgId, {
          toolCallsDisplay: toolCallDisplays.length > 0
            ? JSON.stringify(toolCallDisplays)
            : null,
        });
      };

      // Fetch relevant memories for context injection
      let relevantMemories: string[] = [];
      try {
        const memRes = await fetch('/api/memory?layer=session&limit=5');
        const memData = await memRes.json();
        if (memData.success && Array.isArray(memData.memories)) {
          relevantMemories = memData.memories
            .filter((m: Record<string, unknown>) => m.content)
            .map((m: Record<string, unknown>) => m.content as string)
            .slice(0, 5);
        }
      } catch {
        // silently fail — memory system may not be available
      }

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: userMessage,
            model: selectedModel || agentConfig.activeModel,
            thinkingEnabled: agentConfig.thinkingEnabled,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens,
            memories: relevantMemories,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Request failed');
        }

        let fullContent = '';
        let fullThinking = '';
        let firstContentReceived = false;

        // Check if response is NOT SSE format
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream') && !contentType.includes('application/octet-stream')) {
          const text = await res.text();
          fullContent = text;
          updateMessage(streamMsgId, { content: fullContent, isStreaming: false, tokens: Math.floor(text.length / 4) });
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.startsWith('data: ')) {
                const payload = trimmed.slice(6);
                if (payload === '[DONE]') continue;

                try {
                  const data = JSON.parse(payload);
                  if (data.error) {
                    throw new Error(data.error);
                  }

                  // ── V3 Protocol Events ────────────────────

                  // Loop iteration indicator
                  if (data.type === 'loop_iteration') {
                    setAgenticStatus({
                      phase: 'thinking',
                      detail: 'Analyzing...',
                      loopIteration: data.iteration,
                    });
                    continue;
                  }

                  // Tool call start — show executing state
                  if (data.type === 'tool_call_start') {
                    setAgenticStatus({
                      phase: 'executing_tools',
                      detail: 'Executing tool...',
                      toolName: data.toolName,
                    });
                    const newTc = {
                      toolCallId: data.toolCallId,
                      toolName: data.toolName,
                      arguments: data.arguments,
                      riskLevel: data.riskLevel || 'low',
                      status: 'executing' as const,
                      startedAt: new Date().toISOString(),
                    };
                    toolCallDisplays.push(newTc);
                    syncToolDisplays();
                    continue;
                  }

                  // Tool call progress — update status text
                  if (data.type === 'tool_call_progress') {
                    continue;
                  }

                  // Tool call result — show completed/error state
                  if (data.type === 'tool_call_result') {
                    const tc = toolCallDisplays.find(
                      (t) => t.toolCallId === data.toolCallId
                    );
                    if (tc) {
                      tc.status = data.status === 'error' ? 'error' : 'success';
                      tc.result = data.result;
                      tc.duration = data.duration;
                      tc.completedAt = new Date().toISOString();
                    }
                    syncToolDisplays();
                    // Keep in executing_tools phase if more tools may come
                    continue;
                  }

                  // ── Legacy / V2 Protocol Events ────────────
                  // Handle reasoning/thinking content from reasoning models
                  if (data.reasoning) {
                    fullThinking += data.reasoning;
                    updateMessage(streamMsgId, { thinkingContent: fullThinking });
                    if (!firstContentReceived) {
                      setAgenticStatus({ phase: 'thinking', detail: 'Reasoning...' });
                    }
                  }
                  // Handle legacy tool_calls (V2 format)
                  if (data.tool_calls) {
                    const currentMsg = useChatStore.getState().messages.find(m => m.id === streamMsgId);
                    const existingCalls = currentMsg?.toolCalls;
                    const updatedCalls = existingCalls
                      ? JSON.stringify([...JSON.parse(existingCalls || '[]'), ...data.tool_calls])
                      : JSON.stringify(data.tool_calls);
                    updateMessage(streamMsgId, { toolCalls: updatedCalls });
                  }
                  if (data.content) {
                    if (!firstContentReceived) {
                      firstContentReceived = true;
                      setAgenticStatus({ phase: 'generating', detail: 'Generating response...' });
                    }
                    fullContent += data.content;
                    updateMessage(streamMsgId, { content: fullContent });
                  }
                  if (data.done) {
                    setAgenticStatus({ phase: 'idle' });
                    updateMessage(streamMsgId, {
                      isStreaming: false,
                      tokens: data.tokens || 0,
                    });
                  }
                } catch (parseErr) {
                  if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) {
                    throw parseErr;
                  }
                  if (payload && payload.length > 0) {
                    const rawText = payload.replace(/^["']|["']$/g, '');
                    if (rawText) {
                      fullContent += rawText + '\n';
                      if (!firstContentReceived) {
                        firstContentReceived = true;
                        setAgenticStatus({ phase: 'generating', detail: 'Generating response...' });
                      }
                      updateMessage(streamMsgId, { content: fullContent });
                    }
                  }
                }
              } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                  const data = JSON.parse(trimmed);
                  if (data.content) {
                    if (!firstContentReceived) {
                      firstContentReceived = true;
                      setAgenticStatus({ phase: 'generating', detail: 'Generating response...' });
                    }
                    fullContent += data.content;
                    updateMessage(streamMsgId, { content: fullContent });
                  }
                  if (data.error) {
                    throw new Error(data.error);
                  }
                } catch {
                  fullContent += trimmed + '\n';
                  updateMessage(streamMsgId, { content: fullContent });
                }
              } else {
                if (!firstContentReceived) {
                  firstContentReceived = true;
                  setAgenticStatus({ phase: 'generating', detail: 'Generating response...' });
                }
                fullContent += trimmed + '\n';
                updateMessage(streamMsgId, { content: fullContent });
              }
            }
          }
        }

        // Finalize: if tool calls were in progress, mark remaining as error
        toolCallDisplays.forEach((tc) => {
          if (tc.status === 'executing') {
            tc.status = 'error';
            tc.result = 'Execution timed out or interrupted';
            tc.completedAt = new Date().toISOString();
          }
        });
        syncToolDisplays();

        // If no content was streamed
        if (!fullContent) {
          const hasToolResults = toolCallDisplays.some(
            (tc) => tc.status === 'success'
          );
          if (!hasToolResults) {
            updateMessage(streamMsgId, {
              content: 'No response received. Please try again.',
              isStreaming: false,
            });
          } else {
            updateMessage(streamMsgId, { isStreaming: false });
          }
        }
      } catch (err) {
        // If aborted, don't show error — just finalize
        if (controller.signal.aborted) {
          updateMessage(streamMsgId, { isStreaming: false });
        } else {
          updateMessage(streamMsgId, {
            content: `Sorry, an error occurred: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
            isStreaming: false,
          });
        }
      } finally {
        clearInterval(speedInterval);
        abortControllerRef.current = null;
        setStreamingCharsPerSec(null);
        setAgenticStatus({ phase: 'idle' });
        setStreamingMessageId(null);
        setLoading(false);
      }
    },
    [addMessage, updateMessage, setLoading, setStreamingMessageId, selectedModel, agentConfig]
  );

  const sendImageToAPI = useCallback(
    async (userMessage: string, imageFile: File) => {
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append('image', imageFile);
        if (userMessage.trim()) {
          formData.append('message', userMessage.trim());
        }

        const res = await fetch('/api/ai/image-analyze', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');

        const assistantMsg: Message = {
          id: `msg-${Date.now()}`,
          sessionId: activeSessionId || '',
          role: 'assistant',
          content: data.content,
          toolCalls: null,
          toolResults: data.imagePreview || null,
          tokens: Math.floor(data.content.length / 4),
          createdAt: new Date().toISOString(),
        };
        addMessage(assistantMsg);
      } catch (err) {
        const errorMsg: Message = {
          id: `msg-err-${Date.now()}`,
          sessionId: activeSessionId || '',
          role: 'assistant',
          content: `Sorry, image analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          toolCalls: null,
          toolResults: null,
          tokens: 0,
          createdAt: new Date().toISOString(),
        };
        addMessage(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [activeSessionId, addMessage, setLoading]
  );

  // ── Multi-Agent helpers ─────────────────
  const isMultiAgentMode = activeMode === 'coordinator' || activeMode === 'swarm' || activeMode === 'teammate';
  const isMultiAgentExecuting = multiAgent.phase === 'spawning' || multiAgent.phase === 'executing' || multiAgent.phase === 'aggregating';

  const multiAgentModeConfig: Record<string, { label: string; icon: LucideIcon; colorClass: string; bgColor: string; borderColor: string; defaultCount: number; minCount: number; maxCount: number; countLabel: string }> = {
    coordinator: { label: 'Coordinator', icon: Users, colorClass: 'text-orange-400', bgColor: 'bg-orange-500/5', borderColor: 'border-orange-500/20', defaultCount: 3, minCount: 1, maxCount: 6, countLabel: 'Workers' },
    swarm: { label: 'Swarm', icon: Network, colorClass: 'text-red-400', bgColor: 'bg-red-500/5', borderColor: 'border-red-500/20', defaultCount: 3, minCount: 2, maxCount: 6, countLabel: 'Agents' },
    teammate: { label: 'Teammate', icon: UserCheck, colorClass: 'text-cyan-400', bgColor: 'bg-cyan-500/5', borderColor: 'border-cyan-500/20', defaultCount: 1, minCount: 1, maxCount: 1, countLabel: '' },
  };

  const sendToMultiAgentAPI = useCallback(
    async (userMessage: string, sessionId: string) => {
      const mode = activeMode as MultiAgentMode;
      if (!mode || !isMultiAgentMode) return;

      setLoading(true);
      const config = multiAgentModeConfig[mode];

      const streamMsgId = `msg-stream-${Date.now()}`;
      const streamMsg: Message = {
        id: streamMsgId,
        sessionId,
        role: 'assistant',
        content: '',
        toolCalls: null,
        toolCallsDisplay: null,
        toolResults: null,
        tokens: 0,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(streamMsg);
      setStreamingMessageId(streamMsgId);

      const agentCount = mode === 'teammate' ? 1 : multiAgent.workerCount;
      setMultiAgent({
        phase: 'spawning',
        mode,
        agents: mode === 'teammate'
          ? [{ id: 'teammate', name: 'Teammate', status: 'spawning' }]
          : Array.from({ length: agentCount }, (_, i) => ({
              id: `pending-${i}`,
              name: `${config.label} ${i + 1}`,
              status: 'spawning' as const,
            })),
        totalAgents: agentCount + (mode === 'teammate' ? 0 : 1),
        completedAgents: 0,
        totalTokens: 0,
        configOpen: false,
        workerCount: multiAgent.workerCount,
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiUrl = mode === 'coordinator' ? '/api/agents/coordinator' : '/api/agents/swarm';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: userMessage,
            model: selectedModel || agentConfig.activeModel,
            sessionId,
            ...(mode === 'coordinator' ? { numWorkers: agentCount } : { agentCount }),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Multi-agent request failed');
        }

        let fullContent = '';
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') continue;

              try {
                const data = JSON.parse(payload);
                if (data.error) throw new Error(data.error);

                if (data.type === 'agent_spawned') {
                  setMultiAgent(prev => {
                    const agents = [...prev.agents];
                    const idx = data.agentIndex ?? agents.length - 1;
                    if (agents[idx]) {
                      agents[idx] = { ...agents[idx], id: data.agentId || agents[idx].id, name: data.agentName || agents[idx].name, status: 'thinking' };
                    }
                    return { ...prev, phase: 'executing' as const, agents };
                  });
                  continue;
                }

                if (data.type === 'task_assigned' || data.type === 'agent_status') {
                  setMultiAgent(prev => ({
                    ...prev,
                    agents: prev.agents.map(a =>
                      a.id === data.agentId
                        ? { ...a, status: (data.status || 'executing') as MultiAgentAgentInfo['status'] }
                        : a
                    ),
                  }));
                  continue;
                }

                if (data.type === 'agent_result') {
                  setMultiAgent(prev => ({
                    ...prev,
                    agents: prev.agents.map(a =>
                      a.id === data.agentId
                        ? { ...a, status: (data.status === 'failed' ? 'failed' : 'done') as MultiAgentAgentInfo['status'], result: data.result, error: data.error, tokens: data.tokens }
                        : a
                    ),
                    completedAgents: data.completedAgents || prev.completedAgents + 1,
                  }));
                  continue;
                }

                if (data.type === 'aggregation_start') {
                  setMultiAgent(prev => ({ ...prev, phase: 'aggregating' as const }));
                  continue;
                }

                if (data.type === 'aggregation_complete') {
                  setMultiAgent(prev => ({ ...prev, phase: 'done' as const, totalTokens: data.totalTokens || 0 }));
                  continue;
                }

                if (data.content) {
                  fullContent += data.content;
                  updateMessage(streamMsgId, { content: fullContent });
                }
                if (data.done) {
                  updateMessage(streamMsgId, { isStreaming: false, tokens: data.tokens || 0 });
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
              }
            }
          }
        }

        if (!fullContent) {
          updateMessage(streamMsgId, { content: 'No response from multi-agent system.', isStreaming: false });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          updateMessage(streamMsgId, { isStreaming: false });
        } else {
          updateMessage(streamMsgId, { content: `Multi-agent error: ${err instanceof Error ? err.message : 'Unknown error'}`, isStreaming: false });
        }
        setMultiAgent(prev => ({ ...prev, phase: 'done' }));
      } finally {
        abortControllerRef.current = null;
        setStreamingMessageId(null);
        setLoading(false);
      }
    },
    [activeMode, isMultiAgentMode, multiAgent.workerCount, setLoading, addMessage, setStreamingMessageId, updateMessage, selectedModel, agentConfig]
  );

  // ── Auto-title handler ─────────────────────
  const autoTitleSession = useCallback(
    async (sid: string, msg: string) => {
      const title = msg.length > 50 ? msg.slice(0, 47) + '...' : msg;
      try {
        const res = await fetch(`/api/sessions/${sid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        const data = await res.json();
        if (!data.error) {
          updateSession(sid, { title: data.title || title, updatedAt: data.updatedAt || new Date().toISOString() });
        }
      } catch {
        // silently fail
      }
    },
    [updateSession]
  );

  const handleSend = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && !attachedImage) return;
      if (isLoading) return;

      // ── Auto-create session if none active ───
      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await createSessionAPI(selectedModel || agentConfig.activeModel, trimmed.slice(0, 60));
        if (!session) {
          toast.error('Failed to create session');
          return;
        }
        addSession(session);
        sessionId = session.id;
        // Small delay for store to update
        await new Promise(r => setTimeout(r, 50));
      }

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        sessionId,
        role: 'user',
        content: attachedImage
          ? `${trimmed ? trimmed + '\n' : ''}[IMAGE]${attachedImage.preview}`
          : trimmed,
        toolCalls: null,
        toolResults: null,
        tokens: Math.floor(trimmed.length * 1.5),
        createdAt: new Date().toISOString(),
      };

      addMessage(userMsg);
      setInput('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      if (attachedImage) {
        const imageFile = attachedImage.file;
        setAttachedImage(null);
        await sendImageToAPI(trimmed, imageFile);
      } else if (isMultiAgentMode) {
        await sendToMultiAgentAPI(trimmed, sessionId);
      } else {
        await sendToAPI(trimmed, sessionId);
      }

      // ── Auto-title new session on first message ──
      if (sessionId) {
        const sessionMsgs = useChatStore.getState().messagesMap[sessionId];
        if (!sessionMsgs || sessionMsgs.length === 0) {
          // This is the first message in the session
          autoTitleSession(sessionId, trimmed);
        }
      }
    },
    [input, isLoading, activeSessionId, addMessage, sendToAPI, sendImageToAPI, attachedImage, selectedModel, agentConfig, addSession, autoTitleSession, isMultiAgentMode, sendToMultiAgentAPI]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) return;
    const lines: string[] = [];
    lines.push(`# ${agentConfig.agentName} - Chat Export`);
    lines.push(`> Exported: ${new Date().toLocaleString()}`);
    lines.push(`> Model: ${selectedModel || agentConfig.activeModel}`);
    lines.push(`> Mode: ${activeMode}`);
    lines.push('');

    for (const msg of messages) {
      const role = msg.role === 'user' ? '**You**' : `**${agentConfig.agentName}**`;
      const time = new Date(msg.createdAt).toLocaleTimeString();
      lines.push(`### ${role} *(${time})*`);
      lines.push('');
      lines.push(msg.content || '(empty)');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported', { description: 'Markdown file downloaded.' });
  }, [messages, agentConfig, selectedModel, activeMode]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStreamingMessageId(null);
    setAgenticStatus({ phase: 'idle' });
    setStreamingCharsPerSec(null);
  }, [setLoading, setStreamingMessageId]);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = ev.target?.result as string;
        setAttachedImage({ file, preview });
      };
      reader.readAsDataURL(file);

      // Reset file input so same file can be re-selected
      e.target.value = '';
    },
    []
  );

  // ── Voice Handlers ─────────────────────────
  const voiceEnabled = featureFlags.VOICE || activeMode === 'voice';
  const isVoiceMode = activeMode === 'voice';

  // Find the latest assistant message
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  // Start recording
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4',
      });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const audioFile = new File([audioBlob], 'recording.webm', { type: mediaRecorder.mimeType });

        try {
          const formData = new FormData();
          formData.append('audio', audioFile);

          const res = await fetch('/api/voice/asr', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.text) {
            setInput((prev) => (prev ? prev + ' ' + data.text : data.text));
            textareaRef.current?.focus();
          } else {
            toast.error(t.voice.transcriptionError, {
              description: data.error || 'Unknown error',
            });
          }
        } catch {
          toast.error(t.voice.transcriptionError);
        } finally {
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      toast.error(t.voice.startRecording, {
        description: 'Microphone access denied or unavailable.',
      });
    }
  }, [setIsRecording, t]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [setIsRecording]);

  // Play TTS
  const handlePlayTTS = useCallback(async () => {
    if (!latestAssistantMessage?.content) return;

    if (isPlayingTTS && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
      setIsPlayingTTS(false);
      return;
    }

    try {
      setIsPlayingTTS(true);
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: latestAssistantMessage.content,
          voice: ttsVoice,
          speed: ttsSpeed,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'TTS failed');
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      ttsAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingTTS(false);
        ttsAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlayingTTS(false);
        ttsAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        toast.error(t.voice.ttsError);
      };

      await audio.play();
    } catch (err) {
      setIsPlayingTTS(false);
      toast.error(t.voice.ttsError, {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [latestAssistantMessage, isPlayingTTS, ttsVoice, ttsSpeed, setIsPlayingTTS, t]);

  // ── Session Panel Handlers ─────────────────
  const handleNewChat = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Chat',
          model: selectedModel || agentConfig.activeModel,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error('Failed to create session', { description: data.error });
        return;
      }
      const newSession: Session = {
        id: data.id,
        title: data.title,
        model: data.model,
        systemPrompt: data.systemPrompt,
        isActive: data.isActive,
        tokenCount: 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      addSession(newSession);
      setSessionPanelOpen(false);
      toast.success('New chat created');
    } catch {
      toast.error('Failed to create session');
    }
  }, [addSession, selectedModel, agentConfig]);

  const handleSwitchSession = useCallback(
    async (id: string) => {
      // Check if messages are already cached in the messagesMap
      const cachedMessages = useChatStore.getState().messagesMap[id];

      // Switch session (saves current messages to map, loads from map)
      setActiveSession(id);
      setSessionPanelOpen(false);

      // If no cached messages, fetch from DB
      if (!cachedMessages || cachedMessages.length === 0) {
        try {
          const res = await fetch(`/api/sessions/${id}`);
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            const msgs: Message[] = data.messages.map((m: Record<string, unknown>) => ({
              id: m.id as string,
              sessionId: m.sessionId as string,
              role: (m.role as Message['role']),
              content: (m.content as string) || '',
              toolCalls: (m.toolCalls as string) || null,
              toolResults: (m.toolResults as string) || null,
              tokens: (m.tokens as number) || 0,
              thinkingContent: (m.thinkingContent as string) || null,
              createdAt: (m.createdAt as string) || new Date().toISOString(),
            }));
            setMessagesForSession(id, msgs);
          }
        } catch {
          // silently fail
        }
      }
    },
    [setActiveSession, setMessagesForSession]
  );

  const handleTemplateClick = useCallback(
    async (prompt: string) => {
      if (!activeSessionId) {
        // Create a new session via API
        try {
          const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'New Chat',
              model: selectedModel || agentConfig.activeModel,
            }),
          });
          const data = await res.json();
          if (data.error) {
            toast.error('Failed to create session');
            return;
          }
          const newSession: Session = {
            id: data.id,
            title: data.title,
            model: data.model,
            systemPrompt: data.systemPrompt,
            isActive: data.isActive,
            tokenCount: 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
          addSession(newSession);
        } catch {
          toast.error('Failed to create session');
          return;
        }
      }
      setInput(prompt);
      setSessionPanelOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 300);
    },
    [activeSessionId, addSession, selectedModel, agentConfig]
  );

  // ── Session Rename Handler ─────────────────
  const handleStartRename = useCallback(
    (e: React.MouseEvent, session: Session) => {
      e.stopPropagation();
      setRenamingSessionId(session.id);
      setRenameTitle(session.title);
      setExpandedSessionId(null);
      setTimeout(() => renameInputRef.current?.focus(), 50);
    },
    []
  );

  const handleFinishRename = useCallback(
    async (id: string) => {
      const trimmed = renameTitle.trim();
      if (!trimmed) {
        setRenamingSessionId(null);
        return;
      }
      // Find original session to check if title changed
      const session = useChatStore.getState().sessions.find(s => s.id === id);
      if (session && session.title === trimmed) {
        setRenamingSessionId(null);
        return;
      }
      // Update via API
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed }),
        });
        const data = await res.json();
        if (data.error) {
          toast.error('Failed to rename session');
        } else {
          updateSession(id, { title: trimmed, updatedAt: data.updatedAt || new Date().toISOString() });
          toast.success('Session renamed');
        }
      } catch {
        toast.error('Failed to rename session');
      }
      setRenamingSessionId(null);
    },
    [renameTitle, updateSession]
  );

  const handleCancelRename = useCallback(() => {
    setRenamingSessionId(null);
    setRenameTitle('');
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, id: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinishRename(id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelRename();
      }
    },
    [handleFinishRename, handleCancelRename]
  );

  // ── Delete Confirmation Handler ────────────
  const [undoDeleteData, setUndoDeleteData] = useState<{ session: Session; index: number } | null>(null);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirmingDeleteId === id) {
        // Second click — actually delete
        const currentSessions = useChatStore.getState().sessions;
        const deletedSession = currentSessions.find(s => s.id === id);
        const deletedIndex = currentSessions.findIndex(s => s.id === id);

        deleteSession(id);
        fetch('/api/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }).catch(() => {});
        setConfirmingDeleteId(null);
        setExpandedSessionId(null);

        // If the deleted session was active, switch to next available
        if (id === activeSessionId) {
          const remaining = currentSessions.filter(s => s.id !== id);
          if (remaining.length > 0) {
            // Switch to the next most recent session (same index or previous)
            const nextIdx = Math.min(deletedIndex, remaining.length - 1);
            setActiveSession(remaining[nextIdx].id);
          }
          // If no sessions remain, activeSessionId will be null naturally
        }

        // Show toast with undo option
        if (deletedSession) {
          setUndoDeleteData({ session: deletedSession, index: deletedIndex });
          toast.success('Session deleted', {
            description: 'The chat session has been removed.',
            action: {
              label: 'Undo',
              onClick: () => {
                // Re-add session to store (visual undo only)
                addSession(deletedSession);
                setUndoDeleteData(null);
                toast.success('Session restored');
              },
            },
            duration: 5000,
          });
        } else {
          toast.success('Session deleted');
        }
      } else {
        // First click — show confirmation
        setConfirmingDeleteId(id);
        // Auto-reset after 3 seconds
        setTimeout(() => {
          setConfirmingDeleteId((prev) => (prev === id ? null : prev));
        }, 3000);
      }
    },
    [confirmingDeleteId, deleteSession, activeSessionId, setActiveSession, addSession]
  );

  // ── Clear All Sessions Handler ─────────────
  const handleClearAll = useCallback(async () => {
    if (!clearAllConfirm) {
      setClearAllConfirm(true);
      setTimeout(() => setClearAllConfirm(false), 3000);
      return;
    }
    // Delete all sessions from DB
    for (const session of sessions) {
      fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id }),
      }).catch(() => {});
    }
    // Clear local state
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      messages: [],
      messagesMap: {},
      activeView: 'dashboard' as const,
    });
    setClearAllConfirm(false);
    toast.success('All sessions cleared');
  }, [clearAllConfirm, sessions]);

  const modelLabel = selectedModel || agentConfig.activeModel || 'Default';
  const shortModelName = modelLabel.split('/').pop() || modelLabel;

  const hasInput = input.trim().length > 0 || attachedImage !== null;
  const showCharCount = input.length > 200;

  return (
    <>
      {/* ─── Session Panel Backdrop ─── */}
      <AnimatePresence>
        {sessionPanelOpen && (
          <motion.div
            key="session-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setSessionPanelOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Session Panel ─── */}
      <motion.div
        initial={false}
        animate={{ translateX: sessionPanelOpen ? '0%' : '-100%' }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 z-40 flex h-full w-72 flex-col bg-background/98 backdrop-blur-xl border-r border-border/50"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>

        {/* Search Input */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-card/80 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2">
          {!sessionsLoaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="mb-3 text-xs text-muted-foreground/60">
                {searchQuery ? 'No matching sessions' : 'No sessions yet'}
              </p>
              {!searchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={handleNewChat}
                >
                  <Plus className="h-3 w-3" />
                  Create Session
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1 py-1">
              <AnimatePresence mode="popLayout">
              {filteredSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;
                const isRenaming = renamingSessionId === session.id;
                const isConfirmingDelete = confirmingDeleteId === session.id;
                const sessionMsgs = messagesMap[session.id];
                const msgCount = sessionMsgs?.length ?? 0;
                const totalTokens = sessionMsgs?.reduce((acc, m) => acc + m.tokens, 0) ?? session.tokenCount;

                return (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'group rounded-lg transition-all',
                      session.id === activeSessionId &&
                        'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                    )}
                  >
                    {/* Session Row */}
                    <div
                      className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-muted/60 cursor-pointer"
                      onClick={() => handleSwitchSession(session.id)}
                    >
                      <div className="mt-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              session.id === activeSessionId
                                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                : 'bg-zinc-600'
                            )}
                          />
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                              onBlur={() => handleFinishRename(session.id)}
                              className="min-w-0 flex-1 bg-muted/80 rounded px-1.5 py-0.5 text-xs font-medium text-foreground border border-emerald-500/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="truncate text-xs font-medium text-foreground"
                              onDoubleClick={(e) => handleStartRename(e, session)}
                              title="Double-click to rename"
                            >
                              {session.title}
                            </span>
                          )}
                        </div>
                        {!isRenaming && (
                          <div className="mt-1 flex items-center gap-2 pl-3.5">
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatDistanceToNow(new Date(session.updatedAt), {
                                addSuffix: true,
                              })}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">
                              {session.tokenCount.toLocaleString()} tokens
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {/* Info toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSessionId(isExpanded ? null : session.id);
                            if (renamingSessionId === session.id) setRenamingSessionId(null);
                          }}
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                            isExpanded
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground'
                          )}
                          title="Session info"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                        {/* Delete / Confirm */}
                        {isConfirmingDelete ? (
                          <button
                            onClick={(e) => handleDeleteClick(e, session.id)}
                            className="flex h-6 items-center justify-center rounded-md bg-destructive/20 px-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/30 transition-colors"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteClick(e, session.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete session"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Expanded Info Area */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-3 mb-2 rounded-md bg-muted/60 border border-border/30 px-3 py-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/50">Model</span>
                              <span className="text-[10px] font-mono text-emerald-400/80">{session.model.split('/').pop()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/50">Created</span>
                              <span className="text-[10px] text-foreground/70">
                                {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/50">Messages</span>
                              <span className="text-[10px] text-foreground/70">{msgCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/50">Total Tokens</span>
                              <span className="text-[10px] text-foreground/70">{totalTokens.toLocaleString()}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Clear All Sessions (only visible when sessions exist) */}
        {sessionsLoaded && sessions.length > 0 && (
          <div className="border-t border-border/50 px-3 py-2">
            <button
              onClick={handleClearAll}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
                clearAllConfirm
                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                  : 'text-muted-foreground/60 hover:text-destructive/80 hover:bg-destructive/5'
              )}
            >
              <Trash2 className="h-3 w-3" />
              {clearAllConfirm ? 'Click again to clear all' : 'Clear All Sessions'}
            </button>
          </div>
        )}

        {/* Templates Section */}
        <div className="border-t border-border/50 px-3 py-3" data-templates-section>
          <div className="mb-2 flex items-center gap-2">
            <LayoutTemplate className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-muted-foreground">
              Quick Templates
            </span>
          </div>
          <div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTemplateClick(t.prompt)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all',
                    templateColorMap[t.color] || 'text-muted-foreground/70 hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate text-[10px] font-medium">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── Main Content (always show layout) ─── */}
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agentConfig.avatar}</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {agentConfig.agentName}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] text-muted-foreground">
                  {activeSessionId ? `Online · ${messages.length} messages` : 'Online · Ready'}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Session Manager */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                sessionPanelOpen
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-emerald-500/10'
              )}
              onClick={() => setSessionPanelOpen((v) => !v)}
              title="Session Manager"
            >
              <History className="h-4 w-4" />
            </Button>

            {/* Templates Quick Access */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
              onClick={() => {
                setSessionPanelOpen(true);
                setTimeout(() => {
                  const panel = document.querySelector('[data-templates-section]');
                  panel?.scrollIntoView({ behavior: 'smooth' });
                }, 350);
              }}
              title="Templates"
            >
              <LayoutTemplate className="h-4 w-4" />
            </Button>

            {/* Export Chat */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
              onClick={handleExportChat}
              title="Export Chat"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Thinking Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                agentConfig.thinkingEnabled
                  ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() =>
                setAgentConfig({ thinkingEnabled: !agentConfig.thinkingEnabled })
              }
              title={agentConfig.thinkingEnabled ? 'Disable Thinking Mode' : 'Enable Thinking Mode'}
            >
              <Brain className="h-4 w-4" />
            </Button>

            {agentConfig.thinkingEnabled && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400"
              >
                🧠 Thinking
              </Badge>
            )}

            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400"
            >
              <Zap className="h-3 w-3" />
              <span className="hidden sm:inline">{shortModelName}</span>
            </Badge>
            {activeSessionId && (
              <Badge
                variant="outline"
                className="hidden sm:inline-flex border-border/50 text-[10px] text-muted-foreground"
              >
                {messages.reduce((acc, m) => acc + m.tokens, 0).toLocaleString()} tokens
              </Badge>
            )}
          </div>
        </div>

        {/* ─── Agent Progress Panel (Coordinator / Swarm / Teammate) ─── */}
        <AnimatePresence>
          {isMultiAgentMode && multiAgent.phase !== 'idle' && (
            <AgentProgressPanel
              multiAgent={multiAgent}
              userTask={messages.find(m => m.role === 'user')?.content}
              onDismiss={() => setMultiAgent(defaultMultiAgentState)}
            />
          )}
        </AnimatePresence>

        {/* ─── Agent Worker Count Selector (when idle, not executing) ─── */}
        <AnimatePresence>
          {isMultiAgentMode && multiAgent.phase === 'idle' && multiAgent.agents.length === 0 && (() => {
            const config = multiAgentModeConfig[activeMode];
            if (!config || !config.countLabel) return null;
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={cn('border-b px-4 py-2.5', config.bgColor, config.borderColor)}>
                  <div className="flex items-center gap-2">
                    <config.icon className={cn('h-3.5 w-3.5', config.colorClass)} />
                    <span className="text-[11px] font-medium text-foreground">{config.label} Mode</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/60">{config.countLabel}:</span>
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded-md border border-border/50 bg-muted/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                        onClick={() => setMultiAgent(prev => ({ ...prev, workerCount: Math.max(config.minCount, prev.workerCount - 1) }))}
                        disabled={multiAgent.workerCount <= config.minCount}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <span className="w-4 text-center text-xs font-semibold text-foreground">{multiAgent.workerCount}</span>
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded-md border border-border/50 bg-muted/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                        onClick={() => setMultiAgent(prev => ({ ...prev, workerCount: Math.min(config.maxCount, prev.workerCount + 1) }))}
                        disabled={multiAgent.workerCount >= config.maxCount}
                      >
                        <PlusCircle className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ─── UltraPlan Panel ─── */}
        <AnimatePresence>
          {activeMode === 'ultraplan' && <PlanPanel />}
        </AnimatePresence>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto"
          >
            <div className="mx-auto max-w-4xl min-h-full flex flex-col">
              {activeSessionId && messages.length === 0 ? (
                <WelcomeState />
              ) : !activeSessionId ? (
                <WelcomeState />
              ) : (
                <div className="flex-1 py-4">
                  <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isStreaming={streamingMessageId === msg.id}
                      />
                    ))}
                  </AnimatePresence>
                  {isLoading && !streamingMessageId && <MessageListLoading />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Agentic Loop Status Indicator ─── */}
        <AnimatePresence>
          {agenticStatus.phase !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className={cn(
                'mx-auto flex max-w-4xl items-center gap-3 border-t px-4 py-2',
                phaseConfig[agenticStatus.phase].borderClass,
                phaseConfig[agenticStatus.phase].bgClass,
              )}>
                <div className="relative flex items-center justify-center">
                  <Loader2 className={cn(
                    'h-4 w-4 animate-spin',
                    phaseConfig[agenticStatus.phase].colorClass,
                  )} />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={cn(
                    'text-xs font-medium',
                    phaseConfig[agenticStatus.phase].colorClass,
                  )}>
                    {phaseConfig[agenticStatus.phase].icon}{' '}
                    {agenticStatus.toolName
                      ? `${phaseConfig[agenticStatus.phase].label}: ${agenticStatus.toolName}`
                      : agenticStatus.loopIteration
                        ? `${phaseConfig[agenticStatus.phase].label} (loop ${agenticStatus.loopIteration})`
                        : phaseConfig[agenticStatus.phase].label
                    }
                  </span>
                  {agenticStatus.loopIteration && agenticStatus.loopIteration > 1 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-border/50 bg-muted/50 px-1.5 py-0 text-[9px] text-muted-foreground"
                    >
                      Iteration {agenticStatus.loopIteration}
                    </Badge>
                  )}
                </div>
                {/* Streaming speed indicator */}
                {agenticStatus.phase === 'generating' && streamingCharsPerSec !== null && streamingCharsPerSec > 0 && (
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                    {streamingCharsPerSec} chars/s
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleStop}
                  className="h-6 gap-1.5 shrink-0 rounded-md px-2 text-[10px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  Stop
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Chat Toolbar (mode/skills/tools/memory quick access) ─── */}
        <ChatToolbar />

        {/* ─── Input Area (always visible) ─── */}
        <div className="border-t border-border/50 bg-card/50 p-4">
          <form onSubmit={handleSend} className="relative mx-auto max-w-4xl">
            {/* Image Preview */}
            {attachedImage && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border/50 bg-card">
                  <img
                    src={attachedImage.preview}
                    alt="Attached"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">
                    {attachedImage.file.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {(attachedImage.file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setAttachedImage(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Voice Mode Banner */}
            {isVoiceMode && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <span className="text-sm">🎤</span>
                <span className="text-xs font-medium text-emerald-400">
                  {t.voice.voiceModeActive}
                </span>
                {isRecording && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-400">{t.voice.listening}</span>
                  </span>
                )}
              </div>
            )}

            <div className={cn(
              'flex items-end gap-2 rounded-xl border bg-card transition-all duration-200',
              // Default border
              !isTextareaFocused && !hasInput && 'border-border/50 ring-1 ring-border/30',
              // Focused: emerald glow
              isTextareaFocused && !hasInput && 'border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.06)]',
              // Has content: stronger emerald glow
              hasInput && 'border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-[0_0_24px_rgba(16,185,129,0.08)]',
              // Loading state
              isLoading && 'border-amber-500/30 ring-1 ring-amber-500/20',
            )}>
              {/* Image Upload Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="m-1.5 h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach image"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Mic / Recording Button */}
              {voiceEnabled && (
                isRecording ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="m-1.5 h-8 w-8 shrink-0 rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all animate-pulse"
                    onClick={handleStopRecording}
                    title={t.voice.stopRecording}
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'm-1.5 h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground transition-all',
                      isVoiceMode ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-500/10',
                    )}
                    onClick={handleStartRecording}
                    disabled={isLoading}
                    title={t.voice.startRecording}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )
              )}

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder="Send a message to CodeBot..."
                className="min-h-[44px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={1}
                disabled={isLoading}
              />
              {showCharCount && (
                <span className="mb-2 mr-1 shrink-0 text-[10px] tabular-nums text-muted-foreground/30">
                  {input.length}
                </span>
              )}
              {/* TTS Speak Button */}
              {voiceEnabled && latestAssistantMessage && !isLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'm-1.5 h-8 w-8 shrink-0 rounded-lg transition-all',
                    isPlayingTTS
                      ? 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 hover:bg-sky-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sky-500/10',
                  )}
                  onClick={handlePlayTTS}
                  title={isPlayingTTS ? t.voice.stopSpeaking : t.voice.speakResponse}
                >
                  {isPlayingTTS ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleStop}
                  className="m-1.5 h-8 w-8 shrink-0 rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!hasInput}
                  className={cn(
                    'm-1.5 h-8 w-8 shrink-0 rounded-lg transition-all duration-200',
                    hasInput
                      ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                      : 'bg-muted text-muted-foreground disabled:opacity-50',
                  )}
                >
                  <SendHorizontal className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    hasInput && 'translate-x-[-1px]',
                  )} />
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground/40">
                Enter to send · Shift+Enter for new line
              </span>
              <span className="text-[10px] text-muted-foreground/40">
                {shortModelName}
                {agentConfig.thinkingEnabled ? ' · Thinking' : ''} · {agentConfig.maxTokens.toLocaleString()} max tokens
              </span>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

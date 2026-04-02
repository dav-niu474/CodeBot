'use client';

import { cn } from '@/lib/utils';
import type { Message, Session } from '@/lib/types';
import { useChatStore } from '@/store/chat-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageBubble, MessageListLoading, WelcomeState } from './MessageBubble';
import {
  SendHorizontal,
  Square,
  Zap,
  Brain,
  ImagePlus,
  X,
  Download,
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
    agentConfig,
    setAgentConfig,
    streamingMessageId,
    setStreamingMessageId,
    selectedModel,
    activeMode,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

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

  const sendToAPI = useCallback(
    async (userMessage: string) => {
      setLoading(true);

      // Create placeholder assistant message for streaming
      const streamMsgId = `msg-stream-${Date.now()}`;
      const streamMsg: Message = {
        id: streamMsgId,
        sessionId: activeSessionId || '',
        role: 'assistant',
        content: '',
        toolCalls: null,
        toolResults: null,
        tokens: 0,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(streamMsg);
      setStreamingMessageId(streamMsgId);

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            message: userMessage,
            model: selectedModel || agentConfig.activeModel,
            thinkingEnabled: agentConfig.thinkingEnabled,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Request failed');
        }

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
        let fullContent = '';

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
                  if (data.content) {
                    fullContent += data.content;
                    updateMessage(streamMsgId, { content: fullContent });
                  }
                  if (data.done) {
                    updateMessage(streamMsgId, {
                      isStreaming: false,
                      tokens: data.tokens || 0,
                    });
                  }
                } catch (parseErr) {
                  // If it's an error we threw ourselves, re-throw
                  if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) {
                    throw parseErr;
                  }
                  // Otherwise, treat the raw payload as content (model returned non-JSON)
                  if (payload && payload.length > 0) {
                    const rawText = payload.replace(/^["']|["']$/g, '');
                    if (rawText) {
                      fullContent += rawText + '\n';
                      updateMessage(streamMsgId, { content: fullContent });
                    }
                  }
                }
              } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                // Possible JSON without data: prefix
                try {
                  const data = JSON.parse(trimmed);
                  if (data.content) {
                    fullContent += data.content;
                    updateMessage(streamMsgId, { content: fullContent });
                  }
                  if (data.error) {
                    throw new Error(data.error);
                  }
                } catch {
                  // Not valid JSON, treat as text
                  fullContent += trimmed + '\n';
                  updateMessage(streamMsgId, { content: fullContent });
                }
              } else {
                // Plain text line (not SSE formatted)
                fullContent += trimmed + '\n';
                updateMessage(streamMsgId, { content: fullContent });
              }
            }
          }
        }

        // If no content was streamed, use fallback
        if (!fullContent) {
          updateMessage(streamMsgId, {
            content: 'No response received. Please try again.',
            isStreaming: false,
          });
        }
      } catch (err) {
        updateMessage(streamMsgId, {
          content: `Sorry, an error occurred: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          isStreaming: false,
        });
      } finally {
        setStreamingMessageId(null);
        setLoading(false);
      }
    },
    [activeSessionId, addMessage, updateMessage, setLoading, setStreamingMessageId, selectedModel, agentConfig]
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

  const handleSend = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && !attachedImage) return;
      if (isLoading) return;

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        sessionId: activeSessionId || '',
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
      } else {
        await sendToAPI(trimmed);
      }
    },
    [input, isLoading, activeSessionId, addMessage, sendToAPI, sendImageToAPI, attachedImage]
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
    const lines = [];
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
    setLoading(false);
    setStreamingMessageId(null);
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

  // ── Session Panel Handlers ─────────────────
  const handleNewChat = useCallback(() => {
    const now = new Date().toISOString();
    const newSession: Session = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      model: selectedModel || agentConfig.activeModel,
      systemPrompt: null,
      isActive: true,
      tokenCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    addSession(newSession);
    setSessionPanelOpen(false);
    toast.success('New chat created');
  }, [addSession, selectedModel, agentConfig]);

  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteSession(id);
      // Also try to delete from DB (fire-and-forget)
      fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(() => {});
      toast.success('Session deleted');
    },
    [deleteSession]
  );

  const handleSwitchSession = useCallback(
    (id: string) => {
      setActiveSession(id);
      setSessionPanelOpen(false);
    },
    [setActiveSession]
  );

  const handleTemplateClick = useCallback(
    (prompt: string) => {
      if (!activeSessionId) {
        const now = new Date().toISOString();
        const newSession: Session = {
          id: `session-${Date.now()}`,
          title: 'New Chat',
          model: selectedModel || agentConfig.activeModel,
          systemPrompt: null,
          isActive: true,
          tokenCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        addSession(newSession);
      }
      setInput(prompt);
      setSessionPanelOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 300);
    },
    [activeSessionId, addSession, selectedModel, agentConfig]
  );

  const modelLabel = selectedModel || agentConfig.activeModel || 'Default';
  const shortModelName = modelLabel.split('/').pop() || modelLabel;

  const modeColors: Record<string, string> = {
    interactive: 'text-emerald-400',
    kairos: 'text-amber-400',
    plan: 'text-blue-400',
    worktree: 'text-teal-400',
    voice: 'text-purple-400',
    coordinator: 'text-orange-400',
    swarm: 'text-red-400',
    teammate: 'text-cyan-400',
    ultraplan: 'text-indigo-400',
    dream: 'text-pink-400',
  };

  const modeBgColors: Record<string, string> = {
    interactive: 'border-emerald-500/20 bg-emerald-500/10',
    kairos: 'border-amber-500/20 bg-amber-500/10',
    plan: 'border-blue-500/20 bg-blue-500/10',
    worktree: 'border-teal-500/20 bg-teal-500/10',
    voice: 'border-purple-500/20 bg-purple-500/10',
    coordinator: 'border-orange-500/20 bg-orange-500/10',
    swarm: 'border-red-500/20 bg-red-500/10',
    teammate: 'border-cyan-500/20 bg-cyan-500/10',
    ultraplan: 'border-indigo-500/20 bg-indigo-500/10',
    dream: 'border-pink-500/20 bg-pink-500/10',
  };

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
        className="fixed top-0 left-0 z-40 flex h-full w-72 flex-col bg-zinc-950/98 backdrop-blur-xl border-r border-border/50"
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
              className="w-full rounded-lg border border-border/50 bg-zinc-900/80 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2">
          {filteredSessions.length === 0 ? (
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
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  className={cn(
                    'group flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-zinc-800/60',
                    session.id === activeSessionId &&
                      'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                  )}
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
                      <span className="truncate text-xs font-medium text-foreground">
                        {session.title}
                      </span>
                    </div>
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
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

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
                    templateColorMap[t.color] || 'text-zinc-400 hover:bg-zinc-800/60'
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

      {/* ─── Main Content ─── */}
      {!activeSessionId ? (
        <WelcomeState />
      ) : (
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
                    Online · {messages.length} messages
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
                  // Scroll to templates after panel opens
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
                className={cn('gap-1 text-[10px]', modeBgColors[activeMode] || 'border-border/50', modeColors[activeMode] || 'text-muted-foreground')}
              >
                {activeMode}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400"
              >
                <Zap className="h-3 w-3" />
                {shortModelName}
              </Badge>
              <Badge
                variant="outline"
                className="border-border/50 text-[10px] text-muted-foreground"
              >
                {messages.reduce((acc, m) => acc + m.tokens, 0).toLocaleString()} tokens
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto"
            >
              {messages.length === 0 ? (
                <WelcomeState />
              ) : (
                <div className="py-4">
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

          {/* Input Area */}
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

              <div className="flex items-end gap-2 rounded-xl border border-border/50 bg-card ring-1 ring-border/30 focus-within:ring-emerald-500/30 focus-within:border-emerald-500/30 transition-all">
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

                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message to CodeBot..."
                  className="min-h-[44px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                  disabled={isLoading}
                />
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleStop}
                    className="m-1.5 h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() && !attachedImage}
                    className="m-1.5 h-8 w-8 shrink-0 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-[10px] text-muted-foreground/40">
                  Press Enter to send · Shift+Enter for new line
                </span>
                <span className="text-[10px] text-muted-foreground/40">
                  {shortModelName} · {activeMode} mode
                  {agentConfig.thinkingEnabled ? ' · Thinking' : ''} · Max: {agentConfig.maxTokens.toLocaleString()} tokens
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

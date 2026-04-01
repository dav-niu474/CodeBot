'use client';

import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';
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
} from 'lucide-react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
  type FormEvent,
} from 'react';
import { AnimatePresence } from 'framer-motion';

export function ChatView() {
  const {
    activeSessionId,
    messages,
    isLoading,
    setLoading,
    addMessage,
    updateMessage,
    agentConfig,
    setAgentConfig,
    streamingMessageId,
    setStreamingMessageId,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            thinkingEnabled: agentConfig.thinkingEnabled,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Request failed');
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
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
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
                } catch {
                  // ignore parse errors for partial lines
                }
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
    [activeSessionId, addMessage, updateMessage, setLoading, setStreamingMessageId, agentConfig.thinkingEnabled]
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

  const modelLabel =
    agentConfig.activeModel === 'reasoning'
      ? 'Reasoning'
      : agentConfig.activeModel === 'fast'
        ? 'Fast'
        : 'Default';

  // Show welcome state if no session or no messages
  if (!activeSessionId) {
    return <WelcomeState />;
  }

  return (
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
            {modelLabel}
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
              Model: {modelLabel}
              {agentConfig.thinkingEnabled ? ' · 🧠 Thinking' : ''} · Max: {agentConfig.maxTokens.toLocaleString()} tokens
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

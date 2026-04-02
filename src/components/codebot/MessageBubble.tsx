'use client';

import { cn } from '@/lib/utils';
import type { Message, ToolCallDisplay } from '@/lib/types';
import { useChatStore } from '@/store/chat-store';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { RichContentRenderer } from './RichContentRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { Copy, Check, User, Brain, ChevronDown, Wrench, BrainCircuit, Code2, Search } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-4">
      <div className="typing-dot h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
      <div className="typing-dot h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
      <div className="typing-dot h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span className="inline-block h-4 w-0.5 animate-pulse bg-emerald-400 ml-0.5 align-middle" />
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ThinkingIndicator() {
  return (
    <div className="mb-2 flex items-center gap-2 px-1 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
      <Brain className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
      <span className="text-xs font-medium text-amber-400">Thinking...</span>
    </div>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  return (
    <details className="mb-2 group/thinking">
      <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors select-none">
        <Brain className="h-3.5 w-3.5" />
        <span>Thought Process</span>
        <ChevronDown className="ml-auto h-3 w-3 transition-transform duration-200 group-open/thinking:rotate-180" />
      </summary>
      <div className="mt-1.5 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] p-3 text-xs text-amber-200/80 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
        {content}
      </div>
    </details>
  );
}

function ImageContent({ src, alt }: { src: string; alt?: string }) {
  return (
    <div className="mt-2 mb-1 overflow-hidden rounded-lg border border-border/50">
      <img
        src={src}
        alt={alt || 'Image'}
        className="max-h-64 w-auto object-contain"
      />
    </div>
  );
}

export function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const { agentConfig } = useChatStore();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  // Check for thinking indicator
  const isThinking = message.toolCalls === 'thinking';

  // Check for image content
  const imageMatch = message.content.match(/\[IMAGE\](data:image[^;\s]+;base64,[A-Za-z0-9+/=]+)/);
  const textContent = message.content.replace(/\[IMAGE\].*/, '').trim();

  // Parse tool calls from message.toolCallsDisplay (new SSE format) or message.toolCalls (legacy)
  const parsedToolCalls: ToolCallDisplay[] = useMemo(() => {
    // Priority 1: toolCallsDisplay (new structured format from SSE events)
    if (message.toolCallsDisplay) {
      try {
        const calls = JSON.parse(message.toolCallsDisplay);
        if (Array.isArray(calls)) return calls;
        if (calls && calls.toolCallId) return [calls];
      } catch {
        // ignore parse errors
      }
    }

    // Priority 2: toolCalls field (legacy SSE delta format or new format)
    if (!message.toolCalls || message.toolCalls === 'thinking' || message.toolCalls === '') return [];

    try {
      const calls = JSON.parse(message.toolCalls);
      if (!Array.isArray(calls)) return [];
      if (calls.length === 0) return [];

      // Check if already in ToolCallDisplay format (has toolCallId + toolName)
      if (calls[0].toolCallId && calls[0].toolName) {
        return calls as ToolCallDisplay[];
      }

      // Convert old SSE delta format: { id, type, function: { name, arguments } }
      return calls
        .filter((c: Record<string, unknown>) => c.function && typeof c.function === 'object')
        .map((c: Record<string, unknown>) => {
          const fn = c.function as { name?: string; arguments?: string };
          return {
            toolCallId: (c.id as string) || `tc-${Math.random().toString(36).slice(2, 8)}`,
            toolName: fn.name || 'unknown',
            arguments: fn.arguments || '{}',
            status: (isStreaming ? 'executing' : 'success') as ToolCallDisplay['status'],
          };
        });
    } catch {
      return [];
    }
  }, [message.toolCalls, message.toolCallsDisplay, isStreaming]);

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center py-2"
      >
        <Badge variant="outline" className="border-border/50 text-[10px] text-muted-foreground">
          System: {message.content}
        </Badge>
      </motion.div>
    );
  }

  if (isTool) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center py-2"
      >
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-emerald-400/70">🔧 Tool:</span> {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm',
          isUser
            ? 'bg-zinc-700 ring-1 ring-zinc-600'
            : 'bg-emerald-500/15 ring-1 ring-emerald-500/20'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-zinc-300" />
        ) : (
          <span className="text-base">{agentConfig.avatar}</span>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex max-w-[90%] sm:max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Name + Time */}
        <div
          className={cn(
            'flex items-center gap-2 text-[10px] text-muted-foreground/60',
            isUser && 'flex-row-reverse'
          )}
        >
          <span className="font-medium">
            {isUser ? 'You' : agentConfig.agentName}
          </span>
          <span>{formatTime(message.createdAt)}</span>
          {isStreaming && (
            <span className="text-emerald-400/60">streaming...</span>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            isUser
              ? 'rounded-tr-sm bg-emerald-600/90 text-white shadow-lg shadow-emerald-500/10'
              : 'rounded-tl-sm border border-border/50 bg-card'
          )}
        >
          {isUser ? (
            <div>
              <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
              {imageMatch && (
                <ImageContent src={imageMatch[1]} alt="User attached image" />
              )}
            </div>
          ) : (
            <div className="markdown-body">
              {/* Thinking indicator: show when streaming with no content and no thinking content yet */}
              {isThinking && !isStreaming && <ThinkingIndicator />}
              {isStreaming && !textContent && !message.thinkingContent && <ThinkingIndicator />}

              {/* Thinking/reasoning block: collapsible details element */}
              {message.thinkingContent && <ThinkingBlock content={message.thinkingContent} />}

              {/* Tool Call Blocks */}
              {parsedToolCalls.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  <AnimatePresence>
                    {parsedToolCalls.map((tc, idx) => (
                      <ToolCallBlock
                        key={tc.toolCallId || `tc-${idx}`}
                        toolCall={tc}
                        isLatest={idx === parsedToolCalls.length - 1}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Image from tool results */}
              {message.toolResults && message.toolResults.startsWith('data:image') && (
                <ImageContent src={message.toolResults} alt="AI analyzed image" />
              )}

              {/* Text content */}
              {textContent && (
                <>
                  <RichContentRenderer content={textContent} isStreaming={isStreaming} />
                  {isStreaming && <BlinkingCursor />}
                </>
              )}
            </div>
          )}
        </div>

        {/* Token count */}
        {message.tokens > 0 && (
          <span className="text-[10px] text-muted-foreground/40">
            {message.tokens} tokens
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function MessageListLoading() {
  const { agentConfig } = useChatStore();

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
        <span className="text-base">{agentConfig.avatar}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground/60">
          {agentConfig.agentName}
        </span>
        <div className="rounded-xl rounded-tl-sm border border-border/50 bg-card px-4 py-2">
          <TypingIndicator />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// V3 Capability Card
// ────────────────────────────────────────────

interface CapabilityCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function CapabilityCard({ card, index }: { card: CapabilityCard; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.3 }}
      className={cn(
        'rounded-xl border p-4 transition-all hover:shadow-lg',
        card.borderColor,
        'bg-card/80',
      )}
    >
      <div className={cn(
        'mb-3 flex h-9 w-9 items-center justify-center rounded-lg',
        card.bgColor,
      )}>
        {card.icon}
      </div>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{card.title}</h3>
      <p className="text-[11px] leading-relaxed text-muted-foreground/70">{card.description}</p>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Enhanced Welcome State (V3)
// ────────────────────────────────────────────

export function WelcomeState() {
  const { agentConfig } = useChatStore();

  const quickActions = [
    '帮我写一个REST API',
    '分析这个项目的代码结构',
    '搜索代码中的TODO注释',
    '帮我调试一个bug',
  ];

  const capabilities: CapabilityCard[] = [
    {
      icon: <Wrench className="h-4.5 w-4.5 text-sky-400" />,
      title: 'Tool Execution',
      description: 'Execute shell commands, file operations, and code search with real-time results.',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/15 hover:border-sky-500/30',
    },
    {
      icon: <BrainCircuit className="h-4.5 w-4.5 text-amber-400" />,
      title: 'Thinking Mode',
      description: 'Enable reasoning models for step-by-step problem solving and code analysis.',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/15 hover:border-amber-500/30',
    },
    {
      icon: <Code2 className="h-4.5 w-4.5 text-emerald-400" />,
      title: 'Code Generation',
      description: 'Generate, refactor, and debug code across multiple languages and frameworks.',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/15 hover:border-emerald-500/30',
    },
    {
      icon: <Search className="h-4.5 w-4.5 text-purple-400" />,
      title: 'Smart Search',
      description: 'Search the web for documentation, solutions, and up-to-date information.',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/15 hover:border-purple-500/30',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex h-full flex-col items-center overflow-y-auto px-6 py-12"
    >
      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20 codebot-glow"
      >
        <span className="text-3xl">{agentConfig.avatar}</span>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mb-1.5 text-xl font-semibold text-foreground"
      >
        {agentConfig.agentName}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mb-8 max-w-md text-center text-sm text-muted-foreground"
      >
        AI coding assistant with tool execution, thinking mode, and agentic workflows. Write, debug, and ship code faster.
      </motion.p>

      {/* V3 Capability Cards — 2x2 Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="mb-8 grid w-full max-w-lg grid-cols-2 gap-3 sm:gap-4"
      >
        {capabilities.map((card, i) => (
          <CapabilityCard key={card.title} card={card} index={i} />
        ))}
      </motion.div>

      {/* Quick Actions */}
      <div className="mb-8 w-full max-w-lg">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.2 }}
          className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40"
        >
          Quick Start
        </motion.p>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {quickActions.map((action, i) => (
            <motion.button
              key={action}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.2 }}
              className="rounded-lg border border-border/50 bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-foreground"
              onClick={() => {
                const event = new CustomEvent('quick-action', { detail: action });
                window.dispatchEvent(event);
              }}
            >
              <span className="mr-2 text-emerald-400/60">→</span>
              {action}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
        className="flex items-center gap-2 text-xs text-muted-foreground/50"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
        Ready to assist
      </motion.div>
    </motion.div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';
import { useChatStore } from '@/store/chat-store';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Bot, User, Brain } from 'lucide-react';
import { useState, useCallback } from 'react';

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
          'flex max-w-[80%] flex-col gap-1',
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
              {/* Thinking indicator */}
              {isThinking && !isStreaming && <ThinkingIndicator />}
              {isStreaming && !textContent && <ThinkingIndicator />}

              {/* Image from tool results */}
              {message.toolResults && message.toolResults.startsWith('data:image') && (
                <ImageContent src={message.toolResults} alt="AI analyzed image" />
              )}

              {/* Text content */}
              {textContent && (
                <>
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');

                        if (match) {
                          return (
                            <div className="codebot-code-block my-2">
                              <div className="codebot-code-header">
                                <span className="font-mono">{match[1]}</span>
                                <CopyButton text={codeString} />
                              </div>
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: 0,
                                  padding: '1rem',
                                  background: 'oklch(0.09 0.005 260)',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
                          );
                        }

                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre({ children }) {
                        return <>{children}</>;
                      },
                    }}
                  >
                    {textContent}
                  </ReactMarkdown>
                  {/* Blinking cursor for streaming */}
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

export function WelcomeState() {
  const { agentConfig } = useChatStore();
  const quickActions = [
    'Build a REST API with Express',
    'Debug this React component',
    'Create a database schema',
    'Write unit tests',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
    >
      {/* Avatar */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20 codebot-glow">
        <span className="text-3xl">{agentConfig.avatar}</span>
      </div>

      {/* Title */}
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {agentConfig.agentName}
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
        Your AI coding assistant. I can help you write code, debug issues, search
        codebases, and much more.
      </p>

      {/* Quick Actions */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {quickActions.map((action, i) => (
          <motion.button
            key={action}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.2 }}
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

      {/* Status */}
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/50">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
        Ready to assist
      </div>
    </motion.div>
  );
}

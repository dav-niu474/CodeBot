'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { NvidiaModel, ModelCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Cpu,
  Search,
  Eye,
  Zap,
  Check,
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Globe,
  Plus,
  Trash2,
  Link2,
  KeyRound,
  Server,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface CustomModelData {
  id: string;
  name: string;
  modelId: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  apiFormat: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  category: string;
  isEnabled: boolean;
  createdAt: string;
}

type FilterTab = 'all' | ModelCategory | 'large' | 'recommended' | 'custom';

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'custom', label: 'Custom' },
  { id: 'chat', label: 'Chat' },
  { id: 'code', label: 'Code' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'vision', label: 'Vision' },
  { id: 'embedding', label: 'Embedding' },
  { id: 'fast', label: 'Fast' },
  { id: 'large', label: 'Large' },
];

// ────────────────────────────────────────────
// Provider color map
// ────────────────────────────────────────────
const providerColors: Record<string, string> = {
  nvidia: 'bg-green-500',
  meta: 'bg-blue-500',
  mistral: 'bg-orange-500',
  google: 'bg-red-500',
  microsoft: 'bg-sky-500',
  openai: 'bg-emerald-400',
  custom: 'bg-violet-500',
  default: 'bg-zinc-500',
};

const categoryColors: Record<string, string> = {
  chat: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  code: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  reasoning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  vision: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  fast: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  audio: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  embedding: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  custom: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

// ────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────
function ModelCardSkeleton() {
  return (
    <Card className="border-border/50 bg-zinc-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────
// Model Card
// ────────────────────────────────────────────
function ModelCard({
  model,
  isSelected,
  onSelect,
  onTest,
}: {
  model: NvidiaModel;
  isSelected: boolean;
  onSelect: () => void;
  onTest: () => void;
}) {
  const providerColor =
    providerColors[model.provider.toLowerCase()] ?? providerColors.default;
  const catColor =
    categoryColors[model.category] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  const contextK = model.contextLength >= 1000
    ? `${Math.round(model.contextLength / 1000)}K`
    : model.contextLength.toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'group relative border p-4 transition-all hover:shadow-lg hover:shadow-black/10',
          isSelected
            ? 'border-emerald-500/40 bg-emerald-500/5 shadow-emerald-500/5'
            : 'border-border/50 bg-zinc-900/80 hover:border-border/80'
        )}
      >
        {isSelected && (
          <div className="absolute right-3 top-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-3 w-3 text-white" />
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 pr-8">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white',
              providerColor
            )}
          >
            {model.provider.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {model.name}
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {model.provider}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn('h-5 px-1.5 text-[9px] font-medium', catColor)}
          >
            {model.category}
          </Badge>
          {model.isFree && (
            <Badge
              variant="outline"
              className="h-5 border-emerald-500/20 bg-emerald-500/5 px-1.5 text-[9px] font-medium text-emerald-400"
            >
              Free
            </Badge>
          )}
          {model.supportsVision && (
            <div className="flex h-5 items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/5 px-1.5">
              <Eye className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-medium text-purple-400">Vision</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60">{contextK} context</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={onSelect}
            size="sm"
            className={cn(
              'h-7 text-[11px]',
              isSelected
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'border-border/60 bg-transparent text-foreground hover:bg-zinc-800'
            )}
            variant={isSelected ? 'default' : 'outline'}
          >
            {isSelected ? (
              <><Check className="mr-1 h-3 w-3" />Selected</>
            ) : (
              'Select'
            )}
          </Button>
          <Button
            onClick={onTest}
            size="sm"
            variant="outline"
            className="h-7 border-border/60 text-[11px] text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Test
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Custom Model Card
// ────────────────────────────────────────────
function CustomModelCard({
  model,
  isSelected,
  onSelect,
  onTest,
  onDelete,
}: {
  model: CustomModelData;
  isSelected: boolean;
  onSelect: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const contextK = model.contextLength >= 1000
    ? `${Math.round(model.contextLength / 1000)}K`
    : model.contextLength.toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'group relative border p-4 transition-all hover:shadow-lg hover:shadow-black/10',
          isSelected
            ? 'border-violet-500/40 bg-violet-500/5 shadow-violet-500/5'
            : 'border-violet-500/20 bg-zinc-900/80 hover:border-violet-500/40'
        )}
      >
        {isSelected && (
          <div className="absolute right-3 top-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
              <Check className="h-3 w-3 text-white" />
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-xs font-bold text-white">
            C
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{model.name}</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              <Link2 className="mr-0.5 inline h-2.5 w-2.5" />
              {model.baseUrl.replace(/https?:\/\//, '').split('/')[0]}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="h-5 border-violet-500/20 bg-violet-500/10 px-1.5 text-[9px] font-medium text-violet-400"
          >
            Custom
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-medium text-muted-foreground">
            {model.apiFormat}
          </Badge>
          {model.supportsVision && (
            <div className="flex h-5 items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/5 px-1.5">
              <Eye className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-medium text-purple-400">Vision</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60">{contextK} context</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={onSelect}
            size="sm"
            className={cn(
              'h-7 text-[11px]',
              isSelected
                ? 'bg-violet-600 text-white hover:bg-violet-500'
                : 'border-border/60 bg-transparent text-foreground hover:bg-zinc-800'
            )}
            variant={isSelected ? 'default' : 'outline'}
          >
            {isSelected ? (
              <><Check className="mr-1 h-3 w-3" />Selected</>
            ) : (
              'Select'
            )}
          </Button>
          <Button
            onClick={onTest}
            size="sm"
            variant="outline"
            className="h-7 border-border/60 text-[11px] text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Test
          </Button>
          <Button
            onClick={onDelete}
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-[11px] text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Test Dialog (works for both NVIDIA and custom models)
// ────────────────────────────────────────────
function TestModelDialog({
  modelName,
  modelId,
  isCustom,
  open,
  onOpenChange,
}: {
  modelName: string;
  modelId: string;
  isCustom: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState('Hello! Can you introduce yourself?');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const handleTest = useCallback(async () => {
    if (!modelId || !message.trim()) return;
    setIsLoading(true);
    setResponse(null);

    try {
      const endpoint = isCustom ? '/api/custom-models/test' : '/api/models/test';
      const body = isCustom
        ? { modelId, message: message.trim() }
        : { model: modelId, message: message.trim() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setResponse(`Error: ${data.error}${data.details ? `\n${data.details}` : ''}`);
        toast.error('Model test failed', { description: data.error });
      } else {
        setResponse(data.content || 'No response received.');
        if (data.latencyMs) {
          setResponse((prev) => `${prev}\n\n⏱ ${data.latencyMs}ms`);
        }
      }
    } catch {
      setResponse('Network error: Could not reach the API.');
      toast.error('Connection failed');
    } finally {
      setIsLoading(false);
    }
  }, [modelId, message, isCustom]);

  useEffect(() => {
    if (open) {
      setResponse(null);
      setMessage('Hello! Can you introduce yourself?');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className={cn('h-4 w-4', isCustom ? 'text-violet-400' : 'text-emerald-400')} />
            Test {modelName}
            {isCustom && (
              <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-[9px] text-violet-400">
                Custom
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Test Message</label>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a test message..."
                className="border-border/50 bg-zinc-950 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTest();
                  }
                }}
              />
              <Button
                onClick={handleTest}
                disabled={isLoading || !message.trim()}
                size="sm"
                className={cn(
                  'h-9 shrink-0 px-3 text-white',
                  isCustom
                    ? 'bg-violet-600 hover:bg-violet-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="min-h-[120px] max-h-[240px] overflow-y-auto rounded-lg border border-border/50 bg-zinc-950 p-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span className="text-sm">Waiting for response...</span>
              </div>
            ) : response ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{response}</p>
            ) : (
              <p className="text-sm text-muted-foreground/50">Model response will appear here...</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// Add Custom Model Dialog
// ────────────────────────────────────────────
function AddCustomModelDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiFormat, setApiFormat] = useState('openai');
  const [contextLength, setContextLength] = useState('8192');
  const [supportsStreaming, setSupportsStreaming] = useState(true);
  const [supportsVision, setSupportsVision] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setModelId('');
    setBaseUrl('');
    setApiKey('');
    setApiFormat('openai');
    setContextLength('8192');
    setSupportsStreaming(true);
    setSupportsVision(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !modelId.trim() || !baseUrl.trim() || !apiKey.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/custom-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          modelId: modelId.trim(),
          baseUrl: baseUrl.trim().replace(/\/$/, ''),
          apiKey: apiKey.trim(),
          apiFormat,
          contextLength: parseInt(contextLength, 10) || 8192,
          supportsStreaming,
          supportsVision,
          category: 'chat',
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error('Failed to add model', { description: data.error });
      } else {
        toast.success('Custom model added', { description: `${name} is now available.` });
        resetForm();
        onOpenChange(false);
        onAdded();
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, modelId, baseUrl, apiKey, apiFormat, contextLength, supportsStreaming, supportsVision, onOpenChange, onAdded, resetForm]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-violet-400" />
            Add Custom Model
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Model Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My GPT-4"
                className="h-9 border-border/50 bg-zinc-950 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Model ID *</Label>
              <Input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="gpt-4"
                className="h-9 border-border/50 bg-zinc-950 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              <Server className="mr-1 inline h-3 w-3" />
              API Base URL *
            </Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="h-9 border-border/50 bg-zinc-950 text-sm"
            />
            <p className="text-[10px] text-muted-foreground/50">
              OpenAI-compatible endpoint. Do not include /chat/completions
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              <KeyRound className="mr-1 inline h-3 w-3" />
              API Key *
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="h-9 border-border/50 bg-zinc-950 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">API Format</Label>
              <select
                value={apiFormat}
                onChange={(e) => setApiFormat(e.target.value)}
                className="h-9 w-full rounded-md border border-border/50 bg-zinc-950 px-3 text-sm text-foreground"
              >
                <option value="openai">OpenAI Compatible</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Context Length</Label>
              <Input
                type="number"
                value={contextLength}
                onChange={(e) => setContextLength(e.target.value)}
                className="h-9 border-border/50 bg-zinc-950 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsStreaming}
                onChange={(e) => setSupportsStreaming(e.target.checked)}
                className="rounded border-border bg-zinc-950"
              />
              <span className="text-xs text-muted-foreground">Streaming</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsVision}
                onChange={(e) => setSupportsVision(e.target.checked)}
                className="rounded border-border bg-zinc-950"
              />
              <span className="text-xs text-muted-foreground">Vision</span>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !modelId.trim() || !baseUrl.trim() || !apiKey.trim()}
              className="flex-1 bg-violet-600 text-white hover:bg-violet-500"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" />Add Model</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// Selected Model Panel
// ────────────────────────────────────────────
function SelectedModelPanel({
  model,
  isCustom,
}: {
  model: NvidiaModel | CustomModelData | undefined;
  isCustom: boolean;
}) {
  if (!model) return null;

  const providerColor = isCustom
    ? 'bg-violet-500'
    : providerColors[model.provider?.toLowerCase()] ?? providerColors.default;
  const contextK =
    (model.contextLength ?? 0) >= 1000
      ? `${Math.round((model.contextLength ?? 0) / 1000)}K`
      : (model.contextLength ?? 0).toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mt-6 rounded-xl border p-4',
        isCustom
          ? 'border-violet-500/20 bg-violet-500/5'
          : 'border-emerald-500/20 bg-emerald-500/5'
      )}
    >
      <div className="flex items-center gap-2">
        <Check className={cn('h-4 w-4', isCustom ? 'text-violet-400' : 'text-emerald-400')} />
        <span className={cn('text-xs font-semibold', isCustom ? 'text-violet-400' : 'text-emerald-400')}>
          Currently Selected
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white',
            providerColor
          )}
        >
          {isCustom ? 'C' : model.provider?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{model.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{model.provider ?? 'Custom'}</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground">{contextK} tokens</span>
            {isCustom && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <Badge className="h-4 border-violet-500/20 bg-violet-500/10 px-1.5 text-[9px] text-violet-400">
                  Custom
                </Badge>
              </>
            )}
          </div>
        </div>
        <p className="max-w-xs truncate text-[10px] text-muted-foreground/60">
          {model.id ?? model.modelId}
        </p>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Main ModelHubView
// ────────────────────────────────────────────
export function ModelHubView() {
  const { models, selectedModel, setModels, setSelectedModel } = useChatStore();

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Custom models state
  const [customModels, setCustomModels] = useState<CustomModelData[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Test dialog state (works for both types)
  const [testInfo, setTestInfo] = useState<{ name: string; id: string; isCustom: boolean } | null>(null);

  // Fetch NVIDIA models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        const modelList = Array.isArray(data)
          ? data
          : Array.isArray(data.models)
            ? data.models
            : null;
        if (modelList && modelList.length > 0) {
          setModels(modelList);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, [setModels]);

  // Fetch custom models on mount
  const fetchCustomModels = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-models');
      const data = await res.json();
      if (data.models) {
        setCustomModels(data.models);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCustomModels();
  }, [fetchCustomModels]);

  // Filter NVIDIA models
  const filteredModels = models.filter((model) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !model.name.toLowerCase().includes(q) &&
        !model.id.toLowerCase().includes(q) &&
        !model.provider.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (activeTab === 'all') return true;
    if (activeTab === 'large') return model.contextLength >= 100000;
    if (activeTab === 'custom') return false;
    if (activeTab === 'recommended') {
      const recommendedIds = new Set([
        'meta/llama-3.3-70b-instruct',
        'google/gemma-3-27b-it',
        'qwen/qwen2.5-coder-32b-instruct',
        'moonshotai/kimi-k2-instruct',
        'deepseek-ai/deepseek-r1-distill-qwen-32b',
        'mistralai/mistral-large-3-675b-instruct-2512',
        'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        'qwen/qwen3.5-397b-a17b',
        'qwen/qwen3-coder-480b-a35b-instruct',
        'meta/llama-3.2-90b-vision-instruct',
        'z-ai/glm5',
        'stepfun-ai/step-3.5-flash',
      ]);
      return recommendedIds.has(model.id);
    }
    return model.category === activeTab;
  });

  // Filter custom models
  const filteredCustomModels = customModels.filter((model) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !model.name.toLowerCase().includes(q) &&
        !model.modelId.toLowerCase().includes(q) &&
        !model.baseUrl.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (activeTab === 'custom' || activeTab === 'all') return true;
    return false;
  });

  // Find selected model data (check both NVIDIA and custom)
  const selectedNvidiaModel = models.find((m) => m.id === selectedModel);
  const selectedCustomModel = customModels.find((m) => m.modelId === selectedModel);

  const handleSelectNvidia = (model: NvidiaModel) => {
    setSelectedModel(model.id);
    toast.success('Model selected', { description: `${model.name} is now the active model.` });
  };

  const handleSelectCustom = (model: CustomModelData) => {
    setSelectedModel(model.modelId);
    toast.success('Custom model selected', { description: `${model.name} is now the active model.` });
  };

  const handleTestNvidia = (model: NvidiaModel) => {
    setTestInfo({ name: model.name, id: model.id, isCustom: false });
  };

  const handleTestCustom = (model: CustomModelData) => {
    setTestInfo({ name: model.name, id: model.modelId, isCustom: true });
  };

  const handleDeleteCustom = async (model: CustomModelData) => {
    try {
      const res = await fetch(`/api/custom-models/${model.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        toast.error('Failed to delete', { description: data.error });
      } else {
        toast.success('Model deleted', { description: `${model.name} has been removed.` });
        if (selectedModel === model.modelId) {
          setSelectedModel('meta/llama-3.3-70b-instruct');
        }
        fetchCustomModels();
      }
    } catch {
      toast.error('Failed to delete model');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Cpu className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Model Hub</h1>
              <p className="text-xs text-muted-foreground">
                {models.length} NVIDIA models · {customModels.length} custom models
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="h-9 border-border/50 bg-zinc-900 pl-9 text-sm"
              />
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              size="sm"
              className="h-9 gap-1.5 bg-violet-600 text-white hover:bg-violet-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Custom</span>
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
                activeTab === tab.id
                  ? tab.id === 'custom'
                    ? 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20'
                    : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 pl-2">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {filteredModels.length + filteredCustomModels.length} models
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ModelCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              {/* Custom Models Section (shown on 'all' and 'custom' tabs) */}
              {(activeTab === 'all' || activeTab === 'custom') && filteredCustomModels.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-foreground">Custom Models</h2>
                    <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-[10px] text-violet-400">
                      {filteredCustomModels.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCustomModels.map((cm) => (
                      <CustomModelCard
                        key={cm.id}
                        model={cm}
                        isSelected={selectedModel === cm.modelId}
                        onSelect={() => handleSelectCustom(cm)}
                        onTest={() => handleTestCustom(cm)}
                        onDelete={() => handleDeleteCustom(cm)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for custom tab */}
              {activeTab === 'custom' && filteredCustomModels.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <Globe className="mb-3 h-12 w-12 text-muted-foreground/15" />
                  <p className="text-sm text-muted-foreground">No custom models yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/50">
                    Add your own OpenAI-compatible API model
                  </p>
                  <Button
                    onClick={() => setAddDialogOpen(true)}
                    className="mt-4 bg-violet-600 text-white hover:bg-violet-500"
                    size="sm"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Custom Model
                  </Button>
                </motion.div>
              )}

              {/* NVIDIA Models Grid (hidden on 'custom' tab) */}
              {activeTab !== 'custom' && (
                <AnimatePresence mode="wait">
                  {filteredModels.length === 0 && filteredCustomModels.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-16"
                    >
                      <Cpu className="mb-3 h-12 w-12 text-muted-foreground/15" />
                      <p className="text-sm text-muted-foreground">No models found</p>
                      <p className="mt-1 text-xs text-muted-foreground/50">Try adjusting your search or filter</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={activeTab + searchQuery}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {filteredModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={selectedModel === model.id}
                          onSelect={() => handleSelectNvidia(model)}
                          onTest={() => handleTestNvidia(model)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Selected Model Panel */}
              {(selectedNvidiaModel || selectedCustomModel) && (
                <SelectedModelPanel
                  model={selectedNvidiaModel ?? selectedCustomModel ?? undefined}
                  isCustom={!!selectedCustomModel}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Test Dialog */}
      <TestModelDialog
        modelName={testInfo?.name ?? ''}
        modelId={testInfo?.id ?? ''}
        isCustom={testInfo?.isCustom ?? false}
        open={!!testInfo}
        onOpenChange={(open) => { if (!open) setTestInfo(null); }}
      />

      {/* Add Custom Model Dialog */}
      <AddCustomModelDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdded={fetchCustomModels}
      />
    </div>
  );
}

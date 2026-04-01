'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { NvidiaModel, ModelCategory } from '@/lib/types';
import { DEFAULT_NVIDIA_MODELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Shield,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ────────────────────────────────────────────
// Category tabs
// ────────────────────────────────────────────
type FilterTab = 'all' | ModelCategory | 'large';

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'chat', label: 'Chat' },
  { id: 'code', label: 'Code' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'vision', label: 'Vision' },
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
};

// ────────────────────────────────────────────
// Loading skeleton card
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

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          {/* Provider logo */}
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

        {/* Badges row */}
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
              <span className="text-[9px] font-medium text-purple-400">
                Vision
              </span>
            </div>
          )}
        </div>

        {/* Context length */}
        <div className="mt-3 flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60">
            {contextK} context
          </span>
        </div>

        {/* Actions */}
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
              <>
                <Check className="mr-1 h-3 w-3" />
                Selected
              </>
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
// Test Dialog
// ────────────────────────────────────────────
function TestModelDialog({
  model,
  open,
  onOpenChange,
}: {
  model: NvidiaModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState('Hello! Can you introduce yourself?');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const handleTest = useCallback(async () => {
    if (!model || !message.trim()) return;
    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model.id, message: message.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setResponse(`Error: ${data.error}`);
        toast.error('Model test failed', { description: data.error });
      } else {
        setResponse(data.content || 'No response received.');
      }
    } catch {
      setResponse('Network error: Could not reach the model test API.');
      toast.error('Connection failed');
    } finally {
      setIsLoading(false);
    }
  }, [model, message]);

  // Reset when dialog opens/closes or model changes
  useEffect(() => {
    if (open) {
      setResponse(null);
      setMessage('Hello! Can you introduce yourself?');
    }
  }, [open, model]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            Test {model?.name ?? 'Model'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Test Message
            </label>
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
                className="h-9 shrink-0 bg-emerald-600 px-3 text-white hover:bg-emerald-500"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Response area */}
          <div className="min-h-[120px] rounded-lg border border-border/50 bg-zinc-950 p-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span className="text-sm">Waiting for response...</span>
              </div>
            ) : response ? (
              <ScrollArea className="max-h-[200px]">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {response}
                </p>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground/50">
                Model response will appear here...
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// Selected Model Panel (bottom)
// ────────────────────────────────────────────
function SelectedModelPanel({
  model,
}: {
  model: NvidiaModel | undefined;
}) {
  if (!model) return null;

  const providerColor =
    providerColors[model.provider.toLowerCase()] ?? providerColors.default;
  const contextK = model.contextLength >= 1000
    ? `${Math.round(model.contextLength / 1000)}K`
    : model.contextLength.toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
    >
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">
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
          {model.provider.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {model.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {model.provider}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground">
              {contextK} tokens
            </span>
            {model.supportsVision && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1 text-[11px] text-purple-400">
                  <Eye className="h-3 w-3" /> Vision
                </span>
              </>
            )}
            {model.isFree && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <Badge className="h-4 bg-emerald-500/10 px-1.5 text-[9px] text-emerald-400">
                  Free
                </Badge>
              </>
            )}
          </div>
        </div>
        <p className="max-w-xs truncate text-[10px] text-muted-foreground/60">
          {model.id}
        </p>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Main ModelHubView
// ────────────────────────────────────────────
export function ModelHubView() {
  const { models, selectedModel, setModels, setSelectedModel } =
    useChatStore();

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [testModel, setTestModel] = useState<NvidiaModel | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Fetch models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        // API returns { success, models: [...] }
        const modelList = Array.isArray(data)
          ? data
          : Array.isArray(data.models)
            ? data.models
            : null;
        if (modelList && modelList.length > 0) {
          setModels(modelList);
        } else {
          // Fallback to defaults
          setModels(DEFAULT_NVIDIA_MODELS);
        }
      } catch {
        setModels(DEFAULT_NVIDIA_MODELS);
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, [setModels]);

  // Filter models
  const filteredModels = models.filter((model) => {
    // Search filter
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

    // Category filter
    if (activeTab === 'all') return true;
    if (activeTab === 'large') return model.contextLength >= 100000;
    return model.category === activeTab;
  });

  const selectedModelData = models.find((m) => m.id === selectedModel);

  const handleSelect = (model: NvidiaModel) => {
    setSelectedModel(model.id);
    toast.success('Model selected', {
      description: `${model.name} is now the active model.`,
    });
  };

  const handleTest = (model: NvidiaModel) => {
    setTestModel(model);
    setTestDialogOpen(true);
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
              <h1 className="text-lg font-semibold text-foreground">
                Model Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Browse and select NVIDIA AI models
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="h-9 border-border/50 bg-zinc-900 pl-9 text-sm"
            />
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
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 pl-2">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {filteredModels.length} models
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Loading state */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ModelCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              {/* Model grid */}
              <AnimatePresence mode="wait">
                {filteredModels.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <Cpu className="mb-3 h-12 w-12 text-muted-foreground/15" />
                    <p className="text-sm text-muted-foreground">
                      No models found
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/50">
                      Try adjusting your search or filter
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeTab + searchQuery}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                  >
                    {filteredModels.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        isSelected={selectedModel === model.id}
                        onSelect={() => handleSelect(model)}
                        onTest={() => handleTest(model)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Selected Model Panel */}
              <SelectedModelPanel model={selectedModelData} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Test Dialog */}
      <TestModelDialog
        model={testModel}
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
      />
    </div>
  );
}

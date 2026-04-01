// ============================================================
// NVIDIA NIM API Client
// OpenAI-compatible chat completions with streaming support
// ============================================================

const NVIDIA_API_KEY = "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";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 40;

let requestTimestamps: number[] = [];

// ============================================================
// Types
// ============================================================

export type ModelCategory = "chat" | "reasoning" | "vision" | "code" | "large";

export interface NvidiaModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  isFree: boolean;
  category: ModelCategory;
  description: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamDelta {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface NvidiaListedModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  root: string;
  parent: string | null;
  permission: Array<{
    id: string;
    object: string;
    created: number;
    allow_sampling_engine: boolean;
    allow_search_engine: boolean;
    allow_fine_tuning: boolean;
    organization: string;
    group: string | null;
    is_blocking: boolean;
  }>;
}

export class NvidiaApiError extends Error {
  status: number;
  code: string | null;
  headers: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    headers: Record<string, string> = {}
  ) {
    super(message);
    this.name = "NvidiaApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

// ============================================================
// Rate Limit Tracker
// ============================================================

function checkRateLimit(): void {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = requestTimestamps[0];
    const waitTime = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000
    );
    throw new NvidiaApiError(
      `Rate limit exceeded. Please wait ${waitTime}s before trying again.`,
      429,
      "rate_limit_exceeded"
    );
  }

  requestTimestamps.push(now);
}

// ============================================================
// Helper: delay
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Core fetch with retry
// ============================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  checkRateLimit();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          ...options.headers,
        },
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[NVIDIA] Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`
        );
        await delay(waitMs);
        continue;
      }

      if (response.status >= 500 && response.status < 600) {
        const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[NVIDIA] Server error ${response.status}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`
        );
        await delay(waitMs);
        continue;
      }

      const errorBody = await response.text();
      let errorJson: Record<string, unknown> = {};
      try {
        errorJson = JSON.parse(errorBody);
      } catch {
        // use raw text
      }

      throw new NvidiaApiError(
        typeof errorJson.error === "string"
          ? errorJson.error
          : errorBody || `HTTP ${response.status}`,
        response.status,
        response.headers.get("x-request-id")
      );
    } catch (error) {
      lastError = error as Error;
      if (error instanceof NvidiaApiError) {
        throw error;
      }
      if (attempt < retries - 1) {
        const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[NVIDIA] Network error, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries}):`,
          (error as Error).message
        );
        await delay(waitMs);
        continue;
      }
    }
  }

  throw new NvidiaApiError(
    lastError?.message || "Request failed after all retries",
    0,
    "network_error"
  );
}

// ============================================================
// API Methods
// ============================================================

/**
 * List all models available on the NVIDIA NIM platform.
 */
export async function listModels(): Promise<NvidiaListedModel[]> {
  const response = await fetchWithRetry(`${NVIDIA_BASE_URL}/models`, {
    method: "GET",
  });

  const data = await response.json();
  return data.data || [];
}

/**
 * Get curated recommended models with full metadata.
 */
export function getRecommendedModels(): NvidiaModelInfo[] {
  return [
    {
      id: "meta/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      provider: "Meta",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: false,
      isFree: true,
      category: "chat",
      description: "Default fast model — excellent general-purpose instruction following with strong reasoning capabilities",
    },
    {
      id: "google/gemma-3-27b-it",
      name: "Gemma 3 27B",
      provider: "Google",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: true,
      isFree: true,
      category: "chat",
      description: "Balanced model with strong multilingual support and efficient inference",
    },
    {
      id: "qwen/qwen2.5-coder-32b-instruct",
      name: "Qwen 2.5 Coder 32B",
      provider: "Qwen (Alibaba)",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: false,
      isFree: true,
      category: "code",
      description: "Code specialist — excels at code generation, debugging, and explanation across 90+ languages",
    },
    {
      id: "moonshotai/kimi-k2-instruct",
      name: "Kimi K2",
      provider: "Moonshot AI",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: false,
      isFree: true,
      category: "reasoning",
      description: "Reasoning model with strong analytical and problem-solving capabilities",
    },
    {
      id: "mistralai/mistral-large-3-675b-instruct-2512",
      name: "Mistral Large 3 675B",
      provider: "Mistral AI",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: true,
      isFree: true,
      category: "large",
      description: "Large model with exceptional reasoning, multilingual, and coding performance",
    },
    {
      id: "deepseek-ai/deepseek-r1-distill-qwen-32b",
      name: "DeepSeek R1 32B",
      provider: "DeepSeek",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: false,
      isFree: true,
      category: "reasoning",
      description: "Thinking model with chain-of-thought reasoning distilled from DeepSeek R1",
    },
    {
      id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      name: "Nemotron Ultra 253B",
      provider: "NVIDIA",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: false,
      isFree: true,
      category: "large",
      description: "Ultra-capable model optimized by NVIDIA for complex reasoning and instruction following",
    },
    {
      id: "qwen/qwen3.5-397b-a17b",
      name: "Qwen 3.5 397B MoE",
      provider: "Qwen (Alibaba)",
      contextLength: 131072,
      supportsStreaming: true,
      supportsVision: true,
      isFree: true,
      category: "large",
      description: "Premium MoE model with massive 397B parameters, top-tier across all benchmarks",
    },
  ];
}

/**
 * Non-streaming chat completion.
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 1.0,
    frequency_penalty: options.frequencyPenalty ?? 0,
    presence_penalty: options.presencePenalty ?? 0,
    stream: false,
  };

  if (options.stop && options.stop.length > 0) {
    body.stop = options.stop;
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  const response = await fetchWithRetry(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return data as ChatCompletionResponse;
}

/**
 * Streaming chat completion — returns an async iterator of SSE deltas.
 */
export async function chatCompletionStream(
  options: ChatCompletionOptions
): Promise<AsyncIterable<StreamDelta>> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 1.0,
    frequency_penalty: options.frequencyPenalty ?? 0,
    presence_penalty: options.presencePenalty ?? 0,
    stream: true,
  };

  if (options.stop && options.stop.length > 0) {
    body.stop = options.stop;
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  const response = await fetchWithRetry(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.body) {
    throw new NvidiaApiError("Streaming response has no body", 0, "no_body");
  }

  return parseSSEStream(response.body);
}

/**
 * Low-level: create a streaming request and return the raw Response
 * (for piping directly to a web Response in API routes).
 */
export async function chatCompletionStreamRaw(
  options: ChatCompletionOptions
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 1.0,
    frequency_penalty: options.frequencyPenalty ?? 0,
    presence_penalty: options.presencePenalty ?? 0,
    stream: true,
  };

  if (options.stop && options.stop.length > 0) {
    body.stop = options.stop;
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  return fetchWithRetry(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ============================================================
// SSE Parser
// ============================================================

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncIterable<StreamDelta> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith(":")) {
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);

          if (data === "[DONE]") {
            return;
          }

          try {
            const parsed = JSON.parse(data) as StreamDelta;
            yield parsed;
          } catch {
            console.warn("[NVIDIA] Failed to parse SSE chunk:", data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================
// Utility: get model by ID from recommended list
// ============================================================

export function getModelInfo(
  modelId: string
): NvidiaModelInfo | undefined {
  return getRecommendedModels().find((m) => m.id === modelId);
}

/**
 * Get the default model ID.
 */
export function getDefaultModel(): string {
  return "meta/llama-3.3-70b-instruct";
}

/**
 * Get models grouped by category.
 */
export function getModelsByCategory(): Record<ModelCategory, NvidiaModelInfo[]> {
  const models = getRecommendedModels();
  const grouped: Record<ModelCategory, NvidiaModelInfo[]> = {
    chat: [],
    code: [],
    reasoning: [],
    vision: [],
    large: [],
  };

  for (const model of models) {
    if (grouped[model.category]) {
      grouped[model.category].push(model);
    }
    // Models that support vision also go in the vision category
    if (model.supportsVision && model.category !== "vision") {
      grouped.vision.push(model);
    }
  }

  return grouped;
}

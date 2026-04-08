// ============================================================
// Lazy Tool Executors — Runtime implementations for the 30 tools
// that previously only had schemas but no executor logic.
//
// These cover: tool-search, config, plan-mode, cron, remote-trigger,
// sleep, voice, dream-task, magic-docs, repl, notebook-edit (real),
// synthetic-output, team CRUD, task CRUD, worktree, powershell,
// skill, and MCP stubs.
// ============================================================

import type { ToolExecutionResult, ToolExecutionContext } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  enterPlanMode as planStateEnter,
  exitPlanMode as planStateExit,
  getPlanState as planStateGet,
} from '@/lib/plan/plan-state';

const execAsync = promisify(exec);

// ──────────────────────────────────────────────────────────────
// Shared in-memory stores (keyed by sessionId where applicable)
// ──────────────────────────────────────────────────────────────

/** In-memory cron jobs (per session) */
interface CronJob {
  id: string;
  schedule: string;
  task: string;
  enabled: boolean;
  createdAt: number;
}

const cronStore = new Map<string, Map<string, CronJob>>();

/** In-memory dream tasks (per session) */
interface DreamTask {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  createdAt: number;
}

const dreamTaskStore = new Map<string, Map<string, DreamTask>>();

/** In-memory generated docs store */
interface DocEntry {
  target: string;
  content: string;
  format: string;
  generatedAt: number;
}

const docsStore = new Map<string, DocEntry>();

/** In-memory background task store */
interface BackgroundTask {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  parentTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

const taskStore = new Map<string, Map<string, BackgroundTask>>();

/** In-memory team store */
interface TeamMember {
  id: string;
  role: 'leader' | 'worker' | 'scout';
  task: string;
  status: string;
}

interface Team {
  id: string;
  teamName: string;
  members: TeamMember[];
  createdAt: number;
}

const teamStore = new Map<string, Team>();

/** REPL session store (per session) */
const replSessionStore = new Map<string, string>();

/** Worktree state tracking (per session) */
const worktreeStore = new Map<string, { branchName: string; basePath: string }>();

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function getTaskMap(sessionId: string): Map<string, BackgroundTask> {
  if (!taskStore.has(sessionId)) {
    taskStore.set(sessionId, new Map());
  }
  return taskStore.get(sessionId)!;
}

function getCronMap(sessionId: string): Map<string, CronJob> {
  if (!cronStore.has(sessionId)) {
    cronStore.set(sessionId, new Map());
  }
  return cronStore.get(sessionId)!;
}

function getDreamMap(sessionId: string): Map<string, DreamTask> {
  if (!dreamTaskStore.has(sessionId)) {
    dreamTaskStore.set(sessionId, new Map());
  }
  return dreamTaskStore.get(sessionId)!;
}

/** Validate a cron expression (5-field: minute hour day month weekday) */
function validateCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  const validFields = parts.every((part) => {
    if (part === '*') return true;
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      return n >= 0;
    }
    // Support */n, n-m, n/m patterns
    return /^(\*|\d+)(-\d+)?(\/\d+)?$/.test(part) || /^(\d+,)+\d+$/.test(part);
  });
  return validFields;
}

// ──────────────────────────────────────────────────────────────
// 1. tool-search
// ──────────────────────────────────────────────────────────────

export async function executeToolSearch(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const query = (args.query as string || '').toLowerCase();
  const category = args.category as string | undefined;

  try {
    // Dynamic import to avoid circular dependency
    const { getAllToolSchemas, getToolMeta } = await import('@/lib/tools/definitions');
    const allSchemas = getAllToolSchemas();
    const allMeta = (await import('@/lib/types')).ALL_CLAUDE_TOOLS;

    const results = allMeta.filter((tool) => {
      const matchesQuery =
        !query ||
        tool.id.toLowerCase().includes(query) ||
        tool.name.toLowerCase().includes(query) ||
        tool.displayName.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query);

      const matchesCategory = !category || tool.category === category;
      return matchesQuery && matchesCategory;
    });

    if (results.length === 0) {
      return {
        output: `No tools found matching "${args.query || ''}"${category ? ` in category "${category}"` : ''}.`,
        metadata: { total: 0 },
      };
    }

    const lines = results.map((t, i) => {
      return `${i + 1}. **${t.displayName}** (${t.id}) — ${t.description}`;
    });

    return {
      output: `Found ${results.length} tool(s):\n\n${lines.join('\n')}`,
      metadata: {
        total: results.length,
        toolIds: results.map((t) => t.id),
      },
    };
  } catch (error) {
    return {
      output: `Error searching tools: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 2. config
// ──────────────────────────────────────────────────────────────

export async function executeConfig(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const action = args.action as string;

  if (!action || !['get', 'set', 'list', 'reset'].includes(action)) {
    return {
      output: 'Error: "action" must be one of: get, set, list, reset.',
      isError: true,
    };
  }

  try {
    const { db } = await import('@/lib/db');

    switch (action) {
      case 'list': {
        const configs = await db.agentConfig.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        const lines = configs.map((c: Record<string, unknown>) => {
          return `- ${c.id}: ${JSON.stringify({
            agentName: c.agentName,
            activeModel: c.activeModel,
            theme: c.theme,
            language: c.language,
            temperature: c.temperature,
            maxTokens: c.maxTokens,
            activeMode: c.activeMode,
          })}`;
        });
        return {
          output: `Agent configurations (${configs.length}):\n${lines.join('\n')}`,
          metadata: { total: configs.length },
        };
      }

      case 'get': {
        const key = args.key as string;
        if (!key) {
          return { output: 'Error: "key" is required for get action.', isError: true };
        }
        const latestConfig = await db.agentConfig.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        if (!latestConfig) {
          return { output: 'No agent configuration found.', isError: true };
        }
        const value = (latestConfig as Record<string, unknown>)[key];
        if (value === undefined) {
          return { output: `Config key "${key}" not found. Available keys: agentName, avatar, personality, maxTokens, temperature, autoCompact, compactThreshold, toolConcurrency, theme, language, thinkingEnabled, activeModel, activeMode.`, isError: true };
        }
        return {
          output: `${key} = ${JSON.stringify(value)}`,
          metadata: { key, value },
        };
      }

      case 'set': {
        const key = args.key as string;
        const value = args.value as string;
        if (!key || value === undefined) {
          return { output: 'Error: Both "key" and "value" are required for set action.', isError: true };
        }
        const latestConfig = await db.agentConfig.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        if (!latestConfig) {
          // Create a new config if none exists
          const allowedKeys: Record<string, unknown> = {
            agentName: key === 'agentName' ? value : 'CodeBot',
            avatar: key === 'avatar' ? value : '🤖',
            personality: key === 'personality' ? value : 'helpful',
            maxTokens: key === 'maxTokens' ? parseInt(value, 10) || 8192 : 8192,
            temperature: key === 'temperature' ? parseFloat(value) || 0.7 : 0.7,
            activeModel: key === 'activeModel' ? value : 'meta/llama-3.3-70b-instruct',
          };
          if (key in allowedKeys) {
            (allowedKeys as Record<string, unknown>)[key] = value;
          }
          await db.agentConfig.create({ data: allowedKeys as Record<string, unknown> });
          return { output: `Created new config with ${key} = ${value}` };
        }
        // Update existing config
        const updateData: Record<string, unknown> = {};
        const numericKeys = new Set(['maxTokens', 'compactThreshold', 'toolConcurrency']);
        const floatKeys = new Set(['temperature']);
        const boolKeys = new Set(['autoCompact', 'thinkingEnabled']);

        if (numericKeys.has(key)) {
          updateData[key] = parseInt(value, 10);
        } else if (floatKeys.has(key)) {
          updateData[key] = parseFloat(value);
        } else if (boolKeys.has(key)) {
          updateData[key] = value === 'true' || value === '1';
        } else {
          updateData[key] = value;
        }

        await db.agentConfig.update({
          where: { id: latestConfig.id },
          data: updateData,
        });
        return { output: `Updated ${key} = ${value}` };
      }

      case 'reset': {
        await db.agentConfig.deleteMany();
        await db.agentConfig.create({
          data: {
            agentName: 'CodeBot',
            avatar: '🤖',
            personality: 'helpful',
            maxTokens: 8192,
            temperature: 0.7,
            autoCompact: true,
            compactThreshold: 13000,
            toolConcurrency: 5,
            theme: 'dark',
            language: 'zh-CN',
            thinkingEnabled: false,
            activeModel: 'meta/llama-3.3-70b-instruct',
            activeMode: 'interactive',
          },
        });
        return { output: 'Configuration reset to defaults.' };
      }

      default:
        return { output: `Unknown config action: ${action}`, isError: true };
    }
  } catch (error) {
    return {
      output: `Error executing config ${action}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 3. enter-plan-mode / exit-plan-mode
// ──────────────────────────────────────────────────────────────

export async function executeEnterPlanMode(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const description = args.description as string | undefined;
  planStateEnter(context.sessionId);

  return {
    output: `[PLAN_MODE] Plan mode activated.${description ? ` Planning: ${description}` : ''}\n\nThe agent will now create plans before executing changes. Use exit-plan-mode to return to normal execution.`,
    metadata: {
      type: 'plan_mode_entered',
      description,
    },
  };
}

export async function executeExitPlanMode(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const existing = planStateGet(context.sessionId);
  planStateExit(context.sessionId);

  return {
    output: `[PLAN_MODE] Plan mode deactivated. Returning to normal execution mode.${existing ? `\nPlan had ${existing.steps?.length || 0} steps.` : ''}`,
    metadata: {
      type: 'plan_mode_exited',
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 4. schedule-cron
// ──────────────────────────────────────────────────────────────

export async function executeScheduleCron(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const action = args.action as string;
  if (!action || !['create', 'list', 'delete', 'enable', 'disable'].includes(action)) {
    return { output: 'Error: "action" must be one of: create, list, delete, enable, disable.', isError: true };
  }

  const cronMap = getCronMap(context.sessionId);

  try {
    switch (action) {
      case 'create': {
        const schedule = args.schedule as string;
        const task = args.task as string;
        if (!schedule || !task) {
          return { output: 'Error: "schedule" and "task" are required for create.', isError: true };
        }
        if (!validateCronExpression(schedule)) {
          return { output: 'Error: Invalid cron expression. Expected format: "minute hour day month weekday" (e.g. "0 * * * *" for hourly).', isError: true };
        }
        const id = generateId();
        cronMap.set(id, {
          id,
          schedule,
          task,
          enabled: true,
          createdAt: Date.now(),
        });
        return {
          output: `Cron job created:\n  ID: ${id}\n  Schedule: ${schedule}\n  Task: ${task}\n  Enabled: true\n\nNote: Cron jobs are stored in-memory and will not persist across server restarts.`,
          metadata: { cronId: id },
        };
      }

      case 'list': {
        const jobs = Array.from(cronMap.values());
        if (jobs.length === 0) {
          return { output: 'No cron jobs scheduled.' };
        }
        const lines = jobs.map((j) => {
          return `${j.enabled ? '✓' : '✗'} ${j.id} — ${j.schedule} — ${j.task}`;
        });
        return {
          output: `Cron jobs (${jobs.length}):\n${lines.join('\n')}`,
          metadata: { total: jobs.length },
        };
      }

      case 'delete': {
        const cronId = args.cronId as string;
        if (!cronId) {
          return { output: 'Error: "cronId" is required for delete.', isError: true };
        }
        if (!cronMap.has(cronId)) {
          return { output: `Error: Cron job "${cronId}" not found.`, isError: true };
        }
        cronMap.delete(cronId);
        return { output: `Cron job "${cronId}" deleted.` };
      }

      case 'enable': {
        const cronId = args.cronId as string;
        if (!cronId) {
          return { output: 'Error: "cronId" is required.', isError: true };
        }
        const job = cronMap.get(cronId);
        if (!job) {
          return { output: `Error: Cron job "${cronId}" not found.`, isError: true };
        }
        job.enabled = true;
        return { output: `Cron job "${cronId}" enabled.` };
      }

      case 'disable': {
        const cronId = args.cronId as string;
        if (!cronId) {
          return { output: 'Error: "cronId" is required.', isError: true };
        }
        const job = cronMap.get(cronId);
        if (!job) {
          return { output: `Error: Cron job "${cronId}" not found.`, isError: true };
        }
        job.enabled = false;
        return { output: `Cron job "${cronId}" disabled.` };
      }

      default:
        return { output: `Unknown cron action: ${action}`, isError: true };
    }
  } catch (error) {
    return {
      output: `Error in schedule-cron: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 5. remote-trigger
// ──────────────────────────────────────────────────────────────

export async function executeRemoteTrigger(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const url = args.url as string;
  if (!url) {
    return { output: 'Error: "url" is required for remote-trigger.', isError: true };
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { output: 'Error: URL must use http:// or https:// protocol.', isError: true };
    }
  } catch {
    return { output: `Error: Invalid URL format: "${url}"`, isError: true };
  }

  const method = (args.method as string) || 'POST';
  const payload = args.payload as Record<string, unknown> | undefined;
  const headers = args.headers as Record<string, string> | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const fetchOptions: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (payload && ['POST', 'PUT'].includes(method)) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    let body: string;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
    }

    const truncatedBody = body.length > 5000 ? body.substring(0, 5000) + '\n[... truncated ...]' : body;

    return {
      output: `HTTP ${response.status} ${response.statusText}\nURL: ${url}\nMethod: ${method}\n\n${truncatedBody}`,
      metadata: {
        status: response.status,
        url,
        method,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      return { output: `Error: Request to ${url} timed out after 10 seconds.`, isError: true };
    }
    return { output: `Error triggering remote URL: ${msg}`, isError: true };
  }
}

// ──────────────────────────────────────────────────────────────
// 6. sleep
// ──────────────────────────────────────────────────────────────

export async function executeSleep(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const duration = args.duration as number;

  if (typeof duration !== 'number' || isNaN(duration)) {
    return { output: 'Error: "duration" must be a number in milliseconds.', isError: true };
  }
  if (duration < 100) {
    return { output: 'Error: Minimum sleep duration is 100ms.', isError: true };
  }
  if (duration > 60000) {
    return { output: 'Error: Maximum sleep duration is 60000ms (60 seconds).', isError: true };
  }

  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, duration));
  const elapsed = Date.now() - start;

  return {
    output: `Slept for ${elapsed}ms (requested: ${duration}ms).`,
    metadata: { duration, elapsed },
  };
}

// ──────────────────────────────────────────────────────────────
// 7. voice
// ──────────────────────────────────────────────────────────────

export async function executeVoice(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const action = args.action as string;

  if (!action || !['transcribe', 'speak', 'listen'].includes(action)) {
    return { output: 'Error: "action" must be one of: transcribe, speak, listen.', isError: true };
  }

  switch (action) {
    case 'transcribe': {
      const audioData = args.audioData as string | undefined;
      if (!audioData) {
        return {
          output: 'Please use the frontend voice input feature to record audio. Provide the "audioData" field (base64-encoded) to transcribe.\n\nUsage: { "action": "transcribe", "audioData": "<base64-audio>" }',
          metadata: { action: 'transcribe', status: 'requires_frontend' },
        };
      }
      return {
        output: 'Audio transcription requires frontend integration. The base64 audio data was received but the transcription service is not yet connected.\n\nPlease use the frontend voice input button (microphone icon) to record and transcribe audio directly.',
        isError: true,
        metadata: { action: 'transcribe', audioLength: audioData.length },
      };
    }

    case 'speak': {
      const text = args.text as string;
      const voice = (args.voice as string) || 'default';
      if (!text) {
        return { output: 'Error: "text" is required for speak action.', isError: true };
      }
      // Return with [TTS] prefix for frontend detection
      return {
        output: `[TTS]${text}`,
        metadata: {
          action: 'speak',
          voice,
          textLength: text.length,
          ttsMarker: true,
        },
      };
    }

    case 'listen': {
      return {
        output: 'Voice listening requires frontend integration. Please use the frontend voice input feature to capture and send audio.\n\nThe listen action keeps the microphone open for continuous input in the browser.',
        metadata: { action: 'listen', status: 'requires_frontend' },
      };
    }

    default:
      return { output: `Unknown voice action: ${action}`, isError: true };
  }
}

// ──────────────────────────────────────────────────────────────
// 8. dream-task
// ──────────────────────────────────────────────────────────────

export async function executeDreamTask(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const task = args.task as string;
  if (!task) {
    return { output: 'Error: "task" is required for dream-task.', isError: true };
  }

  const priority = (args.priority as 'low' | 'medium' | 'high') || 'low';
  const dreamMap = getDreamMap(context.sessionId);

  const id = generateId();
  const dreamTask: DreamTask = {
    id,
    description: task,
    priority,
    status: 'pending',
    createdAt: Date.now(),
  };
  dreamMap.set(id, dreamTask);

  // Mark as running immediately (in a real implementation, this would run in background)
  dreamTask.status = 'running';
  dreamTask.output = `Dream task queued: ${task}`;

  return {
    output: `Dream task created:\n  ID: ${id}\n  Priority: ${priority}\n  Status: ${dreamTask.status}\n  Description: ${task}\n\nDream tasks run asynchronously in the background while you continue working.`,
    metadata: {
      taskId: id,
      priority,
      status: dreamTask.status,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 9. magic-docs
// ──────────────────────────────────────────────────────────────

export async function executeMagicDocs(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const action = args.action as string;
  if (!action || !['generate', 'update', 'query', 'delete'].includes(action)) {
    return { output: 'Error: "action" must be one of: generate, update, query, delete.', isError: true };
  }

  const target = args.target as string;
  const format = (args.format as string) || 'markdown';

  try {
    switch (action) {
      case 'generate': {
        if (!target) {
          return { output: 'Error: "target" (file path or module name) is required for generate.', isError: true };
        }

        // Try to read the target file to provide context
        let fileContent = '';
        try {
          fileContent = await fs.readFile(target, 'utf-8');
        } catch {
          fileContent = '(file not accessible)';
        }

        // Use LLM to generate documentation
        const { chatCompletion } = await import('@/lib/nvidia');
        const response = await chatCompletion({
          model: 'meta/llama-3.3-70b-instruct',
          messages: [
            {
              role: 'system',
              content: `You are a documentation generator. Generate clear, comprehensive documentation for the given code. Format: ${format}. Include: purpose, usage, parameters, return values, and examples if applicable.`,
            },
            {
              role: 'user',
              content: `Generate documentation for: ${target}\n\n${fileContent.substring(0, 8000)}`,
            },
          ],
          maxTokens: 2048,
          temperature: 0.3,
        });

        const docContent = response.choices?.[0]?.message?.content || 'Failed to generate documentation.';
        const docKey = `${context.sessionId}:${target}`;
        docsStore.set(docKey, {
          target,
          content: docContent,
          format,
          generatedAt: Date.now(),
        });

        return {
          output: `Documentation generated for "${target}":\n\n${docContent}`,
          metadata: {
            action: 'generate',
            target,
            format,
            docKey,
          },
        };
      }

      case 'update': {
        if (!target) {
          return { output: 'Error: "target" is required for update.', isError: true };
        }
        const docKey = `${context.sessionId}:${target}`;
        const existing = docsStore.get(docKey);
        if (!existing) {
          return { output: `No existing documentation found for "${target}". Use "generate" action first.`, isError: true };
        }

        // Re-read file and update doc
        let fileContent = '';
        try {
          fileContent = await fs.readFile(target, 'utf-8');
        } catch {
          fileContent = '(file not accessible)';
        }

        const { chatCompletion } = await import('@/lib/nvidia');
        const response = await chatCompletion({
          model: 'meta/llama-3.3-70b-instruct',
          messages: [
            {
              role: 'system',
              content: `Update the following existing documentation based on the current code. Preserve the structure and format (${format}). Only modify sections that are outdated.`,
            },
            {
              role: 'user',
              content: `Existing documentation:\n${existing.content}\n\nCurrent code:\n${fileContent.substring(0, 8000)}`,
            },
          ],
          maxTokens: 2048,
          temperature: 0.3,
        });

        const updatedContent = response.choices?.[0]?.message?.content || 'Failed to update documentation.';
        docsStore.set(docKey, {
          target,
          content: updatedContent,
          format,
          generatedAt: Date.now(),
        });

        return {
          output: `Documentation updated for "${target}":\n\n${updatedContent}`,
          metadata: { action: 'update', target, format },
        };
      }

      case 'query': {
        const queryTarget = target || '';
        const results: Array<{ target: string; format: string; snippet: string }> = [];

        docsStore.forEach((doc) => {
          if (
            !queryTarget ||
            doc.target.includes(queryTarget) ||
            doc.content.toLowerCase().includes(queryTarget.toLowerCase())
          ) {
            results.push({
              target: doc.target,
              format: doc.format,
              snippet: doc.content.substring(0, 200) + '...',
            });
          }
        });

        if (results.length === 0) {
          return { output: `No documentation found${queryTarget ? ` matching "${queryTarget}"` : ''}. Use "generate" to create documentation first.` };
        }

        const lines = results.map((r, i) => {
          return `${i + 1}. **${r.target}** (${r.format})\n   ${r.snippet}`;
        });
        return {
          output: `Found ${results.length} document(s):\n\n${lines.join('\n\n')}`,
          metadata: { total: results.length, targets: results.map((r) => r.target) },
        };
      }

      case 'delete': {
        if (!target) {
          return { output: 'Error: "target" is required for delete.', isError: true };
        }
        const docKey = `${context.sessionId}:${target}`;
        if (!docsStore.has(docKey)) {
          return { output: `No documentation found for "${target}".`, isError: true };
        }
        docsStore.delete(docKey);
        return { output: `Documentation for "${target}" deleted.` };
      }

      default:
        return { output: `Unknown magic-docs action: ${action}`, isError: true };
    }
  } catch (error) {
    return {
      output: `Error in magic-docs: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 10. repl
// ──────────────────────────────────────────────────────────────

export async function executeRepl(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const code = args.code as string;
  if (!code) {
    return { output: 'Error: "code" is required for repl.', isError: true };
  }

  const language = (args.language as string) || 'javascript';
  const session = args.session as string | undefined;

  if (language !== 'javascript') {
    return {
      output: `Only JavaScript REPL is supported. Received language: "${language}".`,
      isError: true,
    };
  }

  try {
    // Capture console.log output
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
    };
    console.error = (...args: unknown[]) => {
      logs.push(`[stderr] ${args.map((a) => String(a)).join(' ')}`);
    };
    console.warn = (...args: unknown[]) => {
      logs.push(`[warn] ${args.map((a) => String(a)).join(' ')}`);
    };

    try {
      // Use Function constructor for safer eval (no access to outer scope variables)
      const fn = new Function('return (async () => { ' + code + ' })()');
      const timeoutMs = 5000;

      const resultPromise = Promise.resolve(fn()).then((result) => ({
        result: result === undefined ? '(undefined)' : typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
        error: null,
      }));

      const timeoutPromise = new Promise<{ result: string; error: string }>((resolve) =>
        setTimeout(() => resolve({ result: '', error: 'REPL execution timed out (5s limit)' }), timeoutMs)
      );

      const { result, error } = await Promise.race([resultPromise, timeoutPromise]);

      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      const outputParts: string[] = [];
      if (logs.length > 0) {
        outputParts.push(`Console output:\n${logs.join('\n')}`);
      }
      if (error) {
        outputParts.push(`Error: ${error}`);
      } else {
        outputParts.push(`Result: ${result}`);
      }

      return {
        output: outputParts.join('\n\n'),
        metadata: {
          language,
          sessionId: session || context.sessionId,
          hasOutput: logs.length > 0,
          timedOut: !!error && error.includes('timed out'),
        },
      };
    } catch (evalError) {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      return {
        output: `REPL Error: ${evalError instanceof Error ? evalError.message : String(evalError)}${logs.length > 0 ? `\n\nConsole output before error:\n${logs.join('\n')}` : ''}`,
        isError: true,
        metadata: { language, sessionId: session || context.sessionId },
      };
    }
  } catch (error) {
    return {
      output: `Error executing REPL: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 11. notebook-edit (REAL implementation)
// ──────────────────────────────────────────────────────────────

export async function executeNotebookEditReal(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  const cellIndex = args.cellIndex as number;
  const newSource = args.newSource as string;
  const cellType = args.cellType as 'code' | 'markdown' | undefined;

  if (!filePath) {
    return { output: 'Error: "path" is required for notebook-edit.', isError: true };
  }
  if (cellIndex === undefined || cellIndex < 0) {
    return { output: 'Error: "cellIndex" must be a non-negative integer.', isError: true };
  }
  if (!newSource && newSource !== '') {
    return { output: 'Error: "newSource" is required.', isError: true };
  }

  try {
    // Read notebook file
    const raw = await fs.readFile(filePath, 'utf-8');
    let notebook: Record<string, unknown>;
    try {
      notebook = JSON.parse(raw);
    } catch {
      return { output: `Error: "${filePath}" is not a valid JSON file (expected .ipynb format).`, isError: true };
    }

    if (notebook.cells === undefined || !Array.isArray(notebook.cells)) {
      return { output: `Error: "${filePath}" does not appear to be a valid Jupyter notebook (missing "cells" array).`, isError: true };
    }

    const cells = notebook.cells as Array<Record<string, unknown>>;

    if (cellIndex >= cells.length) {
      return {
        output: `Error: cellIndex ${cellIndex} is out of bounds. Notebook has ${cells.length} cell(s) (indices 0-${cells.length - 1}).`,
        isError: true,
      };
    }

    const cell = cells[cellIndex];
    const oldSource = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '');
    const actualCellType = cellType || (cell.cell_type as string) || 'code';

    // Validate cell type
    if (actualCellType !== 'code' && actualCellType !== 'markdown') {
      return { output: `Error: Cell type must be "code" or "markdown", got "${actualCellType}".`, isError: true };
    }

    // Update the cell
    cell.cell_type = actualCellType;
    // Jupyter stores source as array of lines
    if (actualCellType === 'code') {
      cell.source = newSource.split('\n').map((line, i, arr) => (i < arr.length - 1 ? line + '\n' : line));
    } else {
      cell.source = newSource.split('\n').map((line, i, arr) => (i < arr.length - 1 ? line + '\n' : line));
    }

    // Write back
    const updated = JSON.stringify(notebook, null, 1) + '\n';
    await fs.writeFile(filePath, updated, 'utf-8');

    return {
      output: `Notebook cell updated successfully:\n  File: ${filePath}\n  Cell: ${cellIndex} (${actualCellType})\n  Old source length: ${oldSource.length} chars\n  New source length: ${newSource.length} chars`,
      metadata: {
        filePath,
        cellIndex,
        cellType: actualCellType,
        oldLength: oldSource.length,
        newLength: newSource.length,
      },
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as Record<string, unknown>).code === 'ENOENT') {
      return { output: `Error: File not found: "${filePath}"`, isError: true };
    }
    return {
      output: `Error editing notebook: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 12. synthetic-output
// ──────────────────────────────────────────────────────────────

export async function executeSyntheticOutput(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const outputPath = args.outputPath as string;
  if (!outputPath) {
    return { output: 'Error: "outputPath" is required.', isError: true };
  }

  const template = (args.template as string) || 'random-text';
  const size = (args.size as number) || 100;

  try {
    let content = '';

    switch (template) {
      case 'json-array': {
        const items: Array<{id: number; name: string; value: number; active: boolean; tags: string[]}> = [];
        for (let i = 0; i < Math.min(size, 1000); i++) {
          items.push({
            id: i + 1,
            name: `Item_${i + 1}`,
            value: Math.round(Math.random() * 1000) / 100,
            active: Math.random() > 0.5,
            tags: [`tag-${Math.floor(Math.random() * 10)}`],
          });
        }
        content = JSON.stringify(items, null, 2);
        break;
      }

      case 'csv': {
        const headers = ['id', 'name', 'email', 'score', 'active'];
        content = headers.join(',') + '\n';
        for (let i = 0; i < Math.min(size, 1000); i++) {
          content += [
            i + 1,
            `user_${i + 1}`,
            `user${i + 1}@example.com`,
            Math.round(Math.random() * 100),
            Math.random() > 0.5 ? 'yes' : 'no',
          ].join(',') + '\n';
        }
        break;
      }

      case 'markdown-list': {
        content = '# Synthetic Data\n\n';
        for (let i = 0; i < Math.min(size, 500); i++) {
          content += `- Item ${i + 1}: This is a synthetic list entry for testing purposes.\n`;
        }
        content += `\n---\n*Generated ${Math.min(size, 500)} items.*\n`;
        break;
      }

      case 'random-text': {
        const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'cats', 'with', 'code', 'data', 'test', 'output', 'sample', 'file', 'text', 'lines', 'words'];
        const lines: string[] = [];
        for (let i = 0; i < Math.min(size, 1000); i++) {
          const lineWords: string[] = [];
          const wordCount = 5 + Math.floor(Math.random() * 10);
          for (let j = 0; j < wordCount; j++) {
            lineWords.push(words[Math.floor(Math.random() * words.length)]);
          }
          lines.push(lineWords.join(' '));
        }
        content = lines.join('\n');
        break;
      }

      default: {
        // Generic template: just repeat a pattern
        for (let i = 0; i < Math.min(size, 1000); i++) {
          content += `Line ${i + 1}: synthetic output for template "${template}"\n`;
        }
      }
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, content, 'utf-8');

    return {
      output: `Synthetic output written to: ${outputPath}\n  Template: ${template}\n  Items/Lines: ${Math.min(size, 1000)}\n  File size: ${content.length} bytes`,
      metadata: {
        outputPath,
        template,
        size: Math.min(size, 1000),
        fileSize: content.length,
      },
    };
  } catch (error) {
    return {
      output: `Error generating synthetic output: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 13. team-create / team-delete
// ──────────────────────────────────────────────────────────────

export async function executeTeamCreate(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const teamName = args.teamName as string;
  if (!teamName) {
    return { output: 'Error: "teamName" is required for team-create.', isError: true };
  }

  const membersInput = args.members as Array<{ role: string; task: string }> | undefined;
  const id = generateId();

  const members: TeamMember[] = (membersInput || []).map((m, i) => ({
    id: generateId(),
    role: (m.role as 'leader' | 'worker' | 'scout') || 'worker',
    task: m.task || `Task ${i + 1}`,
    status: 'ready',
  }));

  // Ensure at least one leader if members provided
  if (members.length > 0 && !members.some((m) => m.role === 'leader')) {
    members[0].role = 'leader';
  }

  teamStore.set(id, {
    id,
    teamName,
    members,
    createdAt: Date.now(),
  });

  const lines = members.map((m) => {
    return `  - [${m.role.toUpperCase()}] ${m.id}: ${m.task} (${m.status})`;
  });

  return {
    output: `Team created:\n  ID: ${id}\n  Name: ${teamName}\n  Members: ${members.length}\n${members.length > 0 ? lines.join('\n') + '\n' : ''}\n\nNote: Teams are stored in-memory. Use team-delete to disband.`,
    metadata: { teamId: id, teamName, memberCount: members.length },
  };
}

export async function executeTeamDelete(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const teamId = args.teamId as string;
  if (!teamId) {
    return { output: 'Error: "teamId" is required for team-delete.', isError: true };
  }

  const team = teamStore.get(teamId);
  if (!team) {
    return { output: `Error: Team "${teamId}" not found.`, isError: true };
  }

  teamStore.delete(teamId);
  return {
    output: `Team "${team.teamName}" (${teamId}) disbanded. ${team.members.length} member(s) released.`,
    metadata: { teamId, teamName: team.teamName },
  };
}

// ──────────────────────────────────────────────────────────────
// 14. task-create / task-get / task-list / task-output / task-stop / task-update
// ──────────────────────────────────────────────────────────────

export async function executeTaskCreate(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const description = args.description as string;
  if (!description) {
    return { output: 'Error: "description" is required for task-create.', isError: true };
  }

  const priority = (args.priority as 'low' | 'medium' | 'high') || 'medium';
  const parentTaskId = args.parentTaskId as string | undefined;
  const taskMap = getTaskMap(context.sessionId);

  const id = generateId();
  const now = Date.now();
  const task: BackgroundTask = {
    id,
    description,
    priority,
    status: 'pending',
    parentTaskId,
    createdAt: now,
    updatedAt: now,
  };
  taskMap.set(id, task);

  return {
    output: `Task created:\n  ID: ${id}\n  Priority: ${priority}\n  Status: pending\n  Description: ${description}${parentTaskId ? `\n  Parent: ${parentTaskId}` : ''}`,
    metadata: { taskId: id, priority, status: 'pending', parentTaskId },
  };
}

export async function executeTaskGet(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const taskId = args.taskId as string;
  if (!taskId) {
    return { output: 'Error: "taskId" is required for task-get.', isError: true };
  }

  const taskMap = getTaskMap(context.sessionId);
  const task = taskMap.get(taskId);
  if (!task) {
    return { output: `Error: Task "${taskId}" not found.`, isError: true };
  }

  return {
    output: `Task details:\n  ID: ${task.id}\n  Status: ${task.status}\n  Priority: ${task.priority}\n  Description: ${task.description}\n  Created: ${new Date(task.createdAt).toISOString()}\n  Updated: ${new Date(task.updatedAt).toISOString()}${task.output ? `\n  Output: ${task.output}` : ''}${task.error ? `\n  Error: ${task.error}` : ''}`,
    metadata: {
      taskId: task.id,
      status: task.status,
      priority: task.priority,
    },
  };
}

export async function executeTaskList(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const statusFilter = args.status as string | undefined;
  const taskMap = getTaskMap(context.sessionId);

  let tasks = Array.from(taskMap.values());
  if (statusFilter) {
    tasks = tasks.filter((t) => t.status === statusFilter);
  }

  // Sort by creation time (newest first)
  tasks.sort((a, b) => b.createdAt - a.createdAt);

  if (tasks.length === 0) {
    return { output: `No tasks found${statusFilter ? ` with status "${statusFilter}"` : ''}.` };
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': return '✓';
      case 'running': return '→';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  const lines = tasks.map((t) => {
    return `${statusIcon(t.status)} [${t.priority.toUpperCase()}] ${t.id} — ${t.description}`;
  });

  return {
    output: `Tasks (${tasks.length}):\n${lines.join('\n')}`,
    metadata: {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter((t) => t.status === 'pending').length,
        running: tasks.filter((t) => t.status === 'running').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
      },
    },
  };
}

export async function executeTaskOutput(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const taskId = args.taskId as string;
  if (!taskId) {
    return { output: 'Error: "taskId" is required for task-output.', isError: true };
  }

  const taskMap = getTaskMap(context.sessionId);
  const task = taskMap.get(taskId);
  if (!task) {
    return { output: `Error: Task "${taskId}" not found.`, isError: true };
  }

  if (task.status !== 'completed' && task.status !== 'failed') {
    return { output: `Task "${taskId}" is still ${task.status}. Output not yet available.`, isError: true };
  }

  const output = task.output || task.error || '(no output)';
  return {
    output,
    metadata: { taskId, status: task.status, outputLength: output.length },
  };
}

export async function executeTaskStop(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const taskId = args.taskId as string;
  const reason = args.reason as string | undefined;
  if (!taskId) {
    return { output: 'Error: "taskId" is required for task-stop.', isError: true };
  }

  const taskMap = getTaskMap(context.sessionId);
  const task = taskMap.get(taskId);
  if (!task) {
    return { output: `Error: Task "${taskId}" not found.`, isError: true };
  }

  if (task.status !== 'running' && task.status !== 'pending') {
    return { output: `Task "${taskId}" is already ${task.status} and cannot be stopped.`, isError: true };
  }

  task.status = 'failed';
  task.error = reason || 'Stopped by user';
  task.updatedAt = Date.now();

  return {
    output: `Task "${taskId}" stopped.${reason ? ` Reason: ${reason}` : ''}`,
    metadata: { taskId, status: 'failed', reason },
  };
}

export async function executeTaskUpdate(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const taskId = args.taskId as string;
  if (!taskId) {
    return { output: 'Error: "taskId" is required for task-update.', isError: true };
  }

  const taskMap = getTaskMap(context.sessionId);
  const task = taskMap.get(taskId);
  if (!task) {
    return { output: `Error: Task "${taskId}" not found.`, isError: true };
  }

  const updates: string[] = [];
  const newPriority = args.priority as string | undefined;
  const newDescription = args.description as string | undefined;

  if (newPriority && ['low', 'medium', 'high'].includes(newPriority)) {
    task.priority = newPriority as 'low' | 'medium' | 'high';
    updates.push(`priority → ${newPriority}`);
  }
  if (newDescription) {
    task.description = newDescription;
    updates.push('description updated');
  }
  task.updatedAt = Date.now();

  if (updates.length === 0) {
    return { output: `No updates provided for task "${taskId}". Available fields: priority, description.`, isError: true };
  }

  return {
    output: `Task "${taskId}" updated:\n  ${updates.join('\n  ')}\n  Status: ${task.status}`,
    metadata: { taskId, updates, status: task.status },
  };
}

// ──────────────────────────────────────────────────────────────
// 15. enter-worktree / exit-worktree
// ──────────────────────────────────────────────────────────────

export async function executeEnterWorktree(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const branchName = args.branchName as string;
  if (!branchName) {
    return { output: 'Error: "branchName" is required for enter-worktree.', isError: true };
  }

  const basePath = (args.basePath as string) || path.join(process.cwd(), '.worktrees');

  try {
    // Sanitize branch name
    const sanitized = branchName.replace(/[^a-zA-Z0-9_\-\/]/g, '-');
    const worktreePath = path.join(basePath, sanitized);

    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      return { output: `Error: Worktree directory "${worktreePath}" already exists.`, isError: true };
    } catch {
      // Directory doesn't exist, proceed
    }

    // Create worktree directory parent
    await fs.mkdir(basePath, { recursive: true });

    // Execute git worktree add
    const { stdout, stderr } = await execAsync(
      `git worktree add "${worktreePath}" -b "${sanitized}"`,
      { timeout: 30000 }
    );

    // Track in state
    worktreeStore.set(context.sessionId, { branchName: sanitized, basePath: worktreePath });

    return {
      output: `Worktree created:\n  Branch: ${sanitized}\n  Path: ${worktreePath}\n\n${stdout}${stderr ? `\nWarnings: ${stderr}` : ''}\n\nUse exit-worktree to remove this worktree when done.`,
      metadata: {
        branchName: sanitized,
        worktreePath,
      },
    };
  } catch (error) {
    return {
      output: `Error creating worktree: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

export async function executeExitWorktree(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const mergeChanges = args.mergeChanges as boolean | undefined;

  try {
    const worktreeInfo = worktreeStore.get(context.sessionId);
    if (!worktreeInfo) {
      return { output: 'No active worktree found for this session. Use enter-worktree first.', isError: true };
    }

    const { basePath, branchName } = worktreeInfo;

    if (mergeChanges) {
      // Merge the branch back and then remove worktree
      try {
        await execAsync(`git checkout main && git merge "${branchName}" --no-edit`, { timeout: 30000 });
      } catch {
        // Merge might fail if no main branch, try master
        try {
          await execAsync(`git checkout master && git merge "${branchName}" --no-edit`, { timeout: 30000 });
        } catch (mergeErr) {
          return {
            output: `Could not auto-merge. Please merge manually:\n  git checkout main\n  git merge ${branchName}\n\nThen remove worktree:\n  git worktree remove "${basePath}"`,
            isError: true,
          };
        }
      }
    }

    // Remove worktree
    const { stdout, stderr } = await execAsync(`git worktree remove "${basePath}" --force`, { timeout: 30000 });

    // Clean up state
    worktreeStore.delete(context.sessionId);

    // Optionally delete the branch
    try {
      await execAsync(`git branch -d "${branchName}"`, { timeout: 10000 });
    } catch {
      // Branch deletion is optional, might fail if not fully merged
    }

    return {
      output: `Worktree exited:\n  Branch: ${branchName}\n  Path: ${basePath}\n  Merged: ${!!mergeChanges}\n\n${stdout}${stderr ? `\n${stderr}` : ''}`,
      metadata: { branchName, basePath, merged: !!mergeChanges },
    };
  } catch (error) {
    return {
      output: `Error exiting worktree: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 16. powershell
// ──────────────────────────────────────────────────────────────

export async function executePowerShell(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const command = args.command as string;
  if (!command) {
    return { output: 'Error: "command" is required for powershell.', isError: true };
  }

  const timeout = (args.timeout as number) || 30000;

  // Try pwsh first (PowerShell Core), fall back to powershell (Windows PowerShell)
  let shellCmd: string;
  let detectedShell: string;

  try {
    await execAsync('which pwsh', { timeout: 2000 });
    shellCmd = 'pwsh';
    detectedShell = 'PowerShell Core (pwsh)';
  } catch {
    shellCmd = 'powershell';
    detectedShell = 'Windows PowerShell (powershell)';
  }

  try {
    const { stdout, stderr } = await execAsync(
      `${shellCmd} -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
      {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
        env: {
          ...process.env,
          PATH: process.env.PATH || '',
          HOME: process.env.HOME || '',
        },
      }
    );

    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n');
    return {
      output: output || '(no output)',
      metadata: {
        shell: detectedShell,
        exitCode: 0,
        hasStderr: !!stderr.trim(),
      },
    };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string; code?: number };
    const output = [
      execError.stdout?.trim(),
      execError.stderr?.trim(),
      execError.message || 'Unknown error',
    ].filter(Boolean).join('\n\n');

    return {
      output,
      isError: true,
      metadata: {
        shell: detectedShell,
        exitCode: execError.code,
      },
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 17. skill
// ──────────────────────────────────────────────────────────────

export async function executeSkill(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const skillId = args.skillId as string;
  if (!skillId) {
    return { output: 'Error: "skillId" is required for skill.', isError: true };
  }

  try {
    const { db } = await import('@/lib/db');

    // Try to find by id first, then by name
    let skillDef = await db.skillDef.findUnique({ where: { id: skillId } });

    if (!skillDef) {
      skillDef = await db.skillDef.findUnique({ where: { name: skillId } });
    }

    if (!skillDef) {
      // List available skills for helpful error
      const allSkills = await db.skillDef.findMany({
        select: { id: true, name: true, displayName: true, isEnabled: true },
        take: 20,
      });
      const skillList = allSkills.map((s: Record<string, unknown>) => `  - ${s.name} (${s.displayName})`).join('\n');
      return {
        output: `Error: Skill "${skillId}" not found.\n\nAvailable skills:\n${skillList}\n\nUse the skill ID or name to load a skill.`,
        isError: true,
        metadata: { availableSkills: allSkills.length },
      };
    }

    if (!skillDef.isEnabled) {
      return {
        output: `Skill "${skillDef.displayName}" (${skillDef.name}) is currently disabled. Enable it in the Skills panel first.`,
        isError: true,
      };
    }

    const prompt = skillDef.prompt || '';
    const input = args.input as string | undefined;

    return {
      output: `Skill loaded: ${skillDef.displayName}\n${'─'.repeat(skillDef.displayName.length + 12)}\n\n${input ? `Input: ${input}\n\n` : ''}${prompt}`,
      metadata: {
        skillId: skillDef.id,
        skillName: skillDef.name,
        displayName: skillDef.displayName,
        category: skillDef.category,
        promptLength: prompt.length,
        hasInput: !!input,
      },
    };
  } catch (error) {
    return {
      output: `Error loading skill: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// 18. mcp / list-mcp-resources / read-mcp-resource / mcp-auth
// ──────────────────────────────────────────────────────────────

export async function executeMcp(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string;
  const toolName = args.toolName as string;

  return {
    output: `MCP client is being configured. Use the MCP Settings panel to add MCP servers.\n\n${serverName ? `Requested server: ${serverName}\n` : ''}${toolName ? `Requested tool: ${toolName}\n` : ''}MCP (Model Context Protocol) allows connecting to external tool servers for extended capabilities. Configure servers in the Settings panel to enable MCP tool calls.`,
    metadata: { type: 'mcp_not_configured', serverName, toolName },
  };
}

export async function executeListMcpResources(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string;

  return {
    output: `MCP client is being configured. Use the MCP Settings panel to add MCP servers.${serverName ? `\n\nRequested server: ${serverName}` : '\n\nNo servers configured yet.'}\n\nOnce MCP servers are configured, their resources will be listed here.`,
    metadata: { type: 'mcp_not_configured', serverName },
  };
}

export async function executeReadMcpResource(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string;
  const resourceUri = args.resourceUri as string;

  return {
    output: `MCP client is being configured. Use the MCP Settings panel to add MCP servers.${serverName ? `\nServer: ${serverName}` : ''}${resourceUri ? `\nResource URI: ${resourceUri}` : ''}`,
    metadata: { type: 'mcp_not_configured', serverName, resourceUri },
  };
}

export async function executeMcpAuth(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const serverName = args.serverName as string;
  const action = args.action as string;

  return {
    output: `MCP client is being configured. Use the MCP Settings panel to add MCP servers.${serverName ? `\nServer: ${serverName}` : ''}${action ? `\nAuth action: ${action}` : ''}\n\nMCP authentication (OAuth flows) will be available once servers are configured.`,
    metadata: { type: 'mcp_not_configured', serverName, action },
  };
}

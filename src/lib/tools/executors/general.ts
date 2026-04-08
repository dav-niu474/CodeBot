import type { ToolExecutionResult, ToolExecutionContext } from '../types';

// ──────────────────────────────────────────────
// In-memory todo storage (keyed by sessionId)
// ──────────────────────────────────────────────

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

const todoStore = new Map<string, TodoItem[]>();

/**
 * todo-write: Manage todo lists per session
 * Accepts a todos array; updates are merged by id
 */
export async function executeTodoWrite(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const todos = args.todos as TodoItem[] | undefined;

  if (!todos || !Array.isArray(todos)) {
    return { output: 'Error: "todos" argument is required and must be an array.', isError: true };
  }

  const sessionId = context.sessionId;
  const existing = todoStore.get(sessionId) || [];

  // Merge: update existing by id, add new ones
  const updatedMap = new Map<string, TodoItem>();
  for (const item of existing) {
    updatedMap.set(item.id, item);
  }
  for (const item of todos) {
    if (!item.id || !item.content) {
      return {
        output: `Error: Each todo item must have "id" and "content". Invalid item: ${JSON.stringify(item)}`,
        isError: true,
      };
    }
    updatedMap.set(item.id, {
      id: item.id,
      content: item.content,
      status: item.status || 'pending',
      priority: item.priority || 'medium',
    });
  }

  const updatedList = Array.from(updatedMap.values());
  todoStore.set(sessionId, updatedList);

  // Format output
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '→';
      default: return '○';
    }
  };

  const priorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '[HIGH]';
      case 'low': return '[low]';
      default: return '[MED]';
    }
  };

  const lines = updatedList.map((item) => {
    return `${statusIcon(item.status)} ${priorityLabel(item.priority)} ${item.id}: ${item.content}`;
  });

  const completed = updatedList.filter((t) => t.status === 'completed').length;
  const inProgress = updatedList.filter((t) => t.status === 'in_progress').length;
  const pending = updatedList.filter((t) => t.status === 'pending').length;

  const summary = `\nTodo list updated: ${updatedList.length} item(s) — ${completed} done, ${inProgress} in progress, ${pending} pending`;

  return {
    output: lines.join('\n') + '\n' + summary,
    metadata: {
      sessionId,
      total: updatedList.length,
      completed,
      inProgress,
      pending,
    },
  };
}

/**
 * send-message: Forward a message to the client
 * The stream route handles actual SSE forwarding
 */
export async function executeSendMessage(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const message = args.message as string;
  if (!message) {
    return { output: 'Error: "message" argument is required for send-message.', isError: true };
  }

  const level = (args.level as string) || 'info';
  const metadata = args.metadata as Record<string, unknown> | undefined;

  const output = JSON.stringify({
    type: 'send_message',
    message,
    level,
    metadata: metadata || undefined,
  });

  return {
    output,
    metadata: {
      type: 'send_message',
      level,
    },
  };
}

/**
 * ask-user: Signal that user input is needed
 * Returns a special marker that the stream route will detect
 */
export async function executeAskUser(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const question = args.question as string;
  if (!question) {
    return { output: 'Error: "question" argument is required for ask-user.', isError: true };
  }

  const options = args.options as string[] | undefined;
  const placeholder = args.placeholder as string | undefined;

  const payload = {
    question,
    options: options || undefined,
    placeholder: placeholder || undefined,
  };

  // The special marker format that the stream route detects
  const output = `[ASK_USER]${JSON.stringify(payload)}`;

  return {
    output,
    metadata: {
      type: 'ask_user',
      question,
      hasOptions: !!options,
    },
  };
}

/**
 * brief: Simple text summarization (no AI call — truncation only)
 */
export async function executeBrief(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const text = args.text as string;
  if (!text) {
    return { output: 'Error: "text" argument is required for brief.', isError: true };
  }

  const maxLength = typeof args.maxLength === 'number' ? args.maxLength : 2000;
  const title = args.title as string | undefined;

  const words = text.split(/\s+/);
  let result: string;

  if (text.length <= maxLength) {
    result = text;
  } else {
    // Truncate to maxLength, try to break at sentence boundary
    const truncated = text.substring(0, maxLength);
    // Find last sentence-ending punctuation
    const lastPeriod = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
    );
    if (lastPeriod > maxLength * 0.5) {
      result = truncated.substring(0, lastPeriod + 1);
    } else {
      // Break at last space
      const lastSpace = truncated.lastIndexOf(' ');
      result = truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength);
    }
    result += '\n\n[... content truncated for brevity ...]';
  }

  const header = title ? `Brief: ${title}\n${'─'.repeat(title.length + 7)}\n` : '';

  return {
    output: header + result,
    metadata: {
      originalLength: text.length,
      resultLength: result.length,
      wordCount: words.length,
      truncated: text.length > maxLength,
    },
  };
}

// ──────────────────────────────────────────────
// Sub-Agent System — Real Implementation
// ──────────────────────────────────────────────

/** Read-only tool IDs allowed in Explore and Plan sub-agents */
const READ_ONLY_TOOL_IDS = new Set([
  'file-read',
  'glob',
  'grep',
  'web-search',
  'web-fetch',
]);

/** Sub-agent type definitions */
const SUB_AGENT_TYPES = ['general-purpose', 'Explore', 'Plan'] as const;
type SubAgentType = (typeof SUB_AGENT_TYPES)[number];

/** Sub-agent system prompts by type */
const SUB_AGENT_PROMPTS: Record<SubAgentType, string> = {
  'general-purpose': `You are a sub-agent spawned to complete a specific task. Focus on completing the task efficiently. You have access to the same tools as the main agent. When done, provide a clear summary of what you accomplished.`,

  'Explore': `You are an exploration sub-agent. Your job is to quickly search and analyze the codebase. Use read-only tools (file-read, glob, grep, web-search, web-fetch) to gather information. DO NOT modify any files. Provide a comprehensive analysis of what you found.`,

  'Plan': `You are a planning sub-agent. Analyze the codebase and create a detailed implementation plan. Use read-only tools to understand the current state. Output a structured plan with clear steps, dependencies, and implementation details.`,
};

/**
 * agent: Real sub-agent executor
 *
 * Spawns a mini agentic loop (max 5 iterations) with its own messages.
 * Tool access depends on subagent_type:
 *   - "general-purpose": all core tools
 *   - "Explore": read-only tools only (file-read, glob, grep, web-search, web-fetch)
 *   - "Plan": read-only tools only
 */
export async function executeAgent(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const task = args.task as string | undefined;
  const description = (args.description as string) || 'sub-agent task';
  const subagentType = (args.subagent_type as string) || 'general-purpose';
  const model = args.model as string | undefined;

  // ── Validate required args ──
  if (!task) {
    return {
      output: 'Error: "task" argument is required for the agent tool. Provide a clear description of what the sub-agent should accomplish.',
      isError: true,
    };
  }

  if (!SUB_AGENT_TYPES.includes(subagentType as SubAgentType)) {
    return {
      output: `Error: "subagent_type" must be one of: ${SUB_AGENT_TYPES.join(', ')}. Got: "${subagentType}".`,
      isError: true,
    };
  }

  const resolvedType = subagentType as SubAgentType;

  // ── Dynamic imports to avoid circular dependencies ──
  // (executor.ts imports this file, so we must use dynamic imports)
  const { chatCompletion, getDefaultModel } = await import('@/lib/nvidia');
  const { getCoreToolSchemas } = await import('@/lib/tools/definitions');
  const { executeTool: runTool } = await import('@/lib/tools/executor');

  // ── Determine allowed tools based on sub-agent type ──
  const allTools = getCoreToolSchemas();
  let tools;
  if (resolvedType === 'general-purpose') {
    tools = allTools;
  } else {
    // Explore and Plan: only read-only tools
    tools = allTools.filter((t) => READ_ONLY_TOOL_IDS.has(t.function.name));
  }

  // ── Build sub-agent conversation ──
  const subAgentSystemPrompt = SUB_AGENT_PROMPTS[resolvedType];
  const effectiveModel = model || getDefaultModel();

  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
    { role: 'system', content: subAgentSystemPrompt },
    { role: 'user', content: task },
  ];

  // ── Run mini agentic loop ──
  const MAX_SUB_AGENT_ITERATIONS = 5;
  let finalContent = '';
  let iterationCount = 0;

  for (let i = 0; i < MAX_SUB_AGENT_ITERATIONS; i++) {
    iterationCount = i + 1;

    context.onProgress?.('sub_agent_iteration', {
      iteration: iterationCount,
      maxIterations: MAX_SUB_AGENT_ITERATIONS,
      subagentType: resolvedType,
      description,
    });

    // Call the LLM
    const response = await chatCompletion({
      model: effectiveModel,
      messages,
      tools,
      maxTokens: 4096,
      temperature: 0.7,
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';
    const toolCalls = choice.message.tool_calls;

    // If no tool calls, this is the final response
    if (!toolCalls || toolCalls.length === 0) {
      finalContent = content;
      break;
    }

    // Add assistant message (with tool call info) to the conversation
    messages.push({ role: 'assistant', content: content || '' });

    // Execute each tool call
    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        parsedArgs = {};
      }

      context.onProgress?.('sub_agent_tool_call', {
        toolName: tc.function.name,
        subagentType: resolvedType,
        description,
        toolCallId: tc.id,
      });

      const result = await runTool(tc.function.name, parsedArgs, context);

      messages.push({
        role: 'tool',
        content: result.isError ? `Error: ${result.output}` : result.output,
      });
    }
  }

  // If the loop exhausted without a final text response, synthesize one
  if (!finalContent) {
    finalContent = `Sub-agent (${resolvedType}) completed ${iterationCount} iteration(s) using tools but did not produce a final summary. The tool results above contain all the information gathered.`;
  }

  // ── Truncate output to 4000 chars ──
  const MAX_OUTPUT_CHARS = 4000;
  const output =
    finalContent.length > MAX_OUTPUT_CHARS
      ? finalContent.substring(0, MAX_OUTPUT_CHARS) +
        '\n\n[... sub-agent output truncated to 4000 characters ...]'
      : finalContent;

  return {
    output,
    metadata: {
      type: 'sub_agent',
      agentType: resolvedType,
      task,
      description,
      iterations: iterationCount,
      model: effectiveModel,
    },
  };
}

/**
 * notebook-edit: Stub for notebook editing
 * Will be fully implemented in a future version
 */
export async function executeNotebookEdit(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const filePath = args.path as string | undefined;

  return {
    output: `Notebook editing is not yet implemented.\n\nNotebook: ${filePath || 'not specified'}\n\nThis feature will be implemented in a future version with .ipynb file support.`,
    isError: true,
    metadata: {
      type: 'notebook_edit_stub',
      filePath,
    },
  };
}

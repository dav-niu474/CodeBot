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

/**
 * agent: Stub for sub-agent execution
 * Will be fully implemented in V4
 */
export async function executeAgent(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const task = args.task as string | undefined;
  const agentType = args.type as string | undefined;

  const taskDesc = task || 'no task specified';
  const typeDesc = agentType || 'default';

  return {
    output: `Sub-agent execution not yet available in V3.\n\nAgent type: ${typeDesc}\nTask: ${taskDesc}\n\nThis feature will be implemented in V4 with full multi-agent orchestration support.`,
    metadata: {
      type: 'agent_stub',
      agentType: typeDesc,
      task: taskDesc,
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

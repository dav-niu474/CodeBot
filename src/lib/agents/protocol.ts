// ============================================================
// Multi-Agent Communication Protocol (V4.0.0)
// Defines message types, task types, and agent communication
// ============================================================

/** Types of messages exchanged between agents */
export type AgentMessageType = 'task' | 'result' | 'question' | 'error' | 'status' | 'cancel';

/** A message passed between agents */
export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | 'coordinator' | 'all';
  type: AgentMessageType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/** Lifecycle status of a sub-task within a multi-agent run */
export type AgentTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';

/** A decomposed sub-task assigned to a worker agent */
export interface AgentTask {
  id: string;
  description: string;
  assignedTo?: string;
  status: AgentTaskStatus;
  result?: string;
  error?: string;
  tokens: { input: number; output: number };
}

/** Status of an individual agent within a multi-agent session */
export type MultiAgentStatus = 'spawning' | 'thinking' | 'executing' | 'done' | 'failed';

/** SSE event types emitted by multi-agent routes */
export type MultiAgentEventType =
  | 'agent_spawned'
  | 'task_assigned'
  | 'agent_status'
  | 'agent_result'
  | 'aggregation_start'
  | 'aggregation_complete'
  | 'error'
  | 'done';

/** An SSE event emitted during multi-agent execution */
export interface MultiAgentEvent {
  type: MultiAgentEventType;
  agentId?: string;
  agentName?: string;
  agentIndex?: number;
  status?: MultiAgentStatus;
  task?: string;
  result?: string;
  error?: string;
  tokens?: { input: number; output: number };
  totalAgents?: number;
  completedAgents?: number;
  finalContent?: string;
  totalTokens?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/** In-memory message bus for swarm peer-to-peer communication */
export class AgentMessageBus {
  private messages: Map<string, AgentMessage[]> = new Map();

  /** Publish a message to the bus */
  publish(message: AgentMessage): void {
    const targetKey = message.toAgentId === 'all' ? '__broadcast__' : message.toAgentId;
    const existing = this.messages.get(targetKey) || [];
    existing.push(message);
    this.messages.set(targetKey, existing);
  }

  /** Get all messages for a given agent ID */
  getMessages(agentId: string): AgentMessage[] {
    return this.messages.get(agentId) || [];
  }

  /** Get all broadcast messages */
  getBroadcasts(): AgentMessage[] {
    return this.messages.get('__broadcast__') || [];
  }

  /** Get all messages for an agent (including broadcasts) */
  getAllMessages(agentId: string): AgentMessage[] {
    const direct = this.messages.get(agentId) || [];
    const broadcasts = this.messages.get('__broadcast__') || [];
    return [...broadcasts, ...direct].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /** Clear all messages */
  clear(): void {
    this.messages.clear();
  }

  /** Get message count */
  get size(): number {
    let count = 0;
    for (const msgs of this.messages.values()) {
      count += msgs.length;
    }
    return count;
  }
}

/** Generate a unique ID for messages and tasks */
export function generateAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Estimate token count from text (rough: ~4 chars per token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

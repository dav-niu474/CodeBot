// ============================================================
// Multi-Agent System — Barrel Exports (V4.0.0)
// ============================================================

// Protocol types
export {
  type AgentMessageType,
  type AgentMessage,
  type AgentTaskStatus,
  type AgentTask,
  type MultiAgentStatus,
  type MultiAgentEventType,
  type MultiAgentEvent,
  AgentMessageBus,
  generateAgentId,
  estimateTokens,
} from './protocol';

// Engines
export { runCoordinatorMode } from './coordinator';
export { runSwarmMode } from './swarm';
export { runTeammateMode } from './teammate';

// LLM helpers
export { decomposeTask } from './task-decomposer';
export { aggregateResults } from './result-aggregator';

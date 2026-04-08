// ============================================================
// Skills Module — Barrel Export
// ============================================================

// Engine: execute skills with full pre/post processing workflow
export {
  executeSkill,
  type SkillExecutionContext,
  type SkillExecutionResult,
} from './engine';

// Registry: in-memory session-scoped skill management
export {
  loadSkillsForSession,
  getActiveSkills,
  activateSkill,
  deactivateSkill,
  isSkillActive,
  clearSessionSkills,
  getActiveSkillCount,
} from './registry';

// Tool Bridge: connect the `skill` tool to the engine
export { executeSkillTool } from './tool-bridge';

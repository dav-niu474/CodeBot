// ============================================================
// Skill Registry
// In-memory registry of loaded/active skills per session
// ============================================================

import type { LoadedSkill, SkillCategory } from '@/lib/types';
import { db } from '@/lib/db';

// ────────────────────────────────────────────
// In-memory session → skills map
// ────────────────────────────────────────────

/**
 * Map of sessionId → (skillId → LoadedSkill).
 * Each session has its own set of active skills.
 */
const sessionSkills: Map<string, Map<string, LoadedSkill>> = new Map();

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Load all enabled skills from the database into the session's skill map.
 * This is typically called when a session starts or becomes active.
 * Existing session data is preserved — only adds/updates from DB.
 */
export async function loadSkillsForSession(sessionId: string): Promise<void> {
  if (!sessionId) return;

  try {
    const skillDefs = await db.skillDef.findMany({
      where: { isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });

    const skillMap = getSessionMap(sessionId);

    for (const def of skillDefs) {
      const loaded: LoadedSkill = {
        id: def.id,
        name: def.name,
        displayName: def.displayName ?? def.name,
        description: def.description,
        icon: def.icon,
        category: def.category as SkillCategory,
        isEnabled: def.isEnabled,
        prompt: def.prompt ?? '',
        tools: parseToolsFromConfig(def.config),
        isAutoDetected: false,
      };

      // Only add if not already present (don't overwrite active state)
      if (!skillMap.has(def.id)) {
        skillMap.set(def.id, loaded);
      }
    }
  } catch (error) {
    console.error(`[SkillRegistry] Failed to load skills for session ${sessionId}:`, error);
  }
}

/**
 * Get all skills currently loaded for a session.
 */
export function getActiveSkills(sessionId: string): LoadedSkill[] {
  const skillMap = getSessionMap(sessionId);
  return Array.from(skillMap.values());
}

/**
 * Activate a skill for a given session.
 * Loads the skill from DB if not already in the session map.
 */
export async function activateSkill(sessionId: string, skillId: string): Promise<void> {
  if (!sessionId || !skillId) return;

  const skillMap = getSessionMap(sessionId);

  // If already loaded, just ensure it's enabled
  const existing = skillMap.get(skillId);
  if (existing) {
    skillMap.set(skillId, { ...existing, isEnabled: true });
    return;
  }

  // Load from DB
  try {
    const def = await db.skillDef.findUnique({
      where: { id: skillId },
    });

    if (def) {
      const loaded: LoadedSkill = {
        id: def.id,
        name: def.name,
        displayName: def.displayName ?? def.name,
        description: def.description,
        icon: def.icon,
        category: def.category as SkillCategory,
        isEnabled: true,
        prompt: def.prompt ?? '',
        tools: parseToolsFromConfig(def.config),
        isAutoDetected: false,
      };
      skillMap.set(skillId, loaded);
    }
  } catch (error) {
    console.error(`[SkillRegistry] Failed to activate skill ${skillId}:`, error);
  }
}

/**
 * Deactivate a skill for a given session.
 */
export function deactivateSkill(sessionId: string, skillId: string): void {
  if (!sessionId || !skillId) return;

  const skillMap = sessionSkills.get(sessionId);
  if (!skillMap) return;

  const existing = skillMap.get(skillId);
  if (existing) {
    skillMap.set(skillId, { ...existing, isEnabled: false });
  }
}

/**
 * Check if a specific skill is active in a session.
 */
export function isSkillActive(sessionId: string, skillId: string): boolean {
  const skillMap = sessionSkills.get(sessionId);
  if (!skillMap) return false;

  const skill = skillMap.get(skillId);
  return skill?.isEnabled ?? false;
}

/**
 * Clear all skills for a session (e.g., when session ends).
 */
export function clearSessionSkills(sessionId: string): void {
  sessionSkills.delete(sessionId);
}

/**
 * Get the number of active skills in a session.
 */
export function getActiveSkillCount(sessionId: string): number {
  const skillMap = sessionSkills.get(sessionId);
  if (!skillMap) return 0;
  return Array.from(skillMap.values()).filter((s) => s.isEnabled).length;
}

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/**
 * Get or create the skill map for a session.
 */
function getSessionMap(sessionId: string): Map<string, LoadedSkill> {
  let map = sessionSkills.get(sessionId);
  if (!map) {
    map = new Map();
    sessionSkills.set(sessionId, map);
  }
  return map;
}

/**
 * Parse the `tools` array from a skill's JSON config.
 * Config format: { "tools": ["bash", "file-read", ...] }
 */
function parseToolsFromConfig(configJson: string | null): string[] {
  if (!configJson) return [];

  try {
    const parsed = JSON.parse(configJson);
    if (parsed && Array.isArray(parsed.tools)) {
      return parsed.tools.filter((t: unknown) => typeof t === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

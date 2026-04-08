// ============================================================
// Dynamic Skill Loader — Claude Code inspired
// Discovers skills from context (file paths, patterns) and
// injects specialized prompts into the system message.
// Unlike the DB-based skill system, this is lightweight and
// triggers automatically based on the agent's file operations.
// ============================================================

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface DynamicSkill {
  id: string;
  name: string;
  description: string;
  /** System prompt injected when this skill is active */
  systemPrompt: string;
  /** File patterns that trigger this skill (glob) */
  triggerPatterns: string[];
  /** File extensions that trigger this skill */
  triggerExtensions: string[];
  /** Tools restricted to when this skill is active (empty = all core tools) */
  allowedTools?: string[];
  /** Priority: higher skills override lower ones */
  priority: number;
}

// ────────────────────────────────────────────
// Built-in Skill Registry
// Claude Code pattern: bundled skills that activate
// based on file patterns the agent encounters.
// ────────────────────────────────────────────

const BUNDLED_SKILLS: DynamicSkill[] = [
  {
    id: 'debug',
    name: 'Debug',
    description: 'Debug issues in your codebase',
    systemPrompt: `# Debug Mode Active

You are now in debug mode. Focus on:
1. Identifying the root cause of the issue
2. Reading relevant error messages, logs, and stack traces
3. Checking recent code changes that might have caused the issue
4. Proposing and testing fixes step by step

Approach:
- Start by understanding the error/issue thoroughly
- Use file-read and grep to find relevant code
- Use bash to run tests or reproduce the issue
- Propose minimal, targeted fixes
- Verify the fix resolves the issue`,
    triggerPatterns: ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/__tests__/**'],
    triggerExtensions: ['.log', '.err'],
    allowedTools: ['bash', 'file-read', 'file-edit', 'glob', 'grep', 'web-search'],
    priority: 10,
  },
  {
    id: 'review',
    name: 'Code Review',
    description: 'Review code for quality, bugs, and best practices',
    systemPrompt: `# Code Review Mode Active

You are now in code review mode. Focus on:
1. **Bugs & Logic Errors**: Look for off-by-one errors, null references, race conditions
2. **Security**: Check for injection vulnerabilities, hardcoded secrets, unsafe operations
3. **Performance**: Identify N+1 queries, unnecessary re-renders, memory leaks
4. **Best Practices**: Naming conventions, SOLID principles, DRY
5. **Type Safety**: Missing null checks, incorrect types, any casts

Provide specific, actionable feedback with line references.`,
    triggerPatterns: ['**/pull_request/**', '**/PR/**'],
    triggerExtensions: [],
    allowedTools: ['bash', 'file-read', 'glob', 'grep', 'web-search'],
    priority: 8,
  },
  {
    id: 'frontend',
    name: 'Frontend Development',
    description: 'Frontend/UI development with React, CSS, and accessibility',
    systemPrompt: `# Frontend Development Mode Active

You are now in frontend development mode. Guidelines:
1. **Component Design**: Prefer small, composable components
2. **Styling**: Use Tailwind CSS utility classes, avoid inline styles
3. **Accessibility**: Add proper ARIA labels, keyboard navigation, semantic HTML
4. **Performance**: Use React.memo, useMemo, useCallback where appropriate
5. **State Management**: Keep state as local as possible, lift only when needed
6. **Responsive**: Design mobile-first, use responsive breakpoints

For UI components, prefer shadcn/ui patterns.`,
    triggerPatterns: ['**/src/components/**', '**/src/app/**'],
    triggerExtensions: ['.tsx', '.jsx', '.css', '.scss', '.module.css'],
    priority: 5,
  },
  {
    id: 'backend',
    name: 'Backend Development',
    description: 'Backend/API development with database operations',
    systemPrompt: `# Backend Development Mode Active

You are now in backend development mode. Guidelines:
1. **API Design**: RESTful conventions, proper HTTP methods, status codes
2. **Database**: Parameterized queries, proper indexing, transaction safety
3. **Error Handling**: Meaningful error messages, proper error codes
4. **Validation**: Input validation on all endpoints, sanitize user input
5. **Security**: Authentication, authorization, rate limiting
6. **Performance**: Connection pooling, caching, query optimization`,
    triggerPatterns: ['**/src/app/api/**', '**/src/lib/**'],
    triggerExtensions: ['.ts', '.js'],
    priority: 5,
  },
  {
    id: 'git',
    name: 'Git Operations',
    description: 'Git version control operations',
    systemPrompt: `# Git Mode Active

You are now in git operations mode. Guidelines:
1. **Commit Messages**: Use conventional commits (feat:, fix:, docs:, etc.)
2. **Branch Management**: Create feature branches, keep main clean
3. **Safety**: Never force push to shared branches
4. **Conflict Resolution**: Resolve conflicts carefully, preserving both sides when possible
5. **History**: Keep history clean with interactive rebase (only on local branches)`,
    triggerPatterns: ['.git/**'],
    triggerExtensions: [],
    allowedTools: ['bash', 'file-read', 'glob', 'grep'],
    priority: 3,
  },
];

// ────────────────────────────────────────────
// Session Skill State
// ────────────────────────────────────────────

/** Tracks which skills are active per session */
const sessionActiveSkills: Map<string, Set<string>> = new Map();

/** Tracks recently seen file paths per session (for skill discovery) */
const sessionSeenPaths: Map<string, Set<string>> = new Map();

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Discover skills triggered by a file path.
 * Called after file-read, glob, grep operations.
 * Non-blocking: updates session skill state silently.
 */
export function discoverSkillsForPath(sessionId: string, filePath: string): DynamicSkill[] {
  if (!sessionId || !filePath) return [];

  const seen = getSessionSeenPaths(sessionId);

  // Skip if we've already seen this path (avoid re-triggering)
  if (seen.has(filePath)) {
    return getActiveSkills(sessionId);
  }
  seen.add(filePath);

  const matched: DynamicSkill[] = [];

  for (const skill of BUNDLED_SKILLS) {
    // Check file extension match
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    if (skill.triggerExtensions.includes(ext)) {
      matched.push(skill);
      continue;
    }

    // Check pattern match (simple glob: **/*.test.* → check for .test. in filename)
    for (const pattern of skill.triggerPatterns) {
      const basePattern = pattern.replace(/^\*\*\//, '').replace(/\*\*/g, '').replace(/\*/g, '');
      if (basePattern && filePath.includes(basePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
        matched.push(skill);
        break;
      }
    }
  }

  // Sort by priority (higher first)
  matched.sort((a, b) => b.priority - a.priority);

  // Update session active skills
  const active = getSessionActiveSkills(sessionId);
  for (const skill of matched) {
    active.add(skill.id);
  }

  return matched;
}

/**
 * Get all active skills for a session.
 */
export function getActiveSkills(sessionId: string): DynamicSkill[] {
  const activeIds = sessionActiveSkills.get(sessionId);
  if (!activeIds || activeIds.size === 0) return [];

  return BUNDLED_SKILLS.filter(s => activeIds.has(s.id));
}

/**
 * Build the combined system prompt injection from all active skills.
 * Returns empty string if no skills are active.
 */
export function buildSkillSystemPrompt(sessionId: string): string {
  const active = getActiveSkills(sessionId);
  if (active.length === 0) return '';

  const sections = active
    .sort((a, b) => b.priority - a.priority)
    .map(skill => `\n${skill.systemPrompt}\n`);

  return sections.join('\n---\n');
}

/**
 * Get the merged allowed tools from all active skills.
 * If no skills restrict tools, returns null (meaning all tools are available).
 * If skills restrict tools, returns the intersection of allowed tools.
 */
export function getAllowedTools(sessionId: string): string[] | null {
  const active = getActiveSkills(sessionId);

  const restrictions = active
    .filter(s => s.allowedTools && s.allowedTools.length > 0)
    .map(s => s.allowedTools!);

  if (restrictions.length === 0) return null; // No restrictions

  // Intersection of all restrictions
  const allowed = new Set(restrictions[0]);
  for (const r of restrictions.slice(1)) {
    for (const tool of allowed) {
      if (!r.includes(tool)) allowed.delete(tool);
    }
  }

  return Array.from(allowed);
}

/**
 * Clear session skill state (when session ends).
 */
export function clearSessionSkills(sessionId: string): void {
  sessionActiveSkills.delete(sessionId);
  sessionSeenPaths.delete(sessionId);
}

/**
 * Manually activate a skill by ID.
 */
export function activateSkill(sessionId: string, skillId: string): boolean {
  const skill = BUNDLED_SKILLS.find(s => s.id === skillId);
  if (!skill) return false;

  const active = getSessionActiveSkills(sessionId);
  active.add(skillId);
  return true;
}

/**
 * Manually deactivate a skill by ID.
 */
export function deactivateSkill(sessionId: string, skillId: string): void {
  const active = sessionActiveSkills.get(sessionId);
  if (active) active.delete(skillId);
}

/**
 * Get all available bundled skills (for UI listing).
 */
export function getAllBundledSkills(): DynamicSkill[] {
  return [...BUNDLED_SKILLS];
}

// ────────────────────────────────────────────
// Internal Helpers
// ────────────────────────────────────────────

function getSessionActiveSkills(sessionId: string): Set<string> {
  let set = sessionActiveSkills.get(sessionId);
  if (!set) {
    set = new Set();
    sessionActiveSkills.set(sessionId, set);
  }
  return set;
}

function getSessionSeenPaths(sessionId: string): Set<string> {
  let set = sessionSeenPaths.get(sessionId);
  if (!set) {
    set = new Set();
    sessionSeenPaths.set(sessionId, set);
  }
  return set;
}

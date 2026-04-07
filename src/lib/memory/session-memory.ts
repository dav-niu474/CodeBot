import { db } from "@/lib/db";

// ============================================================
// Types
// ============================================================

interface MemoryExtraction {
  content: string;
  category: "preference" | "pattern" | "decision" | "fact" | "error" | "task";
  importance: number; // 1-10
  tags: string[];
}

// ============================================================
// Heuristic Extraction Rules
// ============================================================

interface ExtractionRule {
  patterns: RegExp[];
  category: MemoryExtraction["category"];
  importance: number;
  extractContent: (match: RegExpMatchArray, fullContent: string) => string;
  extractTags?: (match: RegExpMatchArray) => string[];
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // --- Preferences ---
  {
    category: "preference",
    importance: 7,
    patterns: [
      /i (?:prefer|like|want|love|use) (.+?)(?:\.|,|$)/gi,
      /(?:please |always |never )?(?:use|go with|stick with) (.+?) (?:instead of|rather than) (.+?)(?:\.|,|$)/gi,
      /(?:always|never) (?:use|do|make|write|create) (.+?)(?:\.|,|$)/gi,
    ],
    extractContent: (match) => {
      const raw = match[0].trim();
      return raw.endsWith(".") || raw.endsWith(",") ? raw.slice(0, -1) : raw;
    },
    extractTags: () => ["preference"],
  },

  // --- Decisions ---
  {
    category: "decision",
    importance: 8,
    patterns: [
      /(?:let'?s|we |i |let us) (?:use|go with|switch to|adopt|choose|pick) (.+?)(?:\.|,|$)/gi,
      /(?:we |i )?(?:decided|decided to) (?:to )?(.+?)(?:\.|,|$)/gi,
      /(?:switching|switched|migrated|migrating) (?:to )?(.+?)(?:\.|,|$)/gi,
    ],
    extractContent: (match) => {
      const raw = match[0].trim();
      return raw.endsWith(".") || raw.endsWith(",") ? raw.slice(0, -1) : raw;
    },
    extractTags: () => ["decision"],
  },

  // --- Errors & Solutions ---
  {
    category: "error",
    importance: 7,
    patterns: [
      /(?:error|bug|issue|problem|failed|failure)(?:\s*:)?\s+(.+?)(?:\.|,|$)/gi,
      /(?:fixed|resolved|solved|workaround) (?:the )?(.+?)(?:by|with|using) (.+?)(?:\.|,|$)/gi,
      /(?:the )?(?:fix|solution) (?:is|was) (?:to )?(.+?)(?:\.|,|$)/gi,
    ],
    extractContent: (match) => {
      const raw = match[0].trim();
      return raw.endsWith(".") || raw.endsWith(",") ? raw.slice(0, -1) : raw;
    },
    extractTags: () => ["error", "solution"],
  },

  // --- Patterns ---
  {
    category: "pattern",
    importance: 6,
    patterns: [
      /(?:using|with|built on) (?:the )?(react|next\.js|nextjs|vue|angular|svelte|express|fastify|nestjs|django|flask|rails|prisma|typeorm|sequelize|mongodb|postgres|redis|tailwind|bootstrap|shadcn|zustand|redux|mobx|typescript|javascript|python|go|rust|java|docker|kubernetes|graphql|rest|grpc|websocket)/gi,
      /(?:the |a )?(?:pattern|pattern used|architecture|approach|structure) (?:is|was|should be) (.+?)(?:\.|,|$)/gi,
    ],
    extractContent: (match) => {
      const raw = match[0].trim();
      return raw.endsWith(".") || raw.endsWith(",") ? raw.slice(0, -1) : raw;
    },
    extractTags: (match) => {
      const techMatch = match[1]?.toLowerCase();
      return techMatch ? ["pattern", techMatch] : ["pattern"];
    },
  },

  // --- Facts ---
  {
    category: "fact",
    importance: 5,
    patterns: [
      /(?:https?:\/\/[^\s)]+)/g,
      /(?:\/[a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,5})\b/g,
      /(?:api[_-]?key|token|secret|password|endpoint)\s*(?::|=)\s*\S+/gi,
    ],
    extractContent: (match) => match[0].trim(),
    extractTags: (match) => {
      const val = match[0].toLowerCase();
      if (val.startsWith("http")) return ["fact", "url"];
      if (val.includes("/")) return ["fact", "path"];
      return ["fact"];
    },
  },

  // --- Tasks ---
  {
    category: "task",
    importance: 4,
    patterns: [
      /(?:completed|finished|done|implemented|added|created|built|deployed|shipped) (.+?)(?:\.|,|$)/gi,
      /(?:need to|todo|to-do|next step|pending|remaining|blocked) (?:to )?(.+?)(?:\.|,|$)/gi,
    ],
    extractContent: (match) => {
      const raw = match[0].trim();
      return raw.endsWith(".") || raw.endsWith(",") ? raw.slice(0, -1) : raw;
    },
    extractTags: () => ["task"],
  },
];

// ============================================================
// Deduplication helper
// ============================================================

function isDuplicate(
  candidate: string,
  existing: string[],
  threshold: number = 0.7
): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const cNorm = norm(candidate);
  const cLen = cNorm.length;
  if (cLen < 5) return false;

  for (const e of existing) {
    const eNorm = norm(e);
    // Simple substring overlap check
    if (cNorm.includes(eNorm) || eNorm.includes(cNorm)) return true;

    // Character-level Jaccard similarity for short strings
    if (cLen < 80 && eNorm.length < 80) {
      const cSet = new Set(cNorm.split(""));
      const eSet = new Set(eNorm.split(""));
      let intersection = 0;
      for (const ch of cSet) {
        if (eSet.has(ch)) intersection++;
      }
      const union = cSet.size + eSet.size - intersection;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity >= threshold) return true;
    }
  }
  return false;
}

// ============================================================
// Public API
// ============================================================

/**
 * Extract key information from conversation messages using heuristic rules.
 * Rules for extraction:
 * - User preferences (language, style, framework choices) → category: preference, importance: 7
 * - Technical patterns (architecture, API patterns) → category: pattern, importance: 6
 * - Decisions made (framework choice, DB choice) → category: decision, importance: 8
 * - Important facts (API keys mentioned, URLs, file paths) → category: fact, importance: 5
 * - Errors encountered and solutions → category: error, importance: 7
 * - Task status changes → category: task, importance: 4
 *
 * Uses simple heuristic rules (regex patterns, keyword matching).
 * Keeps it fast and deterministic — no AI calls.
 */
export function extractMemoriesFromMessages(
  messages: Array<{ role: string; content: string }>
): MemoryExtraction[] {
  const results: MemoryExtraction[] = [];
  const seenContents: string[] = [];

  // Process last 10 messages max to avoid noise
  const recentMessages = messages.slice(-10);

  for (const msg of recentMessages) {
    if (!msg.content || msg.content.length < 10) continue;

    for (const rule of EXTRACTION_RULES) {
      for (const pattern of rule.patterns) {
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(msg.content)) !== null) {
          const content = rule.extractContent(match, msg.content);

          if (
            !content ||
            content.length < 8 ||
            content.length > 500 ||
            isDuplicate(content, seenContents)
          ) {
            continue;
          }

          const tags = rule.extractTags
            ? rule.extractTags(match)
            : [rule.category];

          results.push({
            content,
            category: rule.category,
            importance: rule.importance,
            tags,
          });

          seenContents.push(content);

          if (results.length >= 5) {
            return results;
          }
        }
      }
    }

    if (results.length >= 5) break;
  }

  return results;
}

/**
 * Save extracted memories to the database.
 * For each memory:
 * 1. Check if a similar memory already exists (by content substring match)
 * 2. If exists, update accessCount and importance
 * 3. If new, create new Memory record with layer: 'session'
 * Returns count of memories saved/updated.
 */
export async function saveSessionMemories(
  sessionId: string,
  memories: MemoryExtraction[]
): Promise<number> {
  let savedCount = 0;

  for (const mem of memories) {
    // Check for existing similar memory
    const existing = await db.memory.findFirst({
      where: {
        sessionId,
        layer: "session",
        category: mem.category,
        content: {
          contains: mem.content.slice(0, 40),
        },
      },
    });

    if (existing) {
      // Update existing: bump access count and importance
      await db.memory.update({
        where: { id: existing.id },
        data: {
          accessCount: { increment: 1 },
          importance: Math.min(10, existing.importance + 1),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new memory
      await db.memory.create({
        data: {
          sessionId,
          layer: "session",
          category: mem.category,
          content: mem.content,
          tags: JSON.stringify(mem.tags),
          importance: mem.importance,
        },
      });
    }

    savedCount++;
  }

  return savedCount;
}

/**
 * Get session memories for context injection.
 * Queries memories from DB:
 * - layer: 'session'
 * - importance >= minImportance (default 5)
 * - Order by importance DESC, accessCount DESC
 * - Limit to maxCount (default 10)
 */
export async function getSessionMemories(
  sessionId: string,
  options?: { maxCount?: number; minImportance?: number }
): Promise<Array<{ content: string; category: string; importance: number }>> {
  const maxCount = options?.maxCount ?? 10;
  const minImportance = options?.minImportance ?? 5;

  const memories = await db.memory.findMany({
    where: {
      sessionId,
      layer: "session",
      importance: { gte: minImportance },
    },
    orderBy: [
      { importance: "desc" },
      { accessCount: "desc" },
      { updatedAt: "desc" },
    ],
    take: maxCount,
    select: {
      content: true,
      category: true,
      importance: true,
    },
  });

  return memories;
}

/**
 * Build a memory context string for system prompt injection.
 */
export function buildMemoryContext(
  memories: Array<{ content: string; category: string }>
): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => `- [${m.category}] ${m.content}`);
  return `\n\n## Memory Context\nThe following information was remembered from previous conversations:\n${lines.join("\n")}`;
}

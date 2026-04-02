import { db } from "@/lib/db";

export interface DreamTaskResult {
  id: string;
  consolidatedFacts: string[];
  patterns: string[];
  recommendations: string[];
  processedSessions: number;
  timestamp: string;
}

const DREAM_LAYER = "dream";
const SESSION_LAYER = "session";
const MIN_SESSIONS_TO_TRIGGER = 5;
const DREAM_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionMemory {
  id: string;
  sessionId: string | null;
  category: string | null;
  content: string;
  importance: number;
  createdAt: Date;
}

interface CategoryGroup {
  category: string;
  memories: SessionMemory[];
}

/**
 * Check if DreamTask should be triggered.
 * Conditions:
 * - At least 5 completed sessions exist (sessions with messages)
 * - OR last DreamTask was more than 24 hours ago AND there are new session memories
 */
export async function shouldTriggerDreamTask(): Promise<boolean> {
  // 1. Check if there are at least 5 sessions with messages
  const sessionsWithMessages = await db.session.findMany({
    where: {
      messages: { some: {} },
    },
    select: { id: true },
    take: 1,
  });
  const hasMinSessions = sessionsWithMessages.length > 0;

  // Count total sessions with messages
  const totalSessionCount = await db.session.count({
    where: { messages: { some: {} } },
  });
  const enoughSessions = totalSessionCount >= MIN_SESSIONS_TO_TRIGGER;

  if (enoughSessions) {
    return true;
  }

  // 2. Check if last DreamTask was more than 24 hours ago
  const lastDream = await db.memory.findFirst({
    where: { layer: DREAM_LAYER },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const now = Date.now();
  const lastDreamTime = lastDream ? lastDream.createdAt.getTime() : 0;
  const dreamIntervalPassed = now - lastDreamTime > DREAM_INTERVAL_MS;

  if (!dreamIntervalPassed) {
    return false;
  }

  // 3. Check if there are new session memories since last DreamTask
  const newSessionMemories = await db.memory.count({
    where: {
      layer: SESSION_LAYER,
      ...(lastDream ? { createdAt: { gt: lastDream.createdAt } } : {}),
    },
  });

  return newSessionMemories > 0;
}

/**
 * Normalize text for pattern matching.
 * Converts to lowercase, trims whitespace, collapses multiple spaces.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Extract the core semantic content from a memory entry.
 * Strips metadata prefixes like [COMPRESSED CONTEXT - ...] etc.
 */
function extractCoreContent(content: string): string {
  // Remove compressed context prefixes
  let cleaned = content.replace(/\[COMPRESSED CONTEXT[^\]]*\]\s*/gi, "");
  // Remove session-specific prefixes
  cleaned = cleaned.replace(/\[Session[^\]]*\]\s*/gi, "");
  // Remove leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Simple similarity check between two text strings.
 * Returns true if the normalized texts share significant overlap.
 * Uses word-level Jaccard similarity.
 */
function isSimilar(a: string, b: string, threshold: number = 0.4): boolean {
  const wordsA = new Set(normalize(a).split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(normalize(b).split(" ").filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 && intersection / union >= threshold;
}

/**
 * Group memories by category and identify duplicates.
 */
function groupByCategory(memories: SessionMemory[]): CategoryGroup[] {
  const groupMap = new Map<string, SessionMemory[]>();

  for (const memory of memories) {
    const category = memory.category || "general";
    const existing = groupMap.get(category) || [];
    existing.push(memory);
    groupMap.set(category, existing);
  }

  return Array.from(groupMap.entries()).map(([category, items]) => ({
    category,
    memories: items,
  }));
}

/**
 * Deduplicate memories within a category using similarity matching.
 * Returns an array of deduplicated content strings with occurrence counts.
 */
function deduplicateGroup(
  memories: SessionMemory[]
): { content: string; occurrences: number; avgImportance: number }[] {
  const deduped: { content: string; occurrences: number; totalImportance: number }[] = [];

  for (const memory of memories) {
    const coreContent = extractCoreContent(memory.content);
    if (!coreContent) continue;

    // Check if this content is similar to any existing deduplicated entry
    let matched = false;
    for (const entry of deduped) {
      if (isSimilar(entry.content, coreContent)) {
        entry.occurrences += 1;
        entry.totalImportance += memory.importance;
        matched = true;
        break;
      }
    }

    if (!matched) {
      deduped.push({
        content: coreContent,
        occurrences: 1,
        totalImportance: memory.importance,
      });
    }
  }

  return deduped.map((entry) => ({
    content: entry.content,
    occurrences: entry.occurrences,
    avgImportance: Math.round(entry.totalImportance / entry.occurrences),
  }));
}

/**
 * Extract error patterns from memory content using simple pattern matching.
 * Looks for common error indicators and returns recommendations.
 */
function generateErrorRecommendations(memories: SessionMemory[]): string[] {
  const recommendations: string[] = [];
  const errorMemories = memories.filter(
    (m) => m.category === "error" || normalize(m.content).includes("error")
  );

  if (errorMemories.length === 0) return recommendations;

  // Extract error-related keywords and group them
  const errorKeywords = new Map<string, number>();
  const errorPatterns = [
    /permission\s+denied/gi,
    /not\s+found/gi,
    /timeout/gi,
    /connection\s+refused/gi,
    /syntax\s*error/gi,
    /type\s*error/gi,
    /undefined\s+is\s+not/gi,
    /cannot\s+read\s+property/gi,
    /ENOENT/gi,
    /EACCES/gi,
    /module\s+not\s+found/gi,
    /failed\s+to\s+fetch/gi,
  ];

  for (const memory of errorMemories) {
    const text = normalize(memory.content);
    for (const pattern of errorPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const key = match.toLowerCase();
          errorKeywords.set(key, (errorKeywords.get(key) || 0) + 1);
        }
      }
    }
  }

  // Generate recommendations for recurring errors
  for (const [keyword, count] of errorKeywords) {
    if (count >= 2) {
      recommendations.push(
        `Recurring issue "${keyword}" detected (${count} occurrences). Consider adding preventive checks or error handling.`
      );
    }
  }

  // General recommendation if many errors
  if (errorMemories.length >= 5) {
    recommendations.push(
      `High error frequency detected (${errorMemories.length} error memories). Consider reviewing error-prone areas and adding validation.`
    );
  }

  return recommendations;
}

/**
 * Execute DreamTask: Consolidate session memories into higher-level insights.
 *
 * Process:
 * 1. Load all session memories from DB (layer: 'session')
 * 2. Group by category
 * 3. For each category, identify patterns and recurring themes
 * 4. Create consolidated facts (high-importance memories that appear frequently)
 * 5. Store results as layer: 'dream' memories with high importance
 * 6. Return result
 *
 * IMPORTANT: Uses simple pattern matching, NOT AI calls (to avoid infinite loops).
 */
export async function executeDreamTask(): Promise<DreamTaskResult> {
  // 1. Load all session memories
  const sessionMemories = await db.memory.findMany({
    where: {
      layer: SESSION_LAYER,
    },
    orderBy: { createdAt: "desc" },
  });

  if (sessionMemories.length === 0) {
    return {
      id: "",
      consolidatedFacts: [],
      patterns: [],
      recommendations: [],
      processedSessions: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Collect unique session IDs
  const sessionIds = new Set<string>();
  for (const m of sessionMemories) {
    if (m.sessionId) sessionIds.add(m.sessionId);
  }

  // 2. Group by category
  const groups = groupByCategory(sessionMemories);

  // 3-4. Identify patterns and consolidated facts
  const consolidatedFacts: string[] = [];
  const patterns: string[] = [];

  for (const group of groups) {
    const deduped = deduplicateGroup(group.memories);

    // Facts: items appearing in 3+ sessions → importance 10
    const frequentItems = deduped.filter((d) => d.occurrences >= 3);
    for (const item of frequentItems) {
      const fact = `[${group.category.toUpperCase()}] (repeated ${item.occurrences}x) ${item.content}`;
      consolidatedFacts.push(fact);
    }

    // Patterns: category items appearing in 2+ → pattern
    const patternItems = deduped.filter(
      (d) => d.occurrences >= 2 && d.occurrences < 3
    );
    for (const item of patternItems) {
      const pattern = `[${group.category}] Recurring theme (${item.occurrences}x): ${item.content}`;
      patterns.push(pattern);
    }

    // If the entire category has many entries, note the category pattern
    if (group.memories.length >= 5 && frequentItems.length === 0 && patternItems.length === 0) {
      patterns.push(
        `[${group.category}] High volume of memories in this category (${group.memories.length} entries).`
      );
    }
  }

  // 5. Generate recommendations based on errors encountered
  const recommendations = generateErrorRecommendations(sessionMemories);

  // Also generate general recommendations from patterns
  if (patterns.length >= 3) {
    recommendations.push(
      `${patterns.length} recurring patterns detected. Consider documenting these as standard procedures.`
    );
  }

  if (consolidatedFacts.length >= 5) {
    recommendations.push(
      `${consolidatedFacts.length} high-confidence facts established from repeated observations. These can be trusted as reliable knowledge.`
    );
  }

  // 6. Save consolidated memories to DB
  const dreamId = `dream-${Date.now()}`;

  // Save consolidated facts as high-importance dream memories
  for (const fact of consolidatedFacts) {
    await db.memory.create({
      data: {
        layer: DREAM_LAYER,
        category: "fact",
        content: fact,
        tags: JSON.stringify(["dream-consolidated", "fact", dreamId]),
        importance: 10,
        accessCount: 1,
      },
    });
  }

  // Save patterns as medium-importance dream memories
  for (const pattern of patterns) {
    await db.memory.create({
      data: {
        layer: DREAM_LAYER,
        category: "pattern",
        content: pattern,
        tags: JSON.stringify(["dream-consolidated", "pattern", dreamId]),
        importance: 7,
        accessCount: 1,
      },
    });
  }

  // Save recommendations
  for (const rec of recommendations) {
    await db.memory.create({
      data: {
        layer: DREAM_LAYER,
        category: "recommendation",
        content: rec,
        tags: JSON.stringify(["dream-consolidated", "recommendation", dreamId]),
        importance: 6,
        accessCount: 1,
      },
    });
  }

  // Store a summary dream memory
  const summaryContent = [
    `DreamTask completed at ${new Date().toISOString()}`,
    `Processed ${sessionMemories.length} memories from ${sessionIds.size} sessions`,
    `Generated: ${consolidatedFacts.length} facts, ${patterns.length} patterns, ${recommendations.length} recommendations`,
  ].join("\n");

  await db.memory.create({
    data: {
      layer: DREAM_LAYER,
      category: "context",
      content: summaryContent,
      tags: JSON.stringify(["dream-summary", dreamId]),
      importance: 5,
      accessCount: 0,
    },
  });

  return {
    id: dreamId,
    consolidatedFacts,
    patterns,
    recommendations,
    processedSessions: sessionIds.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get DreamTask insights for context.
 * Loads memories with layer: 'dream', ordered by importance DESC.
 * Categorizes into facts/patterns/recommendations.
 */
export async function getDreamInsights(): Promise<{
  facts: string[];
  patterns: string[];
  recommendations: string[];
}> {
  const dreamMemories = await db.memory.findMany({
    where: {
      layer: DREAM_LAYER,
    },
    orderBy: { importance: "desc" },
    take: 100,
  });

  const facts: string[] = [];
  const patterns: string[] = [];
  const recommendations: string[] = [];

  for (const memory of dreamMemories) {
    // Skip summary entries
    let parsedTags: string[] = [];
    try {
      const raw = JSON.parse(memory.tags || "[]");
      parsedTags = Array.isArray(raw) ? raw : [];
    } catch {
      // ignore parse errors
    }
    if (parsedTags.includes("dream-summary")) continue;

    const content = extractCoreContent(memory.content);

    switch (memory.category) {
      case "fact":
        facts.push(content);
        break;
      case "pattern":
        patterns.push(content);
        break;
      case "recommendation":
        recommendations.push(content);
        break;
      default:
        // Categorize by importance
        if (memory.importance >= 9) {
          facts.push(content);
        } else if (memory.importance >= 6) {
          patterns.push(content);
        } else {
          recommendations.push(content);
        }
    }
  }

  return { facts, patterns, recommendations };
}

/**
 * Build dream insight context for system prompt injection.
 * Returns a formatted string with consolidated dream insights.
 */
export function buildDreamInsightContext(insights: {
  facts: string[];
  patterns: string[];
  recommendations: string[];
}): string {
  const sections: string[] = [];

  if (insights.facts.length > 0) {
    const factLines = insights.facts
      .slice(0, 15)
      .map((f, i) => `${i + 1}. ${f}`);
    sections.push(`### Established Facts\n${factLines.join("\n")}`);
  }

  if (insights.patterns.length > 0) {
    const patternLines = insights.patterns
      .slice(0, 10)
      .map((p, i) => `${i + 1}. ${p}`);
    sections.push(`### Recurring Patterns\n${patternLines.join("\n")}`);
  }

  if (insights.recommendations.length > 0) {
    const recLines = insights.recommendations
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r}`);
    sections.push(`### Recommendations\n${recLines.join("\n")}`);
  }

  if (sections.length === 0) return "";
  return `\n\n## Dream Insights (Consolidated Knowledge)\n${sections.join("\n\n")}`;
}

/**
 * Get the most recent DreamTask execution timestamp.
 */
export async function getLastDreamTimestamp(): Promise<Date | null> {
  const lastDream = await db.memory.findFirst({
    where: {
      layer: DREAM_LAYER,
      category: "context",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return lastDream ? lastDream.createdAt : null;
}

/**
 * Clean up old dream memories (keep only the most recent batch).
 * Retains memories from the latest DreamTask ID and removes older ones.
 */
export async function cleanupOldDreamMemories(): Promise<number> {
  // Get the most recent dream batch ID
  const recentDreams = await db.memory.findMany({
    where: {
      layer: DREAM_LAYER,
      tags: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { tags: true },
  });

  if (recentDreams.length === 0) return 0;

  let latestDreamId = "";
  try {
    const parsedTags = JSON.parse(recentDreams[0].tags || "[]");
    if (Array.isArray(parsedTags)) {
      latestDreamId = parsedTags.find(
        (t: string) => t.startsWith("dream-")
      ) || "";
    }
  } catch {
    return 0;
  }

  if (!latestDreamId) return 0;

  // Delete dream memories that don't belong to the latest batch
  const result = await db.memory.deleteMany({
    where: {
      layer: DREAM_LAYER,
      tags: { not: null },
      NOT: {
        tags: { contains: latestDreamId },
      },
    },
  });

  return result.count;
}

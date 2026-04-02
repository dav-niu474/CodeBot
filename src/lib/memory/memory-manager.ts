import {
  extractMemoriesFromMessages,
  saveSessionMemories,
  getSessionMemories,
  buildMemoryContext,
} from "./session-memory";
import {
  loadMemdir,
  saveMemdirEntry,
  extractMemdirFromConversation,
  buildMemdirContext,
} from "./memdir";

// ============================================================
// Types
// ============================================================

export interface ProcessResult {
  sessionMemories: number;
  memdirEntries: number;
}

export interface MemoryStats {
  sessionMemories: number;
  memdirEntries: number;
  magicDocs: number;
  totalAccessCount: number;
}

// ============================================================
// Public API — Process Conversation
// ============================================================

/**
 * Process conversation for memory extraction and storage.
 * Called after each agentic loop completion.
 *
 * 1. Extract session memories from recent messages (last 10)
 * 2. Extract memdir entries from the full conversation
 * 3. Save session memories to DB
 * 4. Save memdir entries to DB + MEMORY.md
 * 5. Return counts
 */
export async function processConversationForMemory(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  projectRoot?: string
): Promise<ProcessResult> {
  // 1. Extract session memories from last 10 messages
  const sessionExtractions = extractMemoriesFromMessages(messages);
  let sessionMemories = 0;

  if (sessionExtractions.length > 0) {
    sessionMemories = await saveSessionMemories(sessionId, sessionExtractions);
  }

  // 2. Extract memdir entries from full conversation
  const memdirExtractions = extractMemdirFromConversation(messages);
  let memdirEntries = 0;

  if (memdirExtractions.length > 0) {
    for (const entry of memdirExtractions) {
      await saveMemdirEntry(entry, projectRoot);
      memdirEntries++;
    }
  }

  return { sessionMemories, memdirEntries };
}

// ============================================================
// Public API — Build Full Context
// ============================================================

/**
 * Build complete memory context for system prompt.
 * Combines session memories + memdir entries into a single context string.
 */
export async function buildFullMemoryContext(
  sessionId: string,
  projectRoot?: string
): Promise<string> {
  const parts: string[] = [];

  // 1. Load session memories
  const sessionMemories = await getSessionMemories(sessionId);
  if (sessionMemories.length > 0) {
    parts.push(buildMemoryContext(sessionMemories));
  }

  // 2. Load memdir entries
  const memdirEntries = await loadMemdir(projectRoot);
  if (memdirEntries.length > 0) {
    parts.push(buildMemdirContext(memdirEntries));
  }

  return parts.join("\n");
}

// ============================================================
// Public API — Stats
// ============================================================

/**
 * Get memory statistics for dashboard display.
 * Returns counts by layer and total access count.
 */
export async function getMemoryStats(): Promise<MemoryStats> {
  const [sessionMemories, memdirEntries, magicDocs, aggregate] =
    await Promise.all([
      db.memory.count({ where: { layer: "session" } }),
      db.memory.count({ where: { layer: "memdir" } }),
      db.memory.count({ where: { layer: "magic_doc" } }),
      db.memory.aggregate({
        _sum: { accessCount: true },
      }),
    ]);

  return {
    sessionMemories,
    memdirEntries,
    magicDocs,
    totalAccessCount: aggregate._sum.accessCount ?? 0,
  };
}

// Re-export sub-modules for convenient imports
export {
  extractMemoriesFromMessages,
  saveSessionMemories,
  getSessionMemories,
  buildMemoryContext,
} from "./session-memory";
export {
  loadMemdir,
  saveMemdirEntry,
  extractMemdirFromConversation,
  buildMemdirContext,
} from "./memdir";

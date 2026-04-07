import { db } from "@/lib/db";

export interface MagicDocEntry {
  id: string;
  title: string;
  content: string;
  sourceFiles: string[];
  tags: string[];
  accessCount: number;
  generatedAt: string;
  expiresAt?: string;
}

interface MagicDocTagsPayload {
  title: string;
  tags: string[];
}

const MAGIC_DOC_LAYER = "magic-doc";
const MAGIC_DOC_CATEGORY = "knowledge";
const DEFAULT_IMPORTANCE = 6;
const EXPIRY_DAYS = 7;

/**
 * Parse the stored tags JSON into a structured payload.
 * Tags field stores: JSON.stringify({ title: string, tags: string[] })
 */
function parseTagsPayload(raw: string | null): MagicDocTagsPayload {
  if (!raw) return { title: "Untitled", tags: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || "Untitled",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { title: "Untitled", tags: [] };
  }
}

/**
 * Parse the stored filePath JSON into a sourceFiles array.
 * filePath field stores: JSON.stringify(string[])
 */
function parseSourceFiles(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Convert a DB Memory record into a MagicDocEntry.
 */
function toMagicDocEntry(record: {
  id: string;
  content: string;
  filePath: string | null;
  tags: string | null;
  accessCount: number;
  createdAt: Date;
  expiresAt: Date | null;
}): MagicDocEntry {
  const tagPayload = parseTagsPayload(record.tags);
  const sourceFiles = parseSourceFiles(record.filePath);

  return {
    id: record.id,
    title: tagPayload.title,
    content: record.content,
    sourceFiles,
    tags: tagPayload.tags,
    accessCount: record.accessCount,
    generatedAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : undefined,
  };
}

/**
 * Create or update a magic doc for a source file.
 * Magic docs are triggered when the AI reads a file and wants to remember
 * key information about it.
 *
 * - If a magic doc already exists for the same set of source files, updates
 *   its content and increments accessCount.
 * - If new, creates a memory with layer 'magic-doc' and importance 6.
 * - Sets expiresAt to 7 days from now.
 */
export async function upsertMagicDoc(doc: {
  title: string;
  content: string;
  sourceFiles: string[];
  tags: string[];
}): Promise<MagicDocEntry> {
  const sourceFilesJson = JSON.stringify(
    [...doc.sourceFiles].sort()
  );
  const tagsPayload: MagicDocTagsPayload = {
    title: doc.title,
    tags: doc.tags,
  };
  const tagsJson = JSON.stringify(tagsPayload);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  // 1. Check if a magic doc for these exact source files already exists
  const existing = await db.memory.findFirst({
    where: {
      layer: MAGIC_DOC_LAYER,
      filePath: sourceFilesJson,
    },
  });

  if (existing) {
    // 2. Update existing doc
    const updated = await db.memory.update({
      where: { id: existing.id },
      data: {
        content: doc.content,
        tags: tagsJson,
        accessCount: { increment: 1 },
        expiresAt,
      },
    });
    return toMagicDocEntry(updated);
  }

  // 3. Create new magic doc
  const created = await db.memory.create({
    data: {
      layer: MAGIC_DOC_LAYER,
      category: MAGIC_DOC_CATEGORY,
      content: doc.content,
      filePath: sourceFilesJson,
      tags: tagsJson,
      importance: DEFAULT_IMPORTANCE,
      accessCount: 1,
      expiresAt,
    },
  });
  return toMagicDocEntry(created);
}

/**
 * Search magic docs by query.
 * Simple text search over title and content fields.
 * Results are ordered by accessCount DESC.
 */
export async function searchMagicDocs(
  query: string,
  maxResults: number = 10
): Promise<MagicDocEntry[]> {
  if (!query || query.trim().length === 0) {
    // Return all magic docs ordered by access count
    const records = await db.memory.findMany({
      where: {
        layer: MAGIC_DOC_LAYER,
        expiresAt: { gte: new Date() },
      },
      orderBy: { accessCount: "desc" },
      take: maxResults,
    });
    return records.map(toMagicDocEntry);
  }

  // Search in content (contains is case-insensitive in PostgreSQL)
  const lowerQuery = query.toLowerCase();
  const records = await db.memory.findMany({
    where: {
      layer: MAGIC_DOC_LAYER,
      expiresAt: { gte: new Date() },
      OR: [
        { content: { contains: query } },
        { content: { contains: lowerQuery } },
        { tags: { contains: query } },
      ],
    },
    orderBy: { accessCount: "desc" },
    take: maxResults,
  });
  return records.map(toMagicDocEntry);
}

/**
 * Get magic docs relevant to a set of files.
 * When the AI is about to work on certain files, it can retrieve
 * cached magic docs instead of re-reading them.
 *
 * Finds magic docs whose sourceFiles overlap with the given paths.
 */
export async function getMagicDocsForFiles(
  filePaths: string[]
): Promise<MagicDocEntry[]> {
  if (filePaths.length === 0) return [];

  // Load all non-expired magic docs and filter in-memory for overlap
  const allDocs = await db.memory.findMany({
    where: {
      layer: MAGIC_DOC_LAYER,
      expiresAt: { gte: new Date() },
    },
    orderBy: { accessCount: "desc" },
  });

  const matchingDocs = allDocs.filter((doc) => {
    const sourceFiles = parseSourceFiles(doc.filePath);
    // Check if any sourceFile overlaps with the requested paths
    return sourceFiles.some((sf) =>
      filePaths.some((fp) => sf === fp || fp.includes(sf) || sf.includes(fp))
    );
  });

  // Increment access counts for matched docs
  if (matchingDocs.length > 0) {
    const matchedIds = matchingDocs.map((d) => d.id);
    await db.memory.updateMany({
      where: { id: { in: matchedIds } },
      data: { accessCount: { increment: 1 } },
    });
  }

  return matchingDocs.map(toMagicDocEntry);
}

/**
 * Build magic doc context for system prompt injection.
 * Returns a formatted string with all magic docs that can be
 * injected into the AI system prompt.
 */
export function buildMagicDocContext(docs: MagicDocEntry[]): string {
  if (docs.length === 0) return "";

  const lines = docs.map((doc) => {
    return `### ${doc.title}\n${doc.content}\n_Sources: ${doc.sourceFiles.join(", ")}_`;
  });

  return `\n\n## Cached Documentation\n${lines.join("\n\n")}`;
}

/**
 * Clean up expired magic docs.
 * Deletes all docs where expiresAt < now AND layer = 'magic-doc'.
 * Returns the number of deleted records.
 */
export async function cleanupExpiredDocs(): Promise<number> {
  const result = await db.memory.deleteMany({
    where: {
      layer: MAGIC_DOC_LAYER,
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Delete a specific magic doc by ID.
 */
export async function deleteMagicDoc(id: string): Promise<boolean> {
  try {
    const existing = await db.memory.findUnique({
      where: { id },
    });
    if (!existing || existing.layer !== MAGIC_DOC_LAYER) {
      return false;
    }
    await db.memory.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a single magic doc by ID.
 */
export async function getMagicDocById(
  id: string
): Promise<MagicDocEntry | null> {
  const record = await db.memory.findUnique({
    where: { id },
  });
  if (!record || record.layer !== MAGIC_DOC_LAYER) {
    return null;
  }
  // Increment access count
  await db.memory.update({
    where: { id },
    data: { accessCount: { increment: 1 } },
  });
  return toMagicDocEntry(record);
}

/**
 * List all magic docs with optional pagination.
 */
export async function listMagicDocs(options?: {
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}): Promise<{ docs: MagicDocEntry[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const includeExpired = options?.includeExpired ?? false;

  const where: Record<string, unknown> = {
    layer: MAGIC_DOC_LAYER,
  };
  if (!includeExpired) {
    where.expiresAt = { gte: new Date() };
  }

  const [records, total] = await Promise.all([
    db.memory.findMany({
      where,
      orderBy: [{ accessCount: "desc" }, { updatedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    db.memory.count({ where }),
  ]);

  return {
    docs: records.map(toMagicDocEntry),
    total,
  };
}

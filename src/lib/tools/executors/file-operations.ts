import fs from 'fs/promises';
import path from 'path';
import type { ToolExecutionResult, ToolExecutionContext } from '../types';

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_READ_LINES = 5000;

/** Resolve a file path relative to working directory */
function resolvePath(filePath: string, context: ToolExecutionContext): string {
  if (path.isAbsolute(filePath)) return filePath;
  const base = context.workingDirectory || process.cwd();
  return path.resolve(base, filePath);
}

/**
 * file-read: Read file contents
 * Supports offset and limit for partial reads
 */
export async function executeFileRead(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  if (!filePath) {
    return { output: 'Error: "path" argument is required for file-read.', isError: true };
  }

  const resolved = resolvePath(filePath, context);

  try {
    const content = await fs.readFile(resolved, 'utf-8');
    const lines = content.split('\n');

    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const limit = typeof args.limit === 'number' ? args.limit : DEFAULT_LINE_LIMIT;

    // Apply offset and limit
    const startLine = Math.max(0, offset);
    const endLine = Math.min(lines.length, startLine + limit);
    const sliced = lines.slice(startLine, endLine);

    // Truncate long lines
    const truncated = sliced.map((line, i) => {
      if (line.length > MAX_LINE_LENGTH) {
        return line.substring(0, MAX_LINE_LENGTH) + `... (truncated, ${line.length} chars total)`;
      }
      return line;
    });

    // Format with line numbers (1-indexed)
    const numbered = truncated.map((line, i) => {
      const lineNum = startLine + i + 1;
      return `${String(lineNum).padStart(6, ' ')}\t${line}`;
    });

    const result = numbered.join('\n');

    // Add summary
    const totalLines = lines.length;
    let summary = `\n--- File: ${resolved} ---\n`;
    if (offset > 0 || endLine < totalLines) {
      summary += `[Showing lines ${startLine + 1}-${endLine} of ${totalLines} total lines]\n`;
    } else {
      summary += `[${totalLines} lines total]\n`;
    }

    return {
      output: summary + result,
      metadata: {
        filePath: resolved,
        totalLines,
        linesReturned: truncated.length,
        encoding: 'utf-8',
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        output: `Error: File not found: ${resolved}`,
        isError: true,
        metadata: { filePath: resolved, errorCode: 'ENOENT' },
      };
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      return {
        output: `Error: Permission denied: ${resolved}`,
        isError: true,
        metadata: { filePath: resolved, errorCode: 'EACCES' },
      };
    }
    if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
      return {
        output: `Error: Path is a directory, not a file: ${resolved}`,
        isError: true,
        metadata: { filePath: resolved, errorCode: 'EISDIR' },
      };
    }
    return {
      output: `Error reading file ${resolved}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * file-write: Write content to a file
 * Creates parent directories if they don't exist
 */
export async function executeFileWrite(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  const content = args.content as string;

  if (!filePath) {
    return { output: 'Error: "path" argument is required for file-write.', isError: true };
  }
  if (content === undefined || content === null) {
    return { output: 'Error: "content" argument is required for file-write.', isError: true };
  }

  const resolved = resolvePath(filePath, context);

  try {
    // Create parent directories if they don't exist
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(resolved, content, 'utf-8');

    const stats = await fs.stat(resolved);
    return {
      output: `File written successfully: ${resolved} (${stats.size} bytes)`,
      metadata: {
        filePath: resolved,
        size: stats.size,
        encoding: 'utf-8',
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      return {
        output: `Error: Permission denied writing to: ${resolved}`,
        isError: true,
      };
    }
    return {
      output: `Error writing file ${resolved}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * file-edit: Find and replace text in a file
 */
export async function executeFileEdit(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const filePath = args.path as string;
  const oldText = args.oldText as string;
  const newText = args.newText as string;
  const replaceAll = args.replaceAll as boolean | undefined;

  if (!filePath) {
    return { output: 'Error: "path" argument is required for file-edit.', isError: true };
  }
  if (!oldText) {
    return { output: 'Error: "oldText" argument is required for file-edit.', isError: true };
  }
  if (newText === undefined || newText === null) {
    return { output: 'Error: "newText" argument is required for file-edit.', isError: true };
  }
  if (oldText === newText) {
    return { output: 'Error: oldText and newText are identical. No changes made.', isError: true };
  }

  const resolved = resolvePath(filePath, context);

  try {
    // Read existing content
    const content = await fs.readFile(resolved, 'utf-8');

    // Check if oldText exists in the file
    if (!content.includes(oldText)) {
      // Provide a helpful error message
      const preview = content.substring(0, 500);
      const oldTextPreview = oldText.substring(0, 200);
      return {
        output: `Error: oldText not found in ${resolved}\n\nOld text preview:\n${oldTextPreview}${oldText.length > 200 ? '...' : ''}\n\nFile preview (first 500 chars):\n${preview}${content.length > 500 ? '...' : ''}`,
        isError: true,
        metadata: { filePath: resolved, errorCode: 'TEXT_NOT_FOUND' },
      };
    }

    let newContent: string;
    let changes = 0;

    if (replaceAll) {
      // Count occurrences first
      const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = content.match(new RegExp(escaped, 'g'));
      changes = matches ? matches.length : 0;
      newContent = content.split(oldText).join(newText);
    } else {
      // Replace first occurrence only
      const index = content.indexOf(oldText);
      if (index !== -1) {
        newContent = content.substring(0, index) + newText + content.substring(index + oldText.length);
        changes = 1;
      } else {
        // This shouldn't happen since we checked includes() above
        return {
          output: `Error: oldText not found in ${resolved}`,
          isError: true,
        };
      }
    }

    // Write modified content back
    await fs.writeFile(resolved, newContent, 'utf-8');

    const stats = await fs.stat(resolved);
    return {
      output: `File edited successfully: ${resolved} (${changes} replacement(s))`,
      metadata: {
        filePath: resolved,
        size: stats.size,
        changes,
        replaceAll: !!replaceAll,
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        output: `Error: File not found: ${resolved}`,
        isError: true,
      };
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      return {
        output: `Error: Permission denied: ${resolved}`,
        isError: true,
      };
    }
    return {
      output: `Error editing file ${resolved}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

import fs from 'fs/promises';
import path from 'path';
import type { ToolExecutionResult, ToolExecutionContext } from '../types';

const MAX_GLOB_RESULTS = 200;
const MAX_GREP_RESULTS = 50;

/** Check if a path is a descendant of the search root */
function isWithinRoot(filePath: string, root: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedRoot = path.resolve(root);
  return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
}

/**
 * Basic glob pattern to regex converter
 * Supports: *, **, ?, [chars], [!chars]
 */
function globToRegex(pattern: string): RegExp {
  // Escape everything except glob metacharacters
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any path segment(s)
        if (pattern[i + 2] === '/') {
          regex += '(?:.+/)?'; // **/ — zero or more directory segments
          i += 3;
        } else {
          regex += '.*'; // ** at end
          i += 2;
        }
      } else {
        regex += '[^/]*'; // * — any non-slash characters
        i++;
      }
    } else if (ch === '?') {
      regex += '[^/]'; // ? — single non-slash character
      i++;
    } else if (ch === '[') {
      // Character class
      const closeIdx = pattern.indexOf(']', i);
      if (closeIdx === -1) {
        regex += '\\[';
        i++;
      } else {
        const charClass = pattern.substring(i + 1, closeIdx);
        regex += '[' + charClass.replace(/\//g, '\\/') + ']';
        i = closeIdx + 1;
      }
    } else {
      // Escape regex special characters
      regex += ch.replace(/[.+^${}()|\\]/g, '\\$&');
      i++;
    }
  }
  return new RegExp('^' + regex + '$');
}

/**
 * Recursively walk a directory and collect file paths
 */
async function walkDir(
  dir: string,
  root: string,
  results: string[],
  maxResults: number,
): Promise<void> {
  if (results.length >= maxResults) return;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) break;

      // Skip common ignored directories
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === '.cache') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        await walkDir(fullPath, root, results, maxResults);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  } catch {
    // Permission denied or other error — skip this directory
  }
}

/**
 * glob: Find files matching a pattern
 */
export async function executeGlob(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const pattern = args.pattern as string;
  if (!pattern) {
    return { output: 'Error: "pattern" argument is required for glob.', isError: true };
  }

  const searchPath = (args.path as string) || context.workingDirectory || process.cwd();
  const resolvedPath = path.resolve(searchPath);

  try {
    // Check if pattern contains path separators — if so, extract base dir from pattern
    let baseDir = resolvedPath;
    let filePattern = pattern;

    const lastSlash = pattern.lastIndexOf('/');
    if (lastSlash !== -1) {
      const patternDir = pattern.substring(0, lastSlash);
      filePattern = pattern.substring(lastSlash + 1);
      baseDir = path.resolve(resolvedPath, patternDir);
    }

    // Verify base directory exists
    try {
      const stat = await fs.stat(baseDir);
      if (!stat.isDirectory()) {
        return { output: `Error: ${baseDir} is not a directory.`, isError: true };
      }
    } catch {
      return { output: `Error: Directory not found: ${baseDir}`, isError: true };
    }

    // Walk the directory
    const allFiles: string[] = [];
    await walkDir(baseDir, baseDir, allFiles, MAX_GLOB_RESULTS * 2);

    // Convert glob pattern to regex and filter
    const regex = globToRegex(filePattern);
    const matched = allFiles.filter((f) => regex.test(f)).slice(0, MAX_GLOB_RESULTS);

    // Sort alphabetically
    matched.sort();

    const output = matched.length > 0
      ? matched.join('\n')
      : `No files found matching pattern: ${pattern}`;

    return {
      output,
      metadata: {
        pattern,
        searchPath: baseDir,
        totalFilesScanned: allFiles.length,
        matchedCount: matched.length,
        truncated: allFiles.filter((f) => regex.test(f)).length > MAX_GLOB_RESULTS,
      },
    };
  } catch (error) {
    return {
      output: `Error in glob search: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * Convert a simple include glob (e.g. "*.ts") to a regex
 */
function includeToRegex(include: string): RegExp | null {
  if (!include || include === '*') return null;
  try {
    const regex = globToRegex(include);
    return regex;
  } catch {
    return null;
  }
}

/**
 * grep: Search file contents
 */
export async function executeGrep(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const pattern = args.pattern as string;
  if (!pattern) {
    return { output: 'Error: "pattern" argument is required for grep.', isError: true };
  }

  const searchPath = (args.path as string) || context.workingDirectory || process.cwd();
  const include = args.include as string | undefined;
  const maxResults = typeof args.maxResults === 'number' ? args.maxResults : MAX_GREP_RESULTS;
  const caseInsensitive = !!args.caseInsensitive;

  const resolvedPath = path.resolve(searchPath);

  try {
    // Build regex from pattern
    let searchRegex: RegExp;
    try {
      searchRegex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g');
    } catch {
      // Treat as literal string
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escaped, caseInsensitive ? 'gi' : 'g');
    }

    // Build include filter
    const includeRegex = include ? includeToRegex(include) : null;

    // Collect all files
    const allFiles: string[] = [];
    await walkDir(resolvedPath, resolvedPath, allFiles, 5000);

    // Filter by include pattern
    const filteredFiles = includeRegex
      ? allFiles.filter((f) => includeRegex.test(f))
      : allFiles;

    const matches: Array<{ file: string; line: number; text: string }> = [];

    // Search each file
    for (const file of filteredFiles) {
      if (matches.length >= maxResults) break;

      const filePath = path.join(resolvedPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Skip binary-like files (check for null bytes in first 8KB)
        if (content.substring(0, 8192).includes('\0')) continue;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;

          searchRegex.lastIndex = 0;
          if (searchRegex.test(lines[i])) {
            // Truncate long lines
            let lineText = lines[i];
            if (lineText.length > 500) {
              lineText = lineText.substring(0, 500) + '... (truncated)';
            }
            matches.push({
              file,
              line: i + 1,
              text: lineText,
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Format results
    if (matches.length === 0) {
      return {
        output: `No matches found for pattern: ${pattern}`,
        metadata: { pattern, filesScanned: filteredFiles.length, caseInsensitive },
      };
    }

    // Group by file
    const byFile = new Map<string, typeof matches>();
    for (const m of matches) {
      if (!byFile.has(m.file)) byFile.set(m.file, []);
      byFile.get(m.file)!.push(m);
    }

    const outputParts: string[] = [];
    for (const [file, fileMatches] of byFile) {
      outputParts.push(`\n${file}:`);
      for (const m of fileMatches) {
        outputParts.push(`  ${m.line}: ${m.text}`);
      }
    }

    const output = outputParts.join('\n');

    return {
      output: `Found ${matches.length} match(es) across ${byFile.size} file(s):${output}`,
      metadata: {
        pattern,
        filesScanned: filteredFiles.length,
        matchCount: matches.length,
        fileCount: byFile.size,
        caseInsensitive,
        truncated: matches.length >= maxResults,
      },
    };
  } catch (error) {
    return {
      output: `Error in grep search: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

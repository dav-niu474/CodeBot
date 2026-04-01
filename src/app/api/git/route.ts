import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';

const PROJECT_ROOT = process.cwd();

/**
 * Run a git command using execFileSync to avoid shell interpolation issues.
 * `args` should be the full argument array AFTER 'git'.
 */
function runGit(args: string[]): string {
  try {
    const output = execFileSync('git', args, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim();
  } catch (error: unknown) {
    const cmdStr = `git ${args.join(' ')}`;
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed: ${cmdStr}\n${msg}`);
  }
}

/** Convenience: run git with a simple space-separated arg string (no shell interpolation) */
function runGitStr(argsStr: string): string {
  return runGit(argsStr.split(/\s+/));
}

// ── GET /api/git?type=status|log|branches|diff|stats ──────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'status';

    switch (type) {
      case 'status':
        return NextResponse.json(parseGitStatus());
      case 'log':
        return NextResponse.json(parseGitLog(searchParams.get('count') || '20'));
      case 'branches':
        return NextResponse.json(parseBranches());
      case 'diff':
        return NextResponse.json(parseDiff());
      case 'stats':
        return NextResponse.json(parseStats());
      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Parsers ────────────────────────────────────────────────────────────

function parseGitStatus() {
  const raw = runGitStr('status --porcelain=v1');
  const lines = raw.split('\n').filter(Boolean);

  const files: Array<{ path: string; status: string; staged: boolean }> = [];

  for (const line of lines) {
    const index = line.charAt(0);
    const worktree = line.charAt(1);
    const path = line.slice(3);

    // staged changes
    if (index !== ' ' && index !== '?') {
      files.push({ path, status: index, staged: true });
    }
    // unstaged modifications (not already captured)
    if (worktree !== ' ' && worktree !== '?') {
      if (index !== ' ' && index !== '?') {
        // both staged and unstaged — add unstaged as separate entry
        files.push({ path, status: worktree, staged: false });
      } else {
        files.push({ path, status: worktree, staged: false });
      }
    }
    // untracked
    if (index === '?' && worktree === '?') {
      files.push({ path, status: 'U', staged: false });
    }
  }

  // Get current branch
  let branch: string;
  try {
    branch = runGitStr('rev-parse --abbrev-ref HEAD');
  } catch {
    branch = 'HEAD';
  }

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged && f.status !== 'U');
  const untracked = files.filter((f) => f.status === 'U');

  return {
    branch,
    clean: lines.length === 0,
    stagedCount: staged.length,
    unstagedCount: unstaged.length,
    untrackedCount: untracked.length,
    totalFiles: files.length,
    files,
  };
}

function parseGitLog(count: string) {
  const raw = runGit([
    'log', `-${count}`, '--pretty=format:%H|%h|%an|%ae|%at|%s',
  ]);
  const lines = raw.split('\n').filter(Boolean);

  const commits = lines.map((line) => {
    const [hash, shortHash, author, email, timestamp, message] = line.split('|');
    return {
      hash,
      shortHash,
      author,
      email,
      date: new Date(parseInt(timestamp, 10) * 1000).toISOString(),
      message,
    };
  });

  return { commits, count: commits.length };
}

function parseBranches() {
  const raw = runGitStr('branch -a --no-color');
  const lines = raw.split('\n').filter(Boolean);

  let current = '';
  try {
    current = runGitStr('rev-parse --abbrev-ref HEAD');
  } catch {
    // fallback
  }

  const branches = lines.map((line) => {
    const isCurrent = line.startsWith('* ');
    const name = isCurrent ? line.slice(2).trim() : line.trim();
    const isRemote = name.startsWith('remotes/');
    const cleanName = isRemote ? name.replace('remotes/', '') : name;

    return {
      name: cleanName,
      isCurrent,
      isRemote,
    };
  });

  return {
    current,
    branches,
    localCount: branches.filter((b) => !b.isRemote).length,
    remoteCount: branches.filter((b) => b.isRemote).length,
  };
}

function parseDiff() {
  let diffSummary = '';
  let diffContent = '';

  // Staged diff
  try {
    const staged = runGitStr('diff --cached --stat');
    if (staged) {
      diffSummary += staged + '\n';
    }
  } catch {
    // no staged changes
  }

  // Unstaged diff
  try {
    const unstaged = runGitStr('diff --stat');
    if (unstaged) {
      diffSummary += unstaged + '\n';
    }
  } catch {
    // no unstaged changes
  }

  // Full diff (staged + unstaged, limited to first 500 lines)
  try {
    const fullDiff = runGitStr('diff HEAD --color=never');
    diffContent = fullDiff.split('\n').slice(0, 500).join('\n');
  } catch {
    diffContent = '';
  }

  return {
    summary: diffSummary.trim(),
    content: diffContent,
    hasStagedChanges: diffSummary.includes('files changed'),
    lines: diffContent.split('\n').length,
  };
}

function parseStats() {
  // Total commits
  let totalCommits = 0;
  try {
    totalCommits = parseInt(runGitStr('rev-list --count HEAD'), 10);
  } catch {
    totalCommits = 0;
  }

  // Current branch
  let branch = 'unknown';
  try {
    branch = runGitStr('rev-parse --abbrev-ref HEAD');
  } catch {
    // ignore
  }

  // Contributors
  let contributors: Array<{ name: string; count: number }> = [];
  try {
    const raw = runGitStr('shortlog -sne HEAD');
    contributors = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (!match) return { name: 'unknown', count: 0 };
        return { name: match[2].trim(), count: parseInt(match[1], 10) };
      });
  } catch {
    // ignore
  }

  // Recent activity — commits in last 7 days
  let recentCommits = 0;
  try {
    recentCommits = parseInt(
      runGit(['rev-list', '--count', '--since=7 days ago', 'HEAD']),
      10
    );
  } catch {
    recentCommits = 0;
  }

  // Modified files count
  let modifiedFiles = 0;
  try {
    const status = runGitStr('status --porcelain=v1');
    modifiedFiles = status.split('\n').filter(Boolean).length;
  } catch {
    modifiedFiles = 0;
  }

  // Branch count
  let branchCount = 0;
  try {
    branchCount = runGitStr('branch --no-color')
      .split('\n')
      .filter(Boolean).length;
  } catch {
    branchCount = 0;
  }

  // Latest tag
  let latestTag = '';
  try {
    latestTag = runGit(['describe', '--tags', '--abbrev=0']) || '';
  } catch {
    latestTag = '';
  }

  return {
    totalCommits,
    branch,
    contributors,
    contributorCount: contributors.length,
    recentCommits,
    modifiedFiles,
    branchCount,
    latestTag,
  };
}

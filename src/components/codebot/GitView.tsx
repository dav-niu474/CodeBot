'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  FileCode,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Circle,
  Plus,
  Minus,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// ── Animation Variants ──────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Inline Types ────────────────────────────────

interface GitCommitData {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface GitBranchData {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

interface GitStatusData {
  branch: string;
  clean: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  totalFiles: number;
  files: GitFileStatus[];
}

interface GitDiffData {
  summary: string;
  content: string;
  hasStagedChanges: boolean;
  lines: number;
}

interface GitStatsData {
  totalCommits: number;
  branch: string;
  contributors: Array<{ name: string; count: number }>;
  contributorCount: number;
  recentCommits: number;
  modifiedFiles: number;
  branchCount: number;
  latestTag: string;
}

// ── Status Badge Config ─────────────────────────

const statusBadgeStyles: Record<string, { color: string; bg: string; label: string }> = {
  M: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'M' },
  A: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'A' },
  D: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'D' },
  R: { color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'R' },
  C: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'C' },
  U: { color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'U' },
  '?': { color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'U' },
};

function getStatusStyle(status: string) {
  return statusBadgeStyles[status] || statusBadgeStyles['M'];
}

// ── Tabs ────────────────────────────────────────

type GitTab = 'commits' | 'branches' | 'changes' | 'diff';

const tabs: { id: GitTab; label: string; icon: React.ReactNode }[] = [
  { id: 'commits', label: 'Commits', icon: <GitCommit className="h-3.5 w-3.5" /> },
  { id: 'branches', label: 'Branches', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: 'changes', label: 'Changes', icon: <FileCode className="h-3.5 w-3.5" /> },
  { id: 'diff', label: 'Diff', icon: <FileText className="h-3.5 w-3.5" /> },
];

// ── Author Initial Helper ───────────────────────

function getAuthorInitial(name: string): string {
  return name
    .split(/[\s._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

const authorColors = [
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-sky-500/20 text-sky-300',
  'bg-purple-500/20 text-purple-300',
  'bg-rose-500/20 text-rose-300',
  'bg-teal-500/20 text-teal-300',
];

function getAuthorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return authorColors[Math.abs(hash) % authorColors.length];
}

// ── Diff Line Rendering ─────────────────────────

function DiffLine({ line, index }: { line: string; index: number }) {
  const isAddition = line.startsWith('+');
  const isDeletion = line.startsWith('-');
  const isHeader = line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++');

  if (isHeader) {
    return (
      <div className="flex font-mono text-[11px] leading-5">
        <span className="inline-block w-10 shrink-0 select-none text-right pr-3 text-muted-foreground/30">
          {index}
        </span>
        <span className="inline-block w-4 shrink-0 text-center text-muted-foreground/40">
          {'~'}
        </span>
        <span className="flex-1 text-sky-400/70 whitespace-pre-wrap break-all">{line}</span>
      </div>
    );
  }

  if (isAddition) {
    return (
      <div className="flex font-mono text-[11px] leading-5 bg-emerald-500/8">
        <span className="inline-block w-10 shrink-0 select-none text-right pr-3 text-muted-foreground/30">
          {index}
        </span>
        <span className="inline-block w-4 shrink-0 text-center text-emerald-500">+</span>
        <span className="flex-1 text-emerald-300/90 whitespace-pre-wrap break-all">{line.slice(1)}</span>
      </div>
    );
  }

  if (isDeletion) {
    return (
      <div className="flex font-mono text-[11px] leading-5 bg-red-500/8">
        <span className="inline-block w-10 shrink-0 select-none text-right pr-3 text-muted-foreground/30">
          {index}
        </span>
        <span className="inline-block w-4 shrink-0 text-center text-red-500">-</span>
        <span className="flex-1 text-red-300/90 whitespace-pre-wrap break-all">{line.slice(1)}</span>
      </div>
    );
  }

  return (
    <div className="flex font-mono text-[11px] leading-5">
      <span className="inline-block w-10 shrink-0 select-none text-right pr-3 text-muted-foreground/30">
        {index}
      </span>
      <span className="inline-block w-4 shrink-0 text-center text-muted-foreground/20">
        {' '}
      </span>
      <span className="flex-1 text-muted-foreground/80 whitespace-pre-wrap break-all">{line}</span>
    </div>
  );
}

// ── Component ───────────────────────────────────

export function GitView() {
  const [activeTab, setActiveTab] = useState<GitTab>('commits');
  const [stats, setStats] = useState<GitStatsData | null>(null);
  const [status, setStatus] = useState<GitStatusData | null>(null);
  const [commits, setCommits] = useState<GitCommitData[]>([]);
  const [branches, setBranches] = useState<GitBranchData[]>([]);
  const [diff, setDiff] = useState<GitDiffData | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, statusRes, logRes, branchesRes, diffRes] = await Promise.all([
        fetch('/api/git?type=stats'),
        fetch('/api/git?type=status'),
        fetch('/api/git?type=log&count=20'),
        fetch('/api/git?type=branches'),
        fetch('/api/git?type=diff'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      if (!statusRes.ok) throw new Error('Failed to fetch status');
      if (!logRes.ok) throw new Error('Failed to fetch log');
      if (!branchesRes.ok) throw new Error('Failed to fetch branches');
      if (!diffRes.ok) throw new Error('Failed to fetch diff');

      const statsData: GitStatsData = await statsRes.json();
      const statusData: GitStatusData = await statusRes.json();
      const logData: { commits: GitCommitData[] } = await logRes.json();
      const branchesData: { branches: GitBranchData[] } = await branchesRes.json();
      const diffData: GitDiffData = await diffRes.json();

      setStats(statsData);
      setStatus(statusData);
      setCommits(logData.commits);
      setBranches(branchesData.branches);
      setDiff(diffData);
      setCurrentBranch(statsData.branch || statusData.branch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load git data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex h-full items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="text-sm text-muted-foreground">Loading git data...</span>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex h-full items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Git Error</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <GitBranch className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Git Management
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    Repository status & history
                  </p>
                  {stats?.latestTag && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] h-4 px-1.5"
                    >
                      {stats.latestTag}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              >
                <GitBranch className="mr-1 h-3 w-3" />
                {currentBranch}
              </Badge>
              <button
                onClick={fetchData}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ──────────────────────────── */}
        <motion.div variants={item} className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <GitCommit className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-lg font-bold text-foreground">
                    {stats?.totalCommits ?? 0}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Total Commits
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <GitBranch className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-lg font-bold text-foreground">
                    {stats?.branchCount ?? 0}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Branches
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <FileCode className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-lg font-bold text-foreground">
                    {status?.totalFiles ?? 0}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Modified Files
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <User className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-lg font-bold text-foreground">
                    {stats?.contributorCount ?? 0}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Contributors
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* ── Working Tree Status ────────────────── */}
        {status && !status.clean && (
          <motion.div variants={item} className="mb-6">
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
                status.stagedCount > 0
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-border/50 bg-card/50'
              }`}
            >
              <AlertCircle className={`h-4 w-4 ${status.stagedCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">
                {status.stagedCount > 0
                  ? `${status.stagedCount} staged, ${status.unstagedCount} modified, ${status.untrackedCount} untracked`
                  : `${status.unstagedCount} modified, ${status.untrackedCount} untracked`}
              </span>
              {status.stagedCount === 0 && status.untrackedCount === 0 && (
                <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />
              )}
            </div>
          </motion.div>
        )}

        {/* ── Tabs ────────────────────────────────── */}
        <motion.div variants={item} className="mb-4">
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border/50 bg-card/50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'changes' && status && status.totalFiles > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 min-w-4 px-1 text-[9px] font-semibold text-amber-400"
                  >
                    {status.totalFiles}
                  </Badge>
                )}
                {tab.id === 'commits' && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 min-w-4 px-1 text-[9px] text-muted-foreground"
                  >
                    {commits.length}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Tab Content ─────────────────────────── */}
        <motion.div variants={item}>
          {/* ──── Commits Tab ──── */}
          {activeTab === 'commits' && (
            <Card className="border-border/50 bg-card/50">
              <div className="max-h-[28rem] overflow-y-auto">
                <div className="divide-y divide-border/30">
                  {commits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <GitCommit className="mb-2 h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs">No commits found</p>
                    </div>
                  ) : (
                    commits.map((commit, i) => (
                      <motion.div
                        key={commit.hash}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        {/* Author Avatar */}
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAuthorColor(commit.author)}`}
                        >
                          {getAuthorInitial(commit.author)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Short hash */}
                            <span className="font-mono text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {commit.shortHash}
                            </span>
                            {/* Commit message (truncated to 1 line) */}
                            <span className="text-xs text-foreground truncate max-w-md">
                              {commit.message}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {commit.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(commit.date), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Copy hash on hover */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(commit.hash);
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground/0 transition-all hover:bg-muted hover:text-muted-foreground group-hover:text-muted-foreground/30"
                          title="Copy full hash"
                        >
                          <span className="font-mono text-[9px]">
                            {commit.hash.slice(0, 12)}
                          </span>
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ──── Branches Tab ──── */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {/* Local branches */}
              <Card className="border-border/50 bg-card/50">
                <div className="border-b border-border/30 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-foreground">
                      Local Branches
                    </span>
                    <Badge variant="secondary" className="text-[9px] text-muted-foreground h-4 px-1.5">
                      {localBranches.length}
                    </Badge>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-border/30">
                  {localBranches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <GitBranch className="mb-2 h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs">No local branches</p>
                    </div>
                  ) : (
                    localBranches.map((branch, i) => (
                      <motion.div
                        key={branch.name}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30 ${
                          branch.isCurrent ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {/* Dot indicator */}
                        <div className="flex items-center">
                          {branch.isCurrent ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                              <div className="h-0.5 w-4 rounded-full bg-emerald-500/40" />
                            </div>
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-secondary" />
                          )}
                        </div>
                        {/* Branch name */}
                        <span
                          className={`text-xs font-medium ${
                            branch.isCurrent ? 'text-emerald-400' : 'text-foreground'
                          }`}
                        >
                          {branch.name}
                        </span>
                        {branch.isCurrent && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] h-4 px-1.5"
                          >
                            current
                          </Badge>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>

              {/* Remote branches */}
              {remoteBranches.length > 0 && (
                <Card className="border-border/50 bg-card/50">
                  <div className="border-b border-border/30 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Remote Branches
                      </span>
                      <Badge variant="secondary" className="text-[9px] text-muted-foreground h-4 px-1.5">
                        {remoteBranches.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
                    {remoteBranches.map((branch, i) => (
                      <motion.div
                        key={branch.name}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {branch.name}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ──── Changes Tab ──── */}
          {activeTab === 'changes' && (
            <Card className="border-border/50 bg-card/50">
              {status && status.totalFiles === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="mb-2 h-8 w-8 text-emerald-500/30" />
                  <p className="text-xs font-medium text-foreground">Clean working tree</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    No changes detected
                  </p>
                </div>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto">
                  <div className="divide-y divide-border/30">
                    {status?.files.map((file, i) => {
                      const style = getStatusStyle(file.status);
                      return (
                        <motion.div
                          key={`${file.path}-${file.staged}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15, delay: i * 0.02 }}
                          className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                        >
                          {/* Status badge */}
                          <Badge
                            variant="outline"
                            className={`h-5 w-5 items-center justify-center rounded p-0 text-[10px] font-bold ${style.bg} ${style.color}`}
                          >
                            {style.label}
                          </Badge>
                          {/* File path */}
                          <span className="flex-1 truncate font-mono text-xs text-foreground">
                            {file.path}
                          </span>
                          {/* Staged indicator */}
                          {file.staged && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] h-4 px-1.5"
                            >
                              staged
                            </Badge>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ──── Diff Tab ──── */}
          {activeTab === 'diff' && (
            <Card className="border-border/50 bg-card/50">
              {diff && !diff.content ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="mb-2 h-8 w-8 text-emerald-500/30" />
                  <p className="text-xs font-medium text-foreground">No diff available</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Working tree is clean
                  </p>
                </div>
              ) : (
                <div className="max-h-[32rem] overflow-y-auto">
                  {/* Diff summary */}
                  {diff?.summary && (
                    <div className="border-b border-border/30 px-4 py-2.5">
                      <p className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
                        {diff.summary}
                      </p>
                    </div>
                  )}
                  {/* Diff content with line numbers */}
                  <div className="px-3 py-2">
                    {diff?.content.split('\n').map((line, i) => (
                      <DiffLine key={i} line={line} index={i + 1} />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </motion.div>

        {/* ── Contributors (bottom section) ──────── */}
        {activeTab === 'commits' && stats && stats.contributors.length > 0 && (
          <motion.div variants={item} className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Contributors</h2>
              <Badge variant="outline" className="text-[9px] text-muted-foreground h-4 px-1.5">
                {stats.contributors.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {stats.contributors.map((contributor, i) => {
                const maxCommits = stats.contributors[0].count;
                const pct = maxCommits > 0 ? (contributor.count / maxCommits) * 100 : 0;
                return (
                  <motion.div
                    key={contributor.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                  >
                    <Card className="border-border/50 bg-card/50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${getAuthorColor(contributor.name)}`}
                          >
                            {getAuthorInitial(contributor.name)}
                          </div>
                          <span className="truncate text-[11px] font-medium text-foreground">
                            {contributor.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Commits</span>
                          <span className="text-[10px] font-medium text-foreground">
                            {contributor.count}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </motion.div>
  );
}

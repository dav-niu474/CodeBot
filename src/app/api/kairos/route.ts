import { NextRequest, NextResponse } from 'next/server';

// ────────────────────────────────────────────
// In-memory KAIROS state (simulated)
// ────────────────────────────────────────────

interface MonitoredSource {
  id: string;
  type: 'git' | 'files' | 'scheduled';
  name: string;
  description: string;
  enabled: boolean;
  lastChecked: string | null;
}

interface ProactiveAction {
  id: string;
  type: 'git-detect' | 'file-analyze' | 'health-check' | 'cron-complete' | 'security-scan' | 'dependency-check';
  description: string;
  timestamp: string;
  details: string;
}

interface KairosState {
  isActive: boolean;
  activatedAt: string | null;
  sources: MonitoredSource[];
  recentActions: ProactiveAction[];
  stats: {
    totalChecks: number;
    actionsTaken: number;
    issuesFound: number;
  };
  checkIntervalSeconds: number;
  nextCheckAt: string | null;
}

const DEFAULT_SOURCES: MonitoredSource[] = [
  {
    id: 'src-git-repo',
    type: 'git',
    name: 'src-git-repo',
    description: 'Git Repository — monitor commits and branches',
    enabled: true,
    lastChecked: null,
  },
  {
    id: 'src-file-system',
    type: 'files',
    name: 'src-file-system',
    description: 'File System — monitor critical file modifications',
    enabled: true,
    lastChecked: null,
  },
  {
    id: 'src-scheduled-tasks',
    type: 'scheduled',
    name: 'src-scheduled-tasks',
    description: 'Scheduled Tasks — execute periodic health checks',
    enabled: true,
    lastChecked: null,
  },
];

// Generate simulated proactive actions
function generateSimulatedActions(count: number): ProactiveAction[] {
  const templates: { type: ProactiveAction['type']; descGen: () => { description: string; details: string } }[] = [
    {
      type: 'git-detect',
      descGen: () => ({
        description: 'Detected new commits on main branch',
        details: '3 new commits pushed: feat(api): add streaming support, fix(parser): handle edge cases, chore(deps): update dependencies',
      }),
    },
    {
      type: 'file-analyze',
      descGen: () => ({
        description: 'Auto-analyzed package.json changes',
        details: '2 new dependencies detected: zod@3.22.4, @prisma/client@5.7.1. No breaking changes identified.',
      }),
    },
    {
      type: 'health-check',
      descGen: () => ({
        description: 'Scheduled health check completed',
        details: 'All systems operational. API response time: 142ms. Database connections: 5/20. Memory usage: 67%',
      }),
    },
    {
      type: 'cron-complete',
      descGen: () => ({
        description: 'Scheduled task executed successfully',
        details: 'Token analytics aggregation completed. Processed 1,247 records in 2.3s.',
      }),
    },
    {
      type: 'security-scan',
      descGen: () => ({
        description: 'Security scan completed',
        details: 'Scanned 142 files. 0 critical, 0 high, 2 medium (informational). No action required.',
      }),
    },
    {
      type: 'dependency-check',
      descGen: () => ({
        description: 'Dependency update check completed',
        details: '5 packages have updates available: next@15.1.0, prisma@5.8.0, lucide-react@0.303.0, zod@3.23.0, date-fns@3.2.0',
      }),
    },
  ];

  const now = Date.now();
  const actions: ProactiveAction[] = [];
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const { description, details } = template.descGen();
    actions.push({
      id: `action-${count - i}-${Date.now()}`,
      type: template.type,
      description,
      timestamp: new Date(now - (i * 5 + Math.random() * 4) * 60000).toISOString(),
      details,
    });
  }
  return actions;
}

// Persist state in memory (resets on server restart)
let kairosState: KairosState = {
  isActive: false,
  activatedAt: null,
  sources: [...DEFAULT_SOURCES],
  recentActions: generateSimulatedActions(6),
  stats: {
    totalChecks: 2847,
    actionsTaken: 156,
    issuesFound: 23,
  },
  checkIntervalSeconds: 300,
  nextCheckAt: null,
};

let simulationTimer: ReturnType<typeof setInterval> | null = null;

function startSimulation() {
  if (simulationTimer) return;
  simulationTimer = setInterval(() => {
    if (!kairosState.isActive) {
      if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
      }
      return;
    }

    // Add a new simulated action
    const newActions = generateSimulatedActions(1);
    kairosState.recentActions = [newActions[0], ...kairosState.recentActions].slice(0, 20);
    kairosState.stats.totalChecks += 1;
    kairosState.stats.actionsTaken += Math.random() > 0.6 ? 1 : 0;
    kairosState.stats.issuesFound += Math.random() > 0.9 ? 1 : 0;
    kairosState.nextCheckAt = new Date(Date.now() + kairosState.checkIntervalSeconds * 1000).toISOString();

    // Update source lastChecked
    const sources = [...kairosState.sources];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    if (randomSource) {
      randomSource.lastChecked = new Date().toISOString();
      kairosState.sources = sources;
    }
  }, 10000); // Every 10 seconds
}

function stopSimulation() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

// ────────────────────────────────────────────
// GET handler — return KAIROS status
// ────────────────────────────────────────────
export async function GET() {
  const uptimeMs = kairosState.activatedAt
    ? Date.now() - new Date(kairosState.activatedAt).getTime()
    : 0;

  const uptimeStr = uptimeMs > 0
    ? `${Math.floor(uptimeMs / 86400000)}d ${Math.floor((uptimeMs % 86400000) / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`
    : '0m';

  return NextResponse.json({
    isActive: kairosState.isActive,
    activatedAt: kairosState.activatedAt,
    uptime: uptimeStr,
    sources: kairosState.sources,
    recentActions: kairosState.recentActions,
    stats: kairosState.stats,
    checkInterval: kairosState.checkIntervalSeconds,
    nextCheckAt: kairosState.nextCheckAt,
  });
}

// ────────────────────────────────────────────
// POST handler — toggle KAIROS on/off & configure
// ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sourceId, checkInterval } = body;

    // Toggle KAIROS on/off
    if (action === 'toggle') {
      kairosState.isActive = !kairosState.isActive;

      if (kairosState.isActive) {
        kairosState.activatedAt = new Date().toISOString();
        kairosState.nextCheckAt = new Date(Date.now() + kairosState.checkIntervalSeconds * 1000).toISOString();
        startSimulation();
      } else {
        kairosState.nextCheckAt = null;
        stopSimulation();
      }

      return NextResponse.json({
        success: true,
        isActive: kairosState.isActive,
      });
    }

    // Add a new source
    if (action === 'add-source') {
      const { type, name, description } = body;
      const newSource: MonitoredSource = {
        id: `src-${Date.now()}`,
        type: type || 'files',
        name: name || `source-${Date.now()}`,
        description: description || 'Custom monitored source',
        enabled: true,
        lastChecked: null,
      };
      kairosState.sources = [...kairosState.sources, newSource];
      return NextResponse.json({ success: true, source: newSource });
    }

    // Remove a source
    if (action === 'remove-source' && sourceId) {
      kairosState.sources = kairosState.sources.filter((s) => s.id !== sourceId);
      return NextResponse.json({ success: true });
    }

    // Toggle a source
    if (action === 'toggle-source' && sourceId) {
      kairosState.sources = kairosState.sources.map((s) =>
        s.id === sourceId ? { ...s, enabled: !s.enabled } : s
      );
      return NextResponse.json({ success: true });
    }

    // Set check interval
    if (action === 'set-interval' && checkInterval) {
      kairosState.checkIntervalSeconds = Math.max(30, Math.min(3600, checkInterval));
      kairosState.nextCheckAt = kairosState.isActive
        ? new Date(Date.now() + kairosState.checkIntervalSeconds * 1000).toISOString()
        : null;
      return NextResponse.json({ success: true, checkInterval: kairosState.checkIntervalSeconds });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: toggle, add-source, remove-source, toggle-source, set-interval' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

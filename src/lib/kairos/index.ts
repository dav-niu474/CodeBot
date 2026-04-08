// ============================================================
// Kairos Autonomous Mode — Barrel Export
// ============================================================

export {
  startKairos,
  stopKairos,
  isKairosRunning,
  getKairosState,
  updateKairosConfig,
  getRecentActions,
} from './engine';

export type {
  KairosConfig,
  KairosAction,
  KairosState,
} from './engine';

export {
  runSessionCleanup,
  runTokenAnalysis,
  runAgentHealthCheck,
  runMemoryConsolidation,
  runSystemReport,
} from './tasks';

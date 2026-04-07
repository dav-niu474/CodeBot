import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolExecutionResult, ToolExecutionContext } from '../types';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAX_TIMEOUT = 120_000; // 2 minutes
const MAX_OUTPUT_LENGTH = 30_000; // chars

/** Risky command patterns that should trigger warnings */
const RISKY_PATTERNS: Array<{ pattern: RegExp; warning: string }> = [
  { pattern: /\brm\s+(-\w*r\w*f|\-\-force)\s+\/\b/, warning: 'WARNING: Detected "rm -rf /" — this will delete the entire filesystem!' },
  { pattern: /\bsudo\b/, warning: 'WARNING: sudo detected — this runs commands with elevated privileges.' },
  { pattern: /\bchmod\s+(-R\s+)?777\b/, warning: 'WARNING: chmod 777 detected — this sets overly permissive file permissions.' },
  { pattern: /\bdd\s+if=.*of=\/dev\//, warning: 'WARNING: Direct disk write detected — this may destroy data.' },
  { pattern: />\s*\/dev\/sd[a-z]/, warning: 'WARNING: Direct write to block device detected.' },
  { pattern: /\bmkfs\b/, warning: 'WARNING: Filesystem format command detected.' },
  { pattern: /\bshutdown\b/, warning: 'WARNING: System shutdown/reboot command detected.' },
  { pattern: /\breboot\b/, warning: 'WARNING: System reboot command detected.' },
  { pattern: /\bkill\s+(-9\s+)?1\b/, warning: 'WARNING: Attempting to kill init process (PID 1).' },
  { pattern: /\biptables\b/, warning: 'WARNING: Firewall configuration command detected.' },
];

/** Commands that are completely blocked */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\s*:\s*\(\)\s*\{.*\};\s*:/, reason: 'Fork bomb detected and blocked.' },
  { pattern: /\bnc\b.*-[elp]/, reason: 'Netcat reverse shell/backdoor pattern blocked.' },
];

/**
 * Truncate output if it exceeds the maximum length
 */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  const half = Math.floor(MAX_OUTPUT_LENGTH / 2) - 50;
  return (
    output.substring(0, half) +
    '\n\n... [OUTPUT TRUNCATED: ' +
    output.length +
    ' chars total, showing first and last ' +
    half +
    ' chars] ...\n\n' +
    output.substring(output.length - half)
  );
}

/**
 * bash: Execute shell commands
 * Uses child_process.exec with configurable timeout
 */
export async function executeBash(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const command = args.command as string;
  if (!command) {
    return { output: 'Error: "command" argument is required for bash.', isError: true };
  }

  const timeout = typeof args.timeout === 'number'
    ? Math.min(Math.max(args.timeout * 1000, 1000), MAX_TIMEOUT)
    : DEFAULT_TIMEOUT;

  const workingDir = (args.workingDirectory as string) || context.workingDirectory || process.cwd();

  // Security checks
  for (const blocked of BLOCKED_PATTERNS) {
    if (blocked.pattern.test(command)) {
      return {
        output: `BLOCKED: ${blocked.reason}`,
        isError: true,
        metadata: { blocked: true, reason: blocked.reason },
      };
    }
  }

  // Warnings for risky commands
  const warnings: string[] = [];
  for (const risky of RISKY_PATTERNS) {
    if (risky.pattern.test(command)) {
      warnings.push(risky.warning);
    }
  }

  try {
    // Send progress event if callback provided
    context.onProgress?.('bash_start', { command, workingDirectory: workingDir, timeout });

    // Build safe environment — only pass whitelisted variables, never leak secrets
    const ALLOWED_ENV_VARS = ['PATH', 'HOME', 'LANG', 'NODE_ENV', 'TMPDIR', 'TEMP', 'TMP'] as const;
    const safeEnv: Record<string, string | undefined> = {};
    for (const key of ALLOWED_ENV_VARS) {
      const val = process.env[key];
      if (val !== undefined) safeEnv[key] = val;
    }
    if (!safeEnv.LANG) safeEnv.LANG = 'en_US.UTF-8';

    const result = await execAsync(command, {
      cwd: workingDir,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: safeEnv,
      shell: '/bin/bash',
    });

    let output = '';
    if (warnings.length > 0) {
      output += warnings.join('\n') + '\n\n';
    }

    if (result.stdout) {
      output += truncateOutput(result.stdout.trimEnd());
    }

    if (result.stderr) {
      output += (output ? '\n\n' : '') + 'STDERR:\n' + truncateOutput(result.stderr.trimEnd());
    }

    context.onProgress?.('bash_complete', { exitCode: 0, outputLength: output.length });

    return {
      output: output || 'Command completed with no output.',
      metadata: {
        exitCode: 0,
        workingDirectory: workingDir,
        timeout,
        hasStderr: !!result.stderr,
      },
    };
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string; stderr?: string; killed?: boolean; code?: number };
    let output = '';

    if (warnings.length > 0) {
      output += warnings.join('\n') + '\n\n';
    }

    if (err.killed) {
      output += `Command timed out after ${timeout / 1000}s: ${command}`;
    } else {
      if (err.stdout) {
        output += truncateOutput(err.stdout.trimEnd());
      }
      if (err.stderr) {
        output += (output ? '\n\n' : '') + 'STDERR:\n' + truncateOutput(err.stderr.trimEnd());
      }
      if (!output) {
        output = err.message || `Command failed with code ${err.code}`;
      }
    }

    context.onProgress?.('bash_error', { exitCode: err.code, killed: err.killed });

    return {
      output,
      isError: true,
      metadata: {
        exitCode: err.code,
        killed: !!err.killed,
        timedOut: !!err.killed,
        workingDirectory: workingDir,
      },
    };
  }
}

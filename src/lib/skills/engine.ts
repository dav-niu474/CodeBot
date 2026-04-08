// ============================================================
// Skill Execution Engine
// Goes beyond prompt templates — full workflow with pre/post processing
// ============================================================

import type { SkillDef } from '@/lib/types';
import { db } from '@/lib/db';
import { chatCompletion, getDefaultModel } from '@/lib/nvidia';

// ────────────────────────────────────────────
// Prisma DB SkillDef (has Date fields + extra columns)
// ────────────────────────────────────────────

/** Shape returned by Prisma's db.skillDef.find* — differs from app-level SkillDef */
interface DbSkillDef {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  isEnabled: boolean;
  prompt: string | null;
  config: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/** Convert a Prisma SkillDef to the app-level SkillDef type */
function toAppSkillDef(db: DbSkillDef): SkillDef {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    icon: db.icon,
    category: db.category as SkillDef['category'],
    isEnabled: db.isEnabled,
    prompt: db.prompt,
    config: db.config,
    createdAt: db.createdAt.toISOString(),
    updatedAt: db.updatedAt.toISOString(),
  };
}

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

/** Context provided to execute a skill */
export interface SkillExecutionContext {
  sessionId: string;
  skillId: string;
  input: string;
  model?: string;
  /** Whether the skill can use tools (reserved for future) */
  tools?: boolean;
  /** Progress callback for multi-step skills */
  onProgress?: (step: string) => void;
}

/** Result returned from skill execution */
export interface SkillExecutionResult {
  output: string;
  steps: string[];
  tokensUsed: number;
  skillId: string;
}

/** Parsed skill configuration from the JSON `config` column */
interface SkillConfig {
  /** Pre-processing steps to run before sending to the model */
  preprocessSteps?: PreprocessStep[];
  /** Post-processing steps to run after receiving model output */
  postprocessSteps?: PostprocessStep[];
  /** Variables to inject into the prompt template */
  variables?: Record<string, string>;
  /** Temperature override for this skill */
  temperature?: number;
  /** Max tokens override for this skill */
  maxTokens?: number;
  /** Model override for this skill */
  modelOverride?: string;
}

type PreprocessStep = 'extract-code' | 'validate-format' | 'trim-whitespace' | 'normalize-newlines';
type PostprocessStep = 'format-markdown' | 'add-code-blocks' | 'trim-output' | 'extract-summary';

// ────────────────────────────────────────────
// Main: Execute a skill with full workflow
// ────────────────────────────────────────────

/**
 * Execute a skill with the full workflow:
 * 1. Load skill definition from DB
 * 2. Pre-process input
 * 3. Build system + user prompts
 * 4. Call LLM via chatCompletion
 * 5. Post-process output
 * 6. Return structured result
 */
export async function executeSkill(context: SkillExecutionContext): Promise<SkillExecutionResult> {
  const steps: string[] = [];
  const { sessionId, skillId, input, onProgress } = context;
  const model = context.model || getDefaultModel();

  // ── Step 1: Load skill from DB ────────────
  onProgress?.('Loading skill definition...');
  steps.push('load-skill');

  const dbSkill = await db.skillDef.findUnique({
    where: { id: skillId },
  });

  if (!dbSkill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const skill = toAppSkillDef(dbSkill as DbSkillDef);

  if (!skill.isEnabled) {
    throw new Error(`Skill "${skill.name}" is disabled`);
  }

  // ── Step 2: Pre-process input ─────────────
  onProgress?.('Pre-processing input...');
  steps.push('preprocess');

  const enrichedInput = await preprocessInput(skill, input);

  // ── Step 3: Build prompts ─────────────────
  onProgress?.('Building prompts...');
  steps.push('build-prompt');

  const { system, user } = buildSkillPrompt(skill, enrichedInput);

  // ── Step 4: Call LLM ─────────────────────
  onProgress?.('Generating response...');
  steps.push('llm-call');

  // Parse skill config for overrides
  const config = parseSkillConfig(skill.config);
  const effectiveModel = config.modelOverride || model;

  const response = await chatCompletion({
    model: effectiveModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4096,
  });

  const rawOutput = response.choices[0]?.message?.content ?? '';
  const tokensUsed = response.usage?.total_tokens ?? 0;

  // ── Step 5: Post-process output ───────────
  onProgress?.('Post-processing output...');
  steps.push('postprocess');

  const finalOutput = await postprocessOutput(skill, rawOutput);

  return {
    output: finalOutput,
    steps,
    tokensUsed,
    skillId,
  };
}

// ────────────────────────────────────────────
// Pre-process: enrich input with skill context
// ────────────────────────────────────────────

/**
 * Pre-process the user input based on the skill's configuration.
 * This enriches or validates the input before it reaches the model.
 */
async function preprocessInput(skill: SkillDef, input: string): Promise<string> {
  const config = parseSkillConfig(skill.config);
  let processed = input;

  if (!config.preprocessSteps || config.preprocessSteps.length === 0) {
    return processed;
  }

  for (const step of config.preprocessSteps) {
    switch (step) {
      case 'extract-code':
        // Extract code blocks from markdown input
        processed = processed.replace(
          /```[\w]*\n([\s\S]*?)```/g,
          (_, code) => code.trim()
        );
        break;

      case 'validate-format':
        // Ensure input is not empty after trimming
        if (!processed.trim()) {
          processed = `[No input provided — skill "${skill.name}" activated with default behavior]`;
        }
        break;

      case 'trim-whitespace':
        processed = processed.trim();
        break;

      case 'normalize-newlines':
        processed = processed.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
        break;
    }
  }

  // Inject config variables into the input as context
  if (config.variables && Object.keys(config.variables).length > 0) {
    const varBlock = Object.entries(config.variables)
      .map(([key, value]) => `[${key}]: ${value}`)
      .join('\n');
    processed = `${varBlock}\n\n${processed}`;
  }

  return processed;
}

// ────────────────────────────────────────────
// Post-process: format output according to skill
// ────────────────────────────────────────────

/**
 * Post-process the model's raw output based on the skill's configuration.
 * This formats or transforms the output before returning it.
 */
async function postprocessOutput(skill: SkillDef, rawOutput: string): Promise<string> {
  const config = parseSkillConfig(skill.config);
  let output = rawOutput;

  if (!config.postprocessSteps || config.postprocessSteps.length === 0) {
    return output;
  }

  for (const step of config.postprocessSteps) {
    switch (step) {
      case 'format-markdown':
        // Ensure the output has proper markdown structure
        if (!output.startsWith('#') && !output.startsWith('```') && !output.startsWith('-')) {
          output = `## Result\n\n${output}`;
        }
        break;

      case 'add-code-blocks':
        // Wrap any detected code snippets that aren't already in blocks
        // Simple heuristic: lines starting with common code indicators
        const lines = output.split('\n');
        const processedLines: string[] = [];
        let inCodeBlock = false;

        for (const line of lines) {
          const isCodeLine = /^(import |export |const |let |var |function |class |interface |type |async |def |return |try |catch |if |for |while )/.test(line.trim());

          if (isCodeLine && !inCodeBlock) {
            processedLines.push('```');
            inCodeBlock = true;
          } else if (!isCodeLine && inCodeBlock && line.trim() === '') {
            processedLines.push('```');
            inCodeBlock = false;
          }

          processedLines.push(line);
        }

        if (inCodeBlock) {
          processedLines.push('```');
        }

        output = processedLines.join('\n');
        break;

      case 'trim-output':
        output = output.trim();
        break;

      case 'extract-summary':
        // If the output is very long, try to extract just the summary/conclusion
        if (output.length > 2000) {
          const summaryMatch = output.match(/(?:##?\s*(?:Summary|Conclusion|Result)\s*\n\n?)([\s\S]*?)(?:\n\n##|$)/i);
          if (summaryMatch) {
            output = summaryMatch[1].trim();
          }
        }
        break;
    }
  }

  return output;
}

// ────────────────────────────────────────────
// Build: combine skill prompt with user input
// ────────────────────────────────────────────

/**
 * Build the system and user prompts for the LLM call.
 * Combines the skill's stored prompt template with the user input.
 */
function buildSkillPrompt(skill: SkillDef, input: string): { system: string; user: string } {
  const config = parseSkillConfig(skill.config);
  const skillPrompt = skill.prompt || `You are a helpful assistant with expertise in ${skill.name}.`;

  // System prompt: the skill's role definition
  const system = [
    `# Skill: ${skill.name}`,
    '',
    skillPrompt,
    '',
    `## Category: ${skill.category}`,
    `## Task: ${skill.description}`,
  ].join('\n');

  // User prompt: the enriched input with skill context
  const user = [
    input,
    '',
    '---',
    `*Executed via skill: ${skill.name} (${skill.category})*`,
  ].join('\n');

  // Replace any template variables in the system prompt
  const variables = config.variables || {};
  let finalSystem = system;
  let finalUser = user;

  for (const [key, value] of Object.entries(variables)) {
    finalSystem = finalSystem.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    finalUser = finalUser.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return { system: finalSystem, user: finalUser };
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * Safely parse the JSON config column from a SkillDef.
 * Returns empty config if parsing fails or config is null.
 */
function parseSkillConfig(configJson: string | null): SkillConfig {
  if (!configJson) return {};

  try {
    const parsed = JSON.parse(configJson);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as SkillConfig;
  } catch {
    console.warn(`[SkillEngine] Failed to parse skill config: ${configJson.slice(0, 100)}...`);
    return {};
  }
}

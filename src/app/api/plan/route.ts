import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/nvidia';
import { getDefaultModel } from '@/lib/nvidia';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, model } = body as { task?: string; model?: string };

    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return NextResponse.json(
        { error: 'Task description is required' },
        { status: 400 }
      );
    }

    const modelId = model || getDefaultModel();

    const systemPrompt = `You are a planning assistant. Create a detailed multi-step plan for the given task.
Respond ONLY with valid JSON in this exact format:
{
  "goal": "Brief goal summary",
  "complexity": "low|medium|high",
  "steps": [
    { "id": 1, "title": "Step title", "description": "Detailed description of what to do", "status": "pending", "dependencies": [] },
    { "id": 2, "title": "Step title", "description": "Description", "status": "pending", "dependencies": [1] }
  ]
}

Rules:
- Provide 3-10 steps depending on task complexity
- Each step should be actionable and specific
- Use meaningful dependencies (a step depends on prior steps that must complete first)
- Set complexity to "low" for simple tasks (<3 steps), "medium" for moderate tasks (3-6 steps), "high" for complex tasks (7+ steps)
- Return ONLY the JSON object, no markdown fences, no explanation`;

    const response = await chatCompletion({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a plan for: ${task.trim()}` },
      ],
      temperature: 0.4,
      maxTokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Empty response from AI model' },
        { status: 500 }
      );
    }

    // Parse the AI response — handle markdown code fences and raw JSON
    let jsonStr = content.trim();
    // Remove markdown code fences if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON from the response using regex
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          plan = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            { error: 'Failed to parse plan JSON from AI response', raw: content },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to parse plan JSON from AI response', raw: content },
          { status: 500 }
        );
      }
    }

    // Validate the plan structure
    if (!plan.goal || typeof plan.goal !== 'string') {
      return NextResponse.json(
        { error: 'Invalid plan: missing goal', raw: content },
        { status: 500 }
      );
    }
    if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      return NextResponse.json(
        { error: 'Invalid plan: missing or empty steps', raw: content },
        { status: 500 }
      );
    }

    // Normalize steps
    const normalizedSteps = (plan.steps as Array<Record<string, unknown>>).map(
      (step, index) => ({
        id: (step.id as number) || index + 1,
        title: String(step.title || `Step ${index + 1}`),
        description: String(step.description || ''),
        status: step.status === 'in-progress' ? 'in-progress' : step.status === 'completed' ? 'completed' : 'pending',
        dependencies: Array.isArray(step.dependencies) ? step.dependencies.filter((d: unknown) => typeof d === 'number') : [],
      })
    );

    const normalizedPlan = {
      goal: String(plan.goal),
      complexity: ['low', 'medium', 'high'].includes(plan.complexity as string) ? plan.complexity : 'medium',
      steps: normalizedSteps,
    };

    return NextResponse.json(normalizedPlan);
  } catch (error) {
    console.error('[Plan API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate plan: ${message}` },
      { status: 500 }
    );
  }
}

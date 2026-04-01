import { NextRequest, NextResponse } from "next/server";
import {
  listModels,
  getRecommendedModels,
  getModelsByCategory,
  chatCompletion,
  type NvidiaModelInfo,
  type NvidiaListedModel,
} from "@/lib/nvidia";

/**
 * GET /api/models
 * Returns all available NVIDIA models with metadata.
 * Query params:
 *   category - filter by category (chat, code, reasoning, vision, large)
 *   grouped  - if "true", return models grouped by category
 *   remote   - if "true", also fetch the remote model list from NVIDIA
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const grouped = searchParams.get("grouped") === "true";
    const remote = searchParams.get("remote") === "true";

    const recommended = getRecommendedModels();

    if (grouped) {
      const groupedModels = getModelsByCategory();
      return NextResponse.json({
        success: true,
        models: groupedModels,
        total: recommended.length,
      });
    }

    let filtered: NvidiaModelInfo[] = recommended;
    if (category) {
      filtered = recommended.filter(
        (m) => m.category === category || (category === "vision" && m.supportsVision)
      );
    }

    let remoteModels: NvidiaListedModel[] | null = null;
    if (remote) {
      try {
        remoteModels = await listModels();
      } catch (err) {
        console.warn("[/api/models] Failed to fetch remote models:", err);
      }
    }

    return NextResponse.json({
      success: true,
      models: filtered,
      total: filtered.length,
      remoteModels: remoteModels,
    });
  } catch (error: unknown) {
    console.error("[/api/models] GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list models";
    return NextResponse.json(
      { error: "Failed to list models", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/models/test
 * Test a specific model with a simple message.
 * Body: { model: string, message?: string, temperature?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, message, temperature } = body;

    if (!model) {
      return NextResponse.json(
        { error: "model is required" },
        { status: 400 }
      );
    }

    const testMessage =
      message || "Say hello in one short sentence. Keep it under 20 words.";

    const startTime = Date.now();

    const response = await chatCompletion({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Respond concisely and to the point.",
        },
        { role: "user", content: testMessage },
      ],
      temperature: temperature ?? 0.7,
      maxTokens: 100,
    });

    const elapsed = Date.now() - startTime;
    const content = response.choices?.[0]?.message?.content || "(empty response)";

    return NextResponse.json({
      success: true,
      model: response.model,
      content,
      finishReason: response.choices?.[0]?.finish_reason,
      usage: response.usage,
      latencyMs: elapsed,
    });
  } catch (error: unknown) {
    console.error("[/api/models] POST test error:", error);
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status: number }).status
        : 500;
    const message =
      error instanceof Error ? error.message : "Failed to test model";
    return NextResponse.json(
      { error: "Model test failed", details: message },
      { status: status >= 400 ? status : 500 }
    );
  }
}

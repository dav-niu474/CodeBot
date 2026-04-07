import { NextRequest, NextResponse } from "next/server";
import {
  type NvidiaModelInfo,
  type NvidiaListedModel,
  listModels,
} from "@/lib/nvidia";
import { FULL_NVIDIA_MODEL_CATALOG, getModelsByCategory as catalogGrouped } from "@/lib/nvidia-models";

/**
 * GET /api/models
 * Returns all available NVIDIA models with metadata.
 * Query params:
 *   category   - filter by category (chat, code, reasoning, vision, embedding, fast)
 *   grouped    - if "true", return models grouped by category
 *   search     - search query string (matches id, name, provider)
 *   limit      - limit number of results
 *   recommended - if "true", return only recommended models
 *   remote     - if "true", also fetch the remote model list from NVIDIA
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const grouped = searchParams.get("grouped") === "true";
    const search = searchParams.get("search")?.trim().toLowerCase();
    const limitParam = searchParams.get("limit");
    const recommendedOnly = searchParams.get("recommended") === "true";
    const remote = searchParams.get("remote") === "true";

    // Start with full catalog
    let allModels: NvidiaModelInfo[] = [...FULL_NVIDIA_MODEL_CATALOG];

    // Search filter
    if (search) {
      allModels = allModels.filter(
        (m) =>
          m.id.toLowerCase().includes(search) ||
          m.name.toLowerCase().includes(search) ||
          m.provider.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (category) {
      allModels = allModels.filter(
        (m) =>
          m.category === category ||
          (category === "vision" && m.supportsVision) ||
          (category === "large" && m.contextLength >= 100000)
      );
    }

    // Limit
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        allModels = allModels.slice(0, limit);
      }
    }

    // Recommended filter
    if (recommendedOnly) {
      const recommendedIds = new Set([
        "meta/llama-3.3-70b-instruct",
        "google/gemma-3-27b-it",
        "qwen/qwen2.5-coder-32b-instruct",
        "moonshotai/kimi-k2-instruct",
        "deepseek-ai/deepseek-r1-distill-qwen-32b",
        "mistralai/mistral-large-3-675b-instruct-2512",
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        "qwen/qwen3.5-397b-a17b",
        "qwen/qwen3-coder-480b-a35b-instruct",
        "meta/llama-3.2-90b-vision-instruct",
        "z-ai/glm5",
        "stepfun-ai/step-3.5-flash",
      ]);
      allModels = allModels.filter((m) => recommendedIds.has(m.id));
    }

    if (grouped) {
      const groupedModels = catalogGrouped();
      return NextResponse.json({
        success: true,
        models: groupedModels,
        total: FULL_NVIDIA_MODEL_CATALOG.length,
      });
    }

    // Count models per category from full catalog
    const categoryCounts: Record<string, number> = {};
    for (const m of FULL_NVIDIA_MODEL_CATALOG) {
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
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
      models: allModels,
      total: allModels.length,
      allTotal: FULL_NVIDIA_MODEL_CATALOG.length,
      categories: categoryCounts,
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

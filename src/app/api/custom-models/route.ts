import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// GET /api/custom-models - List all custom models
export async function GET() {
  try {
    const models = await db.customModel.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Mask API keys for security
    const masked = models.map((m) => ({
      ...m,
      apiKey: m.apiKey ? `${m.apiKey.slice(0, 8)}...${m.apiKey.slice(-4)}` : "",
    }));
    return NextResponse.json({ success: true, models: masked });
  } catch (error) {
    console.error("[/api/custom-models] GET error:", error);
    return NextResponse.json({ error: "Failed to list custom models" }, { status: 500 });
  }
}

// POST /api/custom-models - Create a new custom model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, modelId, provider, baseUrl, apiKey, apiFormat, contextLength, supportsStreaming, supportsVision, category } = body;

    if (!name || !modelId || !baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "name, modelId, baseUrl, and apiKey are required" },
        { status: 400 }
      );
    }

    // Check for duplicate modelId
    const existing = await db.customModel.findUnique({ where: { modelId } });
    if (existing) {
      return NextResponse.json({ error: "A model with this ID already exists" }, { status: 409 });
    }

    const model = await db.customModel.create({
      data: {
        name,
        modelId,
        provider: provider || "custom",
        baseUrl,
        apiKey,
        apiFormat: apiFormat || "openai",
        contextLength: contextLength || 8192,
        supportsStreaming: supportsStreaming ?? true,
        supportsVision: supportsVision ?? false,
        category: category || "chat",
        isEnabled: true,
      },
    });

    return NextResponse.json({ success: true, model: { ...model, apiKey: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` } }, { status: 201 });
  } catch (error) {
    console.error("[/api/custom-models] POST error:", error);
    return NextResponse.json({ error: "Failed to create custom model" }, { status: 500 });
  }
}

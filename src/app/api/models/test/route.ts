import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/nvidia";

/**
 * POST /api/models/test
 * Test a specific model with a simple message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, message, temperature } = body;

    if (!model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
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
    const content =
      response.choices?.[0]?.message?.content || "(empty response)";

    return NextResponse.json({
      success: true,
      model: response.model,
      content,
      finishReason: response.choices?.[0]?.finish_reason,
      usage: response.usage,
      latencyMs: elapsed,
    });
  } catch (error: unknown) {
    console.error("[/api/models/test] POST error:", error);
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

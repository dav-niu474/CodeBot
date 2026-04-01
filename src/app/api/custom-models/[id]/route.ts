import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// DELETE /api/custom-models/[id] - Delete a custom model
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.customModel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/custom-models] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete custom model" }, { status: 500 });
  }
}

// PATCH /api/custom-models/[id] - Update a custom model
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const model = await db.customModel.update({
      where: { id },
      data: body,
    });
    
    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("[/api/custom-models] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update custom model" }, { status: 500 });
  }
}

/**
 * API: Single assistant capture
 * DELETE — Remove a capture (e.g. dismissed by mistake, or cleanup)
 */

import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { deleteCapture, dismissCapture } from "@/lib/db/assistant";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const deleted = deleteCapture(id);
    if (!deleted) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to delete capture" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "dismiss") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    const dismissed = dismissCapture(id);
    if (!dismissed) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to dismiss capture" },
      { status: 500 }
    );
  }
}

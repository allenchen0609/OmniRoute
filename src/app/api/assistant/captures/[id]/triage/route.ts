/**
 * API: Triage an assistant capture
 * POST — Ask the AI to turn a raw capture into a structured task, then
 *        mark the capture as triaged and return the created task.
 */

import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getCapture, markCaptureTriaged, createTask } from "@/lib/db/assistant";
import { triageCaptureText } from "@/lib/assistant/triage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const capture = getCapture(id);
    if (!capture) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }
    if (capture.status !== "inbox") {
      return NextResponse.json({ error: "Capture already processed" }, { status: 409 });
    }

    const result = await triageCaptureText(capture.raw_text);
    const task = createTask({
      title: result.title,
      notes: result.notes,
      priority: result.priority,
      dueAt: result.dueAt,
      sourceCaptureId: capture.id,
    });
    markCaptureTriaged(capture.id, task.id);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to triage capture" },
      { status: 500 }
    );
  }
}

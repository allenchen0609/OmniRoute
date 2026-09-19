/**
 * API: Single assistant task
 * PATCH  — Update fields (title/notes/priority/status/dueAt/remindAt);
 *          used for complete/snooze/edit actions from the dashboard.
 * DELETE — Remove a task.
 */

import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { updateTaskSchema } from "@/shared/validation/schemas/assistant";
import { deleteTask, updateTask } from "@/lib/db/assistant";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const rawBody = await request.json();
    const validation = validateBody(updateTaskSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const task = updateTask(id, validation.data);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const deleted = deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to delete task" },
      { status: 500 }
    );
  }
}

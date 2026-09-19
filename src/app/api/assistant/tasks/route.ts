/**
 * API: Assistant tasks
 * GET  — List tasks, optionally filtered by status; ?due=true returns only
 *        tasks whose reminder is due now (for the dashboard's nudge banner).
 * POST — Create a task directly (skipping capture/triage), e.g. from a
 *        focus-view "quick add".
 */

import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { createTaskSchema } from "@/shared/validation/schemas/assistant";
import { createTask, listDueReminders, listTasks } from "@/lib/db/assistant";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("due") === "true") {
      return NextResponse.json({ tasks: listDueReminders() });
    }
    const status = searchParams.get("status");
    const tasks =
      status === "active" || status === "done" || status === "snoozed"
        ? listTasks({ status })
        : listTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to list tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const validation = validateBody(createTaskSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data } = validation;
    const task = createTask({
      title: data.title,
      notes: data.notes ?? null,
      priority: data.priority,
      dueAt: data.dueAt ?? null,
      remindAt: data.remindAt ?? null,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to create task" },
      { status: 500 }
    );
  }
}

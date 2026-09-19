/**
 * Database module: ADHD executive assistant
 * CRUD for brain-dump captures and the tasks they get triaged into.
 */

import crypto from "crypto";
import { getDbInstance } from "./core";

export type CaptureStatus = "inbox" | "triaged" | "dismissed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "active" | "done" | "snoozed";

export interface Capture {
  id: string;
  raw_text: string;
  status: CaptureStatus;
  triaged_task_id: string | null;
  created_at: string;
}

export interface AssistantTask {
  id: string;
  title: string;
  notes: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  remind_at: string | null;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ─── Captures ────────────────────────────────────────────────────────────────

export function createCapture(rawText: string): Capture {
  const db = getDbInstance();
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO assistant_captures (id, raw_text, status) VALUES (?, ?, 'inbox')`).run(
    id,
    rawText
  );
  return getCapture(id) as Capture;
}

export function getCapture(id: string): Capture | null {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM assistant_captures WHERE id = ?").get(id) as
    Capture | undefined;
  return row ?? null;
}

export function listCaptures(options?: { status?: CaptureStatus }): Capture[] {
  const db = getDbInstance();
  if (options?.status) {
    return db
      .prepare("SELECT * FROM assistant_captures WHERE status = ? ORDER BY created_at DESC")
      .all(options.status) as Capture[];
  }
  return db.prepare("SELECT * FROM assistant_captures ORDER BY created_at DESC").all() as Capture[];
}

export function markCaptureTriaged(id: string, taskId: string): void {
  getDbInstance()
    .prepare(`UPDATE assistant_captures SET status = 'triaged', triaged_task_id = ? WHERE id = ?`)
    .run(taskId, id);
}

export function dismissCapture(id: string): boolean {
  const result = getDbInstance()
    .prepare(`UPDATE assistant_captures SET status = 'dismissed' WHERE id = ?`)
    .run(id);
  return result.changes > 0;
}

export function deleteCapture(id: string): boolean {
  const result = getDbInstance().prepare("DELETE FROM assistant_captures WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  remindAt?: string | null;
  sourceCaptureId?: string | null;
}

export function createTask(input: CreateTaskInput): AssistantTask {
  const db = getDbInstance();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO assistant_tasks
       (id, title, notes, priority, status, due_at, remind_at, source_capture_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.notes ?? null,
    input.priority ?? "medium",
    input.dueAt ?? null,
    input.remindAt ?? null,
    input.sourceCaptureId ?? null,
    now,
    now
  );
  return getTask(id) as AssistantTask;
}

export function getTask(id: string): AssistantTask | null {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM assistant_tasks WHERE id = ?").get(id) as
    AssistantTask | undefined;
  return row ?? null;
}

export function listTasks(options?: { status?: TaskStatus }): AssistantTask[] {
  const db = getDbInstance();
  if (options?.status) {
    return db
      .prepare(
        "SELECT * FROM assistant_tasks WHERE status = ? ORDER BY (due_at IS NULL), due_at ASC, created_at DESC"
      )
      .all(options.status) as AssistantTask[];
  }
  return db
    .prepare("SELECT * FROM assistant_tasks ORDER BY (due_at IS NULL), due_at ASC, created_at DESC")
    .all() as AssistantTask[];
}

export function listDueReminders(nowIso: string = new Date().toISOString()): AssistantTask[] {
  const db = getDbInstance();
  return db
    .prepare(
      `SELECT * FROM assistant_tasks
       WHERE status = 'active' AND remind_at IS NOT NULL AND remind_at <= ?
       ORDER BY remind_at ASC`
    )
    .all(nowIso) as AssistantTask[];
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string | null;
  remindAt?: string | null;
}

export function updateTask(id: string, input: UpdateTaskInput): AssistantTask | null {
  const existing = getTask(id);
  if (!existing) return null;

  const db = getDbInstance();
  const now = new Date().toISOString();
  const next = {
    title: input.title ?? existing.title,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    priority: input.priority ?? existing.priority,
    status: input.status ?? existing.status,
    due_at: input.dueAt !== undefined ? input.dueAt : existing.due_at,
    remind_at: input.remindAt !== undefined ? input.remindAt : existing.remind_at,
    completed_at:
      input.status === "done" && existing.status !== "done"
        ? now
        : input.status && input.status !== "done"
          ? null
          : existing.completed_at,
  };

  db.prepare(
    `UPDATE assistant_tasks
       SET title = ?, notes = ?, priority = ?, status = ?, due_at = ?, remind_at = ?,
           completed_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.notes,
    next.priority,
    next.status,
    next.due_at,
    next.remind_at,
    next.completed_at,
    now,
    id
  );
  return getTask(id);
}

export function deleteTask(id: string): boolean {
  const result = getDbInstance().prepare("DELETE FROM assistant_tasks WHERE id = ?").run(id);
  return result.changes > 0;
}

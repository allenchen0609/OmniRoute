import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omni-db-assistant-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const coreDb = await import("../../src/lib/db/core.ts");
const assistantDb = await import("../../src/lib/db/assistant.ts");

async function resetStorage() {
  coreDb.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  coreDb.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("captures: create, list by status, triage, dismiss, delete", () => {
  const capture = assistantDb.createCapture("Call the vendor back about the contract");
  assert.equal(capture.status, "inbox");
  assert.equal(assistantDb.listCaptures({ status: "inbox" }).length, 1);

  const task = assistantDb.createTask({ title: "Call vendor" });
  assistantDb.markCaptureTriaged(capture.id, task.id);
  const triaged = assistantDb.getCapture(capture.id);
  assert.equal(triaged?.status, "triaged");
  assert.equal(triaged?.triaged_task_id, task.id);
  assert.equal(assistantDb.listCaptures({ status: "inbox" }).length, 0);

  const second = assistantDb.createCapture("Random thought");
  assert.equal(assistantDb.dismissCapture(second.id), true);
  assert.equal(assistantDb.getCapture(second.id)?.status, "dismissed");
  assert.equal(assistantDb.dismissCapture("does-not-exist"), false);

  assert.equal(assistantDb.deleteCapture(second.id), true);
  assert.equal(assistantDb.getCapture(second.id), null);
});

test("tasks: create with defaults, list active, update fields, complete sets completed_at", () => {
  const task = assistantDb.createTask({ title: "Draft board memo" });
  assert.equal(task.priority, "medium");
  assert.equal(task.status, "active");
  assert.equal(task.completed_at, null);

  assert.equal(assistantDb.listTasks({ status: "active" }).length, 1);

  const updated = assistantDb.updateTask(task.id, { priority: "urgent", notes: "Due Friday" });
  assert.equal(updated?.priority, "urgent");
  assert.equal(updated?.notes, "Due Friday");
  assert.equal(updated?.status, "active");

  const completed = assistantDb.updateTask(task.id, { status: "done" });
  assert.equal(completed?.status, "done");
  assert.ok(completed?.completed_at);
  assert.equal(assistantDb.listTasks({ status: "active" }).length, 0);

  const reopened = assistantDb.updateTask(task.id, { status: "active" });
  assert.equal(reopened?.completed_at, null);

  assert.equal(assistantDb.updateTask("missing-id", { title: "x" }), null);
});

test("tasks: listDueReminders only returns active tasks whose remind_at has passed", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  const due = assistantDb.createTask({ title: "Send follow-up", remindAt: past });
  assistantDb.createTask({ title: "Not yet due", remindAt: future });
  assistantDb.createTask({ title: "No reminder set" });
  const doneButDue = assistantDb.createTask({ title: "Completed reminder", remindAt: past });
  assistantDb.updateTask(doneButDue.id, { status: "done" });

  const reminders = assistantDb.listDueReminders();
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].id, due.id);
});

test("tasks: deleteTask removes the row and reports whether it existed", () => {
  const task = assistantDb.createTask({ title: "Temp task" });
  assert.equal(assistantDb.deleteTask(task.id), true);
  assert.equal(assistantDb.getTask(task.id), null);
  assert.equal(assistantDb.deleteTask(task.id), false);
});

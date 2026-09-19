import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-assistant-api-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.NODE_ENV = "test";
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

const core = await import("../../../../src/lib/db/core.ts");
const { updateSettings } = await import("../../../../src/lib/db/settings.ts");
await updateSettings({ requireLogin: false });

const capturesRoute = await import("../../../../src/app/api/assistant/captures/route.ts");
const captureByIdRoute = await import("../../../../src/app/api/assistant/captures/[id]/route.ts");
const captureTriageRoute =
  await import("../../../../src/app/api/assistant/captures/[id]/triage/route.ts");
const tasksRoute = await import("../../../../src/app/api/assistant/tasks/route.ts");
const taskByIdRoute = await import("../../../../src/app/api/assistant/tasks/[id]/route.ts");

after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/assistant/captures", () => {
  it("rejects an empty rawText", async () => {
    const res = await capturesRoute.POST(
      jsonRequest("http://localhost/api/assistant/captures", "POST", { rawText: "" })
    );
    assert.equal(res.status, 400);
  });

  it("creates a capture in the inbox", async () => {
    const res = await capturesRoute.POST(
      jsonRequest("http://localhost/api/assistant/captures", "POST", {
        rawText: "Follow up with finance on the budget",
      })
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.capture.status, "inbox");
  });
});

describe("GET /api/assistant/captures", () => {
  it("lists inbox captures", async () => {
    const res = await capturesRoute.GET(
      new Request("http://localhost/api/assistant/captures?status=inbox")
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.captures));
    assert.ok(body.captures.length >= 1);
  });
});

describe("POST /api/assistant/captures/[id]/triage", () => {
  it("triages a capture into a task, using the heuristic fallback (no upstream running)", async () => {
    const created = await capturesRoute.POST(
      jsonRequest("http://localhost/api/assistant/captures", "POST", {
        rawText: "Prep slides for the board meeting",
      })
    );
    const { capture } = await created.json();

    const res = await captureTriageRoute.POST(
      new Request(`http://localhost/api/assistant/captures/${capture.id}/triage`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: capture.id }) }
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.task.title.length > 0);
    assert.equal(body.task.status, "active");

    const dismissRes = await captureByIdRoute.PATCH(
      jsonRequest(`http://localhost/api/assistant/captures/${capture.id}`, "PATCH", {
        action: "dismiss",
      }),
      { params: Promise.resolve({ id: capture.id }) }
    );
    // Already triaged captures are no longer in "inbox" status, but dismiss just
    // flips the status column unconditionally, so this still succeeds.
    assert.equal(dismissRes.status, 200);
  });

  it("returns 404 for an unknown capture id", async () => {
    const res = await captureTriageRoute.POST(
      new Request("http://localhost/api/assistant/captures/does-not-exist/triage", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "does-not-exist" }) }
    );
    assert.equal(res.status, 404);
  });
});

describe("assistant tasks CRUD", () => {
  it("creates, updates, filters due reminders, and deletes a task", async () => {
    const createRes = await tasksRoute.POST(
      jsonRequest("http://localhost/api/assistant/tasks", "POST", {
        title: "Sign the vendor contract",
        priority: "urgent",
        remindAt: new Date(Date.now() - 1000).toISOString(),
      })
    );
    assert.equal(createRes.status, 201);
    const { task } = await createRes.json();

    const dueRes = await tasksRoute.GET(
      new Request("http://localhost/api/assistant/tasks?due=true")
    );
    const dueBody = await dueRes.json();
    assert.ok(dueBody.tasks.some((t: { id: string }) => t.id === task.id));

    const updateRes = await taskByIdRoute.PATCH(
      jsonRequest(`http://localhost/api/assistant/tasks/${task.id}`, "PATCH", {
        status: "done",
      }),
      { params: Promise.resolve({ id: task.id }) }
    );
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.task.status, "done");

    const deleteRes = await taskByIdRoute.DELETE(
      jsonRequest(`http://localhost/api/assistant/tasks/${task.id}`, "DELETE"),
      { params: Promise.resolve({ id: task.id }) }
    );
    assert.equal(deleteRes.status, 200);

    const missingUpdateRes = await taskByIdRoute.PATCH(
      jsonRequest(`http://localhost/api/assistant/tasks/${task.id}`, "PATCH", {
        status: "done",
      }),
      { params: Promise.resolve({ id: task.id }) }
    );
    assert.equal(missingUpdateRes.status, 404);
  });

  it("rejects a PATCH body with no fields", async () => {
    const created = await tasksRoute.POST(
      jsonRequest("http://localhost/api/assistant/tasks", "POST", { title: "Placeholder" })
    );
    const { task } = await created.json();
    const res = await taskByIdRoute.PATCH(
      jsonRequest(`http://localhost/api/assistant/tasks/${task.id}`, "PATCH", {}),
      { params: Promise.resolve({ id: task.id }) }
    );
    assert.equal(res.status, 400);
  });
});

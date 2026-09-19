import test from "node:test";
import assert from "node:assert/strict";

const { triageCaptureText } = await import("../../src/lib/assistant/triage.ts");

function fakeFetch(content: string | null, ok = true) {
  return async () =>
    new Response(JSON.stringify(content === null ? {} : { choices: [{ message: { content } }] }), {
      status: ok ? 200 : 500,
    });
}

test("triageCaptureText parses a well-formed model JSON response", async () => {
  const result = await triageCaptureText("email legal about the NDA", {
    fetchImpl: fakeFetch(
      JSON.stringify({
        title: "Email legal about the NDA",
        priority: "high",
        dueAt: "2026-09-20T09:00:00.000Z",
        notes: "Mentioned during the call",
      })
    ),
  });
  assert.equal(result.title, "Email legal about the NDA");
  assert.equal(result.priority, "high");
  assert.equal(result.dueAt, "2026-09-20T09:00:00.000Z");
  assert.equal(result.notes, "Mentioned during the call");
});

test("triageCaptureText tolerates prose wrapped around the JSON object", async () => {
  const result = await triageCaptureText("book flights", {
    fetchImpl: fakeFetch('Sure! Here you go:\n{"title": "Book flights", "priority": "low"}\nDone.'),
  });
  assert.equal(result.title, "Book flights");
  assert.equal(result.priority, "low");
});

test("triageCaptureText falls back to a heuristic when the upstream call fails", async () => {
  const result = await triageCaptureText("ping the CFO asap about Q3 numbers", {
    fetchImpl: async () => {
      throw new Error("network unreachable");
    },
  });
  assert.equal(result.title, "ping the CFO asap about Q3 numbers");
  assert.equal(result.priority, "high");
});

test("triageCaptureText falls back to a heuristic when the response is not ok", async () => {
  const result = await triageCaptureText("routine note", {
    fetchImpl: fakeFetch(null, false),
  });
  assert.equal(result.title, "routine note");
  assert.equal(result.priority, "medium");
});

test("triageCaptureText falls back when the model content is not parsable JSON", async () => {
  const result = await triageCaptureText("first line\nsecond line", {
    fetchImpl: fakeFetch("not json at all"),
  });
  assert.equal(result.title, "first line");
  assert.equal(result.notes, "first line\nsecond line");
});

test("triageCaptureText rejects an unknown priority from the model and defaults to medium", async () => {
  const result = await triageCaptureText("some note", {
    fetchImpl: fakeFetch(JSON.stringify({ title: "Some note", priority: "critical!!" })),
  });
  assert.equal(result.priority, "medium");
});

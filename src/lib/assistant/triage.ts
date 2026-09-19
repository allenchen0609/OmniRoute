/**
 * AI-assisted triage: turns a raw brain-dump capture into a structured task
 * by asking a model (via OmniRoute's own /v1/chat/completions endpoint) to
 * extract a title, priority and optional due date. Falls back to a plain
 * heuristic whenever the model call fails or returns something unparsable,
 * so triage always succeeds even with no provider configured.
 */

import { resolveOmniRouteBaseUrl } from "@/shared/utils/resolveOmniRouteBaseUrl";
import { TASK_PRIORITY_VALUES } from "@/shared/validation/schemas/assistant";
import type { TaskPriority } from "@/lib/db/assistant";

export interface TriageResult {
  title: string;
  priority: TaskPriority;
  dueAt: string | null;
  notes: string | null;
}

const URGENT_PATTERN = /\b(asap|urgent|right away|today|now)\b/i;

function heuristicTriage(rawText: string): TriageResult {
  const trimmed = rawText.trim();
  const firstLine = (trimmed.split("\n")[0] || trimmed).slice(0, 140) || "Untitled task";
  return {
    title: firstLine,
    priority: URGENT_PATTERN.test(trimmed) ? "high" : "medium",
    dueAt: null,
    notes: trimmed.length > firstLine.length ? trimmed : null,
  };
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (TASK_PRIORITY_VALUES as readonly string[]).includes(value);
}

function parseTriageContent(content: string): TriageResult | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed?.title !== "string" || !parsed.title.trim()) return null;
    return {
      title: parsed.title.trim().slice(0, 200),
      priority: isTaskPriority(parsed.priority) ? parsed.priority : "medium",
      dueAt: typeof parsed.dueAt === "string" ? parsed.dueAt : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
    };
  } catch {
    return null;
  }
}

export interface TriageOptions {
  fetchImpl?: typeof fetch;
  nowIso?: string;
}

export async function triageCaptureText(
  rawText: string,
  options: TriageOptions = {}
): Promise<TriageResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowIso = options.nowIso ?? new Date().toISOString();
  const baseUrl = resolveOmniRouteBaseUrl();
  const apiKey = process.env.OMNIROUTE_API_KEY || "";

  try {
    const res = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "auto",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You triage a busy executive's raw brain-dump note into a single actionable task. " +
              `The current time is ${nowIso}. Respond with ONLY a JSON object, no prose: ` +
              `{"title": string (<=100 chars, action-oriented), "priority": "low"|"medium"|"high"|"urgent", ` +
              `"dueAt": ISO-8601 datetime string or null, "notes": string or null}.`,
          },
          { role: "user", content: rawText },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return heuristicTriage(rawText);
    }
    const data: unknown = await res.json();
    const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
      ?.message?.content;
    const parsed = typeof content === "string" ? parseTriageContent(content) : null;
    return parsed ?? heuristicTriage(rawText);
  } catch {
    return heuristicTriage(rawText);
  }
}

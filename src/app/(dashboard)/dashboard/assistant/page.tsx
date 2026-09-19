"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Button, Textarea, Badge, EmptyState } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

interface Capture {
  id: string;
  raw_text: string;
  status: "inbox" | "triaged" | "dismissed";
  created_at: string;
}

interface AssistantTask {
  id: string;
  title: string;
  notes: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "active" | "done" | "snoozed";
  due_at: string | null;
  remind_at: string | null;
  created_at: string;
}

const PRIORITY_VARIANT: Record<
  AssistantTask["priority"],
  "info" | "default" | "warning" | "error"
> = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "error",
};

const REMINDER_POLL_MS = 60_000;

function addHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export default function AssistantPage() {
  const { addNotification } = useNotificationStore();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [tasks, setTasks] = useState<AssistantTask[]>([]);
  const [dueReminders, setDueReminders] = useState<AssistantTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureText, setCaptureText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const notifiedReminderIds = useRef<Set<string>>(new Set());

  const fetchCaptures = useCallback(async () => {
    const res = await fetch("/api/assistant/captures?status=inbox");
    if (res.ok) {
      const data = await res.json();
      setCaptures(data.captures || []);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/assistant/tasks?status=active");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  }, []);

  const fetchDueReminders = useCallback(async () => {
    const res = await fetch("/api/assistant/tasks?due=true");
    if (!res.ok) return;
    const data = await res.json();
    const due: AssistantTask[] = data.tasks || [];
    setDueReminders(due);
    for (const task of due) {
      if (!notifiedReminderIds.current.has(task.id)) {
        notifiedReminderIds.current.add(task.id);
        addNotification({ type: "info", message: `Reminder: ${task.title}` });
      }
    }
  }, [addNotification]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchCaptures(), fetchTasks(), fetchDueReminders()]);
      setLoading(false);
    })();
  }, [fetchCaptures, fetchTasks, fetchDueReminders]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchDueReminders();
    }, REMINDER_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchDueReminders]);

  const handleCapture = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawText = captureText.trim();
    if (!rawText) return;
    setCapturing(true);
    try {
      const res = await fetch("/api/assistant/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      if (!res.ok) throw new Error("capture failed");
      setCaptureText("");
      await fetchCaptures();
    } catch {
      addNotification({ type: "error", message: "Couldn't save that thought — try again." });
    } finally {
      setCapturing(false);
    }
  };

  const handleTriage = async (captureId: string) => {
    setTriagingId(captureId);
    try {
      const res = await fetch(`/api/assistant/captures/${captureId}/triage`, { method: "POST" });
      if (!res.ok) throw new Error("triage failed");
      addNotification({ type: "success", message: "Turned into a task." });
      await Promise.all([fetchCaptures(), fetchTasks()]);
    } catch {
      addNotification({ type: "error", message: "Couldn't triage that note — try again." });
    } finally {
      setTriagingId(null);
    }
  };

  const handleDismissCapture = async (captureId: string) => {
    await fetch(`/api/assistant/captures/${captureId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    await fetchCaptures();
  };

  const handleCompleteTask = async (taskId: string) => {
    await fetch(`/api/assistant/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    await Promise.all([fetchTasks(), fetchDueReminders()]);
  };

  const handleSnoozeReminder = async (taskId: string) => {
    await fetch(`/api/assistant/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: addHoursIso(1) }),
    });
    notifiedReminderIds.current.delete(taskId);
    await fetchDueReminders();
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/assistant/tasks/${taskId}`, { method: "DELETE" });
    await fetchTasks();
  };

  if (loading) {
    return <div className="p-6">Loading your assistant…</div>;
  }

  const focusTasks = tasks.slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Assistant</h1>
        <p className="text-sm text-text-muted">
          Dump whatever&rsquo;s in your head. Triage it into tasks when you&rsquo;re ready.
        </p>
      </div>

      {dueReminders.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500 p-4">
          <h2 className="mb-2 font-semibold">Due now</h2>
          <div className="space-y-2">
            {dueReminders.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{task.title}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleSnoozeReminder(task.id)}>
                    Remind in 1h
                  </Button>
                  <Button onClick={() => handleCompleteTask(task.id)}>Done</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <form onSubmit={handleCapture} className="space-y-3">
          <Textarea
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            placeholder="What's on your mind? Just get it out — one sentence is fine."
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={capturing || !captureText.trim()}>
              {capturing ? "Capturing…" : "Capture"}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Today&rsquo;s focus</h2>
        {focusTasks.length === 0 ? (
          <EmptyState
            title="Nothing on your plate"
            description="Capture a thought above, then triage it into a task."
          />
        ) : (
          <div className="grid gap-3">
            {focusTasks.map((task) => (
              <Card key={task.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.title}</span>
                    <Badge variant={PRIORITY_VARIANT[task.priority]} size="sm">
                      {task.priority}
                    </Badge>
                  </div>
                  {task.due_at && (
                    <p className="mt-1 text-xs text-text-muted">
                      Due {new Date(task.due_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleCompleteTask(task.id)}>Done</Button>
                  <Button variant="danger" onClick={() => handleDeleteTask(task.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {captures.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Inbox — needs triage</h2>
          <div className="grid gap-3">
            {captures.map((capture) => (
              <Card key={capture.id} className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm">{capture.raw_text}</p>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => handleDismissCapture(capture.id)}>
                    Dismiss
                  </Button>
                  <Button
                    disabled={triagingId === capture.id}
                    onClick={() => handleTriage(capture.id)}
                  >
                    {triagingId === capture.id ? "Triaging…" : "Turn into task"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

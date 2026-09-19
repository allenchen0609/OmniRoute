CREATE TABLE IF NOT EXISTS assistant_captures (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inbox',
  triaged_task_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assistant_captures_status ON assistant_captures(status);

CREATE TABLE IF NOT EXISTS assistant_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  due_at TEXT,
  remind_at TEXT,
  source_capture_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON assistant_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_remind_at ON assistant_tasks(remind_at);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_due_at ON assistant_tasks(due_at);

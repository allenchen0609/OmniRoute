import { z } from "zod";

export const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUS_VALUES = ["active", "done", "snoozed"] as const;

export const createCaptureSchema = z.object({
  rawText: z.string().trim().min(1).max(4000),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(4000).optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  remindAt: z.string().datetime().optional().nullable(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(4000).optional().nullable(),
    priority: z.enum(TASK_PRIORITY_VALUES).optional(),
    status: z.enum(TASK_STATUS_VALUES).optional(),
    dueAt: z.string().datetime().optional().nullable(),
    remindAt: z.string().datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

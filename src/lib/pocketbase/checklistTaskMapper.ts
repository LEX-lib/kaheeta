import type {
  ChecklistTask,
  ChecklistSubtask,
  TaskPriority,
} from "@/types/wallecx/checklists/types";

/**
 * Strip a checklist task down to its writable backend fields (no id/created/
 * updated/user). `subtasks` maps to a JSON column. Mirrors the mapToUpdateX
 * convention used across the PocketBase write layer.
 */
export function mapToUpdateTask(
  t: Pick<ChecklistTask, "checklist" | "title" | "done" | "order"> &
    Partial<Pick<ChecklistTask, "priority" | "due" | "subtasks">>,
): {
  checklist: string;
  title: string;
  done: boolean;
  order: number;
  priority: TaskPriority | null;
  due: string | null;
  subtasks: ChecklistSubtask[];
} {
  return {
    checklist: t.checklist,
    title: t.title,
    done: t.done,
    order: t.order,
    priority: t.priority ?? null,
    due: t.due ?? null,
    subtasks: t.subtasks ?? [],
  };
}

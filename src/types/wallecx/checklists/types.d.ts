// Checklist feature types.
//
// Storage is a local mock today (see useChecklists.ts) but the shapes mirror the
// planned relational PocketBase collections so the swap is isolated:
//   kaheeta_checklists       → Checklist
//   kaheeta_checklist_tasks  → ChecklistTask (subtasks stored as a JSON column)

export type TaskPriority = "high" | "med" | "low";

export interface ChecklistSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface ChecklistTask {
  id: string;
  /** FK → Checklist.id */
  checklist: string;
  title: string;
  done: boolean;
  /** Modeled for the next cut; not surfaced in the MVP UI. */
  priority?: TaskPriority;
  /** ISO date string. Modeled for the next cut; not surfaced in the MVP UI. */
  due?: string;
  /** JSON column on the task. Empty in the MVP. */
  subtasks: ChecklistSubtask[];
  order: number;
}

export interface Checklist {
  id: string;
  name: string;
  /** iconify mdi:* name */
  icon: string;
  /** accent hex, e.g. #e89820 */
  color: string;
  order: number;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  pct: number;
}

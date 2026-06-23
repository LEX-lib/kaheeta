// Checklist feature types — backed by PocketBase collections:
//   kaheeta_checklists       → Checklist
//   kaheeta_checklist_tasks  → ChecklistTask (subtasks stored as a JSON column)

import type { RecordModel } from "pocketbase";

export type TaskPriority = "high" | "med" | "low";

export interface ChecklistSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Checklist extends RecordModel {
  name: string;
  /** iconify mdi:* name */
  icon: string;
  /** accent hex, e.g. #e89820 */
  color: string;
  order: number;
  /** owner — relation to users */
  user: string;
}

export interface ChecklistTask extends RecordModel {
  /** relation → kaheeta_checklists.id */
  checklist: string;
  title: string;
  done: boolean;
  /** Modeled for the next cut; not surfaced in the MVP UI. */
  priority?: TaskPriority;
  /** ISO date string. Modeled for the next cut; not surfaced in the MVP UI. */
  due?: string;
  /** JSON column. Empty in the MVP. */
  subtasks: ChecklistSubtask[];
  order: number;
  /** owner — relation to users */
  user: string;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  pct: number;
}

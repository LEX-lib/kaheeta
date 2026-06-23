import { ref } from "vue";
import { pb } from "@/lib/pocketbase";
import { instrumentedGetFullList } from "@/lib/pocketbase/perfInstrument";
import { mapToUpdateChecklist } from "@/lib/pocketbase/checklistMapper";
import { mapToUpdateTask } from "@/lib/pocketbase/checklistTaskMapper";
import type {
  Checklist,
  ChecklistTask,
  ChecklistProgress,
} from "@/types/wallecx/checklists/types";

/**
 * Checklist data layer, backed by PocketBase:
 *   kaheeta_checklists       (Checklist)
 *   kaheeta_checklist_tasks  (ChecklistTask; subtasks = JSON column)
 *
 * Reads go through instrumentedGetFullList; writes through the mapToUpdateX
 * mappers — per the project's PocketBase conventions. Collection access rules
 * scope every record to the current user, so no client-side user filtering is
 * needed. Mutations update the shared reactive state optimistically and revert
 * on failure.
 */

const CHECKLISTS = "kaheeta_checklists";
const TASKS = "kaheeta_checklist_tasks";

// Module-scope singletons so every useChecklists() consumer shares one state.
const checklists = ref<Checklist[]>([]);
const tasks = ref<ChecklistTask[]>([]);
const isLoading = ref(false);
let loaded = false;

function normalizeTask(t: ChecklistTask): ChecklistTask {
  // PocketBase returns JSON columns parsed, but guard against null/legacy rows.
  if (!Array.isArray(t.subtasks)) {
    t.subtasks = [];
  }
  return t;
}

async function load(force = false): Promise<void> {
  if (loaded && !force) {
    return;
  }
  isLoading.value = true;
  try {
    const [lists, ts] = await Promise.all([
      instrumentedGetFullList<Checklist>(CHECKLISTS, {
        sort: "order,created",
        requestKey: "kaheeta-checklists",
      }),
      instrumentedGetFullList<ChecklistTask>(TASKS, {
        sort: "order,created",
        requestKey: "kaheeta-checklist-tasks",
      }),
    ]);
    checklists.value = lists;
    tasks.value = ts.map(normalizeTask);
    loaded = true;
  } finally {
    isLoading.value = false;
  }
}

function tasksFor(checklistId: string): ChecklistTask[] {
  return tasks.value
    .filter((t) => t.checklist === checklistId)
    .sort((a, b) => a.order - b.order);
}

function progressFor(checklistId: string): ChecklistProgress {
  const list = tasksFor(checklistId);
  const total = list.length;
  const done = list.filter((t) => t.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function currentUserId(): string {
  const id = pb.authStore.record?.id;
  if (!id) {
    throw new Error("Not authenticated");
  }
  return id;
}

async function addChecklist(
  data: Pick<Checklist, "name" | "icon" | "color">,
): Promise<Checklist> {
  const created = await pb.collection(CHECKLISTS).create<Checklist>({
    ...mapToUpdateChecklist({ ...data, order: checklists.value.length }),
    user: currentUserId(),
  });
  checklists.value.push(created);
  return created;
}

async function updateChecklist(
  id: string,
  data: Partial<Pick<Checklist, "name" | "icon" | "color">>,
): Promise<void> {
  const current = checklists.value.find((c) => c.id === id);
  if (!current) {
    return;
  }
  const updated = await pb.collection(CHECKLISTS).update<Checklist>(
    id,
    mapToUpdateChecklist({
      name: data.name ?? current.name,
      icon: data.icon ?? current.icon,
      color: data.color ?? current.color,
      order: current.order,
    }),
  );
  const idx = checklists.value.findIndex((c) => c.id === id);
  if (idx !== -1) {
    checklists.value[idx] = updated;
  }
}

async function removeChecklist(id: string): Promise<void> {
  await pb.collection(CHECKLISTS).delete(id);
  checklists.value = checklists.value.filter((c) => c.id !== id);
  // The checklist relation cascades on the backend; mirror it locally.
  tasks.value = tasks.value.filter((t) => t.checklist !== id);
}

async function addTask(checklistId: string, title: string): Promise<ChecklistTask> {
  const created = await pb.collection(TASKS).create<ChecklistTask>({
    ...mapToUpdateTask({
      checklist: checklistId,
      title,
      done: false,
      order: tasksFor(checklistId).length,
      subtasks: [],
    }),
    user: currentUserId(),
  });
  const normalized = normalizeTask(created);
  tasks.value.push(normalized);
  return normalized;
}

async function toggleTask(id: string): Promise<void> {
  const target = tasks.value.find((t) => t.id === id);
  if (!target) {
    return;
  }
  const next = !target.done;
  target.done = next; // optimistic
  try {
    await pb.collection(TASKS).update(id, { done: next });
  } catch (e) {
    target.done = !next; // revert on failure
    throw e;
  }
}

async function removeTask(id: string): Promise<void> {
  await pb.collection(TASKS).delete(id);
  tasks.value = tasks.value.filter((t) => t.id !== id);
}

export function useChecklists() {
  return {
    checklists,
    tasks,
    isLoading,
    load,
    tasksFor,
    progressFor,
    addChecklist,
    updateChecklist,
    removeChecklist,
    addTask,
    toggleTask,
    removeTask,
  };
}

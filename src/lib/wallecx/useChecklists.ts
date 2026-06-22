import { ref } from "vue";
import type {
  Checklist,
  ChecklistTask,
  ChecklistProgress,
} from "@/types/wallecx/checklists/types";

/**
 * Checklist data layer.
 *
 * MVP backing store is localStorage with seed data — NOT the backend. This is
 * the single swap point: when the `kaheeta_checklists` / `kaheeta_checklist_tasks`
 * collections exist on PocketBase, replace the bodies of load()/persist() and
 * the mutators with `pb.collection(...)` calls (and make them async). The public
 * API (the returned object) is intentionally shaped to make that swap small.
 */

const LISTS_KEY = "kaheeta:checklists";
const TASKS_KEY = "kaheeta:checklist-tasks";

// Module-scope singletons so every useChecklists() consumer shares one state.
const checklists = ref<Checklist[]>([]);
const tasks = ref<ChecklistTask[]>([]);
let loaded = false;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old environments — uniqueness is best-effort.
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function persist(): void {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(checklists.value));
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.value));
  } catch {
    // localStorage unavailable (private mode) — degrade to in-memory only.
  }
}

function seed(): void {
  const g = uid();
  const e = uid();
  const w = uid();
  const h = uid();

  checklists.value = [
    { id: g, name: "Groceries", icon: "mdi:cart-outline", color: "#e89820", order: 0 },
    { id: e, name: "Errands", icon: "mdi:run-fast", color: "#378add", order: 1 },
    { id: w, name: "Work", icon: "mdi:briefcase-outline", color: "#7c5cd6", order: 2 },
    { id: h, name: "Home", icon: "mdi:home-outline", color: "#1a7c45", order: 3 },
  ];

  const mk = (
    checklist: string,
    title: string,
    done: boolean,
    order: number,
  ): ChecklistTask => ({
    id: uid(),
    checklist,
    title,
    done,
    subtasks: [],
    order,
  });

  tasks.value = [
    // Groceries — 4 of 8
    mk(g, "Rice 25kg", true, 0),
    mk(g, "Cooking oil", true, 1),
    mk(g, "Eggs (2 trays)", true, 2),
    mk(g, "Bread", true, 3),
    mk(g, "Coffee", false, 4),
    mk(g, "Dish soap", false, 5),
    mk(g, "Snacks for the kids", false, 6),
    mk(g, "Fruits", false, 7),
    // Errands — 3 of 5
    mk(e, "Renew driver's license", false, 0),
    mk(e, "Pick up dry cleaning", false, 1),
    mk(e, "Deposit cheque at BPI", true, 2),
    mk(e, "Mail the documents", true, 3),
    mk(e, "Buy a gift", true, 4),
    // Work — 2 of 5
    mk(w, "Send weekly report", true, 0),
    mk(w, "Review pull requests", true, 1),
    mk(w, "Prepare slides", false, 2),
    mk(w, "Reply to client email", false, 3),
    mk(w, "Book travel", false, 4),
    // Home — 1 of 3
    mk(h, "Water the plants", true, 0),
    mk(h, "Fix the cabinet", false, 1),
    mk(h, "Schedule aircon cleaning", false, 2),
  ];
}

function ensureLoaded(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const rawLists = localStorage.getItem(LISTS_KEY);
    const rawTasks = localStorage.getItem(TASKS_KEY);
    if (rawLists && rawTasks) {
      checklists.value = JSON.parse(rawLists) as Checklist[];
      tasks.value = JSON.parse(rawTasks) as ChecklistTask[];
      return;
    }
    seed();
    persist();
  } catch {
    seed();
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

function addChecklist(data: Pick<Checklist, "name" | "icon" | "color">): Checklist {
  const created: Checklist = {
    id: uid(),
    name: data.name,
    icon: data.icon,
    color: data.color,
    order: checklists.value.length,
  };
  checklists.value.push(created);
  persist();
  return created;
}

function updateChecklist(
  id: string,
  data: Partial<Pick<Checklist, "name" | "icon" | "color">>,
): void {
  const target = checklists.value.find((c) => c.id === id);
  if (target) {
    Object.assign(target, data);
    persist();
  }
}

function removeChecklist(id: string): void {
  checklists.value = checklists.value.filter((c) => c.id !== id);
  tasks.value = tasks.value.filter((t) => t.checklist !== id);
  persist();
}

function addTask(checklistId: string, title: string): ChecklistTask {
  const created: ChecklistTask = {
    id: uid(),
    checklist: checklistId,
    title,
    done: false,
    subtasks: [],
    order: tasksFor(checklistId).length,
  };
  tasks.value.push(created);
  persist();
  return created;
}

function toggleTask(id: string): void {
  const target = tasks.value.find((t) => t.id === id);
  if (target) {
    target.done = !target.done;
    persist();
  }
}

function removeTask(id: string): void {
  tasks.value = tasks.value.filter((t) => t.id !== id);
  persist();
}

export function useChecklists() {
  ensureLoaded();
  return {
    checklists,
    tasks,
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

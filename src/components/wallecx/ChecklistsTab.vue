<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useChecklists } from "@/lib/wallecx/useChecklists";
import type { Checklist } from "@/types/wallecx/checklists/types";
import ProgressRing from "./ProgressRing.vue";

const ManageChecklist = defineAsyncComponent(() => import("./ManageChecklist.vue"));

const props = defineProps<{ pendingAction?: string | null }>();

const {
  checklists,
  tasksFor,
  progressFor,
  removeChecklist,
  addTask,
  toggleTask,
  removeTask,
} = useChecklists();

const confirm = useConfirm();

const selectedId = ref<string | null>(checklists.value[0]?.id ?? null);

const selectedChecklist = computed<Checklist | null>(
  () => checklists.value.find((c) => c.id === selectedId.value) ?? checklists.value[0] ?? null,
);

// Keep a valid selection if the active checklist is removed.
watch(
  checklists,
  (list) => {
    if (!list.some((c) => c.id === selectedId.value)) {
      selectedId.value = list[0]?.id ?? null;
    }
  },
  { deep: true },
);

const selectedTasks = computed(() =>
  selectedChecklist.value ? tasksFor(selectedChecklist.value.id) : [],
);
const selectedProgress = computed(() =>
  selectedChecklist.value
    ? progressFor(selectedChecklist.value.id)
    : { done: 0, total: 0, pct: 0 },
);

// --- Manage dialog ---
const showManage = ref(false);
const manageRecord = ref<Checklist | null>(null);

function openCreate(): void {
  manageRecord.value = null;
  showManage.value = true;
}
function openEdit(c: Checklist): void {
  manageRecord.value = c;
  showManage.value = true;
}
function onSaved(c: Checklist): void {
  selectedId.value = c.id;
}

function confirmDeleteChecklist(c: Checklist): void {
  confirm.require({
    header: "Delete checklist?",
    message: `"${c.name}" and its tasks will be removed.`,
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Keep", severity: "secondary", outlined: true },
    acceptProps: { label: "Delete", severity: "danger" },
    accept: () => removeChecklist(c.id),
  });
}

// --- quick-add task ---
const newTaskTitle = ref("");
function submitNewTask(): void {
  const title = newTaskTitle.value.trim();
  if (!title || !selectedChecklist.value) {
    return;
  }
  addTask(selectedChecklist.value.id, title);
  newTaskTitle.value = "";
}

// Deep-link "+ New task" shortcut → open the create dialog.
watch(
  () => props.pendingAction,
  (action) => {
    if (action === "add-checklist") {
      openCreate();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="checklist-tab">
    <div class="cl-header">
      <div>
        <p class="cl-eyebrow">Plan · Track · Done</p>
        <h2 class="cl-title">Checklist</h2>
      </div>
      <Button label="New checklist" icon="pi pi-plus" size="small" @click="openCreate" />
    </div>

    <!-- Empty state -->
    <div v-if="checklists.length === 0" class="cl-empty">
      <iconify-icon
        icon="mdi:checkbox-marked-outline"
        width="48"
        height="48"
        style="color: var(--color-brand-accent)"
      ></iconify-icon>
      <p>No checklists yet.</p>
      <Button label="Create your first checklist" icon="pi pi-plus" size="small" @click="openCreate" />
    </div>

    <!-- Two-pane on desktop, stacked on mobile -->
    <div v-else class="cl-layout">
      <!-- Rail -->
      <div class="cl-rail">
        <button
          v-for="c in checklists"
          :key="c.id"
          type="button"
          class="cl-card"
          :class="{ 'is-active': c.id === selectedChecklist?.id }"
          :style="{ '--cl-accent': c.color }"
          @click="selectedId = c.id"
        >
          <span
            class="cl-card-icon"
            :style="{ background: `color-mix(in srgb, ${c.color} 15%, transparent)`, color: c.color }"
          >
            <iconify-icon :icon="c.icon" width="22" height="22" aria-hidden="true"></iconify-icon>
          </span>
          <span class="cl-card-meta">
            <span class="cl-card-name">{{ c.name }}</span>
            <span class="cl-card-count">
              {{ progressFor(c.id).done }} of {{ progressFor(c.id).total }} done
            </span>
          </span>
          <ProgressRing :pct="progressFor(c.id).pct" :color="c.color" :size="42" />
        </button>
      </div>

      <!-- Detail -->
      <div v-if="selectedChecklist" class="cl-detail">
        <div class="cl-detail-head">
          <span
            class="cl-card-icon"
            :style="{
              background: `color-mix(in srgb, ${selectedChecklist.color} 15%, transparent)`,
              color: selectedChecklist.color,
            }"
          >
            <iconify-icon :icon="selectedChecklist.icon" width="22" height="22" aria-hidden="true"></iconify-icon>
          </span>
          <div class="cl-detail-meta">
            <h3 class="cl-detail-name">{{ selectedChecklist.name }}</h3>
            <p class="cl-detail-count">
              {{ selectedProgress.done }} of {{ selectedProgress.total }} done
            </p>
          </div>
          <span class="cl-detail-pct" :style="{ color: selectedChecklist.color }">
            {{ selectedProgress.pct }}%
          </span>
          <Button
            text
            rounded
            size="small"
            aria-label="Edit checklist"
            @click="openEdit(selectedChecklist)"
          >
            <iconify-icon icon="mdi:pencil-outline" width="18" height="18"></iconify-icon>
          </Button>
          <Button
            text
            rounded
            severity="danger"
            size="small"
            aria-label="Delete checklist"
            @click="confirmDeleteChecklist(selectedChecklist)"
          >
            <iconify-icon icon="mdi:trash-can-outline" width="18" height="18"></iconify-icon>
          </Button>
        </div>

        <div class="cl-progress-track">
          <div
            class="cl-progress-fill"
            :style="{ width: `${selectedProgress.pct}%`, background: selectedChecklist.color }"
          ></div>
        </div>

        <ul class="cl-tasks">
          <li v-for="t in selectedTasks" :key="t.id" class="cl-task">
            <button
              type="button"
              class="cl-check"
              :class="{ 'is-done': t.done }"
              :style="{ '--cl-accent': selectedChecklist.color }"
              :aria-pressed="t.done"
              :aria-label="t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`"
              @click="toggleTask(t.id)"
            >
              <iconify-icon icon="mdi:check-bold" width="13" height="13" aria-hidden="true"></iconify-icon>
            </button>
            <span
              class="cl-task-title"
              :class="{ 'is-done': t.done }"
              @click="toggleTask(t.id)"
            >
              {{ t.title }}
            </span>
            <button
              type="button"
              class="cl-task-del"
              aria-label="Delete task"
              @click="removeTask(t.id)"
            >
              <iconify-icon icon="mdi:close" width="16" height="16" aria-hidden="true"></iconify-icon>
            </button>
          </li>
          <li v-if="selectedTasks.length === 0" class="cl-task-empty">
            No tasks yet — add one below.
          </li>
        </ul>

        <form class="cl-add" @submit.prevent="submitNewTask">
          <InputText v-model="newTaskTitle" placeholder="Add a task…" class="flex-1" />
          <Button type="submit" icon="pi pi-plus" :disabled="!newTaskTitle.trim()" aria-label="Add task" />
        </form>
      </div>
    </div>

    <Suspense>
      <ManageChecklist v-model:visible="showManage" v-model:record="manageRecord" @saved="onSaved" />
    </Suspense>
  </div>
</template>

<style scoped>
.cl-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.cl-eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-typo-muted);
}
.cl-title {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-typo-heading);
}
.cl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 0;
  color: var(--color-typo-muted);
}

.cl-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 768px) {
  .cl-layout {
    grid-template-columns: 300px 1fr;
    align-items: start;
  }
}

.cl-rail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.cl-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem;
  border-radius: 14px;
  border: 1.5px solid var(--color-surface-divider);
  background: var(--color-surface-card);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.cl-card.is-active {
  border-color: var(--cl-accent);
  box-shadow: 0 0 0 1px var(--cl-accent);
}
.cl-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  flex-shrink: 0;
}
.cl-card-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.cl-card-name {
  font-weight: 600;
  color: var(--color-typo-heading);
}
.cl-card-count {
  font-size: 0.8rem;
  color: var(--color-typo-muted);
}

.cl-detail {
  background: var(--color-surface-card);
  border: 1px solid var(--color-surface-divider);
  border-radius: 16px;
  padding: 1rem 1.1rem 1.1rem;
}
.cl-detail-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.cl-detail-meta {
  flex: 1;
  min-width: 0;
}
.cl-detail-name {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-typo-heading);
}
.cl-detail-count {
  font-size: 0.8rem;
  color: var(--color-typo-muted);
}
.cl-detail-pct {
  font-weight: 700;
}
.cl-progress-track {
  height: 8px;
  border-radius: 99px;
  background: var(--color-surface-divider);
  overflow: hidden;
  margin: 0.9rem 0 1.1rem;
}
.cl-progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.35s ease;
}

.cl-tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.cl-task {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.7rem;
  border-radius: 11px;
  background: var(--color-surface-card-2);
}
.cl-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border-radius: 7px;
  border: 2px solid var(--color-typo-muted);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.cl-check iconify-icon {
  opacity: 0;
  color: #ffffff;
  transition: opacity 0.15s ease;
}
.cl-check.is-done {
  background: var(--cl-accent);
  border-color: var(--cl-accent);
}
.cl-check.is-done iconify-icon {
  opacity: 1;
}
.cl-task-title {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  color: var(--color-typo-heading);
}
.cl-task-title.is-done {
  text-decoration: line-through;
  color: var(--color-typo-muted);
}
.cl-task-del {
  display: inline-flex;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  color: var(--color-typo-muted);
}
.cl-task-del:hover {
  color: var(--color-status-error);
}
.cl-task-empty {
  padding: 0.5rem 0.2rem;
  font-size: 0.85rem;
  color: var(--color-typo-muted);
}

.cl-add {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.9rem;
}
</style>

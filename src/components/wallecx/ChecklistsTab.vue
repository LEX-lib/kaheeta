<script setup lang="ts">
import { ref, computed, watch, onMounted, defineAsyncComponent } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useChecklists } from "@/lib/wallecx/useChecklists";
import type { Checklist } from "@/types/wallecx/checklists/types";
import ProgressRing from "./ProgressRing.vue";
import WallecxSkeleton from "./WallecxSkeleton.vue";
import { useToast } from "@/composables/useToast";
import { useIsMobile } from "@/composables/useIsMobile";

const ManageChecklist = defineAsyncComponent(() => import("./ManageChecklist.vue"));

const props = defineProps<{ pendingAction?: string | null }>();

const {
  checklists,
  isLoading,
  load,
  tasksFor,
  progressFor,
  removeChecklist,
  addTask,
  toggleTask,
  removeTask,
} = useChecklists();

const toast = useToast();
const confirm = useConfirm();

// Mobile (< md 768px) uses a drill-down: the list and the detail are shown one
// at a time. Desktop shows both panes side by side, so detailOpen is ignored.
const isNarrow = useIsMobile(767);
const detailOpen = ref(false);

function onSelectChecklist(id: string): void {
  selectedId.value = id;
  if (isNarrow.value) {
    detailOpen.value = true;
  }
}
function closeDetail(): void {
  detailOpen.value = false;
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    toast.error("Failed to load checklists.");
    console.error("ChecklistsTab: load failed", e);
  }
});

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
  if (isNarrow.value) {
    detailOpen.value = true; // jump into the new/edited checklist on mobile
  }
}

function confirmDeleteChecklist(c: Checklist): void {
  confirm.require({
    header: "Delete checklist?",
    message: `"${c.name}" and its tasks will be removed.`,
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Keep", severity: "secondary", outlined: true },
    acceptProps: { label: "Delete", severity: "danger" },
    accept: async () => {
      try {
        await removeChecklist(c.id);
        detailOpen.value = false; // back to the list on mobile
        toast.success("Checklist deleted.");
      } catch (e) {
        toast.error("Couldn't delete the checklist.");
        console.error("ChecklistsTab: removeChecklist failed", e);
      }
    },
  });
}

// --- quick-add task ---
const newTaskTitle = ref("");
async function submitNewTask(): Promise<void> {
  const title = newTaskTitle.value.trim();
  if (!title || !selectedChecklist.value) {
    return;
  }
  newTaskTitle.value = "";
  try {
    await addTask(selectedChecklist.value.id, title);
  } catch (e) {
    newTaskTitle.value = title; // restore on failure
    toast.error("Couldn't add the task.");
    console.error("ChecklistsTab: addTask failed", e);
  }
}

async function onToggleTask(id: string): Promise<void> {
  try {
    await toggleTask(id);
  } catch (e) {
    toast.error("Couldn't update the task.");
    console.error("ChecklistsTab: toggleTask failed", e);
  }
}

async function onDeleteTask(id: string): Promise<void> {
  try {
    await removeTask(id);
  } catch (e) {
    toast.error("Couldn't delete the task.");
    console.error("ChecklistsTab: removeTask failed", e);
  }
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

    <!-- Loading -->
    <WallecxSkeleton v-if="isLoading" variant="checklist" :count="3" />

    <!-- Empty state -->
    <div v-else-if="checklists.length === 0" class="cl-empty">
      <iconify-icon
        icon="mdi:checkbox-marked-outline"
        width="48"
        height="48"
        style="color: var(--color-brand-accent)"
      ></iconify-icon>
      <p>No checklists yet.</p>
      <Button label="Create your first checklist" icon="pi pi-plus" size="small" @click="openCreate" />
    </div>

    <!-- Two-pane on desktop; mobile drills down (list OR detail, never both). -->
    <div v-else class="cl-layout">
      <!-- Rail: always on desktop; on mobile only when the detail is closed. -->
      <div v-show="!isNarrow || !detailOpen" class="cl-rail">
        <button
          v-for="c in checklists"
          :key="c.id"
          type="button"
          class="cl-card"
          :class="{ 'is-active': !isNarrow && c.id === selectedChecklist?.id }"
          :style="{ '--cl-accent': c.color }"
          @click="onSelectChecklist(c.id)"
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

      <!-- Detail: always on desktop; on mobile only when opened (drill-down). -->
      <div
        v-if="selectedChecklist"
        v-show="!isNarrow || detailOpen"
        class="cl-detail"
      >
        <div class="cl-detail-head">
          <button
            v-if="isNarrow"
            type="button"
            class="cl-back"
            aria-label="Back to checklists"
            @click="closeDetail"
          >
            <iconify-icon icon="mdi:arrow-left" width="20" height="20" aria-hidden="true"></iconify-icon>
          </button>
          <span
            class="cl-card-icon"
            :style="{
              background: `color-mix(in srgb, ${selectedChecklist.color} 15%, transparent)`,
              color: selectedChecklist.color,
            }"
          >
            <iconify-icon :icon="selectedChecklist.icon" width="22" height="22" aria-hidden="true"></iconify-icon>
          </span>
          <h3 class="cl-detail-name">{{ selectedChecklist.name }}</h3>
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

        <div class="cl-detail-progress-meta">
          <span class="cl-detail-count">
            {{ selectedProgress.done }} of {{ selectedProgress.total }} done
          </span>
          <span class="cl-detail-pct" :style="{ color: selectedChecklist.color }">
            {{ selectedProgress.pct }}%
          </span>
        </div>

        <ProgressBar
          :value="selectedProgress.pct"
          :show-value="false"
          class="cl-progressbar"
          :style="{
            '--p-progressbar-value-background': selectedChecklist.color,
            '--p-progressbar-height': '8px',
            '--p-progressbar-border-radius': '99px',
          }"
        />

        <ul class="cl-tasks">
          <li v-for="t in selectedTasks" :key="t.id" class="cl-task">
            <Checkbox
              :model-value="t.done"
              binary
              :aria-label="t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`"
              :style="{
                '--p-checkbox-checked-background': selectedChecklist.color,
                '--p-checkbox-checked-border-color': selectedChecklist.color,
                '--p-checkbox-checked-hover-background': selectedChecklist.color,
                '--p-checkbox-checked-hover-border-color': selectedChecklist.color,
                '--p-checkbox-checked-focus-border-color': selectedChecklist.color,
              }"
              @update:model-value="onToggleTask(t.id)"
            />
            <span
              class="cl-task-title"
              :class="{ 'is-done': t.done }"
              @click="onToggleTask(t.id)"
            >
              {{ t.title }}
            </span>
            <button
              type="button"
              class="cl-task-del"
              aria-label="Delete task"
              @click="onDeleteTask(t.id)"
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
.cl-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  color: var(--color-typo-body);
  flex-shrink: 0;
}
.cl-back:hover {
  background: var(--color-surface-card-2);
}
.cl-detail-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-typo-heading);
}
.cl-detail-progress-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.85rem;
}
.cl-detail-count {
  font-size: 0.82rem;
  color: var(--color-typo-muted);
}
.cl-detail-pct {
  font-weight: 700;
  font-size: 0.95rem;
}
.cl-progressbar {
  margin: 0.45rem 0 1.1rem;
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

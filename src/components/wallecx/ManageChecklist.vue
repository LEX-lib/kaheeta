<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useToast } from "@/composables/useToast";
import { useChecklists } from "@/lib/wallecx/useChecklists";
import type { Checklist } from "@/types/wallecx/checklists/types";
import BaseMobileDialog from "./BaseMobileDialog.vue";

const toast = useToast();
const { addChecklist, updateChecklist } = useChecklists();

const visible = defineModel<boolean>("visible", { required: true, default: false });
const record = defineModel<Checklist | null>("record", { default: null });

const emit = defineEmits<{ saved: [checklist: Checklist] }>();

const ICON_OPTIONS = [
  "mdi:cart-outline",
  "mdi:run-fast",
  "mdi:briefcase-outline",
  "mdi:home-outline",
  "mdi:heart-outline",
  "mdi:star-outline",
  "mdi:airplane",
  "mdi:school-outline",
  "mdi:dumbbell",
  "mdi:food-outline",
  "mdi:gift-outline",
  "mdi:checkbox-marked-outline",
] as const;
const COLOR_OPTIONS = [
  "#e89820",
  "#378add",
  "#7c5cd6",
  "#1a7c45",
  "#c0392b",
  "#0a6bba",
  "#d97706",
  "#5b6b80",
] as const;

const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null);
const isSaving = ref(false);

const name = ref("");
const nameError = ref("");
const selectedIcon = ref<string>(ICON_OPTIONS[0]);
const selectedColor = ref<string>(COLOR_OPTIONS[0]);

const isEditMode = computed(() => record.value !== null);
const dialogTitle = computed(() => (isEditMode.value ? "Edit checklist" : "New checklist"));

interface Snapshot {
  name: string;
  icon: string;
  color: string;
}
const snapshot = ref<Snapshot | null>(null);

watch(
  () => [visible.value, record.value] as const,
  ([isVisible, rec]) => {
    if (!isVisible) {
      isSaving.value = false;
      return;
    }
    name.value = rec?.name ?? "";
    selectedIcon.value = rec?.icon ?? ICON_OPTIONS[0];
    selectedColor.value = rec?.color ?? COLOR_OPTIONS[0];
    nameError.value = "";
    snapshot.value = {
      name: name.value,
      icon: selectedIcon.value,
      color: selectedColor.value,
    };
  },
  { immediate: true },
);

const isDirty = computed<boolean>(() => {
  if (!snapshot.value) {
    return false;
  }
  return (
    name.value !== snapshot.value.name ||
    selectedIcon.value !== snapshot.value.icon ||
    selectedColor.value !== snapshot.value.color
  );
});

function onCancel(): void {
  baseDialogRef.value?.closeWithoutGuard();
}

async function onSubmit(): Promise<void> {
  const trimmed = name.value.trim();
  if (trimmed.length < 1) {
    nameError.value = "Name is required.";
    return;
  }
  if (trimmed.length > 60) {
    nameError.value = "Keep it under 60 characters.";
    return;
  }
  nameError.value = "";
  isSaving.value = true;
  try {
    let saved: Checklist;
    if (isEditMode.value && record.value) {
      await updateChecklist(record.value.id, {
        name: trimmed,
        icon: selectedIcon.value,
        color: selectedColor.value,
      });
      saved = {
        ...record.value,
        name: trimmed,
        icon: selectedIcon.value,
        color: selectedColor.value,
      };
    } else {
      saved = await addChecklist({
        name: trimmed,
        icon: selectedIcon.value,
        color: selectedColor.value,
      });
    }
    emit("saved", saved);
    toast.success(isEditMode.value ? "Checklist updated." : "Checklist created.");
    baseDialogRef.value?.closeWithoutGuard();
  } catch (e) {
    toast.error("Failed to save. Please try again.");
    console.error("ManageChecklist: save failed", e);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <BaseMobileDialog
    ref="baseDialogRef"
    v-model:visible="visible"
    :title="dialogTitle"
    :is-dirty="isDirty"
    :is-saving="isSaving"
  >
    <div class="space-y-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Name *</label>
        <InputText
          v-model="name"
          fluid
          placeholder="e.g., Groceries, Errands"
          autocomplete="off"
          enterkeyhint="done"
          @keyup.enter="onSubmit"
        />
        <Message v-if="nameError" severity="error" size="small" variant="simple">
          {{ nameError }}
        </Message>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm" style="color: var(--color-typo-heading)">Icon</label>
        <div class="cl-icon-grid">
          <button
            v-for="ic in ICON_OPTIONS"
            :key="ic"
            type="button"
            class="cl-icon-opt"
            :class="{ 'is-sel': ic === selectedIcon }"
            :style="{ '--cl-accent': selectedColor }"
            :aria-label="ic"
            :aria-pressed="ic === selectedIcon"
            @click="selectedIcon = ic"
          >
            <iconify-icon :icon="ic" width="20" height="20" aria-hidden="true"></iconify-icon>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm" style="color: var(--color-typo-heading)">Color</label>
        <div class="cl-color-grid">
          <button
            v-for="col in COLOR_OPTIONS"
            :key="col"
            type="button"
            class="cl-color-opt"
            :class="{ 'is-sel': col === selectedColor }"
            :style="{ background: col }"
            :aria-label="col"
            :aria-pressed="col === selectedColor"
            @click="selectedColor = col"
          ></button>
        </div>
      </div>

      <div class="cl-preview">
        <span
          class="cl-preview-icon"
          :style="{
            background: `color-mix(in srgb, ${selectedColor} 15%, transparent)`,
            color: selectedColor,
          }"
        >
          <iconify-icon :icon="selectedIcon" width="22" height="22" aria-hidden="true"></iconify-icon>
        </span>
        <span class="cl-preview-name">{{ name.trim() || "Checklist name" }}</span>
      </div>
    </div>

    <template #actions>
      <div class="flex gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          fluid
          :disabled="isSaving"
          @click="onCancel"
        />
        <Button
          type="button"
          :label="isEditMode ? 'Save Changes' : 'Create'"
          fluid
          :loading="isSaving"
          :disabled="isSaving"
          @click="onSubmit"
        />
      </div>
    </template>
  </BaseMobileDialog>
</template>

<style scoped>
.cl-icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}
.cl-icon-opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  min-height: 44px;
  border-radius: 10px;
  border: 1.5px solid var(--color-surface-divider);
  background: var(--color-surface-card);
  color: var(--color-typo-body);
  cursor: pointer;
}
.cl-icon-opt.is-sel {
  border-color: var(--cl-accent);
  color: var(--cl-accent);
  background: color-mix(in srgb, var(--cl-accent) 12%, transparent);
}
.cl-color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.cl-color-opt {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
}
.cl-color-opt.is-sel {
  outline: 2px solid var(--color-typo-heading);
  outline-offset: 2px;
}
.cl-preview {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem;
  border-radius: 12px;
  background: var(--color-surface-card-2);
}
.cl-preview-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  flex-shrink: 0;
}
.cl-preview-name {
  font-weight: 600;
  color: var(--color-typo-heading);
}
</style>

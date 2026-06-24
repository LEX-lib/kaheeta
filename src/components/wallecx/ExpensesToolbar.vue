<script setup lang="ts">
import { ref, computed } from "vue";
import { useIsMobile } from "@/composables/useIsMobile";

const props = defineProps<{
  searchQuery: string;
  sortMode: string;
  sortOptions: { value: string; label: string }[];
  selectedCategories: string[];
  categoryOptions: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
}>();

const emit = defineEmits<{
  "update:searchQuery": [value: string];
  "update:sortMode": [value: string];
  "update:selectedCategories": [value: string[]];
  "update:dateFrom": [value: Date | null];
  "update:dateTo": [value: Date | null];
}>();

// On mobile the sort/category/date filters collapse behind a toggle so they
// don't eat half the screen; search stays visible. Desktop shows everything.
const isMobile = useIsMobile();
const showFilters = ref(false);

const activeFilterCount = computed(
  () =>
    (props.selectedCategories.length > 0 ? 1 : 0) +
    (props.dateFrom ? 1 : 0) +
    (props.dateTo ? 1 : 0),
);
</script>

<template>
  <div class="flex flex-col gap-2 mb-4">
    <!-- Row 1: Search + (desktop) Sort / (mobile) Filters toggle -->
    <div class="flex items-center gap-2">
      <IconField class="flex-1">
        <InputIcon class="pi pi-search" />
        <InputText
          :value="searchQuery"
          placeholder="Search by description…"
          class="w-full"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
        <InputIcon
          v-if="searchQuery"
          class="pi pi-times cursor-pointer"
          role="button"
          tabindex="0"
          aria-label="Clear search"
          @click="emit('update:searchQuery', '')"
          @keydown.enter="emit('update:searchQuery', '')"
          @keydown.space.prevent="emit('update:searchQuery', '')"
        />
      </IconField>

      <!-- Desktop: sort inline -->
      <Select
        v-if="!isMobile"
        :model-value="sortMode"
        :options="sortOptions"
        option-label="label"
        option-value="value"
        class="w-36 min-h-[44px]"
        @update:model-value="emit('update:sortMode', $event)"
      />

      <!-- Mobile: a single Filters toggle (badge shows active filter count) -->
      <Button
        v-else
        type="button"
        icon="pi pi-sliders-h"
        severity="secondary"
        class="min-h-[44px] shrink-0"
        :badge="activeFilterCount ? String(activeFilterCount) : undefined"
        :aria-label="showFilters ? 'Hide filters' : 'Show filters'"
        aria-haspopup="true"
        :aria-expanded="showFilters"
        @click="showFilters = !showFilters"
      />
    </div>

    <!-- Filters: desktop always; mobile only when toggled -->
    <div
      v-show="!isMobile || showFilters"
      class="flex items-center gap-2 flex-wrap"
    >
      <!-- Mobile: sort lives here (collapsed with the rest) -->
      <Select
        v-if="isMobile"
        :model-value="sortMode"
        :options="sortOptions"
        option-label="label"
        option-value="value"
        class="flex-1 min-w-0 min-h-[44px]"
        @update:model-value="emit('update:sortMode', $event)"
      />
      <MultiSelect
        :model-value="selectedCategories"
        :options="categoryOptions"
        placeholder="All categories"
        class="flex-1 min-w-0 min-h-[44px]"
        display="chip"
        @update:model-value="emit('update:selectedCategories', $event)"
      />
      <DatePicker
        :model-value="dateFrom"
        placeholder="From date"
        dateFormat="dd M yy"
        class="w-32 min-h-[44px]"
        @update:model-value="emit('update:dateFrom', ($event instanceof Date ? $event : null))"
      />
      <DatePicker
        :model-value="dateTo"
        placeholder="To date"
        dateFormat="dd M yy"
        class="w-32 min-h-[44px]"
        @update:model-value="emit('update:dateTo', ($event instanceof Date ? $event : null))"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.my-app-dark .p-inputtext) {
  background-color: var(--color-surface-card);
  color: var(--color-typo-body);
  border-color: var(--color-surface-divider);
}
:deep(.my-app-dark .p-select),
:deep(.my-app-dark .p-multiselect),
:deep(.my-app-dark .p-datepicker) {
  background-color: var(--color-surface-card);
  color: var(--color-typo-body);
  border-color: var(--color-surface-divider);
}
</style>

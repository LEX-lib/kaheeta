<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { pb } from '@/lib/pocketbase'
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import { useIsMobile } from '@/composables/useIsMobile'
import type { Group } from '@/types/wallecx/splits/types'
import { createGroup, joinGroup } from '@/lib/pocketbase/splitsApi'
import BaseMobileDialog from './BaseMobileDialog.vue'
import WallecxSkeleton from './WallecxSkeleton.vue'
import GroupDetail from './GroupDetail.vue'

const props = defineProps<{ pendingAction?: string | null }>()

const toast = useToast()

// Mobile (< md 768px) drills down: the rail and the detail are shown one at a
// time. Desktop (>= 768px) shows both panes side by side, like ChecklistsTab.
const isNarrow = useIsMobile(767)
const detailOpen = ref(false)

const currentUserId = computed(() => pb.authStore.record?.id ?? '')

const groups = ref<Group[]>([])
const isLoading = ref(false)
const selectedId = ref<string | null>(null)

const selectedGroup = computed<Group | null>(
  () => groups.value.find((g) => g.id === selectedId.value) ?? groups.value[0] ?? null,
)

// --- Create group dialog ---
const showCreate = ref(false)
const createName = ref('')
const createCurrency = ref('USD')
const isCreating = ref(false)
const createDirty = computed(() => createName.value.trim() !== '' || createCurrency.value !== 'USD')
const createDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)

// --- Join group dialog ---
const showJoin = ref(false)
const joinCode = ref('')
const isJoining = ref(false)
const joinDirty = computed(() => joinCode.value.trim() !== '')
const joinDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)

async function loadGroups(): Promise<void> {
  isLoading.value = true
  try {
    groups.value = await instrumentedGetFullList<Group>('kaheeta_groups', {
      sort: '-created',
      requestKey: 'groups-getFullList',
    })
  } catch (e: unknown) {
    toast.error('Failed to load groups.')
    console.error('GroupsTab: loadGroups failed', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadGroups)

// Keep a valid selection when the active group disappears from the list.
watch(
  groups,
  (list) => {
    if (!list.some((g) => g.id === selectedId.value)) {
      selectedId.value = list[0]?.id ?? null
    }
  },
  { deep: true },
)

// pendingAction parity with the other tabs (immediate:true catches values set pre-registration)
watch(
  () => props.pendingAction,
  (action) => {
    if (action === 'create-group') {
      openCreate()
    }
  },
  { immediate: true },
)

function openCreate(): void {
  createName.value = ''
  createCurrency.value = 'USD'
  showCreate.value = true
}

function openJoin(): void {
  joinCode.value = ''
  showJoin.value = true
}

async function submitCreate(): Promise<void> {
  const name = createName.value.trim()
  if (!name) {
    toast.error('Group name is required.')
    return
  }
  isCreating.value = true
  try {
    const created = await createGroup({
      name,
      defaultCurrency: createCurrency.value.trim() || 'USD',
    })
    createDialogRef.value?.closeWithoutGuard()
    await loadGroups()
    selectedId.value = created.id
    if (isNarrow.value) detailOpen.value = true
    toast.success('Group created.')
  } catch (e: unknown) {
    toast.error('Failed to create group. Please try again.')
    console.error('GroupsTab: createGroup failed', e)
  } finally {
    isCreating.value = false
  }
}

async function submitJoin(): Promise<void> {
  const code = joinCode.value.trim()
  if (!code) {
    toast.error('Enter a join code.')
    return
  }
  isJoining.value = true
  try {
    const joined = await joinGroup(code)
    joinDialogRef.value?.closeWithoutGuard()
    await loadGroups()
    selectedId.value = joined.id
    if (isNarrow.value) detailOpen.value = true
    toast.success(`Joined "${joined.name}".`)
  } catch (e: unknown) {
    toast.error('Could not join — check the code and try again.')
    console.error('GroupsTab: joinGroup failed', e)
  } finally {
    isJoining.value = false
  }
}

function openGroup(group: Group): void {
  selectedId.value = group.id
  if (isNarrow.value) {
    detailOpen.value = true
  }
}

function closeDetail(): void {
  detailOpen.value = false
}

// GroupDetail emits these after a successful leave/delete; reload the rail and
// leave the detail (mobile) or select the next group (desktop).
async function onGroupGone(): Promise<void> {
  selectedId.value = null
  detailOpen.value = false
  await loadGroups()
}

// GroupDetail persisted the group's simplify flag; update our cached object
// (the same reference the rail shows) so reopening reflects the new state.
function onSimplifyChanged(value: boolean): void {
  const group = groups.value.find((g) => g.id === selectedId.value)
  if (group) {
    group.simplify_debts = value
  }
}
</script>

<template>
  <div class="groups-tab">
    <div class="flex gap-2 mb-4 sm:justify-end">
      <Button
        class="flex-1 sm:flex-none"
        label="Join group"
        icon="pi pi-sign-in"
        severity="secondary"
        size="small"
        @click="openJoin"
      />
      <Button
        class="flex-1 sm:flex-none"
        label="New group"
        icon="pi pi-plus"
        size="small"
        @click="openCreate"
      />
    </div>

    <WallecxSkeleton v-if="isLoading" variant="membership-card" :count="3" />

    <!-- Empty state -->
    <div v-else-if="groups.length === 0" class="flex flex-col items-center py-12 gap-3">
      <iconify-icon
        icon="mdi:account-group"
        width="48"
        height="48"
        style="color: var(--color-brand-primary)"
        aria-hidden="true"
      ></iconify-icon>
      <p class="text-sm" style="color: var(--color-typo-heading)">
        No groups yet. Create one or join with a code.
      </p>
      <Button label="Create your first group" icon="pi pi-plus" size="small" @click="openCreate" />
    </div>

    <!-- Two-pane on desktop; mobile drills down (rail OR detail, never both). -->
    <div v-else class="groups-layout">
      <Transition name="gr-pane-l" :css="isNarrow">
        <div v-show="!isNarrow || !detailOpen" class="groups-rail">
          <button
            v-for="group in groups"
            :key="group.id"
            type="button"
            class="group-card"
            :class="{ 'is-active': !isNarrow && group.id === selectedGroup?.id }"
            @click="openGroup(group)"
          >
            <span class="group-card-icon">
              <iconify-icon
                icon="mdi:account-group"
                width="22"
                height="22"
                aria-hidden="true"
              ></iconify-icon>
            </span>
            <span class="group-card-meta">
              <span class="group-card-name">{{ group.name }}</span>
              <span class="group-card-sub">
                {{ group.default_currency }}
                <Tag
                  v-if="group.created_by === currentUserId"
                  value="Owner"
                  severity="secondary"
                  class="group-owner-tag"
                />
              </span>
            </span>
          </button>
        </div>
      </Transition>

      <Transition name="gr-pane-r" :css="isNarrow">
        <div v-if="selectedGroup" v-show="!isNarrow || detailOpen" class="groups-detail">
          <GroupDetail
            :key="selectedGroup.id"
            :group="selectedGroup"
            :current-user-id="currentUserId"
            :show-back="isNarrow"
            @back="closeDetail"
            @left="onGroupGone"
            @deleted="onGroupGone"
            @simplify-changed="onSimplifyChanged"
          />
        </div>
      </Transition>
    </div>

    <!-- Create group form -->
    <BaseMobileDialog
      ref="createDialogRef"
      v-model:visible="showCreate"
      title="New group"
      :is-dirty="createDirty"
      :is-saving="isCreating"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="group-name">Group name</label>
          <InputText id="group-name" v-model="createName" placeholder="e.g. Bali Trip" autofocus />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="group-currency">Default currency</label>
          <InputText id="group-currency" v-model="createCurrency" placeholder="USD" />
        </div>
      </div>
      <template #actions>
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          :disabled="isCreating"
          @click="createDialogRef?.closeWithoutGuard()"
        />
        <Button label="Create" icon="pi pi-check" :loading="isCreating" @click="submitCreate" />
      </template>
    </BaseMobileDialog>

    <!-- Join group form -->
    <BaseMobileDialog
      ref="joinDialogRef"
      v-model:visible="showJoin"
      title="Join a group"
      :is-dirty="joinDirty"
      :is-saving="isJoining"
    >
      <div class="flex flex-col gap-1 pt-2">
        <label class="text-sm font-medium" for="join-code">Join code</label>
        <InputText id="join-code" v-model="joinCode" placeholder="Paste the group's code" autofocus />
        <small class="opacity-70">Ask a group member to share their join code with you.</small>
      </div>
      <template #actions>
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          :disabled="isJoining"
          @click="joinDialogRef?.closeWithoutGuard()"
        />
        <Button label="Join" icon="pi pi-sign-in" :loading="isJoining" @click="submitJoin" />
      </template>
    </BaseMobileDialog>
  </div>
</template>

<style scoped>
.groups-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  position: relative; /* anchor for the sliding panes during the mobile transition */
  overflow-x: clip; /* clip the horizontal slide so it never causes a scrollbar */
}
@media (min-width: 768px) {
  .groups-layout {
    grid-template-columns: 280px 1fr;
    align-items: start;
  }
}
@media (min-width: 1024px) {
  .groups-layout {
    grid-template-columns: 320px 1fr;
  }
}

/* Mobile drill-down slide/fade (gated to mobile via :css="isNarrow"). */
.gr-pane-l-enter-active,
.gr-pane-l-leave-active,
.gr-pane-r-enter-active,
.gr-pane-r-leave-active {
  transition:
    transform 0.26s ease,
    opacity 0.26s ease;
}
.gr-pane-r-enter-from,
.gr-pane-r-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
.gr-pane-l-enter-from,
.gr-pane-l-leave-to {
  transform: translateX(-24px);
  opacity: 0;
}
.gr-pane-l-leave-active,
.gr-pane-r-leave-active {
  position: absolute;
  inset: 0;
}
@media (prefers-reduced-motion: reduce) {
  .gr-pane-l-enter-active,
  .gr-pane-l-leave-active,
  .gr-pane-r-enter-active,
  .gr-pane-r-leave-active {
    transition: none;
  }
}

.groups-rail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}
.group-card {
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
.group-card.is-active {
  border-color: var(--color-brand-accent);
  box-shadow: 0 0 0 1px var(--color-brand-accent);
}
.group-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--color-brand-primary) 14%, transparent);
  color: var(--color-brand-primary);
}
.group-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.group-card-name {
  font-weight: 600;
  color: var(--color-typo-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-card-sub {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-typo-muted);
}
.group-owner-tag {
  font-size: 0.65rem;
  padding: 0.05rem 0.4rem;
}

.groups-detail {
  min-width: 0;
}
</style>

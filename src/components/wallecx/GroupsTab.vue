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
import DragHandle from './DragHandle.vue'
import GroupDetail from './GroupDetail.vue'

const props = defineProps<{ pendingAction?: string | null }>()

const toast = useToast()
const isMobile = useIsMobile()

const currentUserId = computed(() => pb.authStore.record?.id ?? '')

const groups = ref<Group[]>([])
const isLoading = ref(false)

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

// --- Group detail drawer/dialog ---
const selectedGroup = ref<Group | null>(null)
const showDetail = ref(false)

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
    await createGroup({ name, defaultCurrency: createCurrency.value.trim() || 'USD' })
    createDialogRef.value?.closeWithoutGuard()
    await loadGroups()
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
    toast.success(`Joined "${joined.name}".`)
  } catch (e: unknown) {
    toast.error('Could not join — check the code and try again.')
    console.error('GroupsTab: joinGroup failed', e)
  } finally {
    isJoining.value = false
  }
}

function openGroup(group: Group): void {
  selectedGroup.value = group
  showDetail.value = true
}

// GroupDetail emits these after a successful leave/delete; drop the group from
// the list and close the detail view.
async function onGroupGone(): Promise<void> {
  showDetail.value = false
  await loadGroups()
}
</script>

<template>
  <div>
    <!-- Header: Join + Create -->
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
    <div
      v-else-if="groups.length === 0"
      class="flex flex-col items-center py-12 gap-3"
    >
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

    <!-- Group grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card
        v-for="group in groups"
        :key="group.id"
        class="cursor-pointer"
        @click="openGroup(group)"
      >
        <template #content>
          <div class="flex items-center gap-3">
            <iconify-icon
              icon="mdi:account-group"
              width="28"
              height="28"
              style="color: var(--color-brand-primary)"
              aria-hidden="true"
            ></iconify-icon>
            <div class="min-w-0">
              <p class="font-semibold truncate" style="color: var(--color-typo-heading)">
                {{ group.name }}
              </p>
              <p class="text-xs opacity-70">
                {{ group.default_currency }}
                <span v-if="group.created_by === currentUserId"> · Owner</span>
              </p>
            </div>
          </div>
        </template>
      </Card>
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

    <!-- Group detail: desktop Dialog -->
    <Dialog
      v-if="!isMobile"
      v-model:visible="showDetail"
      modal
      :header="selectedGroup?.name ?? 'Group'"
      :style="{ width: '40rem' }"
      :breakpoints="{ '960px': '75vw', '641px': '92vw' }"
      @hide="selectedGroup = null"
    >
      <GroupDetail
        v-if="selectedGroup"
        :key="selectedGroup.id"
        :group="selectedGroup"
        :current-user-id="currentUserId"
        @left="onGroupGone"
        @deleted="onGroupGone"
      />
    </Dialog>

    <!-- Group detail: mobile Drawer -->
    <Drawer v-else v-model:visible="showDetail" position="bottom" @hide="selectedGroup = null">
      <template #header>
        <div class="flex flex-col items-center w-full gap-1">
          <DragHandle />
          <span class="font-semibold">{{ selectedGroup?.name ?? 'Group' }}</span>
        </div>
      </template>
      <GroupDetail
        v-if="selectedGroup"
        :key="selectedGroup.id"
        :group="selectedGroup"
        :current-user-id="currentUserId"
        @left="onGroupGone"
        @deleted="onGroupGone"
      />
    </Drawer>
  </div>
</template>

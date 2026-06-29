<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { pb } from '@/lib/pocketbase'
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import { useConfirm } from 'primevue/useconfirm'   // explicit — NOT auto-resolved by PrimeVueResolver
import { useIsMobile } from '@/composables/useIsMobile'
import type { Group, GroupMember } from '@/types/wallecx/splits/types'
import {
  createGroup,
  joinGroup,
  leaveGroup,
  deleteGroup,
  addMemberByEmail,
} from '@/lib/pocketbase/splitsApi'
import BaseMobileDialog from './BaseMobileDialog.vue'
import WallecxSkeleton from './WallecxSkeleton.vue'
import DragHandle from './DragHandle.vue'

const props = defineProps<{ pendingAction?: string | null }>()

const toast = useToast()
const confirm = useConfirm()
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
const members = ref<GroupMember[]>([])
const membersLoading = ref(false)
const inviteEmail = ref('')
const isAddingMember = ref(false)

const isOwner = computed(
  () => !!selectedGroup.value && selectedGroup.value.created_by === currentUserId.value,
)

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

async function loadMembers(groupId: string): Promise<void> {
  membersLoading.value = true
  try {
    members.value = await instrumentedGetFullList<GroupMember>('kaheeta_group_members', {
      filter: pb.filter('group = {:g}', { g: groupId }),
      expand: 'user',
      sort: 'created',
      requestKey: 'group-members-getFullList',
    })
  } catch (e: unknown) {
    toast.error('Failed to load members.')
    console.error('GroupsTab: loadMembers failed', e)
  } finally {
    membersLoading.value = false
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

async function openGroup(group: Group): Promise<void> {
  selectedGroup.value = group
  inviteEmail.value = ''
  showDetail.value = true
  await loadMembers(group.id)
}

async function copyCode(group: Group): Promise<void> {
  try {
    await navigator.clipboard.writeText(group.public_id)
    toast.success('Join code copied.')
  } catch {
    toast.info(`Join code: ${group.public_id}`)
  }
}

async function submitAddMember(): Promise<void> {
  const group = selectedGroup.value
  const email = inviteEmail.value.trim()
  if (!group || !email) return
  isAddingMember.value = true
  try {
    await addMemberByEmail(group.id, email)
    inviteEmail.value = ''
    await loadMembers(group.id)
    toast.success('Member added.')
  } catch (e: unknown) {
    toast.error('Could not add member — they may not have a Kaheeta account.')
    console.error('GroupsTab: addMemberByEmail failed', e)
  } finally {
    isAddingMember.value = false
  }
}

function confirmLeave(group: Group): void {
  confirm.require({
    header: 'Leave group?',
    message: `Leave "${group.name}"? You'll lose access to its expenses.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Stay', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Leave', severity: 'danger' },
    accept: () => doLeave(group),
  })
}

async function doLeave(group: Group): Promise<void> {
  try {
    await leaveGroup(group.id)
    showDetail.value = false
    await loadGroups()
    toast.success('Left group.')
  } catch (e: unknown) {
    toast.error('Failed to leave. Please try again.')
    console.error('GroupsTab: leaveGroup failed', e)
  }
}

function confirmDelete(group: Group): void {
  confirm.require({
    header: 'Delete group?',
    message: `Delete "${group.name}"? This removes it for everyone and cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Keep', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: () => doDelete(group),
  })
}

async function doDelete(group: Group): Promise<void> {
  try {
    await deleteGroup(group.id)
    showDetail.value = false
    await loadGroups()
    toast.success('Group deleted.')
  } catch (e: unknown) {
    toast.error('Failed to delete. Please try again.')
    console.error('GroupsTab: deleteGroup failed', e)
  }
}

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
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
      <div v-if="selectedGroup" class="flex flex-col gap-4">
        <!-- Join code -->
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-xs opacity-70">Join code</p>
            <p class="font-mono truncate">{{ selectedGroup.public_id }}</p>
          </div>
          <Button
            label="Copy"
            icon="pi pi-copy"
            size="small"
            severity="secondary"
            @click="copyCode(selectedGroup)"
          />
        </div>

        <!-- Members -->
        <div>
          <p class="text-sm font-medium mb-2">Members</p>
          <div v-if="membersLoading" class="text-sm opacity-70">Loading…</div>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="m in members" :key="m.id" class="flex items-center gap-2">
              <iconify-icon icon="mdi:account-circle" width="22" height="22" aria-hidden="true"></iconify-icon>
              <span class="truncate">{{ memberLabel(m) }}</span>
              <span v-if="m.user === selectedGroup.created_by" class="text-xs opacity-60">· owner</span>
            </li>
          </ul>
        </div>

        <!-- Add member by email (owner only) -->
        <div v-if="isOwner" class="flex items-end gap-2">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-sm font-medium" for="invite-email">Add by email</label>
            <InputText id="invite-email" v-model="inviteEmail" placeholder="name@example.com" type="email" />
          </div>
          <Button
            label="Add"
            icon="pi pi-user-plus"
            :loading="isAddingMember"
            :disabled="!inviteEmail.trim()"
            @click="submitAddMember"
          />
        </div>

        <!-- Danger actions -->
        <div class="flex justify-end pt-2">
          <Button
            v-if="isOwner"
            label="Delete group"
            icon="pi pi-trash"
            severity="danger"
            outlined
            size="small"
            @click="confirmDelete(selectedGroup)"
          />
          <Button
            v-else
            label="Leave group"
            icon="pi pi-sign-out"
            severity="danger"
            outlined
            size="small"
            @click="confirmLeave(selectedGroup)"
          />
        </div>
      </div>
    </Dialog>

    <!-- Group detail: mobile Drawer -->
    <Drawer v-else v-model:visible="showDetail" position="bottom" @hide="selectedGroup = null">
      <template #header>
        <div class="flex flex-col items-center w-full gap-1">
          <DragHandle />
          <span class="font-semibold">{{ selectedGroup?.name ?? 'Group' }}</span>
        </div>
      </template>
      <div v-if="selectedGroup" class="flex flex-col gap-4">
        <!-- Join code -->
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-xs opacity-70">Join code</p>
            <p class="font-mono truncate">{{ selectedGroup.public_id }}</p>
          </div>
          <Button
            label="Copy"
            icon="pi pi-copy"
            size="small"
            severity="secondary"
            @click="copyCode(selectedGroup)"
          />
        </div>

        <!-- Members -->
        <div>
          <p class="text-sm font-medium mb-2">Members</p>
          <div v-if="membersLoading" class="text-sm opacity-70">Loading…</div>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="m in members" :key="m.id" class="flex items-center gap-2">
              <iconify-icon icon="mdi:account-circle" width="22" height="22" aria-hidden="true"></iconify-icon>
              <span class="truncate">{{ memberLabel(m) }}</span>
              <span v-if="m.user === selectedGroup.created_by" class="text-xs opacity-60">· owner</span>
            </li>
          </ul>
        </div>

        <!-- Add member by email (owner only) -->
        <div v-if="isOwner" class="flex items-end gap-2">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-sm font-medium" for="invite-email">Add by email</label>
            <InputText id="invite-email" v-model="inviteEmail" placeholder="name@example.com" type="email" />
          </div>
          <Button
            label="Add"
            icon="pi pi-user-plus"
            :loading="isAddingMember"
            :disabled="!inviteEmail.trim()"
            @click="submitAddMember"
          />
        </div>

        <!-- Danger actions -->
        <div class="flex justify-end pt-2">
          <Button
            v-if="isOwner"
            label="Delete group"
            icon="pi pi-trash"
            severity="danger"
            outlined
            size="small"
            @click="confirmDelete(selectedGroup)"
          />
          <Button
            v-else
            label="Leave group"
            icon="pi pi-sign-out"
            severity="danger"
            outlined
            size="small"
            @click="confirmLeave(selectedGroup)"
          />
        </div>
      </div>
    </Drawer>
  </div>
</template>

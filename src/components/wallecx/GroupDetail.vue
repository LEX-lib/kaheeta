<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { pb } from '@/lib/pocketbase'
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import { useToast } from '@/composables/useToast'
import { useIsMobile } from '@/composables/useIsMobile'
import { useConfirm } from 'primevue/useconfirm' // explicit — NOT auto-resolved by PrimeVueResolver
import { computeBalances } from '@/lib/wallecx/balances'
import { simplifyDebts } from '@/lib/wallecx/simplifyDebts'
import { formatCents } from '@/lib/wallecx/splitFormat'
import { buildGroupSharesCsv, groupSharesCsvFilename } from '@/lib/wallecx/csv'
import {
  leaveGroup,
  deleteGroup,
  addMemberByEmail,
  addMemberAsUser,
  getGroupMembers,
  getSuggestedMembers,
  deleteSplitExpense,
  setGroupSimplify,
} from '@/lib/pocketbase/splitsApi'
import type {
  Group,
  GroupMember,
  SplitExpense,
  SplitShare,
} from '@/types/wallecx/splits/types'
import type { SuggestedMember } from '@/lib/pocketbase/splitsApi'
import ManageSplitExpense from './ManageSplitExpense.vue'
import SplitExpenseRow from './SplitExpenseRow.vue'
import SettleUpDialog from './SettleUpDialog.vue'
import AttachmentPreview from './AttachmentPreview.vue'
import DragHandle from './DragHandle.vue'

const props = defineProps<{
  group: Group
  currentUserId: string
  /** Mobile drill-down: show the back button to the group rail. */
  showBack?: boolean
}>()

const emit = defineEmits<{
  left: []
  deleted: []
  back: []
  'simplify-changed': [value: boolean]
}>()

const toast = useToast()
const confirm = useConfirm()

const members = ref<GroupMember[]>([])
const membersLoading = ref(false)
const expenses = ref<SplitExpense[]>([])
const shares = ref<SplitShare[]>([])
const ledgerLoading = ref(false)

const inviteEmail = ref('')
const isAddingMember = ref(false)
const suggested = ref<SuggestedMember[]>([])
const suggestionsLoading = ref(false)
const addingUserId = ref('')
const showManage = ref(false)
const editingExpense = ref<SplitExpense | null>(null)
const manageToken = ref('')
const showSettle = ref(false)
const simplifyOn = ref(props.group.simplify_debts)
const isSavingSimplify = ref(false)
const isExporting = ref(false)
const isExportingCsv = ref(false)
const showMembers = ref(false)

// Receipt preview mirrors the Expenses tab: token required for protected files.
const isMobile = useIsMobile(767)
const showPreview = ref(false)
const previewRecord = ref<SplitExpense | null>(null)
const previewToken = ref('')

const isOwner = computed(() => props.group.created_by === props.currentUserId)

const headerMenuRef = ref<{ toggle: (e: Event) => void } | null>(null)
const headerMenuItems = computed(() => {
  const items: Array<Record<string, unknown>> = []
  if (!isMobile.value) {
    items.push({ label: 'Download JSON', icon: 'pi pi-download', command: exportJson })
  }
  items.push(
    isOwner.value
      ? {
          label: 'Delete group',
          icon: 'pi pi-trash',
          class: 'gd-menu-danger',
          command: confirmDeleteGroup,
        }
      : {
          label: 'Leave group',
          icon: 'pi pi-sign-out',
          class: 'gd-menu-danger',
          command: confirmLeave,
        },
  )
  return items
})

function toggleHeaderMenu(event: Event): void {
  headerMenuRef.value?.toggle(event)
}

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
}

function nameForUser(userId: string): string {
  const m = members.value.find((x) => x.user === userId)
  if (m) return memberLabel(m)
  return userId === props.currentUserId ? 'You' : 'Someone'
}

function addedByName(ex: SplitExpense): string {
  if (ex.added_by === props.currentUserId) return 'you'
  return nameForUser(ex.added_by)
}

const balances = computed(() =>
  simplifyOn.value
    ? simplifyDebts(expenses.value, shares.value, props.currentUserId)
    : computeBalances(expenses.value, shares.value, props.currentUserId),
)

// Net position per currency (positive = you lent, negative = you owe).
const netByCurrency = computed(() => {
  const net = new Map<string, number>()
  for (const b of balances.value) {
    net.set(b.currency, (net.get(b.currency) ?? 0) + b.amount)
  }
  return [...net.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .filter((n) => n.amount !== 0)
})

const groupedExpenses = computed(() => {
  const groups: Array<{ key: string; label: string; items: SplitExpense[] }> = []
  for (const ex of expenses.value) {
    const d = ex.expense_date ? dayjs(ex.expense_date) : null
    const valid = !!d && d.isValid()
    const key = valid ? d.format('YYYY-MM') : 'undated'
    const label = valid ? d.format('MMMM').toUpperCase() : 'UNDATED'
    let bucket = groups.find((g) => g.key === key)
    if (!bucket) {
      bucket = { key, label, items: [] }
      groups.push(bucket)
    }
    bucket.items.push(ex)
  }
  return groups
})

const shownAvatars = computed(() => members.value.slice(0, 5))
const extraMembers = computed(() => Math.max(0, members.value.length - shownAvatars.value.length))

const sharesForEditing = computed(() =>
  editingExpense.value ? sharesFor(editingExpense.value.id) : [],
)

// Shares belonging to one expense (the row renders its own breakdown).
function sharesFor(expenseId: string): SplitShare[] {
  return shares.value.filter((s) => s.expense === expenseId)
}

// Export the group's ledger as JSON (desktop only — reachable from the header
// menu). Mirrors ExpensesTab's "Download records". Uses the already-loaded
// expenses/shares/balances; no extra fetch.
function exportJson(): void {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const payload = {
      exported_at: new Date().toISOString(),
      group: {
        id: props.group.id,
        name: props.group.name,
        default_currency: props.group.default_currency,
        simplify_debts: simplifyOn.value,
      },
      members: members.value.map((m) => ({ user: m.user, name: nameForUser(m.user) })),
      balances: balances.value.map((b) => ({
        user: b.userId,
        name: nameForUser(b.userId),
        currency: b.currency,
        amount: b.amount, // signed cents: + they owe you, - you owe them
      })),
      expenses: expenses.value.map((ex) => ({
        id: ex.id,
        name: ex.name,
        amount: ex.amount, // integer minor units
        currency: ex.currency,
        split_type: ex.split_type,
        expense_date: ex.expense_date,
        notes: ex.notes ?? '',
        payment_mode: ex.payment_mode ?? '',
        receipt: ex.receipt ?? '',
        paid_by: nameForUser(ex.paid_by),
        shares: sharesFor(ex.id).map((s) => ({
          user: nameForUser(s.user),
          amount: s.amount,
        })),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const slug = props.group.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    anchor.download = `kaheeta-${slug}-${dayjs().format('YYYY-MM-DD')}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    toast.success('Group records exported.')
  } catch (e: unknown) {
    toast.error('Export failed. Please try again.')
    console.error('GroupDetail: exportJson failed', e)
  } finally {
    isExporting.value = false
  }
}

// CSV report: one row per (expense × member share) so any member can filter
// their own share in a spreadsheet. Available on every viewport.
function exportCsv(): void {
  if (isExportingCsv.value) return
  isExportingCsv.value = true
  try {
    const csv = buildGroupSharesCsv({
      groupName: props.group.name,
      expenses: expenses.value,
      shares: shares.value,
      currentUserId: props.currentUserId,
      nameForUser,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = groupSharesCsvFilename(props.group.name, dayjs().format('YYYY-MM-DD'))
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    toast.success('CSV report exported.')
  } catch (e: unknown) {
    toast.error('Export failed. Please try again.')
    console.error('GroupDetail: exportCsv failed', e)
  } finally {
    isExportingCsv.value = false
  }
}

async function onToggleSimplify(): Promise<void> {
  const next = simplifyOn.value
  isSavingSimplify.value = true
  try {
    await setGroupSimplify(props.group.id, next)
    // Let the parent update its cached Group so reopening reflects the new
    // state (GroupDetail re-reads props.group.simplify_debts on remount).
    emit('simplify-changed', next)
  } catch (e: unknown) {
    simplifyOn.value = !next // revert on failure
    toast.error('Could not change debt simplification.')
    console.error('GroupDetail: setGroupSimplify failed', e)
  } finally {
    isSavingSimplify.value = false
  }
}

async function loadMembers(): Promise<void> {
  membersLoading.value = true
  try {
    // Names come from a superuser route — the users view rule is self-only, so
    // expand: 'user' on the collection would only resolve the current user.
    const { members: rows } = await getGroupMembers(props.group.id)
    members.value = rows.map(
      (m): GroupMember => ({
        id: m.id,
        collectionId: 'kaheeta_group_members',
        collectionName: 'kaheeta_group_members',
        created: '',
        updated: '',
        group: props.group.id,
        user: m.user,
        expand: {
          user: {
            id: m.user,
            name: m.name || undefined,
            email: m.email || undefined,
            avatar: m.avatar || undefined,
          },
        },
      }),
    )
  } catch (e: unknown) {
    toast.error('Failed to load members.')
    console.error('GroupDetail: loadMembers failed', e)
  } finally {
    membersLoading.value = false
  }
}

// People the owner has already shared groups with — one tap to add. Non-critical:
// a failure just leaves the email form as the only way in.
async function loadSuggestions(): Promise<void> {
  if (!isOwner.value) {
    suggested.value = []
    return
  }
  suggestionsLoading.value = true
  try {
    const { contacts } = await getSuggestedMembers(props.group.id)
    suggested.value = contacts
  } catch (e: unknown) {
    suggested.value = []
    console.error('GroupDetail: loadSuggestions failed', e)
  } finally {
    suggestionsLoading.value = false
  }
}

async function loadLedger(): Promise<void> {
  ledgerLoading.value = true
  try {
    const [exp, shr] = await Promise.all([
      instrumentedGetFullList<SplitExpense>('kaheeta_split_expenses', {
        filter: pb.filter('group = {:g} && deleted_at = ""', { g: props.group.id }),
        sort: '-expense_date,-created',
        requestKey: 'split-expenses-getFullList',
      }),
      instrumentedGetFullList<SplitShare>('kaheeta_split_shares', {
        filter: pb.filter('expense.group = {:g} && expense.deleted_at = ""', {
          g: props.group.id,
        }),
        requestKey: 'split-shares-getFullList',
      }),
    ])
    expenses.value = exp
    shares.value = shr
  } catch (e: unknown) {
    toast.error('Failed to load expenses.')
    console.error('GroupDetail: loadLedger failed', e)
  } finally {
    ledgerLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadMembers(), loadLedger(), loadSuggestions()])
})

function openAddExpense(): void {
  editingExpense.value = null
  manageToken.value = ''
  showManage.value = true
}

async function openEditExpense(ex: SplitExpense): Promise<void> {
  // Edit mode with an existing receipt needs a file token to render the thumbnail.
  try {
    manageToken.value = await pb.files.getToken()
  } catch (e: unknown) {
    manageToken.value = ''
    toast.error('Receipt preview unavailable. Form will still save.')
    console.error('GroupDetail: getToken (manage) failed', e)
  }
  editingExpense.value = ex
  showManage.value = true
}

watch(showManage, (v) => {
  if (!v) manageToken.value = ''
})

async function openReceiptPreview(ex: SplitExpense): Promise<void> {
  try {
    previewToken.value = await pb.files.getToken()
  } catch (e: unknown) {
    toast.error('Failed to load receipt. Refresh to try again.')
    console.error('GroupDetail: getToken (preview) failed', e)
    return
  }
  previewRecord.value = ex
  showPreview.value = true
}

async function onExpenseSaved(): Promise<void> {
  await loadLedger()
}

function openSettle(): void {
  showSettle.value = true
}

async function onSettleSaved(): Promise<void> {
  showSettle.value = false
  await loadLedger()
}

function confirmDeleteExpense(ex: SplitExpense): void {
  confirm.require({
    header: ex.split_type === 'settlement' ? 'Delete settlement?' : 'Delete expense?',
    message: `Delete "${ex.name}"? Added by ${addedByName(ex)} — this changes everyone's balances.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Keep', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: () => doDeleteExpense(ex),
  })
}

async function doDeleteExpense(ex: SplitExpense): Promise<void> {
  try {
    await deleteSplitExpense(ex.id)
    toast.success(ex.split_type === 'settlement' ? 'Settlement deleted.' : 'Expense deleted.')
    await loadLedger()
  } catch (e: unknown) {
    toast.error('Failed to delete expense. Please try again.')
    console.error('GroupDetail: deleteSplitExpense failed', e)
  }
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.group.public_id)
    toast.success('Join code copied.')
  } catch {
    toast.info(`Join code: ${props.group.public_id}`)
  }
}

async function submitAddMember(): Promise<void> {
  const email = inviteEmail.value.trim()
  if (!email) return
  isAddingMember.value = true
  try {
    await addMemberByEmail(props.group.id, email)
    inviteEmail.value = ''
    await Promise.all([loadMembers(), loadSuggestions()])
    toast.success('Member added.')
  } catch (e: unknown) {
    toast.error('Could not add member — they may not have a Kaheeta account.')
    console.error('GroupDetail: addMemberByEmail failed', e)
  } finally {
    isAddingMember.value = false
  }
}

async function addSuggested(contact: SuggestedMember): Promise<void> {
  if (addingUserId.value) return
  addingUserId.value = contact.user
  try {
    await addMemberAsUser(props.group.id, contact.user)
    toast.success(`${contact.name || contact.email || 'Member'} added.`)
    await Promise.all([loadMembers(), loadSuggestions()])
  } catch (e: unknown) {
    toast.error('Could not add member. Please try again.')
    console.error('GroupDetail: addMemberAsUser failed', e)
  } finally {
    addingUserId.value = ''
  }
}

function confirmLeave(): void {
  confirm.require({
    header: 'Leave group?',
    message: `Leave "${props.group.name}"? You'll lose access to its expenses.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Stay', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Leave', severity: 'danger' },
    accept: doLeave,
  })
}

async function doLeave(): Promise<void> {
  try {
    await leaveGroup(props.group.id)
    toast.success('Left group.')
    emit('left')
  } catch (e: unknown) {
    toast.error('Failed to leave. Please try again.')
    console.error('GroupDetail: leaveGroup failed', e)
  }
}

function confirmDeleteGroup(): void {
  confirm.require({
    header: 'Delete group?',
    message: `Delete "${props.group.name}"? This removes it for everyone and cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Keep', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: doDeleteGroup,
  })
}

async function doDeleteGroup(): Promise<void> {
  try {
    await deleteGroup(props.group.id)
    toast.success('Group deleted.')
    emit('deleted')
  } catch (e: unknown) {
    toast.error('Failed to delete. Please try again.')
    console.error('GroupDetail: deleteGroup failed', e)
  }
}
</script>

<template>
  <div class="gd">
    <!-- Header -->
    <div class="gd-head">
      <Button
        v-if="showBack"
        text
        rounded
        size="small"
        aria-label="Back to groups"
        @click="emit('back')"
      >
        <iconify-icon icon="mdi:arrow-left" width="20" height="20" aria-hidden="true"></iconify-icon>
      </Button>
      <h3 class="gd-title">{{ group.name }}</h3>
      <Tag v-if="isOwner" value="Owner" severity="secondary" class="hidden sm:inline-flex" />
      <span class="gd-spacer" />
      <AvatarGroup v-if="!isMobile && members.length" class="gd-avatars">
        <Avatar
          v-for="m in shownAvatars"
          :key="m.id"
          :label="memberLabel(m).slice(0, 1).toUpperCase()"
          shape="circle"
        />
        <Avatar v-if="extraMembers > 0" :label="`+${extraMembers}`" shape="circle" />
      </AvatarGroup>
      <Button
        text
        rounded
        size="small"
        aria-label="Export CSV"
        :loading="isExportingCsv"
        :disabled="ledgerLoading"
        @click="exportCsv"
      >
        <iconify-icon icon="mdi:file-delimited-outline" width="20" height="20"></iconify-icon>
      </Button>
      <Button
        text
        rounded
        size="small"
        aria-label="Group actions"
        aria-haspopup="true"
        @click="toggleHeaderMenu"
      >
        <iconify-icon icon="mdi:dots-horizontal" width="20" height="20"></iconify-icon>
      </Button>
      <Menu ref="headerMenuRef" :model="headerMenuItems" popup />
    </div>

    <!-- Net position -->
    <div class="gd-net">
      <p v-if="ledgerLoading" class="gd-muted">Loading…</p>
      <template v-else-if="balances.length === 0">
        <Message severity="success" :closable="false">You're all settled up.</Message>
      </template>
      <template v-else>
        <div v-for="n in netByCurrency" :key="n.currency" class="gd-net-line">
          <span
            :style="{ color: n.amount > 0 ? 'var(--p-green-500)' : 'var(--p-amber-500)' }"
          >
            {{ n.amount > 0 ? 'You lent' : 'You owe' }}
            {{ formatCents(Math.abs(n.amount), n.currency) }}
          </span>
        </div>
        <ul class="gd-balances">
          <li
            v-for="b in balances"
            :key="`${b.userId}-${b.currency}`"
            class="gd-balance"
          >
            <span class="gd-balance-label">
              <template v-if="b.amount > 0">{{ nameForUser(b.userId) }} owes you</template>
              <template v-else>You owe {{ nameForUser(b.userId) }}</template>
            </span>
            <span
              class="gd-balance-amount tabular-nums"
              :style="{ color: b.amount > 0 ? 'var(--p-green-500)' : 'var(--p-amber-500)' }"
            >
              {{ formatCents(Math.abs(b.amount), b.currency) }}
            </span>
          </li>
        </ul>
      </template>
    </div>

    <!-- Actions -->
    <Toolbar class="gd-toolbar">
      <template #start>
        <div class="gd-actions">
          <Button label="Add expense" icon="pi pi-plus" size="small" @click="openAddExpense" />
          <Button
            label="Settle up"
            icon="pi pi-wallet"
            size="small"
            severity="secondary"
            :disabled="ledgerLoading || balances.length === 0"
            @click="openSettle"
          />
          <Button
            v-if="isOwner"
            label="Add members"
            icon="pi pi-user-plus"
            size="small"
            severity="secondary"
            @click="showMembers = true"
          />
        </div>
      </template>
      <template #end>
        <div class="gd-simplify">
          <ToggleSwitch
            v-if="isOwner"
            v-model="simplifyOn"
            :disabled="isSavingSimplify"
            aria-label="Simplify debts"
            @change="onToggleSimplify"
          />
          <span class="text-xs">Simplify</span>
          <Tag v-if="!isOwner && simplifyOn" value="simplified" severity="secondary" />
        </div>
      </template>
    </Toolbar>

    <!-- Expense feed, grouped by month -->
    <div class="gd-feed">
      <p v-if="ledgerLoading" class="gd-muted">Loading…</p>
      <p v-else-if="expenses.length === 0" class="gd-muted">
        No expenses yet. Add the first one.
      </p>
      <template v-else>
        <section v-for="bucket in groupedExpenses" :key="bucket.key" class="gd-month">
          <p class="gd-month-label">{{ bucket.label }}</p>
          <div class="gd-month-rows">
            <!-- Any viewer of this pane is a group member (the read rules only
                 expose a group to its members), so every row is editable. -->
            <SplitExpenseRow
              v-for="ex in bucket.items"
              :key="ex.id"
              :expense="ex"
              :shares="sharesFor(ex.id)"
              :members="members"
              :current-user-id="currentUserId"
              :can-edit="true"
              :can-delete="true"
              @edit="openEditExpense"
              @delete="confirmDeleteExpense"
              @preview="openReceiptPreview"
            />
          </div>
        </section>
      </template>
    </div>

    <!-- Members / join code / add people (modal, opened from Add members) -->
    <BaseMobileDialog
      v-model:visible="showMembers"
      title="Members"
      :is-dirty="false"
      :is-saving="false"
    >
      <div class="flex items-center gap-2">
        <Tag
          :value="`${members.length} member${members.length === 1 ? '' : 's'}`"
          severity="secondary"
        />
      </div>

      <div v-if="membersLoading" class="gd-muted">Loading…</div>
      <ul v-else class="gd-member-list">
        <li v-for="m in members" :key="m.id" class="gd-member">
          <Avatar :label="memberLabel(m).slice(0, 1).toUpperCase()" shape="circle" size="small" />
          <span class="gd-member-name">{{ memberLabel(m) }}</span>
          <Tag v-if="m.user === group.created_by" value="Owner" severity="secondary" />
        </li>
      </ul>

      <div class="gd-join">
        <label class="text-sm font-medium">Join code</label>
        <InputGroup>
          <InputText :model-value="group.public_id" readonly />
          <Button label="Copy" icon="pi pi-copy" severity="secondary" @click="copyCode" />
        </InputGroup>
      </div>

      <template v-if="isOwner">
        <div v-if="suggestionsLoading || suggested.length > 0" class="gd-frequent">
          <p class="text-sm font-medium">Frequent</p>
          <div v-if="suggestionsLoading" class="gd-muted">Loading…</div>
          <div v-else class="flex flex-wrap gap-2">
            <Button
              v-for="c in suggested"
              :key="c.user"
              :label="c.name || c.email"
              icon="pi pi-user-plus"
              size="small"
              severity="secondary"
              outlined
              rounded
              :loading="addingUserId === c.user"
              :disabled="!!addingUserId && addingUserId !== c.user"
              @click="addSuggested(c)"
            />
          </div>
        </div>

        <form class="gd-add-member" @submit.prevent="submitAddMember">
          <div class="gd-add-field">
            <label class="text-sm font-medium" for="invite-email">Add by email</label>
            <InputText
              id="invite-email"
              v-model="inviteEmail"
              placeholder="name@example.com"
              type="email"
            />
          </div>
          <Button
            type="submit"
            label="Add"
            icon="pi pi-user-plus"
            :loading="isAddingMember"
            :disabled="!inviteEmail.trim()"
          />
        </form>
      </template>

      <template #actions>
        <Button label="Done" fluid @click="showMembers = false" />
      </template>
    </BaseMobileDialog>

    <!-- Add / edit expense dialog -->
    <ManageSplitExpense
      v-model:visible="showManage"
      :group="group"
      :members="members"
      :expense="editingExpense"
      :expense-shares="sharesForEditing"
      :token="manageToken"
      @saved="onExpenseSaved"
    />

    <!-- Receipt preview: Dialog on desktop, bottom Drawer on mobile -->
    <Dialog
      v-if="!isMobile"
      v-model:visible="showPreview"
      modal
      header="Receipt"
      :style="{ width: '40rem' }"
      :breakpoints="{ '960px': '75vw', '641px': '92vw' }"
      @hide="previewRecord = null; previewToken = ''"
    >
      <AttachmentPreview
        v-if="previewRecord"
        :record="previewRecord"
        attachment-field="receipt"
        attachment-name="Receipt"
        :token="previewToken"
      />
    </Dialog>

    <Drawer
      v-else
      v-model:visible="showPreview"
      position="bottom"
      @hide="previewRecord = null; previewToken = ''"
    >
      <template #header>
        <div class="flex flex-col items-center w-full gap-1">
          <DragHandle />
          <span class="font-semibold">Receipt</span>
        </div>
      </template>
      <AttachmentPreview
        v-if="previewRecord"
        :record="previewRecord"
        attachment-field="receipt"
        attachment-name="Receipt"
        :token="previewToken"
      />
    </Drawer>

    <!-- Settle up dialog -->
    <SettleUpDialog
      v-model:visible="showSettle"
      :group="group"
      :members="members"
      :balances="balances"
      :current-user-id="currentUserId"
      @saved="onSettleSaved"
    />
  </div>
</template>

<style scoped>
.gd {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}
.gd-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.gd-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-typo-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.gd-spacer {
  flex: 1;
}
.gd-avatars :deep(.p-avatar) {
  width: 1.9rem;
  height: 1.9rem;
  font-size: 0.75rem;
}
.gd-net {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.gd-net-line {
  font-weight: 600;
}
.gd-balances {
  list-style: none;
  margin: 0.15rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.gd-balance {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.gd-balance-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-typo-body);
}
.gd-balance-amount {
  font-weight: 500;
}
.gd-muted {
  font-size: 0.85rem;
  color: var(--color-typo-muted);
}
.gd-toolbar {
  padding: 0.35rem 0.5rem;
}
.gd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.gd-simplify {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-typo-body);
}
.gd-simplify :deep(.p-toggleswitch) {
  transform: scale(0.9);
}
.gd-feed {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.gd-month-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-typo-muted);
  margin: 0 0 0.4rem;
}
.gd-month-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.gd-member-list {
  list-style: none;
  margin: 0 0 0.85rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.gd-member {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.9rem;
}
.gd-member-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-join,
.gd-frequent,
.gd-add-member {
  margin-top: 0.75rem;
}
.gd-join {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.gd-add-member {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}
.gd-add-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}
@media (max-width: 639px) {
  /* Add expense gets its own row; the two secondary actions share the next. */
  .gd-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    width: 100%;
  }
  .gd-actions > :first-child {
    grid-column: 1 / -1;
  }
  .gd-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>

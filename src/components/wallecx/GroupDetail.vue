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
  BalanceSummary,
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
}>()

const emit = defineEmits<{
  left: []
  deleted: []
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
const settleBalance = ref<BalanceSummary | null>(null)
const simplifyOn = ref(props.group.simplify_debts)
const isSavingSimplify = ref(false)
const isExporting = ref(false)
const isExportingCsv = ref(false)

// Receipt preview mirrors the Expenses tab: token required for protected files.
const isMobile = useIsMobile()
const showPreview = ref(false)
const previewRecord = ref<SplitExpense | null>(null)
const previewToken = ref('')

const isOwner = computed(() => props.group.created_by === props.currentUserId)

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
}

function nameForUser(userId: string): string {
  const m = members.value.find((x) => x.user === userId)
  if (m) return memberLabel(m)
  return userId === props.currentUserId ? 'You' : 'Someone'
}

const balances = computed(() =>
  simplifyOn.value
    ? simplifyDebts(expenses.value, shares.value, props.currentUserId)
    : computeBalances(expenses.value, shares.value, props.currentUserId),
)

const sharesForEditing = computed(() =>
  editingExpense.value
    ? sharesFor(editingExpense.value.id)
    : [],
)

// Shares belonging to one expense (the row renders its own breakdown).
function sharesFor(expenseId: string): SplitShare[] {
  return shares.value.filter((s) => s.expense === expenseId)
}

function addedByName(ex: SplitExpense): string {
  if (ex.added_by === props.currentUserId) return 'you'
  return nameForUser(ex.added_by)
}

// Export the group's ledger as JSON (desktop only — the trigger is hidden on
// mobile). Mirrors ExpensesTab's "Download records". Uses the already-loaded
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
        shares: shares.value
          .filter((s) => s.expense === ex.id)
          .map((s) => ({ user: nameForUser(s.user), amount: s.amount })),
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

// Every viewer of a group expense is a member of that group, so any member may
// edit any expense — including settlements (edited through a dedicated mode).
function canEditExpense(ex: SplitExpense): boolean {
  return !!ex.group
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

function openSettle(b: BalanceSummary): void {
  settleBalance.value = b
  showSettle.value = true
}

async function onSettleSaved(): Promise<void> {
  showSettle.value = false
  await loadLedger()
}

// Any member of the group may delete an expense or settlement.
function canDeleteExpense(ex: SplitExpense): boolean {
  return !!ex.group
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
    toast.success('Expense deleted.')
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

function confirmDelete(): void {
  confirm.require({
    header: 'Delete group?',
    message: `Delete "${props.group.name}"? This removes it for everyone and cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Keep', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: doDelete,
  })
}

async function doDelete(): Promise<void> {
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
  <div class="flex flex-col gap-4">
    <!-- Balances -->
    <div>
      <div class="flex items-center justify-between mb-2 gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <p class="text-sm font-medium">Balances</p>
          <label
            v-if="isOwner"
            class="flex items-center gap-1 text-xs opacity-80 cursor-pointer"
          >
            <ToggleSwitch
              v-model="simplifyOn"
              :disabled="isSavingSimplify"
              @change="onToggleSimplify"
            />
            Simplify
          </label>
          <span v-else-if="simplifyOn" class="text-xs opacity-60">· simplified</span>
        </div>
        <div class="flex items-center gap-2">
          <Button
            label="Export CSV"
            icon="pi pi-file-excel"
            size="small"
            severity="secondary"
            :loading="isExportingCsv"
            :disabled="ledgerLoading"
            @click="exportCsv"
          />
          <!-- JSON backup is desktop-only (hidden on mobile), mirroring Expenses. -->
          <span class="hidden sm:contents">
            <Button
              label="Download records"
              icon="pi pi-download"
              size="small"
              severity="secondary"
              :loading="isExporting"
              :disabled="ledgerLoading"
              @click="exportJson"
            />
          </span>
          <Button label="Add expense" icon="pi pi-plus" size="small" @click="openAddExpense" />
        </div>
      </div>
      <div v-if="ledgerLoading" class="text-sm opacity-70">Loading…</div>
      <p v-else-if="balances.length === 0" class="text-sm opacity-70">
        All settled up — no outstanding balances.
      </p>
      <ul v-else class="flex flex-col gap-1">
        <li
          v-for="b in balances"
          :key="`${b.userId}-${b.currency}`"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="truncate flex-1">
            <template v-if="b.amount > 0">{{ nameForUser(b.userId) }} owes you</template>
            <template v-else>You owe {{ nameForUser(b.userId) }}</template>
          </span>
          <span
            class="font-medium tabular-nums"
            :style="{ color: b.amount > 0 ? 'var(--p-green-500)' : 'var(--p-amber-500)' }"
          >
            {{ formatCents(Math.abs(b.amount), b.currency) }}
          </span>
          <Button
            label="Settle"
            size="small"
            severity="secondary"
            text
            @click="openSettle(b)"
          />
        </li>
      </ul>
    </div>

    <!-- Expense feed -->
    <div>
      <p class="text-sm font-medium mb-2">Expenses</p>
      <div v-if="ledgerLoading" class="text-sm opacity-70">Loading…</div>
      <p v-else-if="expenses.length === 0" class="text-sm opacity-70">
        No expenses yet. Add the first one.
      </p>
      <div v-else class="flex flex-col gap-2">
        <SplitExpenseRow
          v-for="ex in expenses"
          :key="ex.id"
          :expense="ex"
          :shares="sharesFor(ex.id)"
          :members="members"
          :current-user-id="currentUserId"
          :can-edit="canEditExpense(ex)"
          :can-delete="canDeleteExpense(ex)"
          @edit="openEditExpense"
          @delete="confirmDeleteExpense"
          @preview="openReceiptPreview"
        />
      </div>
    </div>

    <!-- Join code -->
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-xs opacity-70">Join code</p>
        <p class="font-mono truncate">{{ group.public_id }}</p>
      </div>
      <Button label="Copy" icon="pi pi-copy" size="small" severity="secondary" @click="copyCode" />
    </div>

    <!-- Members -->
    <div>
      <p class="text-sm font-medium mb-2">Members</p>
      <div v-if="membersLoading" class="text-sm opacity-70">Loading…</div>
      <ul v-else class="flex flex-col gap-2">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-2">
          <iconify-icon icon="mdi:account-circle" width="22" height="22" aria-hidden="true"></iconify-icon>
          <span class="truncate">{{ memberLabel(m) }}</span>
          <span v-if="m.user === group.created_by" class="text-xs opacity-60">· owner</span>
        </li>
      </ul>
    </div>

    <!-- Frequent members (owner only) — one tap instead of typing an email -->
    <div v-if="isOwner && (suggestionsLoading || suggested.length > 0)">
      <p class="text-sm font-medium mb-2">Frequent</p>
      <div v-if="suggestionsLoading" class="text-sm opacity-70">Loading…</div>
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
        @click="confirmDelete"
      />
      <Button
        v-else
        label="Leave group"
        icon="pi pi-sign-out"
        severity="danger"
        outlined
        size="small"
        @click="confirmLeave"
      />
    </div>

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
      v-if="settleBalance"
      v-model:visible="showSettle"
      :group="group"
      :members="members"
      :balance="settleBalance"
      :current-user-id="currentUserId"
      @saved="onSettleSaved"
    />
  </div>
</template>

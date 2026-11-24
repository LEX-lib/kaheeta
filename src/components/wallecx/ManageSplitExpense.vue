<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import { pb } from '@/lib/pocketbase'
import { useToast } from '@/composables/useToast'
import { useMobileEnv } from '@/composables/useMobileEnv'
import { equalSplit, weightedSplit, percentagesFromShares, shareCountsFromShares } from '@/lib/wallecx/splitMath'
import { formatCents, COMMON_CURRENCIES } from '@/lib/wallecx/splitFormat'
import { compressToWebP } from '@/lib/wallecx/compressToWebP'
import { PAYMENT_MODES } from '@/lib/wallecx/expenseSchema'
import { createSplitExpense, updateSplitExpense } from '@/lib/pocketbase/splitsApi'
import type {
  Group,
  GroupMember,
  PaymentMode,
  SplitType,
  SplitExpense,
  SplitShare,
} from '@/types/wallecx/splits/types'
import BaseMobileDialog from './BaseMobileDialog.vue'

const props = defineProps<{
  group: Group
  members: GroupMember[]
  expense?: SplitExpense | null
  expenseShares?: SplitShare[]
  /** File token for the edit-mode receipt preview (protected file field). */
  token?: string
}>()

const isEditMode = computed(() => !!props.expense)
// Settlements are edited through a dedicated single-counterparty mode: keep
// their split_type so balances/feed continue to treat them as settlements.
const isSettlement = computed(() => props.expense?.split_type === 'settlement')

const visible = defineModel('visible', { type: Boolean, default: false, required: true })

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()
const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)
const isSaving = ref(false)

const currentUserId = computed(() => pb.authStore.record?.id ?? '')
// Per-expense currency (editable). Defaults to the group's currency; the Select
// is editable so any ISO code can be typed.
const currency = ref('USD')
const currencyOptions = COMMON_CURRENCIES.map((c) => ({ label: c, value: c }))

type FormSplitType = Extract<SplitType, 'equal' | 'exact' | 'percentage' | 'share'>
const SPLIT_TYPE_OPTIONS: Array<{ label: string; value: FormSplitType }> = [
  { label: 'Equally', value: 'equal' },
  { label: 'Exact', value: 'exact' },
  { label: 'Percent', value: 'percentage' },
  { label: 'Shares', value: 'share' },
]

// --- Form refs ---
const description = ref('')
const amount = ref<number | null>(null) // major units, as typed
const expenseDate = ref<Date>(new Date())
const paidBy = ref('')
const splitType = ref<FormSplitType>('equal')
const selectedParticipants = ref<string[]>([])
// Settlement mode: the single counterparty the debtor paid (users id).
const settlementTo = ref('')
// Per-type, per-user inputs (keyed by user id).
const exactAmounts = ref<Record<string, number | null>>({}) // major units
const percentages = ref<Record<string, number | null>>({})
const shareCounts = ref<Record<string, number | null>>({})

// Optional metadata (parity with the personal Add Expense form).
const notes = ref('')
const paymentMode = ref<string>('')
const paymentModeOptions = [...PAYMENT_MODES]
const pendingFile = ref<File | null>(null)
const removeExistingReceipt = ref(false)
const { isMobile } = useMobileEnv()

const receiptThumbnailUrl = computed(() => {
  const ex = props.expense
  if (!ex?.receipt || removeExistingReceipt.value) return null
  if (ex.receipt.toLowerCase().endsWith('.pdf')) return null
  // Protected file field: the URL must carry a file token, fetched by the parent.
  return pb.files.getURL(ex, ex.receipt, { token: props.token })
})

const hasExistingPdf = computed(
  () =>
    !!props.expense?.receipt &&
    !removeExistingReceipt.value &&
    props.expense.receipt.toLowerCase().endsWith('.pdf'),
)

// File select handler — EXIF strip + compression for images, direct assign for PDF.
async function onFileSelect(event: { files: File[] }): Promise<void> {
  const file = event.files[0]
  if (!file) return

  if (file.size > 10 * 1024 * 1024) {
    toast.fileTooLarge()
    return
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    toast.fileTypeUnsupported('JPEG, PNG, WebP, or PDF')
    return
  }

  if (file.type === 'application/pdf') {
    pendingFile.value = file
    removeExistingReceipt.value = false
    return
  }

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = await createImageBitmap(file)
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    const strippedBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        file.type,
      ),
    )
    const strippedFile = new File([strippedBlob], file.name, { type: file.type })
    pendingFile.value = await compressToWebP(strippedFile)
    removeExistingReceipt.value = false
    toast.locationDataRemoved()
  } catch {
    toast.imageProcessFailed()
    pendingFile.value = null
  }
}

async function onRawFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // reset so the same file can be re-selected
  await onFileSelect({ files: [file] })
}

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
}

const memberOptions = computed(() =>
  props.members.map((m) => ({ label: memberLabel(m), value: m.user })),
)

// Settlement counterparty: every member except the debtor who paid.
const counterpartyOptions = computed(() =>
  memberOptions.value.filter((o) => o.value !== paidBy.value),
)

const amountCents = computed(() => Math.round((amount.value ?? 0) * 100))

// Resolved per-participant amounts in cents, by split type. Always keyed by the
// currently-selected participants.
const computedShares = computed<Record<string, number>>(() => {
  const sel = selectedParticipants.value
  if (splitType.value === 'equal') {
    return equalSplit(amountCents.value, sel)
  }
  if (splitType.value === 'exact') {
    const m: Record<string, number> = {}
    for (const u of sel) m[u] = Math.round((exactAmounts.value[u] ?? 0) * 100)
    return m
  }
  const src = splitType.value === 'percentage' ? percentages.value : shareCounts.value
  const weights: Record<string, number> = {}
  for (const u of sel) weights[u] = src[u] ?? 0
  return weightedSplit(amountCents.value, weights)
})

const allocatedCents = computed(() =>
  Object.values(computedShares.value).reduce((a, b) => a + b, 0),
)
const remainingCents = computed(() => amountCents.value - allocatedCents.value)
const percentTotal = computed(() =>
  selectedParticipants.value.reduce((a, u) => a + (percentages.value[u] ?? 0), 0),
)
const shareTotal = computed(() =>
  selectedParticipants.value.reduce((a, u) => a + (shareCounts.value[u] ?? 0), 0),
)

interface FormSnapshot {
  description: string
  amount: number | null
  currency: string
  paidBy: string
  splitType: FormSplitType
  notes: string
  paymentMode: string
  settlementTo: string
}

const snapshot = ref<FormSnapshot | null>(null)

const isDirty = computed(() => {
  const s = snapshot.value
  if (!s) return false
  return (
    description.value.trim() !== s.description ||
    amount.value !== s.amount ||
    currency.value !== s.currency ||
    paidBy.value !== s.paidBy ||
    splitType.value !== s.splitType ||
    notes.value !== s.notes ||
    paymentMode.value !== s.paymentMode ||
    settlementTo.value !== s.settlementTo ||
    (splitSnapshot.value !== null && splitSignature() !== splitSnapshot.value) ||
    pendingFile.value !== null ||
    removeExistingReceipt.value
  )
})

// Seed the per-type inputs with sensible defaults for the current selection.
// Called ONLY from an explicit split-type change (not a watcher): prefill in
// edit mode writes its own per-person values, and a watcher used to overwrite
// them with an equal split on the first open (stored exact splits looked equal).
function seedInputs(): void {
  const sel = selectedParticipants.value
  if (splitType.value === 'exact') {
    const eq = equalSplit(amountCents.value, sel)
    const m: Record<string, number | null> = {}
    for (const u of sel) m[u] = (eq[u] ?? 0) / 100
    exactAmounts.value = m
  } else if (splitType.value === 'percentage') {
    percentages.value = { ...equalSplit(100, sel) } // integer percents summing to 100
  } else if (splitType.value === 'share') {
    const m: Record<string, number | null> = {}
    for (const u of sel) m[u] = 1
    shareCounts.value = m
  }
}

function onSplitTypeChange(value: FormSplitType): void {
  splitType.value = value
  seedInputs()
}

// 'adjustment' is a legacy type with no inputs of its own; exact is its closest
// editable form. 'settlement' is edited through a dedicated mode downstream.
function formSplitTypeFromStored(stored: SplitType): FormSplitType {
  if (stored === 'equal' || stored === 'percentage' || stored === 'share') {
    return stored
  }
  return 'exact'
}

function centsByUser(from: SplitShare[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const s of from) m[s.user] = s.amount
  return m
}

// A stable fingerprint of everything that produces the saved shares. When it
// still matches the value captured at prefill, a save reuses the stored shares
// verbatim — notes/receipt-only edits must never move a cent, and percentage /
// share weights are reconstructed approximately.
function splitSignature(): string {
  const sel = [...selectedParticipants.value].sort()
  const dump = (src: Record<string, number | null>): string =>
    sel.map((u) => `${u}:${src[u] ?? 0}`).join(',')
  return [
    amountCents.value,
    splitType.value,
    sel.join(','),
    dump(exactAmounts.value),
    dump(percentages.value),
    dump(shareCounts.value),
  ].join('|')
}

const splitSnapshot = ref<string | null>(null)

// Reset/prefill the form each time the dialog opens.
watch(visible, (isOpen) => {
  if (!isOpen) {
    isSaving.value = false
    pendingFile.value = null
    removeExistingReceipt.value = false
    snapshot.value = null
    splitSnapshot.value = null
    return
  }
  exactAmounts.value = {}
  percentages.value = {}
  shareCounts.value = {}
  pendingFile.value = null
  removeExistingReceipt.value = false

  if (props.expense) {
    // Edit: prefill from the stored expense + its resolved shares. The split
    // method comes from the stored `split_type`; its per-person inputs are
    // reconstructed from the saved cents (only amounts are persisted).
    const ex = props.expense
    const exShares = props.expenseShares ?? []
    description.value = ex.name
    amount.value = ex.amount / 100
    expenseDate.value = ex.expense_date ? new Date(ex.expense_date) : new Date()
    paidBy.value = ex.paid_by
    currency.value = ex.currency || props.group.default_currency || 'USD'
    splitType.value = formSplitTypeFromStored(ex.split_type)
    notes.value = ex.notes ?? ''
    paymentMode.value = ex.payment_mode ?? ''
    selectedParticipants.value = exShares.map((s) => s.user)
    settlementTo.value = isSettlement.value ? (exShares[0]?.user ?? '') : ''
    const storedCents = centsByUser(exShares)
    if (splitType.value === 'exact') {
      const exact: Record<string, number | null> = {}
      for (const s of exShares) exact[s.user] = s.amount / 100
      exactAmounts.value = exact
    } else if (splitType.value === 'percentage') {
      percentages.value = percentagesFromShares(storedCents)
    } else if (splitType.value === 'share') {
      shareCounts.value = shareCountsFromShares(storedCents)
    }
    splitSnapshot.value = splitSignature()
    snapshot.value = {
      description: description.value.trim(),
      amount: amount.value,
      currency: currency.value,
      paidBy: paidBy.value,
      splitType: splitType.value,
      notes: notes.value,
      paymentMode: paymentMode.value,
      settlementTo: settlementTo.value,
    }
    return
  }

  // Add: empty defaults.
  description.value = ''
  amount.value = null
  expenseDate.value = new Date()
  paidBy.value = currentUserId.value || props.members[0]?.user || ''
  currency.value = props.group.default_currency || 'USD'
  splitType.value = 'equal'
  notes.value = ''
  paymentMode.value = ''
  selectedParticipants.value = props.members.map((m) => m.user)
  settlementTo.value = ''
  splitSnapshot.value = null
  snapshot.value = {
    description: '',
    amount: null,
    currency: currency.value,
    paidBy: paidBy.value,
    splitType: splitType.value,
    notes: '',
    paymentMode: '',
    settlementTo: '',
  }
})

async function onSubmit(): Promise<void> {
  const name = description.value.trim()
  if (!name) {
    toast.error('A description is required.')
    return
  }
  if (amountCents.value <= 0) {
    toast.error('Enter an amount greater than zero.')
    return
  }
  if (!paidBy.value) {
    toast.error('Choose who paid.')
    return
  }

  // Settlement mode: one counterparty receives the whole amount. The stored
  // split_type is preserved so the row remains a settlement.
  if (isSettlement.value) {
    if (!settlementTo.value) {
      toast.error('Choose who the settlement was paid to.')
      return
    }
    if (settlementTo.value === paidBy.value) {
      toast.error('The payer and the recipient must be different people.')
      return
    }
    const settlementPayload = {
      group: props.group.id,
      name,
      amount: amountCents.value,
      currency: currency.value,
      split_type: 'settlement' as SplitType,
      expense_date: dayjs(expenseDate.value).format('YYYY-MM-DD'),
      paid_by: paidBy.value,
      notes: notes.value.trim() || undefined,
      payment_mode: (paymentMode.value || undefined) as PaymentMode | undefined,
      shares: [{ user: settlementTo.value, amount: amountCents.value }],
    }
    isSaving.value = true
    try {
      await updateSplitExpense(props.expense!.id, settlementPayload, {
        receipt: pendingFile.value,
        removeReceipt: removeExistingReceipt.value,
      })
      toast.success('Settlement updated.')
      pendingFile.value = null
      removeExistingReceipt.value = false
      emit('saved')
      baseDialogRef.value?.closeWithoutGuard()
    } catch (e: unknown) {
      toast.error('Failed to update settlement. Please try again.')
      console.error('ManageSplitExpense: settlement update failed', e)
    } finally {
      isSaving.value = false
    }
    return
  }

  if (selectedParticipants.value.length === 0) {
    toast.error('Select at least one participant.')
    return
  }

  // Per-type validation.
  if (splitType.value === 'exact' && remainingCents.value !== 0) {
    toast.error(`Amounts must add up to ${formatCents(amountCents.value, currency.value)}.`)
    return
  }
  if (splitType.value === 'percentage' && percentTotal.value !== 100) {
    toast.error('Percentages must add up to 100%.')
    return
  }
  if (splitType.value === 'share' && shareTotal.value <= 0) {
    toast.error('Enter at least one share.')
    return
  }

  // If nothing that produces the split changed, reuse the stored shares exactly
  // (reconstructed percentage/share weights can be a cent off for odd amounts).
  const splitUntouched =
    !!props.expense &&
    splitSnapshot.value !== null &&
    splitSignature() === splitSnapshot.value &&
    (props.expenseShares?.length ?? 0) > 0
  const shares = splitUntouched
    ? props.expenseShares!.map((s) => ({ user: s.user, amount: s.amount }))
    : selectedParticipants.value.map((user) => ({
        user,
        amount: computedShares.value[user] ?? 0,
      }))

  const payload = {
    group: props.group.id,
    name,
    amount: amountCents.value,
    currency: currency.value,
    split_type: splitType.value,
    expense_date: dayjs(expenseDate.value).format('YYYY-MM-DD'),
    paid_by: paidBy.value,
    notes: notes.value.trim() || undefined,
    payment_mode: (paymentMode.value || undefined) as PaymentMode | undefined,
    shares,
  }

  isSaving.value = true
  try {
    const fileOpts = {
      receipt: pendingFile.value,
      removeReceipt: removeExistingReceipt.value,
    }
    if (props.expense) {
      await updateSplitExpense(props.expense.id, payload, fileOpts)
      toast.success('Expense updated.')
    } else {
      await createSplitExpense(payload, fileOpts)
      toast.success('Expense added.')
    }
    pendingFile.value = null
    removeExistingReceipt.value = false
    emit('saved')
    baseDialogRef.value?.closeWithoutGuard()
  } catch (e: unknown) {
    toast.error(
      props.expense
        ? 'Failed to update expense. Please try again.'
        : 'Failed to add expense. Please try again.',
    )
    console.error('ManageSplitExpense: save failed', e)
  } finally {
    isSaving.value = false
  }
}

function onCancel(): void {
  baseDialogRef.value?.closeWithoutGuard()
}
</script>

<template>
  <BaseMobileDialog
    ref="baseDialogRef"
    v-model:visible="visible"
    :title="isSettlement ? 'Edit settlement' : isEditMode ? 'Edit expense' : 'Add expense'"
    :is-dirty="isDirty"
    :is-saving="isSaving"
  >
    <form id="manage-split-expense-form" class="space-y-4" @submit.prevent="onSubmit">
      <!-- Description -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Description *</label>
        <InputText
          v-model="description"
          fluid
          :maxlength="120"
          :disabled="isSaving"
          placeholder="e.g. Dinner"
          enterkeyhint="next"
          autocomplete="off"
          autofocus
        />
      </div>

      <!-- Amount -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Amount *</label>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium" style="color: var(--color-typo-body)">
            {{ currency }}
          </span>
          <InputNumber
            v-model="amount"
            fluid
            :minFractionDigits="2"
            :maxFractionDigits="2"
            :min="0"
            :disabled="isSaving"
            inputmode="decimal"
            enterkeyhint="next"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- Currency (per expense; editable) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Currency *</label>
        <Select
          v-model="currency"
          fluid
          editable
          option-label="label"
          option-value="value"
          :options="currencyOptions"
          :disabled="isSaving"
          placeholder="e.g. USD"
        />
      </div>

      <!-- Date -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Date *</label>
        <DatePicker v-model="expenseDate" fluid dateFormat="dd M yy" :disabled="isSaving" />
      </div>

      <!-- Paid by -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Paid by *</label>
        <Select
          v-model="paidBy"
          fluid
          option-label="label"
          option-value="value"
          :options="memberOptions"
          :disabled="isSaving"
          placeholder="Who paid?"
        />
      </div>

      <!-- Payment mode (optional) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">
          Payment mode
          <span class="text-xs" style="color: var(--color-typo-muted)">(optional)</span>
        </label>
        <Select
          v-model="paymentMode"
          fluid
          show-clear
          option-label="label"
          option-value="value"
          :options="paymentModeOptions"
          :disabled="isSaving"
          placeholder="Select a payment mode"
          enterkeyhint="next"
        />
      </div>

      <!-- Notes (optional) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">
          Notes
          <span class="text-xs" style="color: var(--color-typo-muted)">(optional)</span>
        </label>
        <Textarea
          v-model="notes"
          fluid
          :rows="3"
          :autoResize="false"
          :disabled="isSaving"
          inputmode="text"
          enterkeyhint="done"
          autocomplete="off"
        />
      </div>

      <!-- Split method (shared expenses only) -->
      <template v-if="!isSettlement">
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Split</label>
        <SelectButton
          :model-value="splitType"
          :options="SPLIT_TYPE_OPTIONS"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="isSaving"
          @update:model-value="onSplitTypeChange"
        />
      </div>

      <!-- Participants -->
      <div class="flex flex-col gap-2">
        <label class="text-sm" style="color: var(--color-typo-heading)">Split between *</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="m in members"
            :key="m.id"
            class="flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <Checkbox
                v-model="selectedParticipants"
                :inputId="`split-p-${m.user}`"
                :value="m.user"
                :disabled="isSaving"
              />
              <label :for="`split-p-${m.user}`" class="truncate">{{ memberLabel(m) }}</label>
            </div>

            <template v-if="selectedParticipants.includes(m.user)">
              <!-- Exact: amount per person -->
              <InputNumber
                v-if="splitType === 'exact'"
                v-model="exactAmounts[m.user]"
                class="w-28"
                :minFractionDigits="2"
                :maxFractionDigits="2"
                :min="0"
                :disabled="isSaving"
                inputmode="decimal"
              />
              <!-- Percentage: % per person -->
              <InputNumber
                v-else-if="splitType === 'percentage'"
                v-model="percentages[m.user]"
                class="w-24"
                suffix="%"
                :min="0"
                :max="100"
                :disabled="isSaving"
                inputmode="decimal"
              />
              <!-- Shares: integer weight per person -->
              <InputNumber
                v-else-if="splitType === 'share'"
                v-model="shareCounts[m.user]"
                class="w-20"
                :min="0"
                showButtons
                buttonLayout="horizontal"
                :disabled="isSaving"
                inputmode="numeric"
              />
              <!-- Computed amount preview (always shown) -->
              <span class="text-sm tabular-nums opacity-70 w-20 text-right shrink-0">
                {{ formatCents(computedShares[m.user] ?? 0, currency) }}
              </span>
            </template>
          </div>
        </div>

        <!-- Per-type running summary -->
        <small
          v-if="selectedParticipants.length > 0 && amountCents > 0"
          class="opacity-80"
          :style="{
            color:
              (splitType === 'exact' && remainingCents !== 0) ||
              (splitType === 'percentage' && percentTotal !== 100)
                ? 'var(--p-red-500)'
                : undefined,
          }"
        >
          <template v-if="splitType === 'equal'">
            {{ formatCents(amountCents, currency) }} split
            {{ selectedParticipants.length }} way{{ selectedParticipants.length === 1 ? '' : 's' }}
          </template>
          <template v-else-if="splitType === 'exact'">
            {{ formatCents(allocatedCents, currency) }} of {{ formatCents(amountCents, currency) }}
            · {{ formatCents(remainingCents, currency) }} left
          </template>
          <template v-else-if="splitType === 'percentage'">
            Total {{ percentTotal }}% (must be 100%)
          </template>
          <template v-else>
            {{ shareTotal }} share{{ shareTotal === 1 ? '' : 's' }}
          </template>
        </small>
      </div>
      </template>

      <!-- Settlement: the debtor paid a single counterparty -->
      <div v-else class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Paid to *</label>
        <Select
          v-model="settlementTo"
          fluid
          option-label="label"
          option-value="value"
          :options="counterpartyOptions"
          :disabled="isSaving"
          placeholder="Who received the payment?"
        />
        <small style="color: var(--color-typo-muted)">
          Recorded as a settlement between the payer and this member.
        </small>
      </div>

      <!-- Receipt (optional) -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">
          Receipt
          <span class="text-xs" style="color: var(--color-typo-muted)">(optional)</span>
        </label>

        <!-- Edit mode: current attachment preview -->
        <template v-if="isEditMode && expense?.receipt">
          <img
            v-if="receiptThumbnailUrl"
            :src="receiptThumbnailUrl"
            class="w-24 h-24 object-cover rounded"
            alt="Current receipt"
          />
          <div
            v-else-if="hasExistingPdf"
            class="w-24 h-24 flex items-center justify-center border rounded"
          >
            <i class="pi pi-file-pdf text-3xl" aria-label="Receipt (PDF)"></i>
          </div>
          <p v-if="!removeExistingReceipt" class="text-sm" style="color: var(--color-typo-muted)">
            Current receipt — select a new file to replace it
          </p>
          <p v-else class="text-sm" style="color: var(--color-typo-muted)">
            Current receipt will be removed on save.
          </p>
          <div v-if="!pendingFile" class="flex items-center gap-2">
            <Checkbox
              v-model="removeExistingReceipt"
              binary
              inputId="remove-split-receipt"
              :disabled="isSaving"
            />
            <label for="remove-split-receipt" class="text-sm">Remove current receipt</label>
          </div>
        </template>

        <!-- Mobile: take photo / choose from gallery -->
        <template v-if="isMobile">
          <div class="flex gap-2">
            <label class="p-button p-button-outlined p-button-secondary p-button-sm min-h-[44px] cursor-pointer flex items-center gap-2 flex-1">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                class="hidden"
                :disabled="isSaving"
                @change="onRawFileChange"
              />
              <i class="pi pi-camera" aria-hidden="true"></i>
              Take photo
            </label>
            <label class="p-button p-button-outlined p-button-secondary p-button-sm min-h-[44px] cursor-pointer flex items-center gap-2 flex-1">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                class="hidden"
                :disabled="isSaving"
                @change="onRawFileChange"
              />
              <i class="pi pi-images" aria-hidden="true"></i>
              Choose from gallery
            </label>
          </div>
        </template>

        <!-- Desktop -->
        <FileUpload
          v-else
          mode="basic"
          :auto="false"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          :chooseLabel="isEditMode && expense?.receipt ? 'Replace file' : 'Choose File'"
          :disabled="isSaving"
          @select="onFileSelect"
        />

        <p v-if="pendingFile" class="text-sm" style="color: var(--color-typo-muted)">
          {{ pendingFile.name }} selected
        </p>
      </div>
    </form>

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
          type="submit"
          form="manage-split-expense-form"
          :label="isEditMode ? 'Save changes' : 'Add expense'"
          fluid
          :loading="isSaving"
          :disabled="isSaving"
        />
      </div>
    </template>
  </BaseMobileDialog>
</template>

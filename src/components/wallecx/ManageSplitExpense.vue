<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import { pb } from '@/lib/pocketbase'
import { useToast } from '@/composables/useToast'
import { equalSplit, weightedSplit } from '@/lib/wallecx/splitMath'
import { formatCents } from '@/lib/wallecx/splitFormat'
import { createSplitExpense } from '@/lib/pocketbase/splitsApi'
import type { Group, GroupMember, SplitType } from '@/types/wallecx/splits/types'
import BaseMobileDialog from './BaseMobileDialog.vue'

const props = defineProps<{
  group: Group
  members: GroupMember[]
}>()

const visible = defineModel('visible', { type: Boolean, default: false, required: true })

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()
const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)
const isSaving = ref(false)

const currentUserId = computed(() => pb.authStore.record?.id ?? '')
const currency = computed(() => props.group.default_currency || 'USD')

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
// Per-type, per-user inputs (keyed by user id).
const exactAmounts = ref<Record<string, number | null>>({}) // major units
const percentages = ref<Record<string, number | null>>({})
const shareCounts = ref<Record<string, number | null>>({})

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
}

const memberOptions = computed(() =>
  props.members.map((m) => ({ label: memberLabel(m), value: m.user })),
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

const isDirty = computed(
  () => description.value.trim() !== '' || amount.value !== null,
)

// Seed the per-type inputs with sensible defaults for the current selection.
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

watch(splitType, seedInputs)

// Reset the form each time the dialog opens.
watch(visible, (isOpen) => {
  if (!isOpen) {
    isSaving.value = false
    return
  }
  description.value = ''
  amount.value = null
  expenseDate.value = new Date()
  paidBy.value = currentUserId.value || props.members[0]?.user || ''
  splitType.value = 'equal'
  selectedParticipants.value = props.members.map((m) => m.user)
  exactAmounts.value = {}
  percentages.value = {}
  shareCounts.value = {}
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
  if (selectedParticipants.value.length === 0) {
    toast.error('Select at least one participant.')
    return
  }
  if (!paidBy.value) {
    toast.error('Choose who paid.')
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

  const shareMap = computedShares.value
  const shares = selectedParticipants.value.map((user) => ({
    user,
    amount: shareMap[user] ?? 0,
  }))

  isSaving.value = true
  try {
    await createSplitExpense({
      group: props.group.id,
      name,
      amount: amountCents.value,
      currency: currency.value,
      split_type: splitType.value,
      expense_date: dayjs(expenseDate.value).format('YYYY-MM-DD'),
      paid_by: paidBy.value,
      shares,
    })
    emit('saved')
    toast.success('Expense added.')
    baseDialogRef.value?.closeWithoutGuard()
  } catch (e: unknown) {
    toast.error('Failed to add expense. Please try again.')
    console.error('ManageSplitExpense: createSplitExpense failed', e)
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
    title="Add expense"
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

      <!-- Split method -->
      <div class="flex flex-col gap-1">
        <label class="text-sm" style="color: var(--color-typo-heading)">Split</label>
        <SelectButton
          v-model="splitType"
          :options="SPLIT_TYPE_OPTIONS"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="isSaving"
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
          label="Add expense"
          fluid
          :loading="isSaving"
          :disabled="isSaving"
        />
      </div>
    </template>
  </BaseMobileDialog>
</template>

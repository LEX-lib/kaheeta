<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import { useToast } from '@/composables/useToast'
import { formatCents } from '@/lib/wallecx/splitFormat'
import { createSplitExpense } from '@/lib/pocketbase/splitsApi'
import type { Group, GroupMember, BalanceSummary } from '@/types/wallecx/splits/types'
import BaseMobileDialog from './BaseMobileDialog.vue'

const props = defineProps<{
  group: Group
  members: GroupMember[]
  /** Every outstanding balance involving the current user. */
  balances: BalanceSummary[]
  currentUserId: string
}>()

const visible = defineModel('visible', { type: Boolean, default: false, required: true })

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()
const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)
const isSaving = ref(false)

// Amount the user is settling, in major units (defaults to the full balance).
const amount = ref<number | null>(null)
const selectedKey = ref('')

function balanceKey(b: BalanceSummary): string {
  return `${b.userId}|${b.currency}`
}

function memberLabel(userId: string): string {
  const m = props.members.find((x) => x.user === userId)
  return m?.expand?.user?.name || m?.expand?.user?.email || 'them'
}

function balanceLabel(b: BalanceSummary): string {
  const other = memberLabel(b.userId)
  const money = formatCents(Math.abs(b.amount), b.currency)
  return b.amount > 0 ? `${other} owes you ${money}` : `You owe ${other} ${money}`
}

const options = computed(() =>
  props.balances.map((b) => ({ key: balanceKey(b), label: balanceLabel(b) })),
)

const selected = computed<BalanceSummary | null>(
  () => props.balances.find((b) => balanceKey(b) === selectedKey.value) ?? null,
)

const otherName = computed(() => (selected.value ? memberLabel(selected.value.userId) : 'them'))
// balance.amount > 0 => the other person owes the current user (they pay you);
// < 0 => the current user owes them (you pay them).
const youArePaying = computed(() => (selected.value?.amount ?? 0) < 0)
const debtor = computed(() =>
  youArePaying.value ? props.currentUserId : (selected.value?.userId ?? ''),
)
const creditor = computed(() =>
  youArePaying.value ? (selected.value?.userId ?? '') : props.currentUserId,
)
const fullCents = computed(() => Math.abs(selected.value?.amount ?? 0))
const amountCents = computed(() => Math.round((amount.value ?? 0) * 100))

const isDirty = computed(
  () => !!selected.value && amountCents.value !== fullCents.value,
)

function syncAmount(): void {
  amount.value = fullCents.value > 0 ? fullCents.value / 100 : null
}

// immediate: the dialog is mounted on demand (v-if) with visible already true,
// so a plain watcher would miss that initial open and never prefill the amount.
watch(
  visible,
  (isOpen) => {
    if (!isOpen) {
      isSaving.value = false
      return
    }
    selectedKey.value = props.balances[0] ? balanceKey(props.balances[0]) : ''
    syncAmount()
  },
  { immediate: true },
)

watch(selectedKey, syncAmount)

// If the balance list refreshes while open, keep a valid selection.
watch(
  () => props.balances,
  (list) => {
    if (!list.some((b) => balanceKey(b) === selectedKey.value)) {
      selectedKey.value = list[0] ? balanceKey(list[0]) : ''
    }
  },
  { deep: true },
)

async function onSubmit(): Promise<void> {
  if (!selected.value) return
  if (amountCents.value <= 0) {
    toast.error('Enter an amount greater than zero.')
    return
  }
  if (amountCents.value > fullCents.value) {
    toast.error(`That's more than the ${formatCents(fullCents.value, selected.value.currency)} owed.`)
    return
  }

  isSaving.value = true
  try {
    await createSplitExpense({
      group: props.group.id,
      name: 'Settlement',
      amount: amountCents.value,
      currency: selected.value.currency,
      split_type: 'settlement',
      expense_date: dayjs(new Date()).format('YYYY-MM-DD'),
      paid_by: debtor.value,
      shares: [{ user: creditor.value, amount: amountCents.value }],
    })
    emit('saved')
    toast.success('Settlement recorded.')
    baseDialogRef.value?.closeWithoutGuard()
  } catch (e: unknown) {
    toast.error('Failed to record settlement. Please try again.')
    console.error('SettleUpDialog: createSplitExpense failed', e)
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
    title="Settle up"
    :is-dirty="isDirty"
    :is-saving="isSaving"
  >
    <form id="settle-up-form" class="space-y-4 pt-2" @submit.prevent="onSubmit">
      <Message v-if="!selected" severity="success" :closable="false">
        You're all settled up.
      </Message>

      <template v-else>
        <div v-if="options.length > 1" class="flex flex-col gap-1">
          <label class="text-sm" style="color: var(--color-typo-heading)">Balance</label>
          <Listbox
            v-model="selectedKey"
            :options="options"
            option-label="label"
            option-value="key"
            :disabled="isSaving"
            list-style="max-height: 12rem"
          />
        </div>

        <p class="text-sm" style="color: var(--color-typo-body)">
          <template v-if="youArePaying">
            You are paying <strong>{{ otherName }}</strong>
          </template>
          <template v-else>
            <strong>{{ otherName }}</strong> is paying you
          </template>
          — recording this cancels the balance.
        </p>

        <div class="flex flex-col gap-1">
          <label class="text-sm" style="color: var(--color-typo-heading)">Amount *</label>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" style="color: var(--color-typo-body)">
              {{ selected.currency }}
            </span>
            <InputNumber
              v-model="amount"
              fluid
              :minFractionDigits="2"
              :maxFractionDigits="2"
              :min="0"
              :max="fullCents / 100"
              :disabled="isSaving"
              inputmode="decimal"
              autofocus
            />
          </div>
          <small class="opacity-70">
            Outstanding: {{ formatCents(fullCents, selected.currency) }}
          </small>
        </div>
      </template>
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
          form="settle-up-form"
          label="Record settlement"
          fluid
          :loading="isSaving"
          :disabled="isSaving || !selected || amountCents <= 0"
        />
      </div>
    </template>
  </BaseMobileDialog>
</template>

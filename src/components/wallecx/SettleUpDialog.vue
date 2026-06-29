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
  balance: BalanceSummary
  currentUserId: string
}>()

const visible = defineModel('visible', { type: Boolean, default: false, required: true })

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()
const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)
const isSaving = ref(false)

// amount the user is settling, in major units (defaults to the full balance).
const amount = ref<number | null>(null)

function memberLabel(userId: string): string {
  const m = props.members.find((x) => x.user === userId)
  return m?.expand?.user?.name || m?.expand?.user?.email || 'them'
}

// The debtor pays the creditor. balance.amount > 0 => the other person owes the
// current user (they pay you); < 0 => the current user owes them (you pay them).
const otherName = computed(() => memberLabel(props.balance.userId))
const youArePaying = computed(() => props.balance.amount < 0)
const debtor = computed(() =>
  youArePaying.value ? props.currentUserId : props.balance.userId,
)
const creditor = computed(() =>
  youArePaying.value ? props.balance.userId : props.currentUserId,
)
const fullCents = computed(() => Math.abs(props.balance.amount))
const amountCents = computed(() => Math.round((amount.value ?? 0) * 100))

const isDirty = computed(() => amountCents.value !== fullCents.value)

watch(visible, (isOpen) => {
  if (!isOpen) {
    isSaving.value = false
    return
  }
  amount.value = fullCents.value / 100
})

async function onSubmit(): Promise<void> {
  if (amountCents.value <= 0) {
    toast.error('Enter an amount greater than zero.')
    return
  }
  if (amountCents.value > fullCents.value) {
    toast.error(`That's more than the ${formatCents(fullCents.value, props.balance.currency)} owed.`)
    return
  }

  isSaving.value = true
  try {
    await createSplitExpense({
      group: props.group.id,
      name: 'Settlement',
      amount: amountCents.value,
      currency: props.balance.currency,
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
            {{ balance.currency }}
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
          Outstanding: {{ formatCents(fullCents, balance.currency) }}
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
          form="settle-up-form"
          label="Record settlement"
          fluid
          :loading="isSaving"
          :disabled="isSaving"
        />
      </div>
    </template>
  </BaseMobileDialog>
</template>

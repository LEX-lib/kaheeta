<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import { pb } from '@/lib/pocketbase'
import { useToast } from '@/composables/useToast'
import { equalSplit } from '@/lib/wallecx/splitMath'
import { formatCents } from '@/lib/wallecx/splitFormat'
import { createSplitExpense } from '@/lib/pocketbase/splitsApi'
import type { Group, GroupMember } from '@/types/wallecx/splits/types'
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

// --- Form refs ---
const description = ref('')
const amount = ref<number | null>(null) // major units, as typed
const expenseDate = ref<Date>(new Date())
const paidBy = ref('')
const selectedParticipants = ref<string[]>([])

function memberLabel(m: GroupMember): string {
  return m.expand?.user?.name || m.expand?.user?.email || 'Member'
}

const memberOptions = computed(() =>
  props.members.map((m) => ({ label: memberLabel(m), value: m.user })),
)

const amountCents = computed(() => Math.round((amount.value ?? 0) * 100))

// Live equal-split preview keyed by participant user id.
const previewShares = computed<Record<string, number>>(() =>
  equalSplit(amountCents.value, selectedParticipants.value),
)

const isDirty = computed(
  () => description.value.trim() !== '' || amount.value !== null,
)

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
  selectedParticipants.value = props.members.map((m) => m.user)
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

  const shareMap = equalSplit(amountCents.value, selectedParticipants.value)
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
      split_type: 'equal',
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

      <!-- Participants -->
      <div class="flex flex-col gap-2">
        <label class="text-sm" style="color: var(--color-typo-heading)">Split between *</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="m in members"
            :key="m.id"
            class="flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Checkbox
                v-model="selectedParticipants"
                :inputId="`split-p-${m.user}`"
                :value="m.user"
                :disabled="isSaving"
              />
              <label :for="`split-p-${m.user}`" class="truncate">{{ memberLabel(m) }}</label>
            </div>
            <span
              v-if="selectedParticipants.includes(m.user)"
              class="text-sm tabular-nums opacity-70"
            >
              {{ formatCents(previewShares[m.user] ?? 0, currency) }}
            </span>
          </div>
        </div>
        <small v-if="selectedParticipants.length > 0 && amountCents > 0" class="opacity-70">
          {{ formatCents(amountCents, currency) }} split
          {{ selectedParticipants.length }} way{{ selectedParticipants.length === 1 ? '' : 's' }}
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

<script setup lang="ts">
import type { Expenses } from '@/types/wallecx/expenses/types'
import { formatCurrency } from '@/lib/wallecx/currency'
import { PAYMENT_MODES } from '@/lib/wallecx/expenseSchema'
import dayjs from 'dayjs'

defineProps<{ record: Expenses }>()

function paymentModeLabel(value: string): string {
  return PAYMENT_MODES.find((m) => m.value === value)?.label ?? value
}

const emit = defineEmits<{
  edit:    [record: Expenses]
  delete:  [record: Expenses]
  preview: [record: Expenses]
}>()
</script>

<template>
  <div
    class="flex items-center gap-3 py-3 border-b"
    style="border-color: var(--color-surface-divider)"
  >
    <!-- Amount: fixed 96px, bold, brand colour -->
    <div class="w-24 shrink-0 font-bold text-base"
         style="color: var(--color-brand-primary)">
      {{ formatCurrency(record.amount) }}
    </div>

    <!-- Meta + description: fills remaining space -->
    <div class="flex-1 min-w-0">
      <div class="text-xs" style="color: var(--color-typo-muted)">
        {{ dayjs(record.expense_date).format('D MMM YYYY') }} · {{ record.category }}
        <span
          v-if="record.payment_mode"
          class="inline-block ml-1 px-2 py-0.5 rounded-full"
          style="background: var(--color-surface-card-2); color: var(--color-typo-body)"
        >
          {{ paymentModeLabel(record.payment_mode) }}
        </span>
      </div>
      <div class="text-sm truncate" style="color: var(--color-typo-body)">
        {{ record.description }}
      </div>
    </div>

    <!-- Paperclip — only when receipt is truthy (falsy check handles "" and undefined) -->
    <Button
      v-if="record.receipt"
      icon="pi pi-paperclip"
      aria-label="View receipt"
      text
      rounded
      severity="secondary"
      @click.stop="emit('preview', record)"
    />

    <!-- Edit -->
    <Button
      icon="pi pi-pencil"
      aria-label="Edit expense"
      text
      rounded
      severity="secondary"
      @click.stop="emit('edit', record)"
    />

    <!-- Delete -->
    <Button
      icon="pi pi-trash"
      aria-label="Delete expense"
      text
      rounded
      severity="danger"
      @click.stop="emit('delete', record)"
    />
  </div>
</template>

<style scoped>
</style>

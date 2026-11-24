<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { formatCents } from '@/lib/wallecx/splitFormat'
import { PAYMENT_MODES } from '@/lib/wallecx/expenseSchema'
import { useIsMobile } from '@/composables/useIsMobile'
import type { GroupMember, SplitExpense, SplitShare } from '@/types/wallecx/splits/types'

const props = defineProps<{
  expense: SplitExpense
  /** All shares belonging to this expense. */
  shares: SplitShare[]
  members: GroupMember[]
  currentUserId: string
  canEdit: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  edit: [expense: SplitExpense]
  delete: [expense: SplitExpense]
  preview: [expense: SplitExpense]
}>()

const isNarrow = useIsMobile(767)
const expanded = ref(false)
const menuRef = ref<{ toggle: (event: Event) => void } | null>(null)

function nameForUser(userId: string): string {
  const m = props.members.find((x) => x.user === userId)
  if (m) return m.expand?.user?.name || m.expand?.user?.email || 'Member'
  return userId === props.currentUserId ? 'You' : 'Someone'
}

const isSettlement = computed(() => props.expense.split_type === 'settlement')
const payerName = computed(() =>
  props.expense.paid_by === props.currentUserId
    ? 'You'
    : nameForUser(props.expense.paid_by),
)
const myShare = computed(
  () => props.shares.find((s) => s.user === props.currentUserId) ?? null,
)
const myShareCents = computed(() => myShare.value?.amount ?? 0)

// "Only me" is an expense whose split list is exactly one participant. Show it
// to everyone (the other members need to know why they are not involved).
const soloShare = computed(() => (props.shares.length === 1 ? props.shares[0] : null))
const settlementPayee = computed(() => {
  if (soloShare.value) return nameForUser(soloShare.value.user)
  const names = props.shares.map((s) => nameForUser(s.user))
  return names.length ? names.join(', ') : 'a member'
})

const onlyLabel = computed(() => {
  if (isSettlement.value || !soloShare.value) return null
  return soloShare.value.user === props.currentUserId
    ? 'Only you'
    : `Only ${nameForUser(soloShare.value.user)}`
})

const paymentModeLabel = computed(() => {
  const value = props.expense.payment_mode
  if (!value) return ''
  return PAYMENT_MODES.find((m) => m.value === value)?.label ?? value
})

const dateLabel = computed(() => {
  const d = props.expense.expense_date ? dayjs(props.expense.expense_date) : null
  return d && d.isValid() ? { month: d.format('MMM').toUpperCase(), day: d.format('D') } : null
})

const breakdown = computed(() => {
  const order = new Map(props.members.map((m, i) => [m.user, i]))
  return [...props.shares].sort(
    (a, b) => (order.get(a.user) ?? 99) - (order.get(b.user) ?? 99),
  )
})

const menuItems = computed(() => [
  ...(props.expense.receipt
    ? [
        {
          label: 'View receipt',
          icon: 'pi pi-paperclip',
          command: () => emit('preview', props.expense),
        },
      ]
    : []),
  ...(props.canEdit
    ? [
        {
          label: isSettlement.value ? 'Edit settlement' : 'Edit expense',
          icon: 'pi pi-pencil',
          command: () => emit('edit', props.expense),
        },
      ]
    : []),
  ...(props.canDelete
    ? [
        {
          label: 'Delete',
          icon: 'pi pi-trash',
          class: 'sx-menu-danger',
          command: () => emit('delete', props.expense),
        },
      ]
    : []),
])

function toggleMenu(event: Event): void {
  event.stopPropagation()
  menuRef.value?.toggle(event)
}
</script>

<template>
  <div class="sx-wrap">
    <div class="sx-row" :class="{ 'is-expanded': expanded }">
      <button
        type="button"
        class="sx-main"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span v-if="dateLabel" class="sx-date" aria-hidden="true">
          <span class="sx-date-month">{{ dateLabel.month }}</span>
          <span class="sx-date-day">{{ dateLabel.day }}</span>
        </span>
        <Avatar
          :label="payerName.slice(0, 1).toUpperCase()"
          shape="circle"
          size="normal"
          class="sx-avatar"
        />
        <span class="sx-body">
          <span class="sx-name">{{ expense.name }}</span>
          <span class="sx-meta">
            <span v-if="isSettlement" class="sx-meta-payer">
              {{ payerName }} paid {{ settlementPayee }}
              {{ formatCents(expense.amount, expense.currency) }}
            </span>
            <span v-else class="sx-meta-payer">
              {{ payerName }} paid {{ formatCents(expense.amount, expense.currency) }}
            </span>
            <span v-if="!isSettlement && myShare" class="sx-meta-share">
              <span class="sx-meta-dot">· </span>your share
              {{ formatCents(myShareCents, expense.currency) }}
            </span>
            <span v-else-if="!isSettlement && shares.length > 0" class="sx-meta-share">
              <span class="sx-meta-dot">· </span>not included
            </span>
          </span>
          <span class="sx-tags">
            <Tag v-if="isSettlement" value="Settlement" severity="secondary" />
            <Tag v-if="onlyLabel" :value="onlyLabel" severity="info" />
            <Tag v-if="paymentModeLabel" :value="paymentModeLabel" severity="secondary" />
          </span>
        </span>
        <span class="sx-amounts">
          <span class="sx-total tabular-nums">
            {{ formatCents(expense.amount, expense.currency) }}
          </span>
        </span>
      </button>

      <div class="sx-actions">
        <Button
          v-if="expense.receipt"
          text
          rounded
          size="small"
          severity="secondary"
          aria-label="View receipt"
          @click="emit('preview', expense)"
        >
          <iconify-icon icon="mdi:paperclip" width="18" height="18"></iconify-icon>
        </Button>
        <Button
          text
          rounded
          size="small"
          severity="secondary"
          aria-label="Expense actions"
          aria-haspopup="true"
          @click="toggleMenu"
        >
          <iconify-icon icon="mdi:dots-horizontal" width="20" height="20"></iconify-icon>
        </Button>
        <Menu ref="menuRef" :model="menuItems" popup />
      </div>
    </div>

    <div v-if="expanded" class="sx-detail">
      <Divider class="sx-divider" />
      <ul class="sx-breakdown">
        <li v-for="s in breakdown" :key="s.id" class="sx-breakdown-item">
          <Avatar
            :label="nameForUser(s.user).slice(0, 1).toUpperCase()"
            shape="circle"
            size="small"
          />
          <span class="sx-breakdown-name">
            {{ nameForUser(s.user) }}
            <span v-if="s.user === expense.paid_by" class="sx-breakdown-payer">paid</span>
          </span>
          <span class="sx-breakdown-amount tabular-nums">
            {{ formatCents(s.amount, expense.currency) }}
          </span>
        </li>
      </ul>
      <p v-if="expense.notes" class="sx-notes">{{ expense.notes }}</p>
      <div class="sx-detail-actions">
        <Button
          v-if="canEdit"
          label="Edit"
          icon="pi pi-pencil"
          size="small"
          severity="secondary"
          outlined
          :fluid="isNarrow"
          @click="emit('edit', expense)"
        />
        <Button
          v-if="canDelete"
          label="Delete"
          icon="pi pi-trash"
          size="small"
          severity="danger"
          text
          :fluid="isNarrow"
          @click="emit('delete', expense)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sx-wrap {
  border: 1px solid var(--color-surface-divider);
  border-radius: 12px;
  background: var(--color-surface-card);
  overflow: hidden;
}
.sx-row {
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  padding-right: 0.35rem;
}
.sx-main {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex: 1;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.sx-main:hover {
  background: var(--color-surface-card-2);
}
.sx-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 2.2rem;
  flex-shrink: 0;
  color: var(--color-typo-muted);
  font-size: 0.65rem;
  line-height: 1.05;
}
.sx-date-day {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-typo-heading);
}
.sx-avatar {
  flex-shrink: 0;
}
.sx-body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.sx-name {
  font-weight: 600;
  color: var(--color-typo-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sx-meta {
  font-size: 0.78rem;
  color: var(--color-typo-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sx-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.15rem;
}
.sx-tags :deep(.p-tag) {
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
}
.sx-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  flex-shrink: 0;
}
.sx-total {
  font-weight: 600;
  color: var(--color-typo-heading);
  white-space: nowrap;
}
.sx-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.sx-detail {
  padding: 0 0.85rem 0.8rem;
}
.sx-divider {
  margin: 0 0 0.5rem;
}
.sx-breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.sx-breakdown-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.85rem;
}
.sx-breakdown-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-typo-body);
}
.sx-breakdown-payer {
  font-size: 0.7rem;
  color: var(--color-typo-muted);
}
.sx-breakdown-amount {
  color: var(--color-typo-heading);
}
.sx-notes {
  margin: 0.55rem 0 0;
  font-size: 0.8rem;
  color: var(--color-typo-muted);
  white-space: pre-wrap;
}
.sx-detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

/* Phones: give the text the space the avatar used to take, let the meta wrap
 * instead of truncating, and keep the amount/actions compact. */
@media (max-width: 639px) {
  .sx-main {
    gap: 0.5rem;
    padding: 0.6rem 0.55rem;
  }
  .sx-avatar {
    display: none;
  }
  .sx-name {
    font-size: 0.95rem;
  }
  .sx-meta {
    display: flex;
    flex-direction: column;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
  .sx-meta-dot {
    display: none;
  }
  .sx-amounts {
    font-size: 0.9rem;
  }
}
</style>

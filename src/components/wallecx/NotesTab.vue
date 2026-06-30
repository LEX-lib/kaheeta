<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from '@/composables/useToast'
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import { pb } from '@/lib/pocketbase'
import { useAuthStore } from '@/stores/auth'
import type { Note } from '@/types/wallecx/notes/types'
import dayjs from 'dayjs'

const ManageNote = defineAsyncComponent(() => import('./ManageNote.vue'))

const toast = useToast()
const confirm = useConfirm()
const auth = useAuthStore()

const notes = ref<Note[]>([])
const showManage = ref(false)
const manageRecord = ref<Note | null>(null)

// Top-level await drives Suspense fallback in WallecxApp
try {
  notes.value = await instrumentedGetFullList<Note>('kaheeta_notes', {
    sort: '-updated',
    filter: `user = '${auth.user?.id ?? ''}'`,
    requestKey: 'notes-getFullList',
  })
} catch (e: unknown) {
  toast.error('Failed to load notes.')
  console.error('NotesTab: load failed', e)
}

// Computed sorted list: newest updated first
const sortedNotes = computed(() =>
  [...notes.value].sort((a, b) => b.updated.localeCompare(a.updated)),
)

function openManage(note: Note | null): void {
  manageRecord.value = note
  showManage.value = true
}

function requestDelete(note: Note): void {
  confirm.require({
    header: 'Delete note?',
    message: `"${note.title || 'Untitled'}" will be permanently deleted.`,
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await pb.collection('kaheeta_notes').delete(note.id)
        notes.value = notes.value.filter((n) => n.id !== note.id)
        toast.success('Note deleted.')
      } catch (e: unknown) {
        toast.error('Failed to delete note.')
        console.error('NotesTab: delete failed', e)
      }
    },
  })
}

function handleNoteSaved(updatedNote: Note): void {
  const idx = notes.value.findIndex((n) => n.id === updatedNote.id)
  if (idx !== -1) {
    notes.value.splice(idx, 1, updatedNote)
  } else {
    notes.value.unshift(updatedNote)
  }
}
</script>

<template>
  <div>
    <!-- Create button: full-width on mobile, right-aligned on sm+ -->
    <div class="flex gap-2 mb-4 sm:justify-end">
      <Button
        class="flex-1 sm:flex-none"
        label="New note"
        icon="pi pi-plus"
        size="small"
        @click="openManage(null)"
      />
    </div>

    <!-- Notes list (populated state) -->
    <div v-if="sortedNotes.length > 0" class="flex flex-col gap-2">
      <div
        v-for="note in sortedNotes"
        :key="note.id"
        class="flex items-start justify-between gap-2 p-4 rounded border cursor-pointer border-[var(--color-surface-divider)] bg-[var(--color-surface-card-2)] hover:brightness-95 transition-[filter]"
        role="button"
        tabindex="0"
        @click="openManage(note)"
        @keydown.enter="openManage(note)"
      >
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <span
            class="text-sm font-semibold truncate"
            style="color: var(--color-typo-heading)"
          >
            {{ note.title || 'Untitled' }}
          </span>
          <span class="text-xs" style="color: var(--color-typo-muted)">
            {{ dayjs(note.updated).format('D MMM YYYY') }}
          </span>
          <p class="text-xs line-clamp-2" style="color: var(--color-typo-body)">
            {{ note.snippet || '' }}
          </p>
        </div>
        <!-- Delete icon button — right-aligned, 44px touch target -->
        <Button
          text
          rounded
          severity="secondary"
          aria-label="Delete note"
          @click.stop="requestDelete(note)"
        >
          <iconify-icon icon="mdi:delete-outline" width="20" height="20" aria-hidden="true" />
        </Button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center py-12 gap-3">
      <iconify-icon
        icon="mdi:note-text-outline"
        width="48"
        height="48"
        style="color: var(--color-brand-primary)"
        aria-hidden="true"
      />
      <p class="text-sm" style="color: var(--color-typo-heading)">No notes yet.</p>
      <Button label="Write your first note" icon="pi pi-plus" size="small" @click="openManage(null)" />
    </div>

    <!-- ManageNote dialog -->
    <ManageNote
      v-if="showManage"
      v-model:visible="showManage"
      :note="manageRecord"
      @note-saved="handleNoteSaved"
    />
  </div>
</template>

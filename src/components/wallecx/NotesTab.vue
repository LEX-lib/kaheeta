<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from '@/composables/useToast'
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import { pb } from '@/lib/pocketbase'
import { useAuthStore } from '@/stores/auth'
import { decryptBody } from '@/lib/wallecx/notesCrypto'
import { useNotesCrypto } from '@/composables/useNotesCrypto'
import { filterNotesByTitle } from '@/lib/wallecx/noteSearch'
import { clearDraft } from '@/lib/wallecx/noteDraft'
import type { Note } from '@/types/wallecx/notes/types'
import dayjs from 'dayjs'

const ManageNote = defineAsyncComponent(() => import('./ManageNote.vue'))

const toast = useToast()
const confirm = useConfirm()
const auth = useAuthStore()
const { getOrDeriveKey } = useNotesCrypto()

// Decrypt each note's snippet for the list preview (ENC-03). Derives the key
// ONCE before the map (Pitfall 6 — never inside the loop), then decrypts each
// snippet with a per-note try/catch that falls back to the raw stored value on
// failure (legacy Phase 1 plaintext snippet, D-10).
async function decryptSnippets(rawNotes: Note[]): Promise<Note[]> {
  const key = await getOrDeriveKey()
  return Promise.all(
    rawNotes.map(async (note) => {
      if (!note.snippet) return note
      try {
        return { ...note, snippet: await decryptBody(key, note.snippet) }
      } catch {
        return { ...note, snippet: note.snippet }
      }
    }),
  )
}

const notes = ref<Note[]>([])
const showManage = ref(false)
const manageRecord = ref<Note | null>(null)
const searchQuery = ref('')

// Top-level await drives Suspense fallback in WallecxApp
try {
  const rawNotes = await instrumentedGetFullList<Note>('kaheeta_notes', {
    sort: '-updated',
    filter: `user = '${auth.user?.id ?? ''}'`,
    requestKey: 'notes-getFullList',
  })
  notes.value = await decryptSnippets(rawNotes)
} catch (e: unknown) {
  toast.error('Failed to load notes.')
  console.error('NotesTab: load failed', e)
}

// Computed sorted list: newest updated first
const sortedNotes = computed(() =>
  [...notes.value].sort((a, b) => b.updated.localeCompare(a.updated)),
)

// Search state — ephemeral, never persisted
const hasActiveQuery = computed(() => searchQuery.value.trim().length > 0)
const filteredNotes = computed(() => filterNotesByTitle(sortedNotes.value, searchQuery.value))

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
        clearDraft(note.id)
        toast.success('Note deleted.')
      } catch (e: unknown) {
        toast.error('Failed to delete note.')
        console.error('NotesTab: delete failed', e)
      }
    },
  })
}

async function handleNoteSaved(updatedNote: Note): Promise<void> {
  // The saved note's snippet is ciphertext (ManageNote encrypts before write).
  // Decrypt it here so the list preview stays readable without a reload — same
  // key/try-catch pattern as the list load, with a legacy plaintext fallback.
  let previewNote = updatedNote
  if (updatedNote.snippet) {
    try {
      const key = await getOrDeriveKey()
      previewNote = { ...updatedNote, snippet: await decryptBody(key, updatedNote.snippet) }
    } catch {
      previewNote = { ...updatedNote }
    }
  }

  const idx = notes.value.findIndex((n) => n.id === previewNote.id)
  if (idx !== -1) {
    notes.value.splice(idx, 1, previewNote)
  } else {
    notes.value.unshift(previewNote)
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

    <!-- Search bar -->
    <IconField class="w-full mb-4">
      <InputIcon class="pi pi-search" />
      <InputText
        v-model="searchQuery"
        placeholder="Search notes by title"
        aria-label="Search notes by title"
        class="w-full"
      />
      <InputIcon
        v-if="hasActiveQuery"
        class="pi pi-times cursor-pointer"
        role="button"
        tabindex="0"
        aria-label="Clear search"
        @click="searchQuery = ''"
        @keydown.enter="searchQuery = ''"
        @keydown.space.prevent="searchQuery = ''"
      />
    </IconField>

    <!-- Notes list (populated state) -->
    <div v-if="filteredNotes.length > 0" class="flex flex-col gap-2">
      <div
        v-for="note in filteredNotes"
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

    <!-- Empty state: no results for active search query -->
    <div v-else-if="hasActiveQuery" class="flex flex-col items-center py-12 gap-3">
      <iconify-icon
        icon="mdi:file-search-outline"
        width="48"
        height="48"
        style="color: var(--color-brand-primary)"
        aria-hidden="true"
      />
      <p class="text-sm" style="color: var(--color-typo-heading)">
        No notes match "{{ searchQuery }}".
      </p>
    </div>

    <!-- Empty state: no notes yet -->
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

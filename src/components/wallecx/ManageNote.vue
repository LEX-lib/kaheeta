<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useAuthStore } from '@/stores/auth'
import { pb } from '@/lib/pocketbase'
import { mapToUpdateNote } from '@/lib/pocketbase/notesMapper'
import { encryptBody, decryptBody } from '@/lib/wallecx/notesCrypto'
import { useNotesCrypto } from '@/composables/useNotesCrypto'
import { useToast } from '@/composables/useToast'
import { saveDraft, loadDraft, clearDraft, isDraftNewer } from '@/lib/wallecx/noteDraft'
import type { Note } from '@/types/wallecx/notes/types'
import { generateText } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import Link from '@tiptap/extension-link'
import HardBreak from '@tiptap/extension-hard-break'
import type { JSONContent } from '@tiptap/core'
import BaseMobileDialog from './BaseMobileDialog.vue'
import NoteEditor from './NoteEditor.vue'

const props = defineProps<{
  note: Note | null
}>()

const emit = defineEmits<{
  'note-saved': [updatedNote: Note]
}>()

const visible = defineModel<boolean>('visible', { required: true })

const auth = useAuthStore()
const { getOrDeriveKey } = useNotesCrypto()
const toast = useToast()
const confirm = useConfirm()

// Initialise the working record from the prop
const record = ref<Note>(
  props.note
    ? { ...props.note }
    : ({
        id: '',
        title: '',
        body: '',
        snippet: '',
        user: auth.user?.id ?? '',
        created: '',
        updated: '',
        collectionId: '',
        collectionName: 'kaheeta_notes',
        expand: {},
      } as Note),
)

const isNew = computed(() => !record.value.id)

// Editor content is populated asynchronously on mount after decryption
// (WR-01: the old synchronous unguarded JSON.parse is gone — decryption and
// parsing now happen in the onMounted handler with a non-crashing fallback).
const editorContent = ref<JSONContent | null>(null)
const isDecrypting = ref(true)

// Dirty state — true when the user has made unsaved edits (EDIT-01, D-04).
const isDirty = ref(false)

// Save-in-flight flag — prevents concurrent saves and disables the Save button.
const isSaving = ref(false)

// Template ref for closing the dialog without triggering the dirty guard (D-04).
const dialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)

// ---------------------------------------------------------------------------
// Debounced draft write (EDIT-02, D-01/D-02)
//
// ~800ms debounce: draft writes go to localStorage only —
// PocketBase is never touched on keystrokes any more.
// ---------------------------------------------------------------------------

let draftTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDraftWrite(): void {
  // Guard: don't write while the decrypt step is still running (content is
  // being populated — writing mid-decrypt would persist empty/stale content).
  if (isDecrypting.value) return
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
  }
  draftTimer = setTimeout(() => {
    draftTimer = null
    void executeDraftWrite()
  }, 800)
}

async function executeDraftWrite(): Promise<void> {
  try {
    const key = await getOrDeriveKey()
    await saveDraft(record.value.id || null, {
      title: record.value.title,
      body: editorContent.value,
    }, key)
  } catch (e: unknown) {
    // Draft write failures are silent — the user's edits are still in memory
    // and they can still Save explicitly.
    console.warn('ManageNote: draft write failed', e)
  }
}

/**
 * Flush the pending debounced draft write and await its completion (CR-01/CR-02).
 *
 * Returns a Promise so callers (onSave) can await it before clearing the draft,
 * preventing a race where the async write re-persists a just-cleared draft.
 *
 * onBeforeUnmount cannot await — it calls this as `void flushDraftWrite()` which
 * is best-effort only.  The reliable persistence points for the last keystroke are
 * the explicit Save/Discard handlers, not the unmount path.
 */
async function flushDraftWrite(): Promise<void> {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
    await executeDraftWrite()
  }
}

// ---------------------------------------------------------------------------
// Decrypt-on-load (ENC-03) with D-10 lazy-migration fallback:
//   1. decryptBody throws OperationError for a Phase 1 plaintext body → fall
//      back to treating props.note.body as raw plaintext JSON.
//   2. if THAT is also not valid JSON → toast.error, leave editor empty, never
//      crash. This resolves WR-01 (unguarded JSON.parse) as part of the same path.
//
// D-03: after the decrypt completes, check for a newer local draft and prompt
//   Restore / Discard before populating the editor.
// ---------------------------------------------------------------------------
onMounted(async () => {
  let decryptedContent: JSONContent | null = null

  if (props.note?.body) {
    try {
      const key = await getOrDeriveKey()
      let plainBody: string
      try {
        plainBody = await decryptBody(key, props.note.body)
      } catch {
        // Legacy Phase 1 plaintext body — decryptBody rejected it (D-10).
        plainBody = props.note.body
      }
      try {
        decryptedContent = plainBody ? (JSON.parse(plainBody) as JSONContent) : null
      } catch {
        // Fallback body was not valid JSON either — surface, don't crash (D-10).
        toast.error('Could not open this note — it may be corrupted.')
        decryptedContent = null
      }
    } catch (e: unknown) {
      // Unexpected failure (e.g. key derivation) — surface, don't crash.
      toast.error('Could not open this note.')
      console.error('ManageNote: decrypt failed', e)
    }
  }

  // D-03: check for a newer draft before populating the editor.
  try {
    const key = await getOrDeriveKey()
    const noteId = record.value.id || null
    const draft = await loadDraft(noteId, key)

    // Treat any `:new` draft as newer than a blank new note (no saved timestamp).
    const isNewer = draft !== null && (
      isNew.value
        ? true
        : isDraftNewer(draft.savedAt, record.value.updated)
    )

    if (isNewer && draft !== null) {
      // Prompt before showing the editor — user picks Restore or Discard (D-03).
      confirm.require({
        header: 'Unsaved changes found',
        message: 'You have an unsaved draft of this note. Restore it or discard?',
        acceptLabel: 'Restore',
        rejectLabel: 'Discard',
        accept: () => {
          // Restore: load draft content → dirty (user's work is back in the editor).
          record.value.title = draft.title
          editorContent.value = draft.body
          isDirty.value = true
          isDecrypting.value = false
        },
        reject: () => {
          // Discard: remove the draft and use the saved version.
          clearDraft(noteId)
          editorContent.value = decryptedContent
          isDecrypting.value = false
        },
        onHide: () => {
          // Escape / backdrop dismissal without an explicit choice (CR-03).
          // Fall back to saved content and keep the draft so it can be recovered
          // on the next open. Guard: only act if neither callback already fired.
          if (isDecrypting.value) {
            editorContent.value = decryptedContent
            isDecrypting.value = false
          }
        },
      })
      // Don't set isDecrypting = false here — the confirm callbacks do it.
      return
    }
  } catch (e: unknown) {
    // Draft check failure is non-fatal — just open normally.
    console.warn('ManageNote: draft check failed', e)
  }

  // No draft (or not newer) — populate the editor with the saved content.
  editorContent.value = decryptedContent
  isDecrypting.value = false
})

// ---------------------------------------------------------------------------
// Save function — PocketBase encrypt-on-write (EDIT-01).
// Called ONLY from onSave(); never from edit handlers.
// ---------------------------------------------------------------------------
async function saveFn(): Promise<void> {
  const rawContent = editorContent.value ?? { type: 'doc', content: [] }
  const snippet = generateText(
    rawContent,
    [Document, Paragraph, Text, Bold, Italic, Heading, BulletList, ListItem, Link, HardBreak],
    { blockSeparator: ' ' },
  ).slice(0, 150)

  // Encrypt-on-write (ENC-01, D-09): both body AND snippet are encrypted with
  // AES-GCM before they ever reach mapToUpdateNote / PocketBase. The server
  // never receives plaintext note content. getOrDeriveKey is cached after the
  // first call, so this is effectively instant on subsequent saves (D-03).
  const plainBody = JSON.stringify(editorContent.value)
  const key = await getOrDeriveKey()
  const body = await encryptBody(key, plainBody)
  const encSnippet = await encryptBody(key, snippet)

  const payload = mapToUpdateNote({
    ...record.value,
    body,
    snippet: encSnippet,
  })

  if (isNew.value) {
    // Capture the id BEFORE the create so we can clear the `:new` draft key.
    const created = await pb.collection('kaheeta_notes').create<Note>({
      ...payload,
      user: auth.user?.id,
    })
    Object.assign(record.value, created)
    emit('note-saved', { ...record.value })
  } else {
    const updated = await pb
      .collection('kaheeta_notes')
      .update<Note>(record.value.id, payload)
    Object.assign(record.value, updated)
    emit('note-saved', { ...record.value })
  }
}

// ---------------------------------------------------------------------------
// Manual Save handler (D-04)
// ---------------------------------------------------------------------------
async function onSave(): Promise<void> {
  if (!isDirty.value || isSaving.value) return
  // Await the flush so no in-flight encrypted write can race clearDraft below
  // and resurrect a draft after a successful save (CR-01/CR-02).
  await flushDraftWrite()
  isSaving.value = true
  // Capture the old id: for a new note, it changes from '' to the server-assigned
  // id after create, so we need to clear both the old `:new` key and the record id.
  const oldNoteId = record.value.id || null
  try {
    await saveFn()
    // On success: clear draft for both old id and `:new` key (new-note handling).
    clearDraft(oldNoteId)
    clearDraft(null) // always clear the `:new` draft; no-op if already absent
    isDirty.value = false
    // Keep the dialog open — save-in-place UX (the editor stays active after save).
  } catch (e: unknown) {
    toast.error('Failed to save note.')
    console.error('ManageNote: save failed', e)
    // Keep isDirty = true and the draft intact so the user can retry or close.
  } finally {
    isSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Discard handler (D-04)
// Called by BaseMobileDialog when the user confirms "Discard changes?".
// The draft is KEPT — that is the point of the phase (D-04).
// ---------------------------------------------------------------------------
function onDiscard(): void {
  // Cancel any pending debounce timer so the last-keystroke draft write
  // doesn't fire after the component unmounts.
  // (We do NOT clearDraft here — the draft stays in localStorage so the user
  // can recover it on the next open.)
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
}

// Best-effort: fire an async draft write if a debounce tick is still pending
// when the component unmounts. onBeforeUnmount cannot await, so completion is
// not guaranteed — the reliable persistence points are Save and Discard (CR-01).
// If onDiscard already cleared the timer this is a no-op.
onBeforeUnmount(() => {
  void flushDraftWrite()
})
</script>

<template>
  <BaseMobileDialog
    ref="dialogRef"
    v-model:visible="visible"
    :title="isNew ? 'New Note' : 'Edit Note'"
    :is-dirty="isDirty"
    :is-saving="isSaving"
    @discard="onDiscard"
  >
    <!-- Dirty indicator (replaces the old auto-save status span) -->
    <span
      class="text-xs block mb-2"
      style="color: var(--color-typo-muted)"
      aria-live="polite"
      aria-atomic="true"
    >{{ isDirty ? 'Unsaved changes' : '' }}</span>

    <!-- Title input -->
    <InputText
      v-model="record.title"
      placeholder="Note title"
      class="w-full mb-3"
      aria-label="Note title"
      maxlength="500"
      @input="isDirty = true; scheduleDraftWrite()"
    />

    <!-- NoteEditor inside v-if guard for proper mount/unmount lifecycle (RESEARCH.md Open Question 3) -->
    <NoteEditor
      v-if="visible && !isDecrypting"
      v-model="editorContent"
      @update:model-value="isDirty = true; scheduleDraftWrite()"
    />

    <template #actions>
      <Button
        label="Save"
        icon="pi pi-check"
        :disabled="!isDirty || isSaving"
        :loading="isSaving"
        @click="onSave"
      />
    </template>
  </BaseMobileDialog>
</template>

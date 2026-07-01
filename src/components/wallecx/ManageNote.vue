<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pb } from '@/lib/pocketbase'
import { mapToUpdateNote } from '@/lib/pocketbase/notesMapper'
import { useAutoSave } from '@/composables/useAutoSave'
import { encryptBody, decryptBody } from '@/lib/wallecx/notesCrypto'
import { useNotesCrypto } from '@/composables/useNotesCrypto'
import { useToast } from '@/composables/useToast'
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

// Decrypt-on-load (ENC-03) with D-10 lazy-migration fallback:
//   1. decryptBody throws OperationError for a Phase 1 plaintext body → fall
//      back to treating props.note.body as raw plaintext JSON.
//   2. if THAT is also not valid JSON → toast.error, leave editor empty, never
//      crash. This resolves WR-01 (unguarded JSON.parse) as part of the same path.
onMounted(async () => {
  if (!props.note?.body) {
    isDecrypting.value = false
    return
  }
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
      editorContent.value = plainBody ? (JSON.parse(plainBody) as JSONContent) : null
    } catch {
      // Fallback body was not valid JSON either — surface, don't crash (D-10).
      toast.error('Could not open this note — it may be corrupted.')
      editorContent.value = null
    }
  } catch (e: unknown) {
    // Unexpected failure (e.g. key derivation) — surface, don't crash.
    toast.error('Could not open this note.')
    console.error('ManageNote: decrypt failed', e)
  } finally {
    isDecrypting.value = false
  }
})

// The save function called by useAutoSave
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

const { status, trigger, flush, cancel } = useAutoSave(saveFn, 1000)

// CR-01: when the user confirms "Discard changes?", drop the pending save so the
// onBeforeUnmount flush below does not persist the discarded edit.
let discarded = false
function onDiscard(): void {
  discarded = true
  cancel()
}

// Flush pending debounce before unmount to prevent last-keystroke data loss
// (Pitfall 7) — unless the close was an explicit discard.
onBeforeUnmount(() => {
  if (!discarded) {
    flush()
  }
})

// Auto-save status display text
const statusText = computed(() => {
  switch (status.value) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Save failed — tap to retry'
    default:
      return ''
  }
})

// Auto-save status color
const statusColor = computed(() => {
  switch (status.value) {
    case 'saving':
      return 'var(--color-typo-muted)'
    case 'saved':
      return 'var(--color-status-success)'
    case 'error':
      return 'var(--color-status-error)'
    default:
      return ''
  }
})
</script>

<template>
  <BaseMobileDialog
    v-model:visible="visible"
    :title="isNew ? 'New Note' : 'Edit Note'"
    :is-dirty="status === 'pending' || status === 'saving'"
    :is-saving="status === 'saving'"
    @discard="onDiscard"
  >
    <!-- Auto-save status indicator -->
    <span
      class="text-xs block mb-2"
      :style="{ color: statusColor }"
      aria-live="polite"
      aria-atomic="true"
    >{{ statusText }}</span>

    <!-- Title input -->
    <InputText
      v-model="record.title"
      placeholder="Note title"
      class="w-full mb-3"
      aria-label="Note title"
      maxlength="500"
      @input="trigger()"
    />

    <!-- NoteEditor inside v-if guard for proper mount/unmount lifecycle (RESEARCH.md Open Question 3) -->
    <NoteEditor
      v-if="visible && !isDecrypting"
      v-model="editorContent"
      @update:model-value="trigger()"
    />
  </BaseMobileDialog>
</template>

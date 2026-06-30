<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pb } from '@/lib/pocketbase'
import { mapToUpdateNote } from '@/lib/pocketbase/notesMapper'
import { useAutoSave } from '@/composables/useAutoSave'
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

// Initialise editor content from existing note body
const editorContent = ref<JSONContent | null>(
  props.note ? (props.note.body ? (JSON.parse(props.note.body) as JSONContent) : null) : null,
)

// The save function called by useAutoSave
async function saveFn(): Promise<void> {
  const rawContent = editorContent.value ?? { type: 'doc', content: [] }
  const snippet = generateText(
    rawContent,
    [Document, Paragraph, Text, Bold, Italic, Heading, BulletList, ListItem, Link, HardBreak],
    { blockSeparator: ' ' },
  ).slice(0, 150)

  const payload = mapToUpdateNote({
    ...record.value,
    body: JSON.stringify(editorContent.value),
    snippet,
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

const { status, trigger, flush } = useAutoSave(saveFn, 1000)

// Flush pending debounce before unmount to prevent last-keystroke data loss (Pitfall 7)
onBeforeUnmount(() => {
  flush()
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
      v-if="visible"
      v-model="editorContent"
      @update:model-value="trigger()"
    />
  </BaseMobileDialog>
</template>

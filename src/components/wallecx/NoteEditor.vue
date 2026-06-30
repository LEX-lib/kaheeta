<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
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
import History from '@tiptap/extension-history'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { JSONContent } from '@tiptap/core'

interface Props {
  modelValue?: JSONContent | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: JSONContent]
}>()

const editorContainerStyle = ref('')

const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Heading.configure({ levels: [1, 2, 3] }),
    BulletList,
    ListItem,
    HardBreak,
    Link.configure({ openOnClick: false, protocols: ['http', 'https'] }),
    History,
  ],
  content: props.modelValue ?? null,
  onUpdate: ({ editor: e }) => {
    emit('update:modelValue', e.getJSON())
  },
})

watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value) return
    const current = editor.value.getJSON()
    const incoming = val ?? null
    // Only call setContent if the incoming value differs from current editor content.
    // Tiptap v3: second arg is SetContentOptions; emitUpdate:false prevents the
    // programmatic load from firing onUpdate → emit → a phantom auto-save (Pitfall 2).
    if (JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.value.commands.setContent(incoming, { emitUpdate: false })
    }
  },
)

function onViewportResize() {
  const vv = window.visualViewport
  if (!vv) return
  const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  editorContainerStyle.value = `padding-bottom: ${keyboardHeight}px`
}

onMounted(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize)
    window.visualViewport.addEventListener('scroll', onViewportResize)
  }
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  window.visualViewport?.removeEventListener('scroll', onViewportResize)
})

function promptLink() {
  if (!editor.value) return
  if (editor.value.isActive('link')) {
    editor.value.chain().focus().unsetLink().run()
  } else {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.value.chain().focus().setLink({ href: url }).run()
    }
  }
}
</script>

<template>
  <!-- Desktop toolbar -->
  <div
    class="flex flex-wrap gap-1 mb-2 border-b pb-2"
    style="border-color: var(--color-surface-divider)"
  >
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('bold') ? 'primary' : 'secondary'"
      aria-label="Bold"
      @click="editor?.chain().focus().toggleBold().run()"
    >
      <iconify-icon icon="mdi:format-bold" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('italic') ? 'primary' : 'secondary'"
      aria-label="Italic"
      @click="editor?.chain().focus().toggleItalic().run()"
    >
      <iconify-icon icon="mdi:format-italic" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('heading', { level: 1 }) ? 'primary' : 'secondary'"
      aria-label="Heading 1"
      @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
    >
      <iconify-icon icon="mdi:format-header-1" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('heading', { level: 2 }) ? 'primary' : 'secondary'"
      aria-label="Heading 2"
      @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
    >
      <iconify-icon icon="mdi:format-header-2" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('heading', { level: 3 }) ? 'primary' : 'secondary'"
      aria-label="Heading 3"
      @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"
    >
      <iconify-icon icon="mdi:format-header-3" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('bulletList') ? 'primary' : 'secondary'"
      aria-label="Bullet list"
      @click="editor?.chain().focus().toggleBulletList().run()"
    >
      <iconify-icon icon="mdi:format-list-bulleted" width="18" height="18" aria-hidden="true" />
    </Button>
    <Button
      text
      rounded
      size="small"
      :severity="editor?.isActive('link') ? 'primary' : 'secondary'"
      aria-label="Insert link"
      @click="promptLink()"
    >
      <iconify-icon icon="mdi:link-variant" width="18" height="18" aria-hidden="true" />
    </Button>
  </div>

  <!-- BubbleMenu: shown on text selection.
       Tiptap v3 renders an unstyled positioned container, so the visible
       chrome (surface, border, shadow) lives on the inner .note-bubble-menu. -->
  <BubbleMenu v-if="editor" :editor="editor">
    <div class="note-bubble-menu">
      <Button
        text
        size="small"
        :severity="editor.isActive('bold') ? 'primary' : 'secondary'"
        aria-label="Bold"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <iconify-icon icon="mdi:format-bold" width="18" height="18" aria-hidden="true" />
      </Button>
      <Button
        text
        size="small"
        :severity="editor.isActive('italic') ? 'primary' : 'secondary'"
        aria-label="Italic"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <iconify-icon icon="mdi:format-italic" width="18" height="18" aria-hidden="true" />
      </Button>
      <Button
        text
        size="small"
        :severity="editor.isActive('link') ? 'primary' : 'secondary'"
        aria-label="Insert link"
        @click="promptLink()"
      >
        <iconify-icon icon="mdi:link-variant" width="18" height="18" aria-hidden="true" />
      </Button>
    </div>
  </BubbleMenu>

  <!-- Editor wrapper with iOS keyboard handling -->
  <div
    aria-label="Note body"
    role="textbox"
    aria-multiline="true"
    :style="editorContainerStyle"
  >
    <EditorContent :editor="editor" />
  </div>
</template>

import { generateText } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Link from '@tiptap/extension-link'
import HardBreak from '@tiptap/extension-hard-break'

/**
 * Generates a plaintext snippet (up to 150 chars) from a Tiptap JSONContent doc.
 *
 * Extension array mirrors NoteEditor.vue's useEditor extensions (including OrderedList)
 * so all node types — bullet lists, ordered lists, headings, links — are preserved
 * when extracting text. Ordered-list content will NOT be dropped from the snippet.
 *
 * No side effects, no async, no Vue/PocketBase dependencies.
 */
export function generateNoteSnippet(json: JSONContent): string
{
    return generateText(
        json,
        [
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Heading,
            BulletList,
            OrderedList,
            ListItem,
            Link,
            HardBreak,
        ],
        { blockSeparator: ' ' },
    ).slice(0, 150)
}

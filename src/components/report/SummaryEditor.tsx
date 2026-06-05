"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect } from "react"

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SummaryEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Draft will appear here — edit directly after generation.",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getText())
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] outline-none text-sm prose prose-sm max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0",
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getText()) {
      // Insert AI-generated text as plain text, not raw HTML.
      // Using clearContent + insertContent with a plain string prevents
      // stored XSS from prompt-injected HTML in AI responses. TipTap's
      // insertContent treats a plain string as text (not markup).
      editor.commands.clearContent()
      editor.commands.insertContent(value)
    }
  }, [value, editor])

  return (
    <div className="border rounded-md px-4 py-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 min-h-[200px]">
      <EditorContent editor={editor} />
    </div>
  )
}

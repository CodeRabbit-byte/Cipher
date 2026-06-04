"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import ImageExt from "@tiptap/extension-image"
import { Underline as UnderlineExt } from "@tiptap/extension-underline"
import { useRef, useEffect, useState, useCallback } from "react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
  Check,
  Loader2,
} from "lucide-react"

interface Props {
  engagementId: string
  initialContent: string | null
}

export function ForumNotes({ engagementId, initialContent }: Props) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveContent = useCallback(
    async (json: object) => {
      setSaveState("saving")
      try {
        await fetch(`/api/engagements/${engagementId}/forum-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: JSON.stringify(json) }),
        })
        setSaveState("saved")
      } catch {
        setSaveState("idle")
      }
    },
    [engagementId]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExt.configure({ inline: false, allowBase64: true }),
      UnderlineExt,
    ],
    content: (() => {
      try {
        return initialContent ? JSON.parse(initialContent) : { type: "doc", content: [{ type: "paragraph" }] }
      } catch {
        return { type: "doc", content: [{ type: "paragraph" }] }
      }
    })(),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[500px] focus:outline-none px-6 py-5 [&_img]:rounded [&_img]:max-w-full [&_img]:my-3",
      },
    },
    onUpdate: ({ editor }) => {
      setSaveState("idle")
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveContent(editor.getJSON())
      }, 1500)
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  async function handleImageUpload(file: File) {
    if (!editor) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (res.ok) {
        const { url } = await res.json()
        editor.chain().focus().setImage({ src: url }).run()
      }
    } catch {
      // swallow — image just doesn't insert
    }
  }

  if (!editor) return null

  function tbBtn(
    active: boolean,
    onClick: () => void,
    title: string,
    icon: React.ReactNode
  ) {
    return (
      <button
        key={title}
        title={title}
        onMouseDown={(e) => {
          e.preventDefault()
          onClick()
        }}
        className={`p-1.5 rounded transition-colors ${
          active
            ? "bg-primary/15 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {icon}
      </button>
    )
  }

  const sz = "h-3.5 w-3.5"

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 border-b px-3 py-1.5 flex items-center gap-0.5 flex-wrap bg-background">
        {/* Undo / Redo */}
        {tbBtn(false, () => editor.chain().focus().undo().run(), "Undo", <Undo2 className={sz} />)}
        {tbBtn(false, () => editor.chain().focus().redo().run(), "Redo", <Redo2 className={sz} />)}

        <span className="w-px h-4 bg-border mx-1.5" />

        {/* Headings */}
        {tbBtn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "Heading 1", <Heading1 className={sz} />)}
        {tbBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading 2", <Heading2 className={sz} />)}
        {tbBtn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading 3", <Heading3 className={sz} />)}

        <span className="w-px h-4 bg-border mx-1.5" />

        {/* Inline marks */}
        {tbBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold", <Bold className={sz} />)}
        {tbBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic", <Italic className={sz} />)}
        {tbBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline", <Underline className={sz} />)}
        {tbBtn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strikethrough", <Strikethrough className={sz} />)}

        <span className="w-px h-4 bg-border mx-1.5" />

        {/* Lists */}
        {tbBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bullet list", <List className={sz} />)}
        {tbBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Ordered list", <ListOrdered className={sz} />)}

        <span className="w-px h-4 bg-border mx-1.5" />

        {/* Blocks */}
        {tbBtn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Blockquote", <Quote className={sz} />)}
        {tbBtn(editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "Inline code", <Code className={sz} />)}
        {tbBtn(editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Code block", <Code2 className={sz} />)}

        <span className="w-px h-4 bg-border mx-1.5" />

        {/* Image & HR */}
        <button
          title="Insert image"
          onMouseDown={(e) => {
            e.preventDefault()
            fileInputRef.current?.click()
          }}
          className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ImagePlus className={sz} />
        </button>
        {tbBtn(false, () => editor.chain().focus().setHorizontalRule().run(), "Horizontal rule", <Minus className={sz} />)}

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving…</span>
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageUpload(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

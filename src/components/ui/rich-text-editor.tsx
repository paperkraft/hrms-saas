"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Link } from '@tiptap/extension-link'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AArrowUp, AArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  value: string
  onChange: (html: string, text?: string) => void
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  className?: string
  disabled?: boolean
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px']
const DEFAULT_FONT_SIZE = '16px'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
})

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  minHeight = "100px",
  maxHeight,
  className,
  disabled = false
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontSize,
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getText())
    },
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none focus:outline-none px-3 py-2",
          "[&_p]:my-1 [&_p]:leading-relaxed",
          "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1 [&_ul]:pl-1",
          "[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1 [&_ol]:pl-1",
          "[&_li]:my-0.5 [&_li]:pl-1",
          "[&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer hover:[&_a]:text-blue-800 dark:[&_a]:text-blue-400 dark:hover:[&_a]:text-blue-300",
          "min-h-[inherit]"
        ),
      },
    },
  })

  // Sync value from outside if it changes (e.g. form reset)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // Sync disabled state
  useEffect(() => {
    if (editor && editor.isEditable === disabled) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn(
      "border border-input bg-transparent rounded-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors flex flex-col overflow-hidden",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
      style={{ minHeight, maxHeight }}>
      {/* Editor */}
      <div
        className="flex-1 cursor-text overflow-y-auto min-h-0"
        onClick={() => editor.commands.focus()}
        onKeyDown={(e) => {
          if (e.key.toLowerCase() === 'b' && (e.metaKey || e.ctrlKey)) {
            e.stopPropagation()
          }
        }}
      >
        <EditorContent editor={editor} style={{ minHeight: 'inherit' }} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-t border-border/40 p-1 bg-muted/20 shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('bold') && "bg-muted text-foreground font-bold"
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('italic') && "bg-muted text-foreground font-bold"
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('strike') && "bg-muted text-foreground font-bold"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('underline') && "bg-muted text-foreground font-bold"
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('code') && "bg-muted text-foreground font-bold"
          )}
          title="Code snippet"
        >
          <Code className="size-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('bulletList') && "bg-muted text-foreground font-bold"
          )}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive('orderedList') && "bg-muted text-foreground font-bold"
          )}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
                editor.isActive('link') && "bg-muted text-foreground font-bold"
              )}
              title="Link"
              onClick={() => {
                const previousUrl = editor.getAttributes('link').href
                setLinkUrl(previousUrl || '')
              }}
            >
              <LinkIcon className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (linkUrl === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run()
                    } else {
                      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
                    }
                    setIsLinkPopoverOpen(false)
                  }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                {editor.isActive('link') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run()
                      setIsLinkPopoverOpen(false)
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (linkUrl === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run()
                    } else {
                      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
                    }
                    setIsLinkPopoverOpen(false)
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive({ textAlign: 'left' }) && "bg-muted text-foreground font-bold"
          )}
          title="Align Left"
        >
          <AlignLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive({ textAlign: 'center' }) && "bg-muted text-foreground font-bold"
          )}
          title="Align Center"
        >
          <AlignCenter className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            "p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground",
            editor.isActive({ textAlign: 'right' }) && "bg-muted text-foreground font-bold"
          )}
          title="Align Right"
        >
          <AlignRight className="size-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() => {
            const currentSize = editor.getAttributes('textStyle').fontSize || DEFAULT_FONT_SIZE
            const currentIndex = FONT_SIZES.indexOf(currentSize)
            if (currentIndex < FONT_SIZES.length - 1) {
              editor.chain().focus().setFontSize(FONT_SIZES[currentIndex + 1]).run()
            } else if (currentIndex === -1) {
               // if not found in list, start from a slightly larger default
              editor.chain().focus().setFontSize(FONT_SIZES[FONT_SIZES.indexOf(DEFAULT_FONT_SIZE) + 1]).run()
            }
          }}
          className="p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground flex items-center justify-center"
          title="Increase Font Size (A+)"
        >
          <AArrowUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const currentSize = editor.getAttributes('textStyle').fontSize || DEFAULT_FONT_SIZE
            const currentIndex = FONT_SIZES.indexOf(currentSize)
            if (currentIndex > 0) {
              editor.chain().focus().setFontSize(FONT_SIZES[currentIndex - 1]).run()
            } else if (currentIndex === -1) {
               // if not found in list, start from a slightly smaller default
              editor.chain().focus().setFontSize(FONT_SIZES[FONT_SIZES.indexOf(DEFAULT_FONT_SIZE) - 1]).run()
            }
          }}
          className="p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground flex items-center justify-center"
          title="Decrease Font Size (A-)"
        >
          <AArrowDown className="size-4" />
        </button>
      </div>

    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"

interface RichTextViewerProps {
  content: string
  className?: string
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  // Highlight @mentions and #tasks in the HTML output
  const highlightMentions = (html: string) => {
    let processed = html.replace(/(^|\s|>)(@[^\s<]+)(?=\s|<|$)/g, '$1<span class="text-primary bg-primary/10 px-1 rounded-sm font-bold">$2</span>')
    processed = processed.replace(/(^|\s|>)(#[^\s<]+)(?=\s|<|$)/g, '$1<span class="text-blue-600 bg-blue-50 px-1 rounded-sm font-bold">$2</span>')
    return processed
  }

  // We use dangerouslySetInnerHTML to render the HTML from TipTap.
  // We assume content is sanitized on the server before storage if needed.
  return (
    <div
      className={cn(
        "max-w-full break-words [word-break:break-word] overflow-hidden text-foreground/80 font-semibold",
        "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:break-words",
        "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1 [&_ul]:pl-1",
        "[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1 [&_ol]:pl-1",
        "[&_li]:my-0.5 [&_li]:pl-1 [&_li]:break-words",
        "[&_strong]:text-foreground",
        "[&_a]:text-primary hover:[&_a]:text-primary/80 [&_a]:no-underline hover:[&_a]:underline [&_a]:break-all",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-all",
        className
      )}
      dangerouslySetInnerHTML={{ __html: highlightMentions(content) }}
    />
  )
}

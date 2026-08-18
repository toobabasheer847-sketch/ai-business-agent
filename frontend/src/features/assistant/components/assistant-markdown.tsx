import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

type AssistantMarkdownProps = {
  content: string
  className?: string
}

/** Turn single newlines into GFM hard line breaks. */
function normalizeLineBreaks(content: string): string {
  return content.replace(/(?<!\n)\n(?!\n)/g, '  \n')
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-3 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-2 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-2 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1.5 text-sm font-medium first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2 mb-1.5 text-sm font-medium first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2 mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted-foreground line-through">{children}</del>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className)

    if (isBlock) {
      return (
        <code className={cn('font-mono text-xs', className)} {...props}>
          {children}
        </code>
      )
    }

    return (
      <code
        className="rounded-md bg-background/80 px-1 py-0.5 font-mono text-[0.85em] text-foreground ring-1 ring-border/60"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg border bg-background/80 p-3 font-mono text-xs leading-relaxed last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 w-full overflow-x-auto rounded-lg border">
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b bg-muted/40 [&_tr]:border-b">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b transition-colors hover:bg-muted/30">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="h-9 px-3 text-left align-middle text-xs font-medium whitespace-normal text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-middle whitespace-normal">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
}

export function AssistantMarkdown({
  content,
  className,
}: AssistantMarkdownProps) {
  return (
    <div className={cn('assistant-markdown break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {normalizeLineBreaks(content)}
      </ReactMarkdown>
    </div>
  )
}

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memo } from 'react';

interface ChatMarkdownProps {
  content: string;
}

export const ChatMarkdown = memo(function ChatMarkdown({ content }: ChatMarkdownProps) {
  if (!content) return null;

  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-[0.94rem] font-bold mt-2.5 mb-1 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>,
          h4: ({ children }) => <h6 className="text-sm font-semibold mt-1.5 mb-0.5 first:mt-0">{children}</h6>,
          // Paragraphs
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          // Strong / emphasis
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // Lists
          ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block p-2 rounded-lg bg-muted text-[0.85em] font-mono overflow-x-auto my-2 ${className ?? ''}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2 last:my-0">{children}</pre>,
          // Tables
          table: ({ children }) => (
            <div className="my-2 last:my-0 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="divide-x divide-border">{children}</tr>,
          th: ({ children }) => (
            <th className="px-2.5 py-1.5 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5 text-foreground/80 whitespace-nowrap">{children}</td>
          ),
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-2 last:my-0 pl-3 border-l-2 border-primary/40 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="my-3 border-border" />,
          // Links
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

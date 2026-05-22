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
          // Headings — senior-friendly large sizes
          h1: ({ children }) => <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-2 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-lg sm:text-xl font-bold mt-3 mb-1.5 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-lg font-semibold mt-2.5 mb-1 first:mt-0">{children}</h5>,
          h4: ({ children }) => <h6 className="text-base font-semibold mt-2 mb-1 first:mt-0">{children}</h6>,
          // Paragraphs — inherit the large bubble font size
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          // Strong / emphasis
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // Lists
          ul: ({ children }) => <ul className="mb-2.5 last:mb-0 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2.5 last:mb-0 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block p-3 rounded-lg bg-muted text-[0.9em] font-mono overflow-x-auto my-2.5 ${className ?? ''}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2.5 last:my-0">{children}</pre>,
          // Tables — bigger text for readability
          table: ({ children }) => (
            <div className="my-2.5 last:my-0 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-base border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="divide-x divide-border">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-foreground/80 whitespace-nowrap">{children}</td>
          ),
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 last:my-0 pl-4 border-l-3 border-primary/40 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,
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

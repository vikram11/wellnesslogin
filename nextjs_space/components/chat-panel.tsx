'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Heart, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/chat/history');
        if (res?.ok) {
          const data = await res.json();
          setMessages(data?.messages ?? []);
        }
      } catch (e: any) {
        console.error('Failed to load chat history:', e);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef?.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = input?.trim?.() ?? '';
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev: Message[]) => [...(prev ?? []), userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev: Message[]) => [
      ...(prev ?? []),
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response?.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response?.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder?.decode?.(value, { stream: true }) ?? '';
          
          // Parse SSE
          const lines = chunk?.split?.('\n') ?? [];
          for (const line of lines) {
            if (line?.startsWith?.('data: ')) {
              const data = line?.slice?.(6) ?? '';
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed?.choices?.[0]?.delta?.content ?? '';
                if (content) {
                  fullContent += content;
                  // Remove health_data tags from display
                  const displayContent = fullContent?.replace?.(/<health_data>[\s\S]*?<\/health_data>/g, '')?.trim?.() ?? '';
                  setMessages((prev: Message[]) =>
                    (prev ?? []).map((m: Message) =>
                      m?.id === assistantId ? { ...(m ?? {}), content: displayContent } as Message : m
                    )
                  );
                }
              } catch {
                // skip invalid JSON
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      toast.error('Failed to send message. Please try again.');
      setMessages((prev: Message[]) =>
        (prev ?? []).map((m: Message) =>
          m?.id === assistantId ? { ...(m ?? {}), content: 'Sorry, I had trouble processing that. Please try again! 🙏' } as Message : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === 'Enter' && !e?.shiftKey) {
      e?.preventDefault?.();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (messages?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold tracking-tight mb-2">Hi there! 👋</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              I'm Amma's health logger. Tell me about blood pressure readings, medications taken, symptoms, or anything health-related and I'll keep track of it all.
            </p>
            <div className="mt-6 grid gap-2 w-full max-w-sm">
              {[
                'BP is 128/62 pulse 70 this morning before meds',
                'AM meds taken ✔️',
                'Back pain 4/10 today, much better',
                'Had a good night\'s sleep, appetite is great',
              ]?.map?.((suggestion: string, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef?.current?.focus?.();
                  }}
                  className="text-left text-sm px-4 py-2.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-foreground"
                >
                  {suggestion}
                </button>
              )) ?? []}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(messages ?? []).map((msg: Message) => (
              <div
                key={msg?.id}
                className={`flex gap-3 ${
                  msg?.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg?.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg?.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  <div className="chat-markdown whitespace-pre-wrap">{msg?.content || (msg?.role === 'assistant' && isLoading ? '' : '')}</div>
                  {msg?.role === 'assistant' && !msg?.content && isLoading && (
                    <div className="flex gap-1 py-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e?.target?.value ?? '')}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about Amma's health today..."
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !(input?.trim?.())}
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

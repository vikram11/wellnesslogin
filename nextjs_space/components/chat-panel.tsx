'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Heart, Bot, ImagePlus, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ChatMarkdown } from '@/components/chat-markdown';
import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageData?: string | null;
  createdAt: string;
}

// Compress image to max dimension and quality, returns data URL
function compressImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection (gallery or camera)
  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image too large. Please use a photo under 20 MB.');
      return;
    }
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
    } catch {
      toast.error('Could not process the image. Please try another.');
    } finally {
      setIsCompressing(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

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
    if ((!trimmed && !imagePreview) || isLoading) return;

    setInput('');
    const sentImage = imagePreview;
    clearImage();
    setIsLoading(true);

    // If there's an image, upload it to get a persistent file path first
    let imagePath: string | null = null;
    if (sentImage) {
      try {
        const uploadRes = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: sentImage }),
        });
        if (uploadRes?.ok) {
          const uploadData = await uploadRes.json();
          imagePath = uploadData?.path ?? null;
        } else {
          console.warn('Image upload failed, falling back to base64');
        }
      } catch (err) {
        console.warn('Image upload error, falling back to base64:', err);
      }
    }

    // Use the persistent path for display, fall back to base64 preview
    const displayImage = imagePath || sentImage;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed || (sentImage ? '(photo attached)' : ''),
      imageData: displayImage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev: Message[]) => [...(prev ?? []), userMsg]);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev: Message[]) => [
      ...(prev ?? []),
      { id: assistantId, role: 'assistant', content: '', imageData: imagePath, createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed || 'What do you see in this image?',
          imageData: sentImage, // still send base64 for LLM vision
          imagePath: imagePath, // send the saved file path for DB storage
          localTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          localDateTime: (() => {
            const now = new Date();
            const offset = -now.getTimezoneOffset();
            const sign = offset >= 0 ? '+' : '-';
            const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
            const m = String(Math.abs(offset) % 60).padStart(2, '0');
            return now.getFullYear() + '-' +
              String(now.getMonth() + 1).padStart(2, '0') + '-' +
              String(now.getDate()).padStart(2, '0') + 'T' +
              String(now.getHours()).padStart(2, '0') + ':' +
              String(now.getMinutes()).padStart(2, '0') + ':' +
              String(now.getSeconds()).padStart(2, '0') +
              sign + h + ':' + m;
          })(),
        }),
      });

      if (!response?.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error || `Server error ${response?.status}`);
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
      const errMsg = e?.message || 'Unknown error';
      toast.error(errMsg);
      setMessages((prev: Message[]) =>
        (prev ?? []).map((m: Message) =>
          m?.id === assistantId ? { ...(m ?? {}), content: `Sorry, I had trouble processing that: ${errMsg} 🙏` } as Message : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, imagePreview, clearImage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === 'Enter' && !e?.shiftKey) {
      e?.preventDefault?.();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
        }}
      />

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
            <h2 className="font-display text-2xl font-semibold tracking-tight mb-2">Hi there! 👋</h2>
            <p className="text-muted-foreground max-w-sm text-base">
              I'm your wellness companion. Tell me about blood pressure readings, medications taken, symptoms, or anything health-related and I'll keep track of it all.
            </p>
            <p className="text-muted-foreground max-w-sm text-sm mt-2">
              📷 You can also snap a photo of a prescription bottle, lab report, or BP monitor!
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
                  className="text-left text-base px-4 py-3 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-foreground"
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
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[85%]">
                  {/* Image attachment — user messages show their uploaded photo */}
                  {msg?.role === 'user' && msg?.imageData && (
                    <div className="rounded-xl overflow-hidden border border-border ml-auto" style={{ maxWidth: 240 }}>
                      <div className="relative aspect-[4/3] bg-muted">
                        <Image
                          src={msg.imageData}
                          alt="Attached photo"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  {/* Image reference — assistant messages show the photo they analyzed */}
                  {msg?.role === 'assistant' && msg?.imageData && (
                    <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/30" style={{ maxWidth: 180 }}>
                      <div className="px-2 pt-1.5 pb-1">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">📷 Analyzing</span>
                      </div>
                      <div className="relative aspect-[4/3] bg-muted">
                        <Image
                          src={msg.imageData}
                          alt="Photo being analyzed"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-lg sm:text-xl leading-relaxed ${
                      msg?.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border rounded-bl-md'
                    }`}
                  >
                    {msg?.role === 'assistant' ? (
                      <ChatMarkdown content={msg?.content ?? ''} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg?.content ?? ''}</div>
                    )}
                    {msg?.role === 'assistant' && !msg?.content && isLoading && (
                      <div className="flex gap-1.5 py-1">
                        <span className="w-2.5 h-2.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2.5 h-2.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2.5 h-2.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card px-4 py-3">
        {/* Image preview */}
        {(imagePreview || isCompressing) && (
          <div className="max-w-3xl mx-auto mb-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1.5 pr-3">
              {isCompressing ? (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : imagePreview ? (
                <div className="relative w-12 h-12 rounded overflow-hidden bg-muted">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                </div>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {isCompressing ? 'Processing...' : 'Photo attached'}
              </span>
              {!isCompressing && (
                <button
                  onClick={clearImage}
                  className="ml-1 p-0.5 rounded-full hover:bg-accent transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex gap-2 items-stretch">
          {/* Image buttons — stacked vertically on mobile, horizontal on desktop */}
          <div className="flex flex-col sm:flex-row gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-[44px] w-[48px] sm:h-full sm:w-[48px]"
              title="Attach photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isCompressing}
            >
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-[44px] w-[48px] sm:h-full sm:w-[48px]"
              title="Take photo"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isLoading || isCompressing}
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e?.target?.value ?? '')}
            onKeyDown={handleKeyDown}
            placeholder={imagePreview ? 'Add a note about this photo...' : 'Tell me about your health today...'}
            className="min-h-[92px] sm:min-h-[52px] max-h-[160px] resize-none text-lg leading-relaxed"
            rows={2}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || (!(input?.trim?.()) && !imagePreview)}
            className="shrink-0 h-auto w-[48px] self-stretch"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

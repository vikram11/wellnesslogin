'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, Send, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface SavedRecipient {
  id: string;
  email: string;
}

export function EmailPanel() {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch('/api/recipients');
      const data = res?.ok ? await res.json() : { recipients: [] };
      setSavedRecipients(data?.recipients ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const toggleRecipient = (id: string) => {
    setSent(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const removeRecipient = async (id: string) => {
    try {
      await fetch(`/api/recipients?id=${id}`, { method: 'DELETE' });
      setSavedRecipients((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast.error('Failed to remove recipient');
    }
  };

  const autoSaveRecipient = async (addr: string): Promise<void> => {
    const trimmed = addr.trim().toLowerCase();
    if (!trimmed) return;
    // Don't re-save if already in the list
    if (savedRecipients.some((r) => r.email === trimmed)) return;
    try {
      const res = await fetch('/api/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res?.ok) {
        await fetchRecipients();
      }
    } catch {
      /* silent */
    }
  };

  const sendEmail = async () => {
    // Collect all recipient emails
    const recipients: string[] = [];
    for (const id of selectedIds) {
      const r = savedRecipients.find((s) => s.id === id);
      if (r) recipients.push(r.email);
    }
    const typed = email?.trim?.() ?? '';
    if (typed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) {
      if (!recipients.includes(typed.toLowerCase())) {
        recipients.push(typed.toLowerCase());
      }
    }

    if (recipients.length === 0) {
      toast.error('Please select or enter at least one recipient');
      return;
    }

    setSending(true);
    setSent(false);

    try {
      // Send to each recipient
      const results = await Promise.all(
        recipients.map(async (addr) => {
          const res = await fetch('/api/email-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientEmail: addr, days }),
          });
          return res?.json?.();
        })
      );

      const allOk = results.every((r) => r?.success);
      if (allOk) {
        setSent(true);
        toast.success(
          recipients.length === 1
            ? 'Email sent successfully!'
            : `Sent to ${recipients.length} recipients!`
        );
        // Auto-save any typed email
        if (typed) {
          await autoSaveRecipient(typed);
          setEmail('');
        }
      } else {
        throw new Error('One or more emails failed to send');
      }
    } catch (e: any) {
      console.error('Email error:', e);
      toast.error(e?.message ?? 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 overflow-y-auto h-full chat-scroll">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Email Summary</h2>
        <p className="text-muted-foreground text-sm">Send a health summary report via email</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Send Health Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved Recipients */}
          {savedRecipients.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Saved Recipients</label>
              <div className="flex flex-wrap gap-2">
                {savedRecipients.map((r) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      className={`
                        group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                        cursor-pointer transition-all duration-150 select-none
                        ${isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }
                      `}
                      onClick={() => toggleRecipient(r.id)}
                    >
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[180px]">{r.email}</span>
                      <button
                        className={`
                          ml-0.5 rounded-full p-0.5 transition-colors
                          ${isSelected
                            ? 'hover:bg-primary-foreground/20'
                            : 'hover:bg-destructive/20 opacity-0 group-hover:opacity-100'
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecipient(r.id);
                        }}
                        title="Remove saved recipient"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual Email Input */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {savedRecipients.length > 0 ? 'Or enter a new address' : 'Recipient Email'}
            </label>
            <Input
              type="email"
              placeholder="doctor@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setEmail(e?.target?.value ?? '');
                setSent(false);
              }}
              className="max-w-md"
            />
            {savedRecipients.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Addresses are saved automatically after first send
              </p>
            )}
          </div>

          {/* Period Selection */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Summary Period</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 1, label: 'Today' },
                { value: 3, label: '3 Days' },
                { value: 7, label: '1 Week' },
                { value: 14, label: '2 Weeks' },
                { value: 30, label: '1 Month' },
              ].map((opt: { value: number; label: string }) => (
                <Button
                  key={opt?.value}
                  variant={days === opt?.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDays(opt?.value ?? 1)}
                >
                  {opt?.label}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={sendEmail} disabled={sending} className="gap-2">
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sent ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Sending...' : sent ? 'Sent!' : 'Send Summary'}
          </Button>

          <p className="text-xs text-muted-foreground">
            The email will include BP readings, notes, and medication compliance for the selected period.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

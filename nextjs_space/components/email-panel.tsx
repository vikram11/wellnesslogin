'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, Send, CheckCircle, X, Clock, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface SavedRecipient {
  id: string;
  email: string;
}

interface EmailSchedule {
  id: string;
  enabled: boolean;
  sendTime: string;
  recipientIds: string[];
}

export function EmailPanel() {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Daily schedule state
  const [schedule, setSchedule] = useState<EmailSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch('/api/recipients');
      const data = res?.ok ? await res.json() : { recipients: [] };
      setSavedRecipients(data?.recipients ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      setScheduleLoading(true);
      const res = await fetch('/api/email-schedule');
      const data = res?.ok ? await res.json() : null;
      if (data) {
        setSchedule({
          id: data.id,
          enabled: data.enabled,
          sendTime: data.sendTime,
          recipientIds: data.recipientIds || [],
        });
      }
    } catch {
      /* ignore */
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
    fetchSchedule();
  }, [fetchRecipients, fetchSchedule]);

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

  // Daily schedule handlers
  const toggleSchedule = async (enabled: boolean) => {
    if (!schedule) return;
    setScheduleSaving(true);
    try {
      const res = await fetch('/api/email-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          sendTime: schedule.sendTime,
          recipientIds: schedule.recipientIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule({ ...schedule, enabled });
        toast.success(enabled ? 'Daily summaries enabled' : 'Daily summaries disabled');
      }
    } catch {
      toast.error('Failed to update schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  const updateSendTime = async (newTime: string) => {
    if (!schedule) return;
    setScheduleSaving(true);
    try {
      const res = await fetch('/api/email-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedule.enabled,
          sendTime: newTime,
          recipientIds: schedule.recipientIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule({ ...schedule, sendTime: newTime });
        toast.success('Send time updated');
      }
    } catch {
      toast.error('Failed to update send time');
    } finally {
      setScheduleSaving(false);
    }
  };

  const toggleScheduleRecipient = async (recipientId: string) => {
    if (!schedule) return;
    const currentIds = schedule.recipientIds || [];
    let newIds: string[];
    if (currentIds.includes(recipientId)) {
      newIds = currentIds.filter(id => id !== recipientId);
    } else {
      newIds = [...currentIds, recipientId];
    }
    setScheduleSaving(true);
    try {
      const res = await fetch('/api/email-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedule.enabled,
          sendTime: schedule.sendTime,
          recipientIds: newIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule({ ...schedule, recipientIds: newIds });
      }
    } catch {
      toast.error('Failed to update recipients');
    } finally {
      setScheduleSaving(false);
    }
  };

  // Format time for display (24h to 12h)
  const formatTime12 = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 overflow-y-auto h-full chat-scroll">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Email Summary</h2>
        <p className="text-muted-foreground text-sm">Send health summary reports via email</p>
      </div>

      {/* Daily Auto-Summary Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Automatic Daily Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable daily summaries</p>
              <p className="text-xs text-muted-foreground">
                {schedule?.enabled ? 'Daily emails will be sent automatically' : 'Daily summaries are currently disabled'}
              </p>
            </div>
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                schedule?.enabled ? 'bg-primary' : 'bg-muted'
              }`}
              onClick={() => toggleSchedule(!schedule?.enabled)}
              disabled={scheduleSaving || scheduleLoading}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                  schedule?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Send Time */}
          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Send time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={schedule?.sendTime || '08:00'}
                onChange={(e) => updateSendTime(e.target.value)}
                disabled={!schedule?.enabled || scheduleSaving}
                className="border rounded-md px-2 py-1.5 text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-muted-foreground">
                {schedule ? formatTime12(schedule.sendTime) : '—'} (Central Time)
              </span>
            </div>
          </div>

          {/* Recipients for daily summary */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Daily summary recipients
            </label>
            {savedRecipients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved recipients yet. Add recipients below first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedRecipients.map((r) => {
                  const isSelected = schedule?.recipientIds?.includes(r.id);
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
                      onClick={() => toggleScheduleRecipient(r.id)}
                    >
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[180px]">{r.email}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Send Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Send Wellness Summary
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
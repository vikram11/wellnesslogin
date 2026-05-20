'use client';

import { useState } from 'react';
import { Mail, Loader2, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function EmailPanel() {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendEmail = async () => {
    if (!email?.trim?.()) {
      toast.error('Please enter an email address');
      return;
    }
    setSending(true);
    setSent(false);
    try {
      const res = await fetch('/api/email-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: email?.trim?.() ?? '', days }),
      });
      const data = await res?.json?.();
      if (data?.success) {
        setSent(true);
        toast.success('Email sent successfully!');
      } else {
        throw new Error(data?.error ?? 'Failed to send');
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
          <div>
            <label className="text-sm font-medium mb-1.5 block">Recipient Email</label>
            <Input
              type="email"
              placeholder="doctor@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e?.target?.value ?? '')}
              className="max-w-md"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Summary Period</label>
            <div className="flex gap-2">
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
            The email will include BP readings, medication compliance, observations, and daily notes for the selected period.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

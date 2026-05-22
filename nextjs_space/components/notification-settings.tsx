'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Loader2, Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { toast } from 'sonner';

interface Reminder {
  id: string;
  label: string;
  time: string; // HH:MM
  enabled: boolean;
  isDefault: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const hour = h ?? 0;
  const minute = m ?? 0;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // ID of reminder being saved

  // New custom reminder form
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [addingNew, setAddingNew] = useState(false);

  // Check push subscription
  const checkSubscription = useCallback(async (reg: ServiceWorkerRegistration) => {
    try {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  // Init service worker
  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setPushLoading(false);
        return;
      }
      setIsSupported(true);
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        setSwRegistration(reg);
        await checkSubscription(reg);
      } catch (err) {
        console.error('SW registration failed:', err);
      }
      setPushLoading(false);
    };
    init();
  }, [checkSubscription]);

  // Load reminders when drawer opens or push subscription becomes active
  useEffect(() => {
    if (isOpen && isSubscribed) {
      loadReminders();
    }
  }, [isOpen, isSubscribed]);

  const loadReminders = async () => {
    setRemindersLoading(true);
    setRemindersError(false);
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data?.reminders ?? []);
      } else {
        console.error('Load reminders failed:', res.status);
        setRemindersError(true);
        toast.error('Could not load reminders. Please try again.');
      }
    } catch (err) {
      console.error('Load reminders error:', err);
      setRemindersError(true);
      toast.error('Could not load reminders. Please try again.');
    }
    setRemindersLoading(false);
  };

  // Subscribe to push
  const subscribe = async () => {
    if (!swRegistration) return;
    setPushLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('VAPID key not configured');
      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const subJson = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
        }),
      });
      setIsSubscribed(true);
      toast.success('Notifications enabled!');
    } catch (err: any) {
      if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked. Enable them in your browser settings.');
      } else {
        toast.error('Failed to enable notifications');
      }
    }
    setPushLoading(false);
  };

  // Unsubscribe from push
  const unsubscribe = async () => {
    if (!swRegistration) return;
    setPushLoading(true);
    try {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success('Notifications disabled');
    } catch {
      toast.error('Failed to disable notifications');
    }
    setPushLoading(false);
  };

  // Toggle a reminder on/off
  const toggleReminder = async (id: string, enabled: boolean) => {
    setSaving(id);
    try {
      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      if (res.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
      }
    } catch {
      toast.error('Failed to update reminder');
    }
    setSaving(null);
  };

  // Update reminder time
  const updateTime = async (id: string, time: string) => {
    setSaving(id);
    try {
      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, time }),
      });
      if (res.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, time } : r));
        toast.success('Time updated');
      }
    } catch {
      toast.error('Failed to update time');
    }
    setSaving(null);
  };

  // Add custom reminder
  const addReminder = async () => {
    if (!newLabel.trim()) {
      toast.error('Please enter a reminder name');
      return;
    }
    setAddingNew(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), time: newTime }),
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(prev => [...prev, data.reminder]);
        setNewLabel('');
        setNewTime('09:00');
        toast.success('Reminder added!');
      }
    } catch {
      toast.error('Failed to add reminder');
    }
    setAddingNew(false);
  };

  // Delete custom reminder
  const deleteReminder = async (id: string) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id));
        toast.success('Reminder removed');
      } else {
        const data = await res.json();
        toast.error(data?.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete reminder');
    }
    setSaving(null);
  };

  // Don't render if push isn't supported
  if (!isSupported && !pushLoading) return null;

  const defaultReminders = reminders.filter(r => r.isDefault);
  const customReminders = reminders.filter(r => !r.isDefault);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Notification settings"
          className="relative"
        >
          {pushLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isSubscribed ? (
            <Bell className="w-5 h-5 text-primary" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          )}
          {isSubscribed && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full" />
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-lg overflow-y-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Reminder Settings
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Customize when you receive check-in reminders
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-6">
            {/* Master Push Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-muted/50 border border-border p-4">
              <div>
                <p className="text-lg font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? 'Receiving reminders on this device' : 'Enable to receive reminders'}
                </p>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
                disabled={pushLoading}
              />
            </div>

            {/* Reminders list (only show when subscribed) */}
            {isSubscribed && (
              <>
                {remindersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : remindersError ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-base text-muted-foreground">Could not load reminders</p>
                    <Button variant="outline" size="sm" onClick={loadReminders}>
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Default Reminders */}
                    {defaultReminders.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">Medication Reminders</h3>
                        {defaultReminders.map(r => (
                          <ReminderRow
                            key={r.id}
                            reminder={r}
                            saving={saving === r.id}
                            onToggle={(enabled) => toggleReminder(r.id, enabled)}
                            onTimeChange={(time) => updateTime(r.id, time)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Custom Reminders */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">Custom Reminders</h3>
                      {customReminders.length > 0 ? (
                        customReminders.map(r => (
                          <ReminderRow
                            key={r.id}
                            reminder={r}
                            saving={saving === r.id}
                            onToggle={(enabled) => toggleReminder(r.id, enabled)}
                            onTimeChange={(time) => updateTime(r.id, time)}
                            onDelete={() => deleteReminder(r.id)}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No custom reminders yet</p>
                      )}

                      {/* Add new reminder */}
                      <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
                        <p className="text-base font-medium">Add a Reminder</p>
                        <Input
                          value={newLabel}
                          onChange={e => setNewLabel(e.target.value)}
                          placeholder="e.g. PT Exercises, Take BP Reading"
                          className="text-base h-12"
                        />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                            <input
                              type="time"
                              value={newTime}
                              onChange={e => setNewTime(e.target.value)}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <Button
                            onClick={addReminder}
                            disabled={addingNew || !newLabel.trim()}
                            className="h-11 px-4 text-base"
                          >
                            {addingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="text-base h-12">Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Individual reminder row
function ReminderRow({
  reminder,
  saving,
  onToggle,
  onTimeChange,
  onDelete,
}: {
  reminder: Reminder;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 transition-opacity ${!reminder.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-medium truncate">{reminder.label}</p>
        </div>
        <Switch
          checked={reminder.enabled}
          onCheckedChange={onToggle}
          disabled={saving}
        />
      </div>
      <div className="flex items-center justify-between mt-2.5 gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="time"
            value={reminder.time}
            onChange={e => onTimeChange(e.target.value)}
            disabled={!reminder.enabled || saving}
            className="rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground hidden sm:inline">
            ({formatTime12h(reminder.time)})
          </span>
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={saving}
            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete reminder"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

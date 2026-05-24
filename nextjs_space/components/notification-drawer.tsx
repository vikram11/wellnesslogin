'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellOff, Clock, Plus, Trash2, X, Loader2, Pencil, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { usePushManager } from '@/hooks/use-push-manager';

interface Notification {
  id: string;
  label: string;
  time: string;
  type: string;
  enabled: boolean;
  daysOfWeek: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { isSupported, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushManager();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // New notification form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('12:00');

  // Edit label inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data?.notifications) {
        setNotifications(data.notifications);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const toggleNotif = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
        );
      }
    } catch {
      toast.error('Failed to toggle notification');
    } finally {
      setSavingId(null);
    }
  };

  const updateTime = async (id: string, time: string) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_time', id, time }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, time } : n)));
        toast.success('Time updated');
      }
    } catch {
      toast.error('Failed to update time');
    } finally {
      setSavingId(null);
    }
  };

  const saveLabel = async (id: string) => {
    if (!editLabel.trim()) {
      setEditingId(null);
      return;
    }
    setSavingId(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_label', id, label: editLabel.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, label: editLabel.trim() } : n))
        );
        toast.success('Label updated');
      }
    } catch {
      toast.error('Failed to update label');
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  const deleteNotif = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast.success('Notification deleted');
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setSavingId(null);
    }
  };

  const createNotification = async () => {
    if (!newLabel.trim()) {
      toast.error('Please enter a label');
      return;
    }
    setSavingId('new');
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', label: newLabel.trim(), time: newTime }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => [...prev, data.notification]);
        setShowNewForm(false);
        setNewLabel('');
        setNewTime('12:00');
        toast.success('Custom notification added');
      } else {
        toast.error(data.error || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create notification');
    } finally {
      setSavingId(null);
    }
  };

  const isFixed = (type: string) =>
    ['morning_meds', 'midday_meds', 'evening_meds'].includes(type);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] flex flex-col ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notification Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Push Subscription Card */}
              {isSupported && (
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Push Notifications</p>
                        <p className="text-xs text-muted-foreground">
                          {isSubscribed
                            ? 'This device receives push alerts'
                            : 'Allow notifications on this device'}
                        </p>
                      </div>
                    </div>
                    {isSubscribed ? (
                      <button
                        onClick={async () => {
                          const ok = await unsubscribe();
                          if (ok) toast.success('Push notifications disabled');
                          else toast.error('Could not unsubscribe');
                        }}
                        disabled={pushLoading}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {pushLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Disable'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await subscribe();
                          if (ok) toast.success('Push notifications enabled!');
                          else toast.error('Permission denied or push not available');
                        }}
                        disabled={pushLoading}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {pushLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Enable'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`rounded-xl border p-4 transition-opacity ${
                    notif.enabled ? 'border-border' : 'border-border/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleNotif(notif.id)}
                      disabled={savingId === notif.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        notif.enabled ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                          notif.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    {/* Label and time */}
                    <div className="flex-1 min-w-0">
                      {editingId === notif.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onBlur={() => saveLabel(notif.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLabel(notif.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 border rounded-md px-2 py-1 text-sm bg-background"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{notif.label}</span>
                          <button
                            onClick={() => {
                              setEditingId(notif.id);
                              setEditLabel(notif.label);
                            }}
                            className="p-0.5 rounded hover:bg-muted shrink-0"
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="time"
                          value={notif.time}
                          onChange={(e) => updateTime(notif.id, e.target.value)}
                          disabled={savingId === notif.id}
                          className="border rounded-md px-2 py-1 text-xs bg-background disabled:opacity-50"
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatTime12(notif.time)}
                        </span>
                      </div>
                    </div>

                    {/* Delete (custom only) */}
                    {!isFixed(notif.type) && (
                      <button
                        onClick={() => deleteNotif(notif.id)}
                        disabled={savingId === notif.id}
                        className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add custom notification button */}
              {!showNewForm ? (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Notification
                </button>
              ) : (
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">New Custom Notification</h3>
                    <button
                      onClick={() => {
                        setShowNewForm(false);
                        setNewLabel('');
                        setNewTime('12:00');
                      }}
                      className="p-1 rounded hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Do PT Exercises"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm bg-background"
                    />
                  </div>
                  <button
                    onClick={createNotification}
                    disabled={savingId === 'new'}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {savingId === 'new' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add Notification
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
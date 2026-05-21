'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

export function NotificationToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const checkSubscription = useCallback(async (reg: ServiceWorkerRegistration) => {
    try {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setLoading(false);
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
      setLoading(false);
    };
    init();
  }, [checkSubscription]);

  const subscribe = async () => {
    if (!swRegistration) return;
    setLoading(true);
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
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
        }),
      });

      setIsSubscribed(true);
      toast.success('Notifications enabled! You\'ll receive check-in reminders.');
    } catch (err: any) {
      console.error('Subscribe error:', err);
      if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked. Please enable them in your browser settings.');
      } else {
        toast.error('Failed to enable notifications');
      }
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    if (!swRegistration) return;
    setLoading(true);
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
    } catch (err: any) {
      console.error('Unsubscribe error:', err);
      toast.error('Failed to disable notifications');
    }
    setLoading(false);
  };

  // Don't render anything if push isn't supported
  if (!isSupported && !loading) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={isSubscribed ? 'Disable check-in reminders' : 'Enable check-in reminders'}
      className="relative"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-4 h-4 text-primary" />
      ) : (
        <BellOff className="w-4 h-4 text-muted-foreground" />
      )}
      {isSubscribed && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
      )}
    </Button>
  );
}

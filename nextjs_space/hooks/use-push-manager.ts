'use client';

import { useState, useEffect, useCallback } from 'react';

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

export function usePushManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  const checkSubscription = useCallback(async (reg: ServiceWorkerRegistration) => {
    try {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  // Auto-initialize: register SW + check subscription on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setLoading(false);
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    navigator.serviceWorker.register('/sw.js')
      .then(async (reg) => {
        setSwReg(reg);
        await checkSubscription(reg);
      })
      .catch((err) => console.error('SW registration error:', err))
      .finally(() => setLoading(false));
  }, [checkSubscription]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!swReg) return false;
    setLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('VAPID key not configured');

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
        }),
      });

      if (!res.ok) throw new Error('Server rejected subscription');

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      console.error('Subscribe error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!swReg) return false;
    setLoading(true);
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        // Tell server to remove subscription
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (err: any) {
      console.error('Unsubscribe error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe };
}
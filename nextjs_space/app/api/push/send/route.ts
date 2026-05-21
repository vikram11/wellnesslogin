export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = `mailto:noreply@${(() => { try { return new URL(process.env.NEXTAUTH_URL ?? '').hostname; } catch { return 'localhost'; } })()}`;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = body?.title ?? 'WellnessLog.in';
    const message = body?.body ?? 'Time for a check-in!';
    const tag = body?.tag ?? 'checkin';
    const url = body?.url ?? '/';

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscribers' });
    }

    const payload = JSON.stringify({ title, body: message, tag, url });
    const staleIds: string[] = [];
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        // 410 Gone or 404 means subscription expired
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          staleIds.push(sub.id);
        } else {
          console.error(`Push failed for ${sub.label || sub.id}:`, err?.statusCode, err?.body);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      });
    }

    return NextResponse.json({ success: true, sent, stale: staleIds.length });
  } catch (error: any) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}

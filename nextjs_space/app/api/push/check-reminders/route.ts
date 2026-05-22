export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = 'mailto:noreply@' + (() => { try { return new URL(process.env.NEXTAUTH_URL ?? '').hostname; } catch { return 'localhost'; } })();

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// Get current time in Central timezone as { hours, minutes }
function getCentralTime(): { hours: number; minutes: number } {
  const now = new Date();
  // Convert to Central time string and parse
  const centralStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false });
  // Format: "M/D/YYYY, HH:MM:SS"
  const timePart = centralStr.split(', ')[1] ?? '';
  const [h, m] = timePart.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

export async function POST(request: NextRequest) {
  try {
    const { hours, minutes } = getCentralTime();
    const currentMinutes = hours * 60 + minutes;

    // Find all enabled reminders
    const reminders = await prisma.reminderSchedule.findMany({
      where: { enabled: true },
    });

    if (reminders.length === 0) {
      return NextResponse.json({ success: true, fired: 0, message: 'No enabled reminders' });
    }

    // Get subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, fired: 0, message: 'No subscribers' });
    }

    let totalFired = 0;
    const firedLabels: string[] = [];

    for (const reminder of reminders) {
      // Parse reminder time
      const [rh, rm] = (reminder.time ?? '00:00').split(':').map(Number);
      const reminderMinutes = (rh ?? 0) * 60 + (rm ?? 0);

      // Check if current time is within ±7 minutes of reminder time
      const diff = Math.abs(currentMinutes - reminderMinutes);
      const isInWindow = diff <= 7 || diff >= (24 * 60 - 7); // handle midnight wraparound

      if (!isInWindow) continue;

      // Check if already fired recently (within last 60 minutes) to prevent duplicates
      if (reminder.lastFiredAt) {
        const msSinceFired = Date.now() - new Date(reminder.lastFiredAt).getTime();
        if (msSinceFired < 60 * 60 * 1000) continue; // skip, fired less than 1 hour ago
      }

      // Fire this reminder!
      const payload = JSON.stringify({
        title: 'WellnessLog.in',
        body: reminder.label || 'Time for a check-in!',
        tag: 'reminder-' + reminder.id,
        url: '/',
      });

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
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            staleIds.push(sub.id);
          } else {
            console.error('Push failed for ' + (sub.label || sub.id) + ':', err?.statusCode);
          }
        }
      }

      // Clean up stale subscriptions
      if (staleIds.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { id: { in: staleIds } },
        });
      }

      // Mark as fired
      await prisma.reminderSchedule.update({
        where: { id: reminder.id },
        data: { lastFiredAt: new Date() },
      });

      totalFired++;
      firedLabels.push(reminder.label);
    }

    return NextResponse.json({
      success: true,
      fired: totalFired,
      labels: firedLabels,
      checkedAt: hours + ':' + String(minutes).padStart(2, '0') + ' Central',
    });
  } catch (error: any) {
    console.error('Check reminders error:', error);
    return NextResponse.json({ error: 'Failed to check reminders' }, { status: 500 });
  }
}

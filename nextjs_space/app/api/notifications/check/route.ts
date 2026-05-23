export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get current time in America/Chicago
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const chicagoTime = timeFormatter.format(now);
    const [currentHour, currentMinute] = chicagoTime.split(':').map(Number);
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Also get day of week in Chicago (1=Monday ... 7=Sunday)
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
    });
    const chicagoDayAbbr = dayFormatter.format(now).toLowerCase();
    const dayMap: Record<string, number> = {
      mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7,
    };
    const currentDayOfWeek = dayMap[chicagoDayAbbr] || 0;

    // Get all enabled notifications
    const notifications = await prisma.notification.findMany({
      where: { enabled: true },
    });

    let sent = 0;

    for (const notif of notifications) {
      // Parse notification time
      const [notifHour, notifMinute] = notif.time.split(':').map(Number);
      const notifTotalMinutes = notifHour * 60 + notifMinute;

      const diffMinutes = currentTotalMinutes - notifTotalMinutes;

      // Only fire within a 0-1 minute window (just passed)
      if (diffMinutes < 0 || diffMinutes >= 1) continue;

      // Check days of week
      const days: number[] = JSON.parse(notif.daysOfWeek || '[1,2,3,4,5,6,7]');
      if (!days.includes(currentDayOfWeek)) continue;

      // Send the push notification
      try {
        const tag = `notif-${notif.id}-${currentHour}-${currentMinute}`;
        await fetch(`http://localhost:3000/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'WellnessLog.in',
            body: notif.label,
            tag,
            url: '/',
          }),
        });
        sent++;
      } catch {
        console.error(`Failed to fire notification ${notif.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      checkTime: chicagoTime,
      dayOfWeek: currentDayOfWeek,
    });
  } catch (error: any) {
    console.error('Notifications check error:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Check failed' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fixed medication notification types and their default labels/times
const FIXED_TYPES = [
  { type: 'morning_meds', defaultLabel: 'Take Morning Medications', defaultTime: '07:00' },
  { type: 'midday_meds', defaultLabel: 'Take Midday Medications', defaultTime: '12:00' },
  { type: 'evening_meds', defaultLabel: 'Take Evening Medications', defaultTime: '19:00' },
] as const;

// Ensure fixed notification records exist
export async function GET() {
  try {
    // Auto-create any missing fixed notification records
    for (const f of FIXED_TYPES) {
      const existing = await prisma.notification.findFirst({ where: { type: f.type } });
      if (!existing) {
        await prisma.notification.create({
          data: { label: f.defaultLabel, time: f.defaultTime, type: f.type },
        });
      }
    }

    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, label, time, enabled, daysOfWeek } = body;

    // Delete a custom notification
    if (action === 'delete' && id) {
      const notif = await prisma.notification.findUnique({ where: { id } });
      if (!notif) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      if (FIXED_TYPES.some((f) => f.type === notif.type)) {
        return NextResponse.json({ success: false, error: 'Cannot delete fixed notifications' }, { status: 400 });
      }
      await prisma.notification.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    // Toggle enabled
    if (action === 'toggle' && id) {
      const notif = await prisma.notification.findUnique({ where: { id } });
      if (!notif) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      const updated = await prisma.notification.update({
        where: { id },
        data: { enabled: !notif.enabled },
      });
      return NextResponse.json({ success: true, notification: updated });
    }

    // Update time
    if (action === 'update_time' && id && time) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return NextResponse.json({ success: false, error: 'Invalid time format' }, { status: 400 });
      }
      const updated = await prisma.notification.update({
        where: { id },
        data: { time },
      });
      return NextResponse.json({ success: true, notification: updated });
    }

    // Update label
    if (action === 'update_label' && id && label) {
      const updated = await prisma.notification.update({
        where: { id },
        data: { label },
      });
      return NextResponse.json({ success: true, notification: updated });
    }

    // Create custom notification
    if (action === 'create' && label && time) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return NextResponse.json({ success: false, error: 'Invalid time format' }, { status: 400 });
      }
      const created = await prisma.notification.create({
        data: {
          label,
          time,
          type: 'custom',
          enabled: true,
          daysOfWeek: daysOfWeek ?? '[1,2,3,4,5,6,7]',
        },
      });
      return NextResponse.json({ success: true, notification: created });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Notifications POST error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to process' }, { status: 500 });
  }
}
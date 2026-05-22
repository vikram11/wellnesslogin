export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Default reminders seeded on first GET if none exist
const DEFAULT_REMINDERS = [
  { label: 'AM Meds Reminder', time: '08:00', isDefault: true, enabled: true },
  { label: 'Midday Meds Reminder', time: '13:00', isDefault: true, enabled: true },
  { label: 'PM Meds Reminder', time: '20:00', isDefault: true, enabled: true },
];

async function seedDefaults() {
  const count = await prisma.reminderSchedule.count();
  if (count === 0) {
    for (const r of DEFAULT_REMINDERS) {
      await prisma.reminderSchedule.create({ data: r });
    }
  }
}

// GET — list all reminders (seeds defaults on first call)
export async function GET() {
  try {
    await seedDefaults();
    const reminders = await prisma.reminderSchedule.findMany({
      orderBy: [{ isDefault: 'desc' }, { time: 'asc' }],
    });
    return NextResponse.json({ reminders });
  } catch (error: any) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

// POST — create a new custom reminder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const label = body?.label?.trim();
    const time = body?.time; // HH:MM

    if (!label || !time) {
      return NextResponse.json({ error: 'Label and time are required' }, { status: 400 });
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: 'Time must be in HH:MM format' }, { status: 400 });
    }

    const reminder = await prisma.reminderSchedule.create({
      data: { label, time, enabled: true, isDefault: false },
    });
    return NextResponse.json({ reminder });
  } catch (error: any) {
    console.error('Create reminder error:', error);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}

// PUT — update a reminder (time, enabled, label)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (!id) {
      return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (body.label !== undefined) updateData.label = body.label.trim();
    if (body.time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.time)) {
        return NextResponse.json({ error: 'Time must be in HH:MM format' }, { status: 400 });
      }
      updateData.time = body.time;
    }
    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled);

    const reminder = await prisma.reminderSchedule.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ reminder });
  } catch (error: any) {
    console.error('Update reminder error:', error);
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}

// DELETE — remove a custom reminder (cannot delete defaults)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });
    }

    // Check if it's a default — don't allow deletion
    const reminder = await prisma.reminderSchedule.findUnique({ where: { id } });
    if (reminder?.isDefault) {
      return NextResponse.json({ error: 'Cannot delete built-in reminders. Disable them instead.' }, { status: 400 });
    }

    await prisma.reminderSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete reminder error:', error);
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // There should only ever be one schedule record
    let schedule = await prisma.dailyEmailSchedule.findFirst();

    if (!schedule) {
      schedule = await prisma.dailyEmailSchedule.create({
        data: {
          enabled: false,
          sendTime: '08:00',
          recipientIds: '[]',
        },
      });
    }

    return NextResponse.json({
      id: schedule.id,
      enabled: schedule.enabled,
      sendTime: schedule.sendTime,
      recipientIds: JSON.parse(schedule.recipientIds || '[]'),
    });
  } catch (error: any) {
    console.error('Email schedule GET error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, sendTime, recipientIds } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
    }

    if (sendTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
      return NextResponse.json({ success: false, error: 'sendTime must be in HH:MM format' }, { status: 400 });
    }

    if (recipientIds && !Array.isArray(recipientIds)) {
      return NextResponse.json({ success: false, error: 'recipientIds must be an array' }, { status: 400 });
    }

    // Upsert the single schedule record
    let schedule = await prisma.dailyEmailSchedule.findFirst();

    if (schedule) {
      schedule = await prisma.dailyEmailSchedule.update({
        where: { id: schedule.id },
        data: {
          enabled,
          sendTime: sendTime ?? schedule.sendTime,
          recipientIds: JSON.stringify(recipientIds ?? []),
        },
      });
    } else {
      schedule = await prisma.dailyEmailSchedule.create({
        data: {
          enabled,
          sendTime: sendTime ?? '08:00',
          recipientIds: JSON.stringify(recipientIds ?? []),
        },
      });
    }

    return NextResponse.json({
      success: true,
      id: schedule.id,
      enabled: schedule.enabled,
      sendTime: schedule.sendTime,
      recipientIds: JSON.parse(schedule.recipientIds),
    });
  } catch (error: any) {
    console.error('Email schedule POST error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to save schedule' }, { status: 500 });
  }
}
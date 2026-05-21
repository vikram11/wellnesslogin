export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request?.url ?? '');
    const days = parseInt(searchParams?.get?.('days') ?? '30', 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Fetch medication logs for the period
    const logs = await prisma.medicationLog.findMany({
      where: {
        date: { gte: fromDate },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch all medications (active and inactive) so we can show what was scheduled
    const medications = await prisma.medication.findMany({
      orderBy: [{ timeSlot: 'asc' }, { name: 'asc' }],
    });

    // Build a lookup of scheduled meds per time slot (active ones)
    const scheduledBySlot: Record<string, string[]> = {};
    for (const med of medications) {
      if (med?.isActive) {
        const slot = med?.timeSlot ?? 'AM';
        if (!scheduledBySlot[slot]) scheduledBySlot[slot] = [];
        scheduledBySlot[slot].push(med.name);
      }
    }

    // Enrich each log with checklist data
    const enrichedLogs = logs.map((log: any) => {
      let takenNames: string[] = [];
      try {
        takenNames = JSON.parse(log?.medications ?? '[]');
      } catch {
        takenNames = [];
      }
      if (!Array.isArray(takenNames)) takenNames = [];

      const slot = log?.timeSlot ?? 'AM';
      const scheduled = scheduledBySlot[slot] ?? [];

      // Build checklist: each scheduled med marked taken or not
      const checklist = scheduled.map((name: string) => ({
        name,
        taken: takenNames.some((t: string) => t.toLowerCase() === name.toLowerCase()),
      }));

      // Also include any taken meds not in the current schedule (in case schedule changed)
      for (const taken of takenNames) {
        if (!checklist.some((c: any) => c.name.toLowerCase() === taken.toLowerCase())) {
          checklist.push({ name: taken, taken: true });
        }
      }

      return {
        id: log.id,
        date: log.date,
        timeSlot: log.timeSlot,
        notes: log.notes,
        compliance: log.compliance,
        checklist,
      };
    });

    return NextResponse.json({ logs: enrichedLogs, scheduledBySlot });
  } catch (error: any) {
    console.error('Error fetching meds-taken:', error);
    return NextResponse.json({ logs: [], scheduledBySlot: {} });
  }
}

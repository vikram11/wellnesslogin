export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request?.url ?? '');
    const days = parseInt(searchParams?.get?.('days') ?? '7', 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Get readings
    const readings = await prisma.bpReading.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'asc' },
    });

    // Get medication logs
    const medLogs = await prisma.medicationLog.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    // Get daily notes
    const notes = await prisma.dailyNote.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    // Calculate stats
    const bpStats = {
      count: readings?.length ?? 0,
      avgSystolic: (readings?.length ?? 0) > 0 ? Math.round((readings ?? []).reduce((s: number, r: any) => s + (r?.systolic ?? 0), 0) / (readings?.length ?? 1)) : 0,
      avgDiastolic: (readings?.length ?? 0) > 0 ? Math.round((readings ?? []).reduce((s: number, r: any) => s + (r?.diastolic ?? 0), 0) / (readings?.length ?? 1)) : 0,
      avgPulse: (() => {
        const withPulse = (readings ?? []).filter((r: any) => r?.pulse != null);
        return (withPulse?.length ?? 0) > 0 ? Math.round(withPulse.reduce((s: number, r: any) => s + (r?.pulse ?? 0), 0) / (withPulse?.length ?? 1)) : null;
      })(),
      maxSystolic: (readings?.length ?? 0) > 0 ? Math.max(...(readings ?? []).map((r: any) => r?.systolic ?? 0)) : 0,
      minSystolic: (readings?.length ?? 0) > 0 ? Math.min(...(readings ?? []).map((r: any) => r?.systolic ?? 999)) : 0,
      maxDiastolic: (readings?.length ?? 0) > 0 ? Math.max(...(readings ?? []).map((r: any) => r?.diastolic ?? 0)) : 0,
      minDiastolic: (readings?.length ?? 0) > 0 ? Math.min(...(readings ?? []).map((r: any) => r?.diastolic ?? 999)) : 0,
    };

    const medCompliance = {
      totalLogs: medLogs?.length ?? 0,
      compliant: (medLogs ?? []).filter((l: any) => l?.compliance)?.length ?? 0,
    };

    return NextResponse.json({
      period: { from: fromDate.toISOString(), to: new Date().toISOString(), days },
      bpStats,
      medCompliance,
      readings: readings ?? [],
      notes: notes ?? [],
    });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

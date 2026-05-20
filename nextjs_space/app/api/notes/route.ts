export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request?.url ?? '');
    const days = parseInt(searchParams?.get?.('days') ?? '30', 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const notes = await prisma.dailyNote.findMany({
      where: {
        date: { gte: fromDate },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json({ notes: notes ?? [] });
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ notes: [] });
  }
}

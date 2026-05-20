export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const medications = await prisma.medication.findMany({
      orderBy: [{ isActive: 'desc' }, { timeSlot: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ medications: medications ?? [] });
  } catch (error: any) {
    console.error('Error fetching medications:', error);
    return NextResponse.json({ medications: [] });
  }
}

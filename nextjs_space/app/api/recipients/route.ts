export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const recipients = await prisma.savedRecipient.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ recipients: recipients ?? [] });
  } catch (error: any) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json({ recipients: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body?.email ?? '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const recipient = await prisma.savedRecipient.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    return NextResponse.json({ recipient });
  } catch (error: any) {
    console.error('Error saving recipient:', error);
    return NextResponse.json({ error: 'Failed to save recipient' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request?.url ?? '');
    const id = searchParams?.get?.('id') ?? '';

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await prisma.savedRecipient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting recipient:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

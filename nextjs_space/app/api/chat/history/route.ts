export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return NextResponse.json({ messages: messages ?? [] });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ messages: [] });
  }
}

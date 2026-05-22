export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { content: '' },
      });
    }
    return new Response(JSON.stringify({ content: profile.content }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return new Response(JSON.stringify({ content: '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Content must be a string' }), { status: 400 });
    }

    let profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (profile) {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { content },
      });
    } else {
      await prisma.userProfile.create({
        data: { content },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), { status: 500 });
  }
}
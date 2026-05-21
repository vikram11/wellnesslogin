export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TZ = 'America/Chicago';
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const days = body?.days ?? 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const readings = await prisma.bpReading.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'asc' },
    });

    const medications = await prisma.medication.findMany({
      where: { isActive: true },
      orderBy: [{ timeSlot: 'asc' }, { name: 'asc' }],
    });

    const medLogs = await prisma.medicationLog.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    const notes = await prisma.dailyNote.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    // Build data summary for LLM
    const dataContext = `
BP Readings (${readings?.length ?? 0} readings over ${days} days):
${(readings ?? []).map((r: any) => {
  const d = r?.date ? new Date(r.date) : new Date();
  return `  ${fmtDate(d)} ${fmtTime(d)}: ${r?.systolic ?? 0}/${r?.diastolic ?? 0} HR:${r?.pulse ?? 'N/A'} (${r?.context ?? 'no context'})`;
}).join('\n')}

Current Medications:
${(medications ?? []).map((m: any) => `  [${m?.timeSlot ?? '?'}] ${m?.name ?? ''} ${m?.dosage ?? ''} ${m?.notes ? '- ' + m.notes : ''}`).join('\n')}

Medication Compliance: ${medLogs?.length ?? 0} logs, ${(medLogs ?? []).filter((l: any) => l?.compliance)?.length ?? 0} compliant

Medication Logs:
${(medLogs ?? []).map((l: any) => {
  const d = l?.date ? new Date(l.date) : new Date();
  let meds: string[] = [];
  try { meds = JSON.parse(l?.medications ?? '[]'); } catch { meds = []; }
  return `  ${fmtDate(d)} ${fmtTime(d)} [${l?.timeSlot ?? '?'}]: ${Array.isArray(meds) ? meds.join(', ') : 'unknown'}${l?.compliance ? ' ✓' : ' ✗'}${l?.notes ? ' — ' + l.notes : ''}`;
}).join('\n')}

Daily Notes:
${(notes ?? []).map((n: any) => {
  const d = n?.date ? new Date(n.date) : new Date();
  return `  ${fmtDate(d)}: ${n?.note ?? ''}`;
}).join('\n')}
`;

    const response = await fetch('https://ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemma4:31b-cloud',
        messages: [
          {
            role: 'system',
            content: 'You are a medical documentation assistant. Generate a concise, professional clinical summary suitable for a physician review. Use standard medical formatting with sections. Be factual and data-driven. Do not add disclaimers.',
          },
          {
            role: 'user',
            content: `Generate a doctor-ready summary report based on the following ${days}-day health data:\n${dataContext}\n\nDo not use any patient names — refer to the patient as "the patient" only in this clinical document context.\n\nFormat with these sections:\n- Patient Overview\n- Blood Pressure Summary (include avg, range, trend assessment)\n- Current Medications\n- Medication Compliance & Logs\n- Daily Notes\n- Clinical Notes/Recommendations`,
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response?.ok) {
      throw new Error(`LLM API error: ${response?.status}`);
    }

    const result = await response?.json?.();
    const summary = result?.choices?.[0]?.message?.content ?? 'Failed to generate summary';

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Doctor summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

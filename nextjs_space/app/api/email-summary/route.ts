export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

const TZ = 'America/Chicago';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: TZ });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const days = body?.days ?? 1;
    const recipientEmail = body?.recipientEmail ?? '';

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Gather data
    const readings = await prisma.bpReading.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'asc' },
    });

    const medLogs = await prisma.medicationLog.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    const notes = await prisma.dailyNote.findMany({
      where: { date: { gte: fromDate } },
      orderBy: { date: 'desc' },
    });

    // Get active medications for checklist cross-referencing
    const activeMeds = await prisma.medication.findMany({
      where: { isActive: true },
      orderBy: [{ timeSlot: 'asc' }, { name: 'asc' }],
    });

    const scheduledBySlot: Record<string, string[]> = {};
    for (const med of activeMeds) {
      const slot = med?.timeSlot ?? 'AM';
      if (!scheduledBySlot[slot]) scheduledBySlot[slot] = [];
      scheduledBySlot[slot].push(med.name);
    }

    // Build HTML email
    const bpRows = (readings ?? []).map((r: any) => {
      const d = r?.date ? new Date(r.date) : new Date();
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${fmtDate(d)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${fmtTime(d)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${r?.systolic ?? 0}/${r?.diastolic ?? 0}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r?.pulse ?? '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r?.context ?? ''}</td>
      </tr>`;
    }).join('');

    const avgSys = (readings?.length ?? 0) > 0 ? Math.round((readings ?? []).reduce((s: number, r: any) => s + (r?.systolic ?? 0), 0) / (readings?.length ?? 1)) : 'N/A';
    const avgDia = (readings?.length ?? 0) > 0 ? Math.round((readings ?? []).reduce((s: number, r: any) => s + (r?.diastolic ?? 0), 0) / (readings?.length ?? 1)) : 'N/A';

    const notesHtml = (notes ?? []).map((n: any) => {
      const d = n?.date ? new Date(n.date) : new Date();
      return `<li style="margin-bottom:6px;"><strong>${fmtDate(d)}</strong>: ${n?.note ?? ''}</li>`;
    }).join('');

    // Build Meds Taken section with checklist
    // Reuse the fuzzy matching from meds-taken API
    function normMed(name: string): string {
      return name.toLowerCase().trim()
        .replace(/\s*\d+(\.\d+)?\s*(mg|mcg|iu|ml|g|tab|cap|tabs|caps)\b/gi, '')
        .replace(/\s*er\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    const ABBREVS: Record<string, string[]> = {
      'multivitamin': ['mvi', 'multi'],
      'vitamin d': ['vit d', 'vitd'],
      'methylprednisolone': ['medrol', 'methyl'],
      'pantoprazole': ['protonix'],
    };
    function medNameMatches(logName: string, scheduledName: string): boolean {
      const a = normMed(logName);
      const b = normMed(scheduledName);
      if (a === b) return true;
      if (a.startsWith(b) || b.startsWith(a)) return true;
      const aFirst = a.split(/\s+/)[0];
      const bFirst = b.split(/\s+/)[0];
      if (aFirst === bFirst && aFirst.length >= 3) return true;
      for (const [canonical, abbrs] of Object.entries(ABBREVS)) {
        const names = [canonical, ...abbrs];
        const aMatch = names.some(n => a.startsWith(n) || n.startsWith(a));
        const bMatch = names.some(n => b.startsWith(n) || n.startsWith(b));
        if (aMatch && bMatch) return true;
      }
      if (scheduledName.includes('+')) {
        const parts = scheduledName.split('+').map(p => normMed(p));
        if (parts.some(p => a.startsWith(p) || p.startsWith(a))) return true;
      }
      return false;
    }

    const SLOT_LABELS: Record<string, string> = { AM: 'Morning', MID: 'Midday', PM: 'Evening' };

    const medsRows = (medLogs ?? []).map((log: any) => {
      const d = log?.date ? new Date(log.date) : new Date();
      let takenNames: string[] = [];
      try { takenNames = JSON.parse(log?.medications ?? '[]'); } catch { takenNames = []; }
      if (!Array.isArray(takenNames)) takenNames = [];

      const slot = log?.timeSlot ?? 'AM';
      const scheduled = scheduledBySlot[slot] ?? [];
      const matchedTaken = new Set<number>();

      const checklistItems = scheduled.map((name: string) => {
        const takenIdx = takenNames.findIndex((t: string, idx: number) =>
          !matchedTaken.has(idx) && medNameMatches(t, name)
        );
        if (takenIdx >= 0) {
          matchedTaken.add(takenIdx);
          return { name, taken: true };
        }
        // Compound check
        if (name.includes('+')) {
          const parts = name.split('+').map(p => normMed(p));
          const indices: number[] = [];
          for (const part of parts) {
            const idx = takenNames.findIndex((t, i) => !matchedTaken.has(i) && !indices.includes(i) &&
              (normMed(t).startsWith(part) || part.startsWith(normMed(t))));
            if (idx >= 0) indices.push(idx);
          }
          if (indices.length === parts.length) {
            for (const ci of indices) matchedTaken.add(ci);
            return { name, taken: true };
          }
        }
        return { name, taken: false };
      });

      // Unmatched taken meds
      for (let i = 0; i < takenNames.length; i++) {
        if (!matchedTaken.has(i)) {
          checklistItems.push({ name: takenNames[i], taken: true });
        }
      }

      const checksHtml = checklistItems.map((item: any) =>
        `<span style="display:inline-block;margin-right:10px;${!item.taken ? 'color:#999;text-decoration:line-through;' : ''}">${item.taken ? '☑' : '☐'} ${item.name}</span>`
      ).join('');

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;vertical-align:top;">${fmtDate(d)}<br/><span style="color:#666;font-size:12px;">${fmtTime(d)} · ${SLOT_LABELS[slot] ?? slot}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px;">${checksHtml}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px;color:#666;">${log?.notes ?? ''}</td>
      </tr>`;
    }).join('');

    const periodLabel = days === 1 ? 'Daily' : `${days}-Day`;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#1a1a2e;">
        <div style="background:#0d9488;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">💚 ${periodLabel} Health Summary</h1>
          <p style="color:#ccfbf1;margin:6px 0 0;font-size:14px;">Period: ${fmtDate(fromDate)} — ${fmtDate(new Date())}</p>
        </div>

        <div style="padding:24px;background:#f8fffe;border:1px solid #e0f2f1;">
          <h2 style="color:#0d9488;font-size:18px;margin-top:0;">📊 Blood Pressure Overview</h2>
          <p style="font-size:14px;">Readings: <strong>${readings?.length ?? 0}</strong> | Avg: <strong>${avgSys}/${avgDia}</strong></p>
          
          ${(readings?.length ?? 0) > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
            <thead><tr style="background:#e0f2f1;">
              <th style="padding:8px;text-align:left;">Date</th>
              <th style="padding:8px;text-align:left;">Time</th>
              <th style="padding:8px;text-align:left;">BP</th>
              <th style="padding:8px;text-align:left;">HR</th>
              <th style="padding:8px;text-align:left;">Context</th>
            </tr></thead>
            <tbody>${bpRows}</tbody>
          </table>` : '<p style="color:#888;">No BP readings in this period.</p>'}

          ${(notes?.length ?? 0) > 0 ? `
          <h2 style="color:#0d9488;font-size:18px;">📝 Notes</h2>
          <ul style="font-size:14px;padding-left:20px;">${notesHtml}</ul>` : ''}

          <h2 style="color:#0d9488;font-size:18px;">💊 Meds Taken</h2>
          <p style="font-size:14px;">Logs recorded: <strong>${medLogs?.length ?? 0}</strong> | All compliant: <strong>${(medLogs ?? []).every((l: any) => l?.compliance) ? 'Yes ✅' : 'See details'}</strong></p>
          
          ${(medLogs?.length ?? 0) > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
            <thead><tr style="background:#e0f2f1;">
              <th style="padding:8px;text-align:left;">Date / Time</th>
              <th style="padding:8px;text-align:left;">Meds Taken</th>
              <th style="padding:8px;text-align:left;">Notes</th>
            </tr></thead>
            <tbody>${medsRows}</tbody>
          </table>` : '<p style="color:#888;">No medication logs in this period.</p>'}
        </div>

        <div style="padding:16px 24px;background:#e0f2f1;border-radius:0 0 8px 8px;font-size:12px;color:#555;">
          Generated by Health Logger
        </div>
      </div>
    `;

    // Validate SMTP config
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM || `Health Logger <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment.');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587/other
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const toAddr = recipientEmail || smtpUser;
    const subject = `${periodLabel} Health Summary — ${fmtDateShort(new Date())}`;

    await transporter.sendMail({
      from: emailFrom,
      to: toAddr,
      subject,
      html: htmlBody,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email summary error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to send email' }, { status: 500 });
  }
}

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

    // Helper: normalize a med name for matching
    function normMed(name: string): string {
      return name.toLowerCase().trim()
        .replace(/\s*\d+(\.\d+)?\s*(mg|mcg|iu|ml|g|tab|cap|tabs|caps)\b/gi, '') // strip dosages
        .replace(/\s*er\b/gi, '') // strip ER
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Common abbreviation map
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
      // Check first word match
      const aFirst = a.split(/\s+/)[0];
      const bFirst = b.split(/\s+/)[0];
      if (aFirst === bFirst && aFirst.length >= 3) return true;
      // Check abbreviation matches
      for (const [canonical, abbrs] of Object.entries(ABBREVS)) {
        const names = [canonical, ...abbrs];
        const aMatch = names.some(n => a.startsWith(n) || n.startsWith(a));
        const bMatch = names.some(n => b.startsWith(n) || n.startsWith(b));
        if (aMatch && bMatch) return true;
      }
      // Check if scheduled is a compound (e.g., "Potassium + Magnesium") and log matches a component
      if (scheduledName.includes('+')) {
        const parts = scheduledName.split('+').map(p => normMed(p));
        if (parts.some(p => a.startsWith(p) || p.startsWith(a))) return true;
      }
      return false;
    }

    // For compound scheduled meds like "Potassium + Magnesium", check if MULTIPLE log entries cover all parts
    function compoundFullyTaken(scheduledName: string, takenNames: string[], matchedTaken: Set<number>): number[] {
      if (!scheduledName.includes('+')) return [];
      const parts = scheduledName.split('+').map(p => normMed(p));
      const indices: number[] = [];
      for (const part of parts) {
        const idx = takenNames.findIndex((t, i) => !matchedTaken.has(i) && !indices.includes(i) && 
          (normMed(t).startsWith(part) || part.startsWith(normMed(t))));
        if (idx >= 0) indices.push(idx);
      }
      return indices.length === parts.length ? indices : [];
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

      // Track which taken names have been matched to scheduled meds
      const matchedTaken = new Set<number>();

      // Build checklist: each scheduled med marked taken or not
      const checklist = scheduled.map((name: string) => {
        // First try direct match
        const takenIdx = takenNames.findIndex((t: string, idx: number) => 
          !matchedTaken.has(idx) && medNameMatches(t, name)
        );
        if (takenIdx >= 0) {
          matchedTaken.add(takenIdx);
          return { name, taken: true };
        }
        // For compound meds, check if all parts are present
        const compoundIndices = compoundFullyTaken(name, takenNames, matchedTaken);
        if (compoundIndices.length > 0) {
          for (const ci of compoundIndices) matchedTaken.add(ci);
          return { name, taken: true };
        }
        return { name, taken: false };
      });

      // Also include any taken meds not matched to the schedule
      for (let i = 0; i < takenNames.length; i++) {
        if (!matchedTaken.has(i)) {
          checklist.push({ name: takenNames[i], taken: true });
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

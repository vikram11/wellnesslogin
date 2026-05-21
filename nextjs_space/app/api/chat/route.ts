export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { extractHealthData, HealthData } from '@/lib/parse-health-data';

// Parse timezone offset from client's ISO datetime (e.g., "2026-05-21T19:20:00.000-05:00" → "-05:00")
function getTimezoneOffset(localDateTime: string): string {
  const match = localDateTime?.match?.(/([+-]\d{2}:\d{2})$/);
  if (match) return match[1];
  // If Z (UTC), no offset needed
  if (localDateTime?.endsWith?.('Z')) return '+00:00';
  return '';
}

// Ensure a date string from the LLM includes timezone info
function ensureTimezone(dateStr: string, tzOffset: string): Date {
  if (!dateStr) return new Date();
  // If the date already has timezone info (Z or +/-), parse directly
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // If it's just a date (no time), append midnight in user's timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T12:00:00${tzOffset || '+00:00'}`);
  }
  // Otherwise, append the user's timezone offset
  return new Date(`${dateStr}${tzOffset || '+00:00'}`);
}

async function saveHealthData(data: HealthData, tzOffset: string = '') {
  const results: string[] = [];

  // Save BP readings
  if (data?.bp_readings && (data.bp_readings?.length ?? 0) > 0) {
    for (const bp of data.bp_readings) {
      try {
        await prisma.bpReading.create({
          data: {
            date: ensureTimezone(bp?.date ?? '', tzOffset),
            systolic: bp?.systolic ?? 0,
            diastolic: bp?.diastolic ?? 0,
            pulse: bp?.pulse ?? null,
            context: bp?.context ?? null,
            notes: bp?.notes ?? null,
          },
        });
        results.push(`BP ${bp?.systolic}/${bp?.diastolic}`);
      } catch (e: any) {
        console.error('Error saving BP:', e);
      }
    }
  }

  // Save medication logs
  if (data?.medication_logs && (data.medication_logs?.length ?? 0) > 0) {
    for (const log of data.medication_logs) {
      try {
        await prisma.medicationLog.create({
          data: {
            date: ensureTimezone(log?.date ?? '', tzOffset),
            timeSlot: log?.timeSlot ?? 'AM',
            medications: JSON.stringify(log?.medications ?? []),
            compliance: log?.compliance ?? true,
            notes: log?.notes ?? null,
          },
        });
        results.push(`${log?.timeSlot} meds logged`);
      } catch (e: any) {
        console.error('Error saving med log:', e);
      }
    }
  }

  // Save observations
  if (data?.observations && (data.observations?.length ?? 0) > 0) {
    for (const obs of data.observations) {
      try {
        await prisma.observation.create({
          data: {
            date: ensureTimezone(obs?.date ?? '', tzOffset),
            category: obs?.category ?? 'symptom',
            description: obs?.description ?? '',
            severity: obs?.severity ?? null,
          },
        });
        results.push(`Observation: ${obs?.category}`);
      } catch (e: any) {
        console.error('Error saving observation:', e);
      }
    }
  }

  // Save daily notes
  if (data?.daily_notes && (data.daily_notes?.length ?? 0) > 0) {
    for (const note of data.daily_notes) {
      try {
        await prisma.dailyNote.create({
          data: {
            date: ensureTimezone(note?.date ?? '', tzOffset),
            note: note?.note ?? '',
          },
        });
        results.push('Daily note saved');
      } catch (e: any) {
        console.error('Error saving daily note:', e);
      }
    }
  }

  // Handle edits
  if (data?.edits && (data.edits?.length ?? 0) > 0) {
    for (const edit of data.edits) {
      try {
        if (edit?.type === 'bp_reading' && edit?.id) {
          const updateData: Record<string, any> = {};
          const field = edit?.field ?? '';
          if (field === 'systolic' || field === 'diastolic' || field === 'pulse') {
            updateData[field] = parseInt(edit?.new_value ?? '0', 10);
          } else {
            updateData[field] = edit?.new_value ?? '';
          }
          await prisma.bpReading.update({
            where: { id: edit.id },
            data: updateData,
          });
          results.push(`Edited BP reading`);
        }
      } catch (e: any) {
        console.error('Error processing edit:', e);
      }
    }
  }

  // Handle deletes
  if (data?.deletes && (data.deletes?.length ?? 0) > 0) {
    for (const del of data.deletes) {
      try {
        const type = del?.type ?? '';
        const match = del?.match ?? {};
        const count = del?.count ?? 0;

        if (type === 'bp_reading') {
          const where: Record<string, any> = {};
          if (match.systolic) where.systolic = Number(match.systolic);
          if (match.diastolic) where.diastolic = Number(match.diastolic);
          if (match.pulse) where.pulse = Number(match.pulse);

          // Find matching records, limited by count
          const records = await prisma.bpReading.findMany({
            where,
            orderBy: { date: 'desc' },
            take: count > 0 ? count : 100,
          });

          if (records.length > 0) {
            await prisma.bpReading.deleteMany({
              where: { id: { in: records.map((r: any) => r.id) } },
            });
            results.push(`Deleted ${records.length} BP reading(s)`);
          }
        } else if (type === 'observation') {
          const where: Record<string, any> = {};
          if (match.description) where.description = { contains: match.description };
          if (match.category) where.category = match.category;

          const records = await prisma.observation.findMany({
            where,
            orderBy: { date: 'desc' },
            take: count > 0 ? count : 100,
          });

          if (records.length > 0) {
            await prisma.observation.deleteMany({
              where: { id: { in: records.map((r: any) => r.id) } },
            });
            results.push(`Deleted ${records.length} observation(s)`);
          }
        } else if (type === 'daily_note') {
          const where: Record<string, any> = {};
          if (match.note) where.note = { contains: match.note };

          const records = await prisma.dailyNote.findMany({
            where,
            orderBy: { date: 'desc' },
            take: count > 0 ? count : 100,
          });

          if (records.length > 0) {
            await prisma.dailyNote.deleteMany({
              where: { id: { in: records.map((r: any) => r.id) } },
            });
            results.push(`Deleted ${records.length} note(s)`);
          }
        } else if (type === 'medication_log') {
          const where: Record<string, any> = {};
          if (match.timeSlot) where.timeSlot = match.timeSlot;

          const records = await prisma.medicationLog.findMany({
            where,
            orderBy: { date: 'desc' },
            take: count > 0 ? count : 100,
          });

          if (records.length > 0) {
            await prisma.medicationLog.deleteMany({
              where: { id: { in: records.map((r: any) => r.id) } },
            });
            results.push(`Deleted ${records.length} medication log(s)`);
          }
        }
      } catch (e: any) {
        console.error('Error processing delete:', e);
      }
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = body?.message ?? '';
    const localTime = body?.localTime ?? '';
    const localDateTime = body?.localDateTime ?? '';
    const tzOffset = getTimezoneOffset(localDateTime);

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    // Save user message to chat history
    await prisma.chatMessage.create({
      data: { role: 'user', content: userMessage },
    });

    // Get recent chat history for context
    const recentMessages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get recent health data for context
    const recentBP = await prisma.bpReading.findMany({
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Get current medications for context
    const activeMeds = await prisma.medication.findMany({
      where: { isActive: true },
      orderBy: [{ timeSlot: 'asc' }, { name: 'asc' }],
    });

    // Get recent medication logs
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const recentMedLogs = await prisma.medicationLog.findMany({
      where: { date: { gte: threeDaysAgo } },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Get recent observations
    const recentObs = await prisma.observation.findMany({
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Format dates in the user's local timezone for LLM context
    // The server runs in UTC, so we manually apply the offset
    function formatDateLocal(d: Date | string | null): string {
      if (!d) return 'unknown';
      const utc = new Date(d);
      // Parse offset in minutes from tzOffset string (e.g., "-05:00" → -300)
      let offsetMinutes = 0;
      if (tzOffset) {
        const match = tzOffset.match(/^([+-])(\d{2}):(\d{2})$/);
        if (match) {
          offsetMinutes = (parseInt(match[2]) * 60 + parseInt(match[3])) * (match[1] === '+' ? 1 : -1);
        }
      }
      const local = new Date(utc.getTime() + offsetMinutes * 60000);
      const month = local.getUTCMonth() + 1;
      const day = local.getUTCDate();
      const year = local.getUTCFullYear();
      return `${month}/${day}/${year}`;
    }

    function formatTimeLocal(d: Date | string | null): string {
      if (!d) return '';
      const utc = new Date(d);
      let offsetMinutes = 0;
      if (tzOffset) {
        const match = tzOffset.match(/^([+-])(\d{2}):(\d{2})$/);
        if (match) {
          offsetMinutes = (parseInt(match[2]) * 60 + parseInt(match[3])) * (match[1] === '+' ? 1 : -1);
        }
      }
      const local = new Date(utc.getTime() + offsetMinutes * 60000);
      let hours = local.getUTCHours();
      const minutes = local.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }

    let recentContext = '';

    if (recentBP?.length) {
      recentContext += `\n\nRecent BP readings: ${(recentBP ?? []).map((r: any) => `${formatDateLocal(r?.date)} ${formatTimeLocal(r?.date)}: ${r?.systolic ?? 0}/${r?.diastolic ?? 0} HR:${r?.pulse ?? 'N/A'} (${r?.context ?? ''})`).join(', ')}`;
    }

    if (activeMeds?.length) {
      const medsBySlot: Record<string, string[]> = {};
      for (const med of activeMeds) {
        const slot = med?.timeSlot ?? 'OTHER';
        if (!medsBySlot[slot]) medsBySlot[slot] = [];
        medsBySlot[slot].push(`${med?.name ?? 'Unknown'}${med?.dosage ? ` (${med.dosage})` : ''}${med?.notes ? ` — ${med.notes}` : ''}`);
      }
      recentContext += `\n\nCurrent medication schedule:\n${Object.entries(medsBySlot).map(([slot, meds]) => `  ${slot}: ${meds.join(', ')}`).join('\n')}`;
    }

    if (recentMedLogs?.length) {
      recentContext += `\n\nRecent medication logs (last 3 days): ${(recentMedLogs ?? []).map((l: any) => {
        const meds = (() => { try { return JSON.parse(l?.medications ?? '[]'); } catch { return []; } })();
        return `${formatDateLocal(l?.date)} ${l?.timeSlot ?? ''}: ${Array.isArray(meds) ? meds.join(', ') : 'unknown'}${l?.compliance ? ' ✓' : ' ✗'}`;
      }).join('; ')}`;
    }

    if (recentObs?.length) {
      recentContext += `\n\nRecent observations: ${(recentObs ?? []).map((o: any) => `${formatDateLocal(o?.date)}: [${o?.category ?? ''}] ${o?.description ?? ''}`).join('; ')}`;
    }

    const timeContext = localTime
      ? `\n\nThe user's current local time is ${localTime} (${localDateTime}). Use this as the default timestamp for any health data logged in this message if no specific time is mentioned. IMPORTANT: When outputting dates in the health_data JSON, always include the timezone offset (e.g., "2026-05-21T19:20:00${tzOffset || '-05:00'}"), never output bare dates without timezone info.`
      : '';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + timeContext + recentContext },
      ...(recentMessages ?? []).reverse().map((m: any) => ({
        role: m?.role ?? 'user',
        content: m?.content ?? '',
      })),
      { role: 'user', content: userMessage },
    ];

    // Call LLM API with streaming
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages,
        stream: true,
        max_tokens: 2000,
      }),
    });

    if (!response?.ok) {
      throw new Error(`LLM API error: ${response?.status}`);
    }

    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        try {
          let partialRead = '';
          while (true) {
            const { done, value } = await (reader as any).read();
            if (done) break;
            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead?.split?.('\n') ?? [];
            partialRead = lines?.pop?.() ?? '';

            for (const line of lines) {
              if (line?.startsWith?.('data: ')) {
                const data = line?.slice?.(6) ?? '';
                if (data === '[DONE]') {
                  // Process health data extraction
                  const { cleanText, healthData } = extractHealthData(fullContent);
                  if (healthData) {
                    await saveHealthData(healthData, tzOffset);
                  }
                  // Save assistant message (clean version)
                  await prisma.chatMessage.create({
                    data: { role: 'assistant', content: cleanText },
                  });
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed?.choices?.[0]?.delta?.content ?? '';
                  if (content) {
                    fullContent += content;
                  }
                  // Forward the chunk to client
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch {
                  // skip invalid JSON
                }
              }
            }
          }

          // If we get here without [DONE], still save
          if (fullContent) {
            const { cleanText, healthData } = extractHealthData(fullContent);
            if (healthData) {
              await saveHealthData(healthData, tzOffset);
            }
            await prisma.chatMessage.create({
              data: { role: 'assistant', content: cleanText },
            });
          }
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

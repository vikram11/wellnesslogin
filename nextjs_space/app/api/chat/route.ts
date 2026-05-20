export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { extractHealthData, HealthData } from '@/lib/parse-health-data';

async function saveHealthData(data: HealthData) {
  const results: string[] = [];

  // Save BP readings
  if (data?.bp_readings && (data.bp_readings?.length ?? 0) > 0) {
    for (const bp of data.bp_readings) {
      try {
        await prisma.bpReading.create({
          data: {
            date: new Date(bp?.date ?? new Date().toISOString()),
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
            date: new Date(log?.date ?? new Date().toISOString()),
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
            date: new Date(obs?.date ?? new Date().toISOString()),
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
            date: new Date(note?.date ?? new Date().toISOString()),
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

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = body?.message ?? '';

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

    let recentContext = '';

    if (recentBP?.length) {
      recentContext += `\n\nRecent BP readings: ${(recentBP ?? []).map((r: any) => `${r?.date ? new Date(r.date).toLocaleDateString() : 'unknown'} ${r?.date ? new Date(r.date).toLocaleTimeString() : ''}: ${r?.systolic ?? 0}/${r?.diastolic ?? 0} HR:${r?.pulse ?? 'N/A'} (${r?.context ?? ''})`).join(', ')}`;
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
        return `${l?.date ? new Date(l.date).toLocaleDateString() : 'unknown'} ${l?.timeSlot ?? ''}: ${Array.isArray(meds) ? meds.join(', ') : 'unknown'}${l?.compliance ? ' ✓' : ' ✗'}`;
      }).join('; ')}`;
    }

    if (recentObs?.length) {
      recentContext += `\n\nRecent observations: ${(recentObs ?? []).map((o: any) => `${o?.date ? new Date(o.date).toLocaleDateString() : 'unknown'}: [${o?.category ?? ''}] ${o?.description ?? ''}`).join('; ')}`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + recentContext },
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
                    await saveHealthData(healthData);
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
              await saveHealthData(healthData);
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

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { extractHealthData, HealthData } from '@/lib/parse-health-data';

// Extract profile_update tags from assistant response
function extractProfileUpdate(content: string): string | null {
  const match = content.match(/<profile_update>([\s\S]*?)<\/profile_update>/i);
  return match ? match[1].trim() : null;
}

// Save updated profile to database
async function saveProfileUpdate(newContent: string) {
  try {
    let profile = await prisma.userProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (profile) {
      await prisma.userProfile.update({ where: { id: profile.id }, data: { content: newContent } });
    } else {
      await prisma.userProfile.create({ data: { content: newContent } });
    }
    console.log('User profile updated');
  } catch (e) {
    console.error('Error saving profile update:', e);
  }
}

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

  // Handle edits — match records by field values since LLM doesn't know database IDs
  if (data?.edits && (data.edits?.length ?? 0) > 0) {
    for (const edit of data.edits) {
      try {
        const type = edit?.type ?? '';
        const match = edit?.match ?? {};
        const updates = edit?.updates ?? {};

        if (type === 'bp_reading') {
          // Build where clause from match criteria
          const where: Record<string, any> = {};
          if (match.systolic) where.systolic = Number(match.systolic);
          if (match.diastolic) where.diastolic = Number(match.diastolic);
          if (match.pulse) where.pulse = Number(match.pulse);
          if (match.date) {
            // Try to match the date approximately
            const matchDate = ensureTimezone(match.date, tzOffset);
            const startOfDay = new Date(matchDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(matchDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
            where.date = { gte: startOfDay, lte: endOfDay };
          }

          // Find matching record(s)
          const records = await prisma.bpReading.findMany({
            where,
            orderBy: { date: 'desc' },
            take: 1,
          });

          if (records.length > 0) {
            const updateData: Record<string, any> = {};
            if (updates.systolic !== undefined) updateData.systolic = Number(updates.systolic);
            if (updates.diastolic !== undefined) updateData.diastolic = Number(updates.diastolic);
            if (updates.pulse !== undefined) updateData.pulse = Number(updates.pulse);
            if (updates.context !== undefined) {
              const val = updates.context;
              updateData.context = (val === null || val === '' || val === 'null') ? null : String(val);
            }
            if (updates.notes !== undefined) {
              const val = updates.notes;
              updateData.notes = (val === null || val === '' || val === 'null') ? null : String(val);
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.bpReading.update({
                where: { id: records[0].id },
                data: updateData,
              });
              results.push(`Edited BP reading (${records[0].systolic}/${records[0].diastolic})`);
            }
          } else {
            console.warn('Edit: No matching BP record found for', match);
          }
        } else if (type === 'medication_log') {
          const where: Record<string, any> = {};
          if (match.timeSlot) where.timeSlot = match.timeSlot;
          if (match.date) {
            const matchDate = ensureTimezone(match.date, tzOffset);
            const startOfDay = new Date(matchDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(matchDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
            where.date = { gte: startOfDay, lte: endOfDay };
          }

          const records = await prisma.medicationLog.findMany({ where, orderBy: { date: 'desc' }, take: 1 });
          if (records.length > 0) {
            const updateData: Record<string, any> = {};
            if (updates.medications !== undefined) updateData.medications = JSON.stringify(updates.medications);
            if (updates.compliance !== undefined) updateData.compliance = Boolean(updates.compliance);
            // Handle notes: null, "", or "null" all mean "clear the notes"
            if (updates.notes !== undefined) {
              const val = updates.notes;
              updateData.notes = (val === null || val === '' || val === 'null') ? null : String(val);
            }
            if (updates.timeSlot !== undefined) updateData.timeSlot = String(updates.timeSlot);
            if (Object.keys(updateData).length > 0) {
              await prisma.medicationLog.update({ where: { id: records[0].id }, data: updateData });
              results.push('Edited medication log');
            }
          } else {
            console.warn('Edit: No matching medication_log found for', match);
          }
        } else if (type === 'daily_note') {
          const where: Record<string, any> = {};
          if (match.note) where.note = { contains: match.note };

          const records = await prisma.dailyNote.findMany({ where, orderBy: { date: 'desc' }, take: 1 });
          if (records.length > 0) {
            const updateData: Record<string, any> = {};
            if (updates.note !== undefined) updateData.note = updates.note;
            if (Object.keys(updateData).length > 0) {
              await prisma.dailyNote.update({ where: { id: records[0].id }, data: updateData });
              results.push('Edited daily note');
            }
          }
        }

        // Legacy support: if edit has old id-based format, try that too
        if (!edit?.match && edit?.id && type === 'bp_reading') {
          try {
            const updateData: Record<string, any> = {};
            const field = edit?.field ?? '';
            if (field === 'systolic' || field === 'diastolic' || field === 'pulse') {
              updateData[field] = parseInt(edit?.new_value ?? '0', 10);
            } else {
              updateData[field] = edit?.new_value ?? '';
            }
            await prisma.bpReading.update({ where: { id: edit.id }, data: updateData });
            results.push('Edited BP reading (by id)');
          } catch { /* ignore if id doesn't exist */ }
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
        } else if (type === 'medication') {
          const where: Record<string, any> = {};
          if (match.name) where.name = { equals: match.name, mode: 'insensitive' };

          const records = await prisma.medication.findMany({
            where,
            take: count > 0 ? count : 100,
          });

          if (records.length > 0) {
            await prisma.medication.deleteMany({
              where: { id: { in: records.map((r: any) => r.id) } },
            });
            results.push(`Deleted ${records.length} medication(s)`);
          }
        }
      } catch (e: any) {
        console.error('Error processing delete:', e);
      }
    }
  }

  // Handle medication changes (add, update, discontinue)
  if (data?.medication_changes && (data.medication_changes?.length ?? 0) > 0) {
    for (const change of data.medication_changes) {
      try {
        const action = change?.action ?? '';

        if (action === 'add') {
          await prisma.medication.create({
            data: {
              name: change?.name ?? 'Unknown',
              dosage: change?.dosage ?? null,
              timeSlot: change?.timeSlot ?? 'AM',
              notes: change?.notes ?? null,
              isActive: true,
              startDate: new Date(),
            },
          });
          results.push(`Added medication: ${change?.name}`);
        } else if (action === 'update' && change?.match_name) {
          // Find medication by name (case-insensitive)
          const meds = await prisma.medication.findMany({
            where: {
              name: { equals: change.match_name, mode: 'insensitive' },
              isActive: true,
            },
          });

          if (meds.length > 0) {
            const updateData: Record<string, any> = {};
            if (change.name !== undefined && change.name !== change.match_name) updateData.name = change.name;
            if (change.dosage !== undefined) updateData.dosage = change.dosage;
            if (change.timeSlot !== undefined) updateData.timeSlot = change.timeSlot;
            if (change.notes !== undefined) updateData.notes = change.notes;

            if (Object.keys(updateData).length > 0) {
              await prisma.medication.update({
                where: { id: meds[0].id },
                data: updateData,
              });
              results.push(`Updated medication: ${change.match_name}`);
            }
          } else {
            console.warn('Medication change: No matching medication found for', change.match_name);
          }
        } else if (action === 'discontinue' && change?.match_name) {
          const meds = await prisma.medication.findMany({
            where: {
              name: { equals: change.match_name, mode: 'insensitive' },
              isActive: true,
            },
          });

          if (meds.length > 0) {
            await prisma.medication.update({
              where: { id: meds[0].id },
              data: { isActive: false, endDate: new Date() },
            });
            results.push(`Discontinued medication: ${change.match_name}`);
          }
        }
      } catch (e: any) {
        console.error('Error processing medication change:', e);
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
    const imageData = body?.imageData ?? null; // base64 data URL for LLM vision
    const imagePath = body?.imagePath ?? null; // persistent file path from upload
    const tzOffset = getTimezoneOffset(localDateTime);

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }

    // Save user message to chat history — store file path if available, else base64
    const storedImage = imagePath || imageData || null;
    await prisma.chatMessage.create({
      data: { role: 'user', content: userMessage, ...(storedImage ? { imageData: storedImage } : {}) },
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

    // Get recent daily notes
    const recentNotes = await prisma.dailyNote.findMany({
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

    // Load user profile for long-term memory
    let profileContext = '';
    try {
      const profile = await prisma.userProfile.findFirst({ orderBy: { createdAt: 'asc' } });
      if (profile?.content?.trim()) {
        profileContext = `\n\nUSER PROFILE (what I know about the user):\n${profile.content}`;
      }
    } catch (e) {
      // Profile may not exist yet
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

    if (recentNotes?.length) {
      recentContext += `\n\nRecent daily notes: ${(recentNotes ?? []).map((n: any) => `${formatDateLocal(n?.date)}: ${n?.note ?? ''}`).join('; ')}`;
    }

    const timeContext = localTime
      ? `\n\nThe user's current local time is ${localTime} (${localDateTime}). Use this as the default timestamp for any health data logged in this message if no specific time is mentioned. IMPORTANT: When outputting dates in the health_data JSON, always include the timezone offset (e.g., "2026-05-21T19:20:00${tzOffset || '-05:00'}"), never output bare dates without timezone info.`
      : '';

    // Helper: read a stored image back to base64 data URL for LLM
    // If it's already a data: URL, return as-is. If it's a file path, read from disk.
    function resolveImageForLLM(stored: string): string | null {
      if (!stored) return null;
      if (stored.startsWith('data:')) return stored;
      // It's a file path like /api/uploads/chat-images/xxx.jpg — read from disk
      try {
        const fs = require('fs');
        const path = require('path');
        // Extract the relative path after /api/uploads/
        const relPath = stored.replace(/^\/api\/uploads\//, '');
        const fullPath = path.join(process.cwd(), 'uploads', relPath);
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const ext = path.extname(fullPath).slice(1).toLowerCase();
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          return `data:${mime};base64,${buf.toString('base64')}`;
        }
      } catch (err) {
        console.warn('Could not read image file for LLM:', err);
      }
      return null;
    }

    // Build messages array — use OpenAI vision format when image is present
    // Only include images from the last 4 messages to avoid excessive token usage
    const reversed = (recentMessages ?? []).reverse();
    const historyMsgs = reversed.map((m: any, idx: number) => {
      const isRecent = idx >= reversed.length - 4;
      // Skip assistant imageData in history (it's just a reference thumbnail)
      const hasImage = m?.role === 'user' && m?.imageData;
      if (hasImage && isRecent) {
        const imgUrl = resolveImageForLLM(m.imageData);
        if (imgUrl) {
          return {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imgUrl } },
              { type: 'text', text: m?.content ?? '' },
            ],
          };
        }
      }
      // For older messages with images, just include text + note
      if (hasImage) {
        return { role: 'user', content: `[Photo was attached] ${m?.content ?? ''}` };
      }
      return { role: m?.role ?? 'user', content: m?.content ?? '' };
    });

    // Current user message — multimodal if image attached
    const currentUserMsg = imageData
      ? {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageData } },
            { type: 'text', text: userMessage },
          ],
        }
      : { role: 'user', content: userMessage };

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + timeContext + recentContext + profileContext },
      ...historyMsgs,
      currentUserMsg,
    ];

    // Call LLM API with streaming
    const response = await fetch('https://ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'gemma4:31b-cloud',
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
                  // Process profile update from assistant response
                  const profileUpdate = extractProfileUpdate(fullContent);
                  if (profileUpdate) {
                    await saveProfileUpdate(profileUpdate);
                  }
                  // Save assistant message (clean version) — include image reference if user sent one
                  await prisma.chatMessage.create({
                    data: {
                      role: 'assistant',
                      content: cleanText,
                      ...(storedImage ? { imageData: storedImage } : {}),
                    },
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
              data: {
                role: 'assistant',
                content: cleanText,
                ...(storedImage ? { imageData: storedImage } : {}),
              },
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
    console.error('Chat API error:', error?.message, error?.stack);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}

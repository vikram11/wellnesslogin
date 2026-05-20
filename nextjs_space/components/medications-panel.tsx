'use client';

import { useState, useEffect } from 'react';
import { Loader2, Pill, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MedicationType {
  id: string;
  name: string;
  dosage: string | null;
  timeSlot: string;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export function MedicationsPanel() {
  const [meds, setMeds] = useState<MedicationType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeds = async () => {
      try {
        const res = await fetch('/api/medications');
        if (res?.ok) {
          const data = await res.json();
          setMeds(data?.medications ?? []);
        }
      } catch (e: any) {
        console.error('Failed to fetch medications:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeds();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeMeds = (meds ?? []).filter((m: MedicationType) => m?.isActive);
  const inactiveMeds = (meds ?? []).filter((m: MedicationType) => !m?.isActive);

  const groupBySlot = (medList: MedicationType[]) => {
    const groups: Record<string, MedicationType[]> = { AM: [], MID: [], PM: [] };
    for (const m of (medList ?? [])) {
      const slot = m?.timeSlot ?? 'AM';
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(m);
    }
    return groups;
  };

  const slotLabels: Record<string, string> = {
    AM: '🌅 Morning (AM)',
    MID: '☀️ Midday (MID)',
    PM: '🌙 Evening (PM)',
  };

  const slotColors: Record<string, string> = {
    AM: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    MID: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200',
    PM: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200',
  };

  const activeGroups = groupBySlot(activeMeds);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 overflow-y-auto h-full chat-scroll">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Medications</h2>
        <p className="text-muted-foreground text-sm">Your current medication schedule</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {Object.keys(activeGroups ?? {}).map((slot: string) => {
          const group = activeGroups?.[slot] ?? [];
          return (
            <Card key={slot}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {slotLabels?.[slot] ?? slot}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(group ?? []).map((m: MedicationType) => (
                    <div key={m?.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/50">
                      <Pill className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m?.name ?? ''}</p>
                        <p className="text-xs text-muted-foreground">
                          {m?.dosage ?? ''}
                          {m?.notes ? ` — ${m.notes}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(group?.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground">No medications</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active count */}
      <div className="flex gap-3 mb-4">
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {activeMeds?.length ?? 0} Active
        </Badge>
        {(inactiveMeds?.length ?? 0) > 0 && (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="w-3 h-3" />
            {inactiveMeds?.length ?? 0} Discontinued
          </Badge>
        )}
      </div>

      {/* Discontinued Medications */}
      {(inactiveMeds?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Discontinued Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(inactiveMeds ?? []).map((m: MedicationType) => (
                <div key={m?.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 opacity-60">
                  <Pill className="w-3.5 h-3.5 shrink-0" />
                  <div>
                    <p className="text-sm line-through">{m?.name ?? ''} {m?.dosage ?? ''}</p>
                    <p className="text-xs text-muted-foreground">{m?.notes ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

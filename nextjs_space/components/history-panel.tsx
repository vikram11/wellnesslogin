'use client';

import { useState, useEffect } from 'react';
import { Loader2, Stethoscope, Pill, StickyNote, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface MedCheckItem {
  name: string;
  taken: boolean;
}

interface MedsTakenLog {
  id: string;
  date: string;
  timeSlot: string;
  notes: string | null;
  compliance: boolean;
  checklist: MedCheckItem[];
}

const SLOT_LABELS: Record<string, string> = {
  AM: 'Morning',
  MID: 'Midday',
  PM: 'Evening',
};

export function HistoryPanel() {
  const [readings, setReadings] = useState<any[]>([]);
  const [medsLogs, setMedsLogs] = useState<MedsTakenLog[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [rRes, mRes, nRes] = await Promise.all([
          fetch(`/api/readings?days=${days}`),
          fetch(`/api/meds-taken?days=${days}`),
          fetch(`/api/notes?days=${days}`),
        ]);
        const rData = rRes?.ok ? await rRes.json() : { readings: [] };
        const mData = mRes?.ok ? await mRes.json() : { logs: [] };
        const nData = nRes?.ok ? await nRes.json() : { notes: [] };
        setReadings(rData?.readings ?? []);
        setMedsLogs(mData?.logs ?? []);
        setNotes(nData?.notes ?? []);
      } catch (e: any) {
        console.error('Failed to fetch history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 overflow-y-auto h-full chat-scroll">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">History</h2>
          <p className="text-muted-foreground text-sm">View all logged health data</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d: number) => (
            <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="bp">
        <TabsList className="mb-4">
          <TabsTrigger value="bp" className="gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" /> BP Readings
          </TabsTrigger>
          <TabsTrigger value="meds" className="gap-1.5">
            <Pill className="w-3.5 h-3.5" /> Meds Taken
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        {/* ── BP Readings ── */}
        <TabsContent value="bp">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blood Pressure Readings ({readings?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>BP</TableHead>
                    <TableHead>HR</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead className="hidden sm:table-cell">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(readings ?? []).map((r: any) => {
                    const d = r?.date ? new Date(r.date) : new Date();
                    return (
                      <TableRow key={r?.id}>
                        <TableCell className="font-mono text-xs">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</TableCell>
                        <TableCell className="font-mono text-xs">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell className="font-mono font-semibold">{r?.systolic ?? 0}/{r?.diastolic ?? 0}</TableCell>
                        <TableCell className="font-mono">{r?.pulse ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r?.context ?? ''}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell max-w-[200px] truncate">{r?.notes ?? ''}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(readings?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No readings in this period</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Meds Taken ── */}
        <TabsContent value="meds">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meds Taken ({medsLogs?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {/* Desktop table view */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date / Time</TableHead>
                      <TableHead>Meds Taken</TableHead>
                      <TableHead className="w-[200px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(medsLogs ?? []).map((log) => {
                      const d = log?.date ? new Date(log.date) : new Date();
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="align-top">
                            <div className="font-mono text-xs">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                            <div className="font-mono text-xs text-muted-foreground">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium">
                              {SLOT_LABELS[log.timeSlot] ?? log.timeSlot}
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              {(log.checklist ?? []).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  {item.taken ? (
                                    <div className="w-4 h-4 rounded border border-primary bg-primary flex items-center justify-center shrink-0">
                                      <Check className="w-3 h-3 text-primary-foreground" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded border-2 border-muted-foreground/40 shrink-0" />
                                  )}
                                  <span className={`text-sm ${!item.taken ? 'text-muted-foreground line-through' : ''}`}>
                                    {item.name}
                                  </span>
                                </div>
                              ))}
                              {(log.checklist?.length ?? 0) === 0 && (
                                <span className="text-xs text-muted-foreground italic">No meds recorded</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground">
                            {log.notes ?? ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(medsLogs?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No medication logs in this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {(medsLogs ?? []).map((log) => {
                  const d = log?.date ? new Date(log.date) : new Date();
                  return (
                    <div key={log.id} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium">
                          {SLOT_LABELS[log.timeSlot] ?? log.timeSlot}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(log.checklist ?? []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {item.taken ? (
                              <div className="w-4 h-4 rounded border border-primary bg-primary flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded border-2 border-muted-foreground/40 shrink-0" />
                            )}
                            <span className={`text-sm ${!item.taken ? 'text-muted-foreground line-through' : ''}`}>
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                      {log.notes && (
                        <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">{log.notes}</p>
                      )}
                    </div>
                  );
                })}
                {(medsLogs?.length ?? 0) === 0 && (
                  <p className="text-center text-muted-foreground py-8">No medication logs in this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Notes ({notes?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(notes ?? []).map((n: any) => {
                  const d = n?.date ? new Date(n.date) : new Date();
                  return (
                    <div key={n?.id} className="flex gap-3 p-3 rounded-lg bg-secondary/50">
                      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">
                        {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <p className="text-sm">{n?.note ?? ''}</p>
                    </div>
                  );
                })}
                {(notes?.length ?? 0) === 0 && (
                  <p className="text-center text-muted-foreground py-8">No notes in this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Loader2, Stethoscope, Clipboard, StickyNote } from 'lucide-react';
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

export function HistoryPanel() {
  const [readings, setReadings] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [rRes, oRes, nRes] = await Promise.all([
          fetch(`/api/readings?days=${days}`),
          fetch(`/api/observations?days=${days}`),
          fetch(`/api/notes?days=${days}`),
        ]);
        const rData = rRes?.ok ? await rRes.json() : { readings: [] };
        const oData = oRes?.ok ? await oRes.json() : { observations: [] };
        const nData = nRes?.ok ? await nRes.json() : { notes: [] };
        setReadings(rData?.readings ?? []);
        setObservations(oData?.observations ?? []);
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
          <TabsTrigger value="obs" className="gap-1.5">
            <Clipboard className="w-3.5 h-3.5" /> Observations
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="obs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observations ({observations?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(observations ?? []).map((obs: any) => {
                    const d = obs?.date ? new Date(obs.date) : new Date();
                    return (
                      <TableRow key={obs?.id}>
                        <TableCell className="font-mono text-xs">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-medium">{obs?.category ?? ''}</span>
                        </TableCell>
                        <TableCell className="text-sm">{obs?.description ?? ''}</TableCell>
                        <TableCell className="font-mono">{obs?.severity != null ? `${obs.severity}/10` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(observations?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No observations in this period</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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

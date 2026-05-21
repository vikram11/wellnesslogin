'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Heart, Activity, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BpChart } from '@/components/bp-chart';

interface BpStats {
  count: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgPulse: number | null;
  maxSystolic: number;
  minSystolic: number;
  maxDiastolic: number;
  minDiastolic: number;
}

interface SummaryData {
  period: { from: string; to: string; days: number };
  bpStats: BpStats;
  medCompliance: { totalLogs: number; compliant: number };
  readings: any[];
  notes: any[];
}

export function ReportsPanel() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [doctorReport, setDoctorReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/summary?days=${days}`);
        if (res?.ok) {
          const json = await res.json();
          setData(json ?? null);
        }
      } catch (e: any) {
        console.error('Failed to fetch report:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [days]);

  const generateDoctorReport = async () => {
    if (!data) return;
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/reports/doctor-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      if (res?.ok) {
        const json = await res.json();
        setDoctorReport(json?.summary ?? 'No summary generated');
      }
    } catch (e: any) {
      console.error('Failed to generate report:', e);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = data?.bpStats;
  const compliance = data?.medCompliance;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 overflow-y-auto h-full chat-scroll">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Health Reports</h2>
          <p className="text-muted-foreground text-sm">Track trends and generate summaries</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d: number) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg BP</span>
            </div>
            <p className="text-xl font-mono font-semibold">
              {stats?.avgSystolic ?? 0}/{stats?.avgDiastolic ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg HR</span>
            </div>
            <p className="text-xl font-mono font-semibold">
              {stats?.avgPulse ?? 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Readings</span>
            </div>
            <p className="text-xl font-mono font-semibold">
              {stats?.count ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Med Logs</span>
            </div>
            <p className="text-xl font-mono font-semibold">
              {compliance?.compliant ?? 0}/{compliance?.totalLogs ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BP Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Blood Pressure Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] sm:h-[350px]">
            <BpChart readings={data?.readings ?? []} />
          </div>
        </CardContent>
      </Card>

      {/* BP Range */}
      {(stats?.count ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">BP Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Systolic Range</p>
                <p className="font-mono font-semibold">{stats?.minSystolic ?? 0} — {stats?.maxSystolic ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Diastolic Range</p>
                <p className="font-mono font-semibold">{stats?.minDiastolic ?? 0} — {stats?.maxDiastolic ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Notes */}
      {(data?.notes?.length ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Recent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data?.notes ?? []).map((n: any) => (
                <li key={n?.id} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground font-mono text-xs w-20 shrink-0">
                    {n?.date ? new Date(n.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <span>{n?.note ?? ''}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Doctor Report Generator */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Doctor-Ready Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Generate a formatted text summary suitable for sharing with your doctors.
          </p>
          <Button onClick={generateDoctorReport} disabled={generatingReport} size="sm">
            {generatingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Generate Summary
          </Button>
          {doctorReport && (
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-sans">{doctorReport}</pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  navigator?.clipboard?.writeText?.(doctorReport);
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

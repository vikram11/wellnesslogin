'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

interface BpChartInnerProps {
  readings: any[];
}

export default function BpChartInner({ readings }: BpChartInnerProps) {
  const chartData = [...(readings ?? [])].sort((a: any, b: any) => new Date(a?.date ?? 0).getTime() - new Date(b?.date ?? 0).getTime()).map((r: any) => {
    const d = r?.date ? new Date(r.date) : new Date();
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      label: `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      Systolic: r?.systolic ?? 0,
      Diastolic: r?.diastolic ?? 0,
      'Heart Rate': r?.pulse ?? null,
    };
  });

  if ((chartData?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No BP readings in this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 25 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={55}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          tick={{ fontSize: 10 }}
          domain={['dataMin - 10', 'dataMax + 10']}
          label={{ value: 'mmHg / BPM', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
        />
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="Systolic"
          stroke="#FF6363"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="Diastolic"
          stroke="#60B5FF"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="Heart Rate"
          stroke="#80D8C3"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

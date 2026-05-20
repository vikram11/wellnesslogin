'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const BpChartInner = dynamic(() => import('@/components/bp-chart-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface BpChartProps {
  readings: any[];
}

export function BpChart({ readings }: BpChartProps) {
  return <BpChartInner readings={readings ?? []} />;
}

export interface HealthData {
  bp_readings?: Array<{
    date: string;
    systolic: number;
    diastolic: number;
    pulse: number | null;
    context: string;
    notes: string;
  }>;
  medication_logs?: Array<{
    date: string;
    timeSlot: string;
    medications: string[];
    compliance: boolean;
    notes: string;
  }>;
  observations?: Array<{
    date: string;
    category: string;
    description: string;
    severity: number | null;
  }>;
  daily_notes?: Array<{
    date: string;
    note: string;
  }>;
  edits?: Array<{
    type: string;
    match?: Record<string, any>;
    updates?: Record<string, any>;
    // Legacy fields
    id?: string;
    field?: string;
    old_value?: string;
    new_value?: string;
  }>;
  deletes?: Array<{
    type: string;
    match: Record<string, any>;
    count: number;
  }>;
}

export function extractHealthData(text: string): { cleanText: string; healthData: HealthData | null } {
  const match = text?.match?.(/<health_data>([\s\S]*?)<\/health_data>/);
  if (!match) {
    return { cleanText: text ?? '', healthData: null };
  }

  const cleanText = (text ?? '').replace(/<health_data>[\s\S]*?<\/health_data>/, '').trim();
  
  try {
    const healthData = JSON.parse(match[1] ?? '{}') as HealthData;
    return { cleanText, healthData };
  } catch {
    return { cleanText, healthData: null };
  }
}

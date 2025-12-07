const API_BASE = '/api';

export interface DayData {
  date: string;
  id: number;
  teeth_brushed: number;
  teeth_comment: string | null;
  vomited: number;
  vomited_comment: string | null;
  peed: number;
  peed_comment: string | null;
  pooped: number;
  pooped_comment: string | null;
  drank: number;
  drank_comment: string | null;
  daily_notes: string | null;
  day_status: string;
  medications: MedicationWithStatus[];
  meals: MealWithStatus[];
}

export interface MedicationWithStatus {
  id: number;
  name: string;
  time_label: string;
  is_active: number;
  taken: number;
  comment: string | null;
}

export interface MealWithStatus {
  meal_slot: number;
  label: string;
  default_amount: number;
  status: string;
  actual_amount: number | null;
  comment: string | null;
}

export interface Medication {
  id: number;
  name: string;
  time_label: string;
  is_active: number;
  sort_order: number;
}

export interface TrendsSummary {
  period: { start: string; end: string };
  totalDays: number;
  statusCounts: { RED: number; ORANGE: number; GREEN: number };
  vomiting: { daysWithVomit: number; daysWithoutVomit: number };
  peePoop: {
    peeDays: number;
    poopDays: number;
    noPeeDates: string[];
    noPoopDates: string[];
  };
  meals: { total: number; missed: number };
  charts: {
    dailyMeals: { date: string; missed: number }[];
    dailyVomit: { date: string; vomited: number }[];
  };
}

export interface ProblemDay {
  date: string;
  status: 'RED' | 'ORANGE';
  issues: string[];
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Day data
export async function getDayData(date: string): Promise<DayData> {
  return fetchApi<DayData>(`/day/${date}`);
}

export async function updateDayData(
  date: string,
  data: {
    teeth_brushed?: number;
    teeth_comment?: string;
    vomited?: number;
    vomited_comment?: string;
    peed?: number;
    peed_comment?: string;
    pooped?: number;
    pooped_comment?: string;
    drank?: number;
    drank_comment?: string;
    daily_notes?: string;
    medications?: { id: number; taken: boolean; comment?: string }[];
    meals?: { slot: number; status: string; actual_amount?: number; set_default_amount?: number; comment?: string }[];
  }
): Promise<DayData> {
  return fetchApi<DayData>(`/day/${date}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// Medications
export async function getMedications(includeInactive = false): Promise<Medication[]> {
  return fetchApi<Medication[]>(`/medications${includeInactive ? '?includeInactive=true' : ''}`);
}

export async function addMedication(name: string, timeLabel: string): Promise<Medication> {
  return fetchApi<Medication>('/medications', {
    method: 'POST',
    body: JSON.stringify({ name, time_label: timeLabel })
  });
}

export async function deleteMedication(id: number): Promise<void> {
  await fetchApi(`/medications/${id}`, { method: 'DELETE' });
}

// Meal config
export async function updateMealAmount(slot: number, amount: number): Promise<void> {
  await fetchApi(`/meal-config/${slot}`, {
    method: 'PUT',
    body: JSON.stringify({ amount })
  });
}

// Trends
export async function getTrends(period: '7' | '30' | 'all' = '7'): Promise<TrendsSummary> {
  return fetchApi<TrendsSummary>(`/trends?period=${period}`);
}

export async function getProblemDays(period: '7' | '30' | 'all' = '7'): Promise<ProblemDay[]> {
  return fetchApi<ProblemDay[]>(`/problem-days?period=${period}`);
}

// Health check
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  return fetchApi('/health');
}

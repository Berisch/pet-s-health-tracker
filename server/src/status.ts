import { db, DailyRecord, MealEntry } from './db.js';

export type DayStatus = 'RED' | 'ORANGE' | 'GREEN';

interface DayData {
  vomited: number;
  peed: number;
  pooped: number;
  meals: { status: string }[];
}

/**
 * Calculate the day status based on the highlighting rules:
 *
 * RED (serious) if:
 *   - (Vomited > 0) AND (peed = 0 OR poop = 0 OR any meal not eaten fully)
 *   - OR (Peed = 0 AND Pooped = 0)
 *
 * ORANGE (moderate) if:
 *   - Vomited > 0 (but pee ≥1, poop ≥1, all meals eaten)
 *   - OR Peed = 0 (only, not both)
 *   - OR Pooped = 0 (only, not both)
 *   - OR One or more meals "Didn't eat fully" (no vomit, pee/poop OK)
 *
 * GREEN (good) if:
 *   - Vomited = 0 AND Peed ≥1 AND Pooped ≥1 AND all meals "Ate fully"
 */
export function calculateDayStatus(data: DayData): DayStatus {
  const { vomited, peed, pooped, meals } = data;

  const hasVomit = vomited > 0;
  const noPee = peed === 0;
  const noPoop = pooped === 0;
  const hasMissedMeal = meals.some(m => m.status !== 'ate_fully');

  // RED conditions
  if (hasVomit && (noPee || noPoop || hasMissedMeal)) {
    return 'RED';
  }
  if (noPee && noPoop) {
    return 'RED';
  }

  // ORANGE conditions
  if (hasVomit) {
    return 'ORANGE';
  }
  if (noPee || noPoop) {
    return 'ORANGE';
  }
  if (hasMissedMeal) {
    return 'ORANGE';
  }

  // GREEN - all good
  return 'GREEN';
}

/**
 * Update the day_status field in daily_records for a given date
 */
export function updateDayStatus(date: string): DayStatus {
  const record = db.prepare('SELECT vomited, peed, pooped FROM daily_records WHERE date = ?').get(date) as { vomited: number; peed: number; pooped: number } | undefined;

  if (!record) {
    return 'GREEN';
  }

  const meals = db.prepare('SELECT status FROM meal_entries WHERE date = ?').all(date) as { status: string }[];

  const status = calculateDayStatus({
    vomited: record.vomited,
    peed: record.peed,
    pooped: record.pooped,
    meals
  });

  db.prepare('UPDATE daily_records SET day_status = ? WHERE date = ?').run(status, date);

  return status;
}

/**
 * Get issues for a day (for display in Trends screen)
 */
export function getDayIssues(date: string): string[] {
  const record = db.prepare('SELECT vomited, peed, pooped FROM daily_records WHERE date = ?').get(date) as { vomited: number; peed: number; pooped: number } | undefined;

  if (!record) {
    return [];
  }

  const meals = db.prepare('SELECT meal_slot, status FROM meal_entries WHERE date = ?').all(date) as { meal_slot: number; status: string }[];
  const mealLabels = ['', 'morning', 'day', 'evening', 'night'];

  const issues: string[] = [];

  if (record.vomited > 0) {
    issues.push(`Vomit: ${record.vomited}`);
  }
  if (record.peed === 0) {
    issues.push('No pee');
  }
  if (record.pooped === 0) {
    issues.push('No poop');
  }

  const missedMeals = meals.filter(m => m.status !== 'ate_fully');
  for (const meal of missedMeals) {
    issues.push(`Meal ${meal.meal_slot} (${mealLabels[meal.meal_slot]}) not eaten fully`);
  }

  return issues;
}

/**
 * Get summary statistics for a period
 */
export function getTrendsSummary(startDate: string, endDate: string) {
  // Total days in period
  const totalDays = db.prepare(`
    SELECT COUNT(DISTINCT date) as count
    FROM daily_records
    WHERE date BETWEEN ? AND ?
  `).get(startDate, endDate) as { count: number };

  // Days by status
  const statusCounts = db.prepare(`
    SELECT day_status, COUNT(*) as count
    FROM daily_records
    WHERE date BETWEEN ? AND ?
    GROUP BY day_status
  `).all(startDate, endDate) as { day_status: string; count: number }[];

  // Vomiting stats
  const vomitDays = db.prepare(`
    SELECT COUNT(*) as count
    FROM daily_records
    WHERE date BETWEEN ? AND ? AND vomited > 0
  `).get(startDate, endDate) as { count: number };

  // Pee/Poop stats
  const peeDays = db.prepare(`
    SELECT COUNT(*) as count
    FROM daily_records
    WHERE date BETWEEN ? AND ? AND peed > 0
  `).get(startDate, endDate) as { count: number };

  const poopDays = db.prepare(`
    SELECT COUNT(*) as count
    FROM daily_records
    WHERE date BETWEEN ? AND ? AND pooped > 0
  `).get(startDate, endDate) as { count: number };

  // Days with no pee/poop
  const noPeeDays = db.prepare(`
    SELECT date FROM daily_records
    WHERE date BETWEEN ? AND ? AND peed = 0
    ORDER BY date DESC
  `).all(startDate, endDate) as { date: string }[];

  const noPoopDays = db.prepare(`
    SELECT date FROM daily_records
    WHERE date BETWEEN ? AND ? AND pooped = 0
    ORDER BY date DESC
  `).all(startDate, endDate) as { date: string }[];

  // Meal stats
  const totalMeals = db.prepare(`
    SELECT COUNT(*) as count
    FROM meal_entries
    WHERE date BETWEEN ? AND ?
  `).get(startDate, endDate) as { count: number };

  const missedMeals = db.prepare(`
    SELECT COUNT(*) as count
    FROM meal_entries
    WHERE date BETWEEN ? AND ? AND status != 'ate_fully'
  `).get(startDate, endDate) as { count: number };

  // Daily meal stats for chart
  const dailyMealStats = db.prepare(`
    SELECT date,
           SUM(CASE WHEN status != 'ate_fully' THEN 1 ELSE 0 END) as missed
    FROM meal_entries
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `).all(startDate, endDate) as { date: string; missed: number }[];

  // Daily vomit stats for chart
  const dailyVomitStats = db.prepare(`
    SELECT date, vomited
    FROM daily_records
    WHERE date BETWEEN ? AND ?
    ORDER BY date
  `).all(startDate, endDate) as { date: string; vomited: number }[];

  return {
    period: { start: startDate, end: endDate },
    totalDays: totalDays.count,
    statusCounts: {
      RED: statusCounts.find(s => s.day_status === 'RED')?.count ?? 0,
      ORANGE: statusCounts.find(s => s.day_status === 'ORANGE')?.count ?? 0,
      GREEN: statusCounts.find(s => s.day_status === 'GREEN')?.count ?? 0
    },
    vomiting: {
      daysWithVomit: vomitDays.count,
      daysWithoutVomit: totalDays.count - vomitDays.count
    },
    peePoop: {
      peeDays: peeDays.count,
      poopDays: poopDays.count,
      noPeeDates: noPeeDays.map(d => d.date),
      noPoopDates: noPoopDays.map(d => d.date)
    },
    meals: {
      total: totalMeals.count,
      missed: missedMeals.count
    },
    charts: {
      dailyMeals: dailyMealStats,
      dailyVomit: dailyVomitStats
    }
  };
}

/**
 * Get problem days (RED and ORANGE) for a period
 */
export function getProblemDays(startDate: string, endDate: string) {
  const problemDays = db.prepare(`
    SELECT date, day_status
    FROM daily_records
    WHERE date BETWEEN ? AND ? AND day_status != 'GREEN'
    ORDER BY date DESC
  `).all(startDate, endDate) as { date: string; day_status: string }[];

  return problemDays.map(day => ({
    date: day.date,
    status: day.day_status as DayStatus,
    issues: getDayIssues(day.date)
  }));
}

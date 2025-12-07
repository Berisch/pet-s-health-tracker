import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'filya.db');

export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initializeDatabase() {
  db.exec(`
    -- Medications (dynamic - can add/remove)
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      time_label TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Meal configuration (for storing default amounts)
    CREATE TABLE IF NOT EXISTS meal_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_slot INTEGER NOT NULL UNIQUE,
      label TEXT NOT NULL,
      default_amount INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Daily records (one row per day)
    CREATE TABLE IF NOT EXISTS daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      teeth_brushed INTEGER DEFAULT 0,
      teeth_comment TEXT,
      vomited INTEGER DEFAULT 0,
      vomited_comment TEXT,
      peed INTEGER DEFAULT 0,
      peed_comment TEXT,
      pooped INTEGER DEFAULT 0,
      pooped_comment TEXT,
      drank INTEGER DEFAULT 0,
      drank_comment TEXT,
      daily_notes TEXT,
      day_status TEXT DEFAULT 'GREEN',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Medication entries (links daily_records to medications)
    CREATE TABLE IF NOT EXISTS medication_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      medication_id INTEGER NOT NULL,
      taken INTEGER DEFAULT 0,
      comment TEXT,
      FOREIGN KEY (medication_id) REFERENCES medications(id),
      UNIQUE(date, medication_id)
    );

    -- Meal entries
    CREATE TABLE IF NOT EXISTS meal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_slot INTEGER NOT NULL,
      status TEXT DEFAULT 'ate_fully',
      actual_amount INTEGER,
      comment TEXT,
      UNIQUE(date, meal_slot)
    );

    -- Meal default history (tracks when default amounts change)
    CREATE TABLE IF NOT EXISTS meal_default_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_slot INTEGER NOT NULL,
      default_amount INTEGER NOT NULL DEFAULT 0,
      effective_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(meal_slot, effective_date)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(date);
    CREATE INDEX IF NOT EXISTS idx_daily_records_status ON daily_records(day_status);
    CREATE INDEX IF NOT EXISTS idx_medication_entries_date ON medication_entries(date);
    CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_meal_default_history_slot_date ON meal_default_history(meal_slot, effective_date DESC);
  `);

  // Seed default meal configuration if not exists
  const mealCount = db.prepare('SELECT COUNT(*) as count FROM meal_config').get() as { count: number };
  if (mealCount.count === 0) {
    const insertMealConfig = db.prepare('INSERT INTO meal_config (meal_slot, label, default_amount) VALUES (?, ?, ?)');
    insertMealConfig.run(1, 'morning', 0);
    insertMealConfig.run(2, 'day', 0);
    insertMealConfig.run(3, 'evening', 0);
    insertMealConfig.run(4, 'night', 0);
  }

  // Seed default medications if not exists
  const medCount = db.prepare('SELECT COUNT(*) as count FROM medications').get() as { count: number };
  if (medCount.count === 0) {
    const insertMed = db.prepare('INSERT INTO medications (name, time_label, sort_order) VALUES (?, ?, ?)');
    insertMed.run('Normolact', 'morning', 1);
    insertMed.run('Normolact', 'evening', 2);
    insertMed.run('Renalvet', 'evening with food', 3);
    insertMed.run('FortiFlora', 'evening with food', 4);
  }

  // Migration: Rename meal_entries.amount to actual_amount if needed
  const mealEntriesInfo = db.prepare("PRAGMA table_info(meal_entries)").all() as { name: string }[];
  const hasAmountColumn = mealEntriesInfo.some(col => col.name === 'amount');
  const hasActualAmountColumn = mealEntriesInfo.some(col => col.name === 'actual_amount');

  if (hasAmountColumn && !hasActualAmountColumn) {
    db.exec('ALTER TABLE meal_entries RENAME COLUMN amount TO actual_amount');
    console.log('Migrated meal_entries.amount to actual_amount');
  }

  // Migration: Copy existing meal_config defaults to history table
  const historyCount = db.prepare('SELECT COUNT(*) as count FROM meal_default_history').get() as { count: number };
  if (historyCount.count === 0) {
    // Get earliest date from daily_records or use today
    const earliest = db.prepare('SELECT MIN(date) as date FROM daily_records').get() as { date: string | null };
    const effectiveDate = earliest?.date || new Date().toISOString().split('T')[0];

    const existingDefaults = db.prepare('SELECT meal_slot, default_amount FROM meal_config').all() as { meal_slot: number; default_amount: number }[];
    const insertHistory = db.prepare('INSERT OR IGNORE INTO meal_default_history (meal_slot, default_amount, effective_date) VALUES (?, ?, ?)');

    for (const config of existingDefaults) {
      if (config.default_amount > 0) {
        insertHistory.run(config.meal_slot, config.default_amount, effectiveDate);
        console.log(`Migrated meal_slot ${config.meal_slot} default ${config.default_amount}g from ${effectiveDate}`);
      }
    }
  }

  console.log('Database initialized successfully');
}

// Types
export interface DailyRecord {
  id: number;
  date: string;
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
}

export interface Medication {
  id: number;
  name: string;
  time_label: string;
  is_active: number;
  sort_order: number;
}

export interface MedicationEntry {
  id: number;
  date: string;
  medication_id: number;
  taken: number;
  comment: string | null;
}

export interface MealEntry {
  id: number;
  date: string;
  meal_slot: number;
  status: string;
  actual_amount: number | null;
  comment: string | null;
}

export interface MealDefaultHistory {
  id: number;
  meal_slot: number;
  default_amount: number;
  effective_date: string;
}

export interface MealConfig {
  id: number;
  meal_slot: number;
  label: string;
  default_amount: number;
}

// Query functions

// Get or create daily record for a date
export function getOrCreateDailyRecord(date: string): DailyRecord {
  let record = db.prepare('SELECT * FROM daily_records WHERE date = ?').get(date) as DailyRecord | undefined;

  if (!record) {
    db.prepare('INSERT INTO daily_records (date) VALUES (?)').run(date);
    record = db.prepare('SELECT * FROM daily_records WHERE date = ?').get(date) as DailyRecord;
  }

  return record;
}

// Update daily record
export function updateDailyRecord(date: string, data: Partial<DailyRecord>) {
  getOrCreateDailyRecord(date); // Ensure record exists

  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'date');
  if (fields.length === 0) return;

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => data[f as keyof DailyRecord]);

  db.prepare(`UPDATE daily_records SET ${setClause}, updated_at = datetime('now') WHERE date = ?`)
    .run(...values, date);
}

// Get medications (active only by default)
export function getMedications(includeInactive = false): Medication[] {
  if (includeInactive) {
    return db.prepare('SELECT * FROM medications ORDER BY sort_order').all() as Medication[];
  }
  return db.prepare('SELECT * FROM medications WHERE is_active = 1 ORDER BY sort_order').all() as Medication[];
}

// Add medication
export function addMedication(name: string, timeLabel: string): Medication {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM medications').get() as { max: number | null };
  const sortOrder = (maxOrder.max ?? 0) + 1;

  const result = db.prepare('INSERT INTO medications (name, time_label, sort_order) VALUES (?, ?, ?)')
    .run(name, timeLabel, sortOrder);

  return db.prepare('SELECT * FROM medications WHERE id = ?').get(result.lastInsertRowid) as Medication;
}

// Deactivate medication (soft delete)
export function deactivateMedication(id: number) {
  db.prepare('UPDATE medications SET is_active = 0 WHERE id = ?').run(id);
}

// Get medication entries for a date
export function getMedicationEntries(date: string): (MedicationEntry & { name: string; time_label: string })[] {
  return db.prepare(`
    SELECT me.*, m.name, m.time_label
    FROM medication_entries me
    JOIN medications m ON me.medication_id = m.id
    WHERE me.date = ?
  `).all(date) as (MedicationEntry & { name: string; time_label: string })[];
}

// Upsert medication entry
export function upsertMedicationEntry(date: string, medicationId: number, taken: boolean, comment?: string) {
  db.prepare(`
    INSERT INTO medication_entries (date, medication_id, taken, comment)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date, medication_id) DO UPDATE SET
      taken = excluded.taken,
      comment = excluded.comment
  `).run(date, medicationId, taken ? 1 : 0, comment ?? null);
}

// Get meal config
export function getMealConfig(): MealConfig[] {
  return db.prepare('SELECT * FROM meal_config ORDER BY meal_slot').all() as MealConfig[];
}

// Update meal config amount (deprecated - use setDefaultAmount instead)
export function updateMealConfigAmount(mealSlot: number, amount: number) {
  db.prepare(`UPDATE meal_config SET default_amount = ?, updated_at = datetime('now') WHERE meal_slot = ?`)
    .run(amount, mealSlot);
}

// Get effective default amount for a meal slot on a given date
export function getEffectiveDefaultAmount(mealSlot: number, date: string): number {
  const result = db.prepare(`
    SELECT default_amount
    FROM meal_default_history
    WHERE meal_slot = ? AND effective_date <= ?
    ORDER BY effective_date DESC
    LIMIT 1
  `).get(mealSlot, date) as { default_amount: number } | undefined;

  return result?.default_amount ?? 0;
}

// Set default amount for a meal slot starting from a specific date
export function setDefaultAmount(mealSlot: number, amount: number, effectiveDate: string): void {
  db.prepare(`
    INSERT INTO meal_default_history (meal_slot, default_amount, effective_date)
    VALUES (?, ?, ?)
    ON CONFLICT(meal_slot, effective_date) DO UPDATE SET
      default_amount = excluded.default_amount
  `).run(mealSlot, amount, effectiveDate);
}

// Get meal entries for a date
export function getMealEntries(date: string): MealEntry[] {
  return db.prepare('SELECT * FROM meal_entries WHERE date = ? ORDER BY meal_slot').all(date) as MealEntry[];
}

// Upsert meal entry
export function upsertMealEntry(date: string, mealSlot: number, status: string, actualAmount?: number, comment?: string) {
  db.prepare(`
    INSERT INTO meal_entries (date, meal_slot, status, actual_amount, comment)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, meal_slot) DO UPDATE SET
      status = excluded.status,
      actual_amount = excluded.actual_amount,
      comment = excluded.comment
  `).run(date, mealSlot, status, actualAmount ?? null, comment ?? null);
}

// Get full day data (record + medications + meals)
export function getFullDayData(date: string) {
  const record = getOrCreateDailyRecord(date);
  const medications = getMedications();
  const medicationEntries = getMedicationEntries(date);
  const mealConfig = getMealConfig();
  const mealEntries = getMealEntries(date);

  // Merge medication entries with medication list
  const medicationsWithStatus = medications.map(med => {
    const entry = medicationEntries.find(e => e.medication_id === med.id);
    return {
      ...med,
      taken: entry?.taken ?? 0,
      comment: entry?.comment ?? null
    };
  });

  // Merge meal entries with meal config and effective defaults
  const mealsWithStatus = mealConfig.map(config => {
    const entry = mealEntries.find(e => e.meal_slot === config.meal_slot);
    const effectiveDefault = getEffectiveDefaultAmount(config.meal_slot, date);
    return {
      meal_slot: config.meal_slot,
      label: config.label,
      default_amount: effectiveDefault,
      status: entry?.status ?? 'ate_fully',
      actual_amount: entry?.actual_amount ?? null,
      comment: entry?.comment ?? null
    };
  });

  return {
    ...record,
    date,
    medications: medicationsWithStatus,
    meals: mealsWithStatus
  };
}

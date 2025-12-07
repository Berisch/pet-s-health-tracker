import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeDatabase,
  db,
  addMedication,
  updateDailyRecord,
  upsertMedicationEntry,
  upsertMealEntry,
  getMedications
} from './db.js';
import { updateDayStatus } from './status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CSV file path (in project root)
const csvPath = path.join(__dirname, '..', '..', 'таблица_наблюдений_за_котом _ Филя.xlsx - Sheet1.csv');

interface CsvRow {
  date: string;
  teethBrushed: boolean;
  pooped: number;
  peed: number;
  drank: number;
  vomited: number;
  robeksera: boolean;
  gabapentinMorning: boolean;
  gabapentinEvening: boolean;
  normolactMorning: boolean;
  normolactEvening: boolean;
  renalvet: boolean;
  fortiflora: boolean;
  meal1: string;
  meal2: string;
  meal3: string;
  meal4: string;
  comments: string;
}

function parseDate(dateStr: string): string {
  // Convert DD.MM.YYYY to YYYY-MM-DD
  const parts = dateStr.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseBoolean(value: string): boolean {
  return value === 'TRUE' || value === '1' || value.toLowerCase() === 'true';
}

function parseNumber(value: string): number {
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

function parseMealStatus(value: string): string {
  if (!value || value === '-' || value === '') {
    return 'ate_fully'; // Default if empty
  }

  const lower = value.toLowerCase();
  if (lower === 'доел' || lower.includes('доел')) {
    return 'ate_fully';
  }
  if (lower === 'не доел' || lower.includes('не доел')) {
    return 'not_fully';
  }
  if (lower.includes('не давала') || lower.includes('был в клинике')) {
    return 'skipped';
  }

  // If it's some other text, treat as comment and mark as ate_fully
  return 'ate_fully';
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function parseRow(columns: string[]): CsvRow {
  return {
    date: columns[0],
    teethBrushed: parseBoolean(columns[1]),
    pooped: parseNumber(columns[2]),
    peed: parseNumber(columns[3]),
    drank: parseNumber(columns[4]),
    vomited: parseNumber(columns[5]),
    robeksera: parseBoolean(columns[6]),
    gabapentinMorning: parseBoolean(columns[7]),
    gabapentinEvening: parseBoolean(columns[8]),
    normolactMorning: parseBoolean(columns[9]),
    normolactEvening: parseBoolean(columns[10]),
    renalvet: parseBoolean(columns[11]),
    fortiflora: parseBoolean(columns[12]),
    meal1: columns[13] || '',
    meal2: columns[14] || '',
    meal3: columns[15] || '',
    meal4: columns[16] || '',
    comments: columns[17] || ''
  };
}

async function importCsv() {
  console.log('Starting CSV import...');
  console.log(`CSV path: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  // Initialize database
  initializeDatabase();

  // Read CSV file
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header row
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} data rows`);

  // Get or create medications
  const existingMeds = getMedications(true);

  // Find existing medication IDs
  let normolactMorningId = existingMeds.find(m => m.name === 'Normolact' && m.time_label === 'morning')?.id;
  let normolactEveningId = existingMeds.find(m => m.name === 'Normolact' && m.time_label === 'evening')?.id;
  let renalvetId = existingMeds.find(m => m.name === 'Renalvet')?.id;
  let fortifloraId = existingMeds.find(m => m.name === 'FortiFlora')?.id;

  // Add inactive medications that existed in the past
  let robekserId = existingMeds.find(m => m.name === 'Robeksera')?.id;
  let gabapentinMorningId = existingMeds.find(m => m.name === 'Gabapentin' && m.time_label === 'morning')?.id;
  let gabapentinEveningId = existingMeds.find(m => m.name === 'Gabapentin' && m.time_label === 'evening')?.id;

  // Create inactive medications if they don't exist
  if (!robekserId) {
    const med = addMedication('Robeksera', 'with food or after');
    robekserId = med.id;
    // Mark as inactive
    db.prepare('UPDATE medications SET is_active = 0 WHERE id = ?').run(robekserId);
    console.log('Added inactive medication: Robeksera');
  }

  if (!gabapentinMorningId) {
    const med = addMedication('Gabapentin', 'morning');
    gabapentinMorningId = med.id;
    db.prepare('UPDATE medications SET is_active = 0 WHERE id = ?').run(gabapentinMorningId);
    console.log('Added inactive medication: Gabapentin (morning)');
  }

  if (!gabapentinEveningId) {
    const med = addMedication('Gabapentin', 'evening');
    gabapentinEveningId = med.id;
    db.prepare('UPDATE medications SET is_active = 0 WHERE id = ?').run(gabapentinEveningId);
    console.log('Added inactive medication: Gabapentin (evening)');
  }

  // Process each row
  let imported = 0;
  let errors = 0;

  for (const line of dataLines) {
    try {
      const columns = parseCsvLine(line);
      if (columns.length < 17) {
        console.warn(`Skipping row with insufficient columns: ${line.substring(0, 50)}...`);
        continue;
      }

      const row = parseRow(columns);

      // Skip rows with invalid dates
      if (!row.date || row.date === '-' || !row.date.includes('.')) {
        console.warn(`Skipping row with invalid date: ${row.date}`);
        continue;
      }

      const date = parseDate(row.date);

      // Update daily record
      updateDailyRecord(date, {
        teeth_brushed: row.teethBrushed ? 1 : 0,
        vomited: row.vomited,
        peed: row.peed,
        pooped: row.pooped,
        drank: row.drank,
        daily_notes: row.comments || null
      });

      // Update medication entries
      if (normolactMorningId) {
        upsertMedicationEntry(date, normolactMorningId, row.normolactMorning);
      }
      if (normolactEveningId) {
        upsertMedicationEntry(date, normolactEveningId, row.normolactEvening);
      }
      if (renalvetId) {
        upsertMedicationEntry(date, renalvetId, row.renalvet);
      }
      if (fortifloraId) {
        upsertMedicationEntry(date, fortifloraId, row.fortiflora);
      }
      if (robekserId) {
        upsertMedicationEntry(date, robekserId, row.robeksera);
      }
      if (gabapentinMorningId) {
        upsertMedicationEntry(date, gabapentinMorningId, row.gabapentinMorning);
      }
      if (gabapentinEveningId) {
        upsertMedicationEntry(date, gabapentinEveningId, row.gabapentinEvening);
      }

      // Update meal entries
      upsertMealEntry(date, 1, parseMealStatus(row.meal1), undefined, row.meal1.includes('не давала') || row.meal1.includes('клинике') ? row.meal1 : undefined);
      upsertMealEntry(date, 2, parseMealStatus(row.meal2), undefined, row.meal2.includes('не давала') || row.meal2.includes('клинике') ? row.meal2 : undefined);
      upsertMealEntry(date, 3, parseMealStatus(row.meal3), undefined, row.meal3.includes('не давала') || row.meal3.includes('клинике') ? row.meal3 : undefined);
      upsertMealEntry(date, 4, parseMealStatus(row.meal4), undefined, row.meal4.includes('не давала') || row.meal4.includes('клинике') ? row.meal4 : undefined);

      // Update day status
      updateDayStatus(date);

      imported++;
      console.log(`Imported: ${date}`);
    } catch (err) {
      console.error(`Error processing row: ${line.substring(0, 50)}...`);
      console.error(err);
      errors++;
    }
  }

  console.log(`\nImport complete!`);
  console.log(`Successfully imported: ${imported} days`);
  console.log(`Errors: ${errors}`);
}

importCsv().catch(console.error);

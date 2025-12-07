import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeDatabase,
  getFullDayData,
  updateDailyRecord,
  getMedications,
  addMedication,
  deactivateMedication,
  upsertMedicationEntry,
  getMealConfig,
  updateMealConfigAmount,
  upsertMealEntry,
  setDefaultAmount
} from './db.js';
import { updateDayStatus, getTrendsSummary, getProblemDays } from './status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(httpsOptions?: { key: Buffer; cert: Buffer }) {
  const app: FastifyInstance = httpsOptions
    ? Fastify({ logger: true, https: httpsOptions })
    : Fastify({ logger: true });

  // Register CORS for frontend development
  await app.register(cors, {
    origin: true // Allow all origins in development
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const clientPath = path.join(__dirname, '..', '..', 'client', 'build');
    await app.register(fastifyStatic, {
      root: clientPath,
      prefix: '/'
    });

    // SPA fallback - serve index.html for all non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      reply.code(404).send({ error: 'Not found' });
    });
  }

  // Initialize database on startup
  initializeDatabase();

  // Health check endpoint
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ============ Day Data Endpoints ============

  // Get full day data
  app.get<{ Params: { date: string } }>('/api/day/:date', async (request) => {
    const { date } = request.params;
    return getFullDayData(date);
  });

  // Update day data
  app.put<{
    Params: { date: string };
    Body: {
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
    };
  }>('/api/day/:date', async (request) => {
    const { date } = request.params;
    const { medications, meals, ...recordData } = request.body;

    // Update daily record fields
    if (Object.keys(recordData).length > 0) {
      updateDailyRecord(date, recordData);
    }

    // Update medication entries
    if (medications) {
      for (const med of medications) {
        upsertMedicationEntry(date, med.id, med.taken, med.comment);
      }
    }

    // Update meal entries
    if (meals) {
      for (const meal of meals) {
        // If setting a new default, record it in history
        if (meal.set_default_amount !== undefined) {
          setDefaultAmount(meal.slot, meal.set_default_amount, date);
        }
        // Update the meal entry (actual amount eaten)
        upsertMealEntry(date, meal.slot, meal.status, meal.actual_amount, meal.comment);
      }
    }

    // Recalculate day status
    updateDayStatus(date);

    return getFullDayData(date);
  });

  // ============ Medications Endpoints ============

  // Get all medications
  app.get<{ Querystring: { includeInactive?: string } }>('/api/medications', async (request) => {
    const includeInactive = request.query.includeInactive === 'true';
    return getMedications(includeInactive);
  });

  // Add new medication
  app.post<{ Body: { name: string; time_label: string } }>('/api/medications', async (request) => {
    const { name, time_label } = request.body;
    return addMedication(name, time_label);
  });

  // Update medication
  app.put<{
    Params: { id: string };
    Body: { name?: string; time_label?: string; sort_order?: number };
  }>('/api/medications/:id', async (request) => {
    const { id } = request.params;
    const { name, time_label, sort_order } = request.body;

    // Simple update - could be enhanced with proper db function
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (time_label !== undefined) {
      updates.push('time_label = ?');
      values.push(time_label);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length > 0) {
      const { db } = await import('./db.js');
      db.prepare(`UPDATE medications SET ${updates.join(', ')} WHERE id = ?`).run(...values, parseInt(id));
    }

    return { success: true };
  });

  // Deactivate medication (soft delete)
  app.delete<{ Params: { id: string } }>('/api/medications/:id', async (request) => {
    const { id } = request.params;
    deactivateMedication(parseInt(id));
    return { success: true };
  });

  // ============ Meal Config Endpoints ============

  // Get meal configuration
  app.get('/api/meal-config', async () => {
    return getMealConfig();
  });

  // Update meal slot default amount (sets effective from today)
  app.put<{
    Params: { slot: string };
    Body: { amount: number; effective_date?: string };
  }>('/api/meal-config/:slot', async (request) => {
    const { slot } = request.params;
    const { amount, effective_date } = request.body;
    // Use provided date or today
    const date = effective_date || new Date().toISOString().split('T')[0];
    setDefaultAmount(parseInt(slot), amount, date);
    return { success: true };
  });

  // ============ Trends Endpoints ============

  // Get trends summary
  app.get<{ Querystring: { period?: string } }>('/api/trends', async (request) => {
    const period = request.query.period || '7';

    const endDate = new Date().toISOString().split('T')[0];
    let startDate: string;

    if (period === 'all') {
      // Get the earliest date in the database
      const { db } = await import('./db.js');
      const earliest = db.prepare('SELECT MIN(date) as date FROM daily_records').get() as { date: string | null };
      startDate = earliest.date || endDate;
    } else {
      const days = parseInt(period) || 7;
      const start = new Date();
      start.setDate(start.getDate() - days + 1);
      startDate = start.toISOString().split('T')[0];
    }

    return getTrendsSummary(startDate, endDate);
  });

  // Get problem days
  app.get<{ Querystring: { period?: string } }>('/api/problem-days', async (request) => {
    const period = request.query.period || '7';

    const endDate = new Date().toISOString().split('T')[0];
    let startDate: string;

    if (period === 'all') {
      const { db } = await import('./db.js');
      const earliest = db.prepare('SELECT MIN(date) as date FROM daily_records').get() as { date: string | null };
      startDate = earliest.date || endDate;
    } else {
      const days = parseInt(period) || 7;
      const start = new Date();
      start.setDate(start.getDate() - days + 1);
      startDate = start.toISOString().split('T')[0];
    }

    return getProblemDays(startDate, endDate);
  });

  return app;
}

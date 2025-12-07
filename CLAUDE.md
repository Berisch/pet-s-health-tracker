# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Filya Health Tracker - a mobile-first web app for tracking a cat's daily health metrics. Designed to run on Raspberry Pi for home use.

## Common Commands

```bash
# Development (runs both server and client)
npm run dev

# Individual workspace commands
npm run dev:server          # Server only (tsx watch, port 3000)
npm run dev:client          # Client only (Vite, port 5173)

# Build and production
npm run build               # Build both server and client
npm run start               # Start production server

# Import historical data from CSV
npm run import              # Imports from root CSV file
```

## Architecture

### Monorepo Structure (npm workspaces)

- **server/** - Fastify REST API with better-sqlite3
- **client/** - SvelteKit 2 + Svelte 5 + Tailwind CSS

### Backend (server/src/)

- `index.ts` - Entry point, starts Fastify server
- `app.ts` - Route definitions, CORS, static file serving
- `db.ts` - SQLite database schema, query functions, types
- `status.ts` - Day status calculation (RED/ORANGE/GREEN), trends aggregation
- `import.ts` - CSV import script for historical data

### Frontend (client/src/)

- `lib/api.ts` - API client with TypeScript types
- `routes/+layout.svelte` - Bottom navigation (Today/Trends)
- `routes/today/+page.svelte` - Daily data entry with auto-save
- `routes/trends/+page.svelte` - Statistics and problem day highlighting

### Database Schema (SQLite)

- `daily_records` - One row per day (pee, poop, vomit counts, teeth, notes, status)
- `medications` - Medication definitions (soft-delete via is_active)
- `medication_entries` - Daily medication tracking (date + medication_id)
- `meal_entries` - Meal status per slot (ate_fully/not_fully/skipped)
- `meal_config` - Meal slot labels and default amounts

### Day Status Logic (status.ts)

Days are classified as:
- **RED**: Vomit + (no pee OR no poop OR missed meal), OR (no pee AND no poop)
- **ORANGE**: Vomit only, OR no pee only, OR no poop only, OR missed meal only
- **GREEN**: No vomit, has pee, has poop, all meals eaten

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/day/:date | Get full day data |
| PUT | /api/day/:date | Update day data |
| GET | /api/medications | List active medications |
| POST | /api/medications | Add medication |
| DELETE | /api/medications/:id | Soft-delete medication |
| GET | /api/trends?period= | Get aggregated statistics |
| GET | /api/problem-days?period= | Get RED/ORANGE days |

## Key Patterns

- Frontend uses Svelte 5 runes ($state, $effect, $props)
- Auto-save with 300ms debounce on input changes
- Dates stored as YYYY-MM-DD strings
- Database uses WAL mode for concurrent access
- Production serves SvelteKit build as static files via @fastify/static

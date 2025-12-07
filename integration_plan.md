Session-by-Session Implementation Guide
This project can be completed in 8-10 sessions of 1-2 hours each. Each session has a clear goal and can be stopped/resumed.
Session 1: Environment Setup (~1 hour)
Goal: Get development environment ready on Windows Prerequisites:
Install Node.js 20 LTS from https://nodejs.org/
Install VS Code (if not already)
Install VS Code extensions: ESLint, Prettier, Svelte
Steps:
# 1. Verify installation
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x

# 2. Navigate to project folder
cd D:\Script\filya_schedule

# 3. Initialize root package.json
npm init -y

# 4. Create folder structure
mkdir server
mkdir client
mkdir scripts
Checkpoint: You have empty server/ and client/ folders and a package.json in root.
Session 2: Backend Foundation (~1.5 hours)
Goal: Create working API server with database Steps:
# 1. Initialize server
cd server
npm init -y
npm install fastify @fastify/cors better-sqlite3
npm install -D typescript @types/node @types/better-sqlite3 tsx

# 2. Create tsconfig.json (TypeScript config)
# 3. Create src/index.ts - entry point
# 4. Create src/db.ts - database setup + schema
# 5. Test: npm run dev (server starts on port 3000)
Files to create:
server/tsconfig.json
server/src/index.ts
server/src/db.ts
server/package.json scripts
Checkpoint: Visit http://localhost:3000/api/health → returns {"status": "ok"}
Session 3: API Endpoints (~2 hours)
Goal: Complete REST API for daily records Steps:
Create server/src/app.ts - Fastify routes
Create server/src/status.ts - day status calculation
Implement endpoints:
GET /api/day/:date - get record
PUT /api/day/:date - update record
GET /api/medications - list meds
POST /api/medications - add med
DELETE /api/medications/:id - deactivate med
Testing:
# Use curl or browser
curl http://localhost:3000/api/day/2025-12-07
curl http://localhost:3000/api/medications
Checkpoint: All API endpoints respond correctly. Test with Postman or curl.
Session 4: Frontend Setup (~1.5 hours)
Goal: Create SvelteKit app with routing Steps:
cd D:\Script\filya_schedule\client

# Create SvelteKit project
npm create svelte@latest .
# Choose: Skeleton project, TypeScript, ESLint, Prettier

# Install dependencies
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Start dev server
npm run dev
Files to create/modify:
client/tailwind.config.js
client/src/app.css (Tailwind imports)
client/src/routes/+layout.svelte (navigation)
client/src/routes/+page.svelte (redirect)
client/src/routes/today/+page.svelte (stub)
client/src/routes/trends/+page.svelte (stub)
Checkpoint: Visit http://localhost:5173 → see app with bottom nav, can switch between Today/Trends tabs.
Session 5: Today Screen - Part 1 (~2 hours)
Goal: Build input components for Today screen Components to create:
DatePicker.svelte - date navigation with arrows
Card.svelte - section wrapper
ToggleRow.svelte - for teeth brushed
CountRow.svelte - for vomited/peed/pooped/drank
CommentInput.svelte - expandable comment field
Checkpoint: Today screen shows Hygiene and Behavior sections with working inputs (not connected to API yet).
Session 6: Today Screen - Part 2 (~2 hours)
Goal: Complete Today screen + API integration Components to create:
MedicationRow.svelte - medication toggle
MealRow.svelte - status dropdown + amount
MedicationManager.svelte - add/remove meds modal
API Integration:
Create client/src/lib/api.ts - fetch wrapper
Connect components to API
Implement auto-save on change
Checkpoint: Can enter data for today, save to database, reload page and see data persisted.
Session 7: Trends Screen (~2 hours)
Goal: Complete Trends screen with summaries Components to create:
PeriodSelector.svelte - 7d/30d/All buttons
SummaryTile.svelte - stats card
ProblemDayItem.svelte - problem day row
ProblemDaysList.svelte - list container
API Integration:
GET /api/trends?period=7
GET /api/problem-days?period=7
Checkpoint: Trends screen shows real data from database. Tap on problem day → navigates to that day.
Session 8: Data Import + Polish (~1.5 hours)
Goal: Import existing CSV data, add finishing touches Steps:
Create server/src/import.ts - CSV parser
Run import script to load 33 days of data
Test all screens with real data
Add PWA manifest + icons
Test on phone (same WiFi network)
Checkpoint: App has all historical data. Works on phone browser.
Session 9: Docker Setup (~1 hour)
Goal: Containerize app for deployment Files to create:
Dockerfile - multi-stage build
docker-compose.yml
.dockerignore
Test locally:
docker-compose up --build
# Visit http://localhost:3000
Checkpoint: App runs in Docker container on Windows.
Session 10: RPi Deployment (~1 hour)
Goal: Deploy to Raspberry Pi Prerequisites on RPi:
# SSH into RPi
ssh pi@raspberrypi.local

# Install Docker (one-time)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi
# Logout and login again
Deploy from Windows:
# Copy files to RPi
scp -r D:\Script\filya_schedule pi@raspberrypi.local:~/

# SSH and start
ssh pi@raspberrypi.local
cd filya_schedule
docker-compose up -d --build

# Check it's running
docker ps

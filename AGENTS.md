# AI Agent Guide: IT Support & Ticket Management System

## Project Overview

**IT Support Request & Ticket Management System** — A full-stack React + Express helpdesk application with real-time WebSocket synchronization, role-based access control (RBAC), dual database modes (PostgreSQL + JSON fallback), and simulated email notifications.

**Key URLs when running:**
- Frontend: `http://localhost:3000`
- pgAdmin (Docker only): `http://localhost:5050`

## Essential Commands

| Task | Command | Notes |
|------|---------|-------|
| **Development** | `npm run dev` | Starts Express server with tsx (watches for changes) |
| **Production Build** | `npm run build` | Vite frontend + esbuild Node bundle → `dist/` |
| **Production Start** | `npm start` | Runs pre-built `dist/server.cjs` |
| **Tests** | `npm test` | Node.js native unit tests (no external runner needed) |
| **Type Check** | `npm run lint` | TypeScript syntax validation |
| **Clean** | `npm run clean` | Removes `dist/`, `server.js`, `tickets_db.json` |

## Architecture & Data Flow

```
Frontend (React/Vite)
├── App.tsx (main container, user switcher)
├── components/
│   ├── TicketDashboard (list + filter by role)
│   ├── TicketForm (create new tickets)
│   ├── NotificationCenter (email simulation log)
│   └── DockerGuide (deployment help)
└── dataStore.ts (API client via fetch)

Backend (Express + WebSockets)
├── server.ts (entry point, HTTP + WS setup)
└── src/
    ├── dataStore.ts (dual DB abstraction: PostgreSQL | JSON)
    ├── types.ts (TypeScript interfaces)
    └── ...API routes handle /api/tickets, /api/notifications

Database Layer
├── PostgreSQL (when DB_HOST env vars set in Docker)
└── tickets_db.json (fallback for dev/sandbox environments)
```

**Real-time Sync:** WebSocket clients are tracked in a `Set<WebSocket>`. When API endpoints mutate tickets/notifications, all connected clients receive broadcast updates via `ws.send(JSON.stringify({type, data}))`.

## Role-Based Access Control (RBAC)

Three user roles with distinct permissions:

| Role | Can View | Can Create | Can Modify | Can Assign |
|------|----------|-----------|-----------|-----------|
| **client** | Own tickets + messages | New tickets | Add client messages | ❌ |
| **agent** | All tickets (for triage) | ❌ | Status, priority, add internal notes | Assign to self |
| **admin** | All tickets + full logs | ❌ | All fields | Assign any ticket |

**Demo users hardcoded in `App.tsx`:**
```typescript
const DEMO_USERS: User[] = [
  { id: 'client-1', name: 'Jane Doe', ... role: 'client' },
  { id: 'agent-1', name: 'Alex Vance', ... role: 'agent' },
  { id: 'admin-1', name: 'Krzysztof Graczyk', ... role: 'admin' },
];
```

**Enforcement:** Backend must validate `currentUser.role` on every API call (not shown in provided code snippet but critical).

## Key Data Structures

**Ticket** (`src/types.ts`)
- Status: `'open' | 'in_progress' | 'resolved' | 'closed'`
- Priority: `'low' | 'medium' | 'high' | 'urgent'`
- Category: `'hardware' | 'software' | 'network' | 'access' | 'other'`
- Attachments: Base64-encoded files (10MB max per request)
- Messages: Chronological thread with `isInternal` flag (agents only)

**ID Generation Pattern:**
```typescript
function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
```
Examples: `tk-101`, `m-1`, `agent-1`

## Database Modes

### PostgreSQL Mode (Docker + Production)
- Enabled when `DB_HOST` or `DATABASE_URL` env vars are set
- Connection pool from `pg` module
- Requires Docker Compose setup with services:
  - **app** (port 3000)
  - **postgres** (port 5432)
  - **pgAdmin** (port 5050, creds: `admin@bagietka.pl` / `AdminPassword_99`)

### JSON Mode (Development/Sandbox)
- Falls back automatically if PostgreSQL connection fails
- Uses `tickets_db.json` in project root
- Synchronous file I/O; suitable for testing but **not production**
- Check `isPostgresConnected()` to verify active mode

**Startup logs show which mode is active:**
```
PostgreSQL configuration detected. Trying to connect...
```
or
```
No PostgreSQL configuration found. Defaulting to local JSON storage for live environment.
```

## Development Tips

### Hot Module Reloading (HMR)
- HMR can be **disabled** via `DISABLE_HMR=true` env var (e.g., in AI Studio)
- When disabled, file watching is also disabled to prevent CPU flicker during agent edits
- See `vite.config.ts` for the conditional logic

### Testing Email Notifications
- Emails are **simulated** and logged to the NotificationLog table/array
- No actual SMTP server; view logs in the "Mailbox" tab (frontend) or via `/api/notifications`
- Triggered on: ticket creation, status change, agent assignment

### Attachments
- Stored as Base64 in the `attachments` array on each Ticket
- 10MB limit per request (`express.json({ limit: '10mb' })`)
- Handle with care in file operations (large payloads in memory)

### Debugging WebSocket Issues
- Check browser DevTools Network tab for WebSocket handshake
- Verify `wsClients.size` logs on server to confirm client connections
- Common issue: Vite dev server CORS—ensure WS URL matches server origin

## Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **TicketDashboard** | Displays ticket list with filters; role-aware (clients see own, agents see all for triage) |
| **TicketForm** | Submits new support requests; handles location picker, attachments |
| **NotificationCenter** | Renders email simulation logs; shows who received what and when |
| **DockerGuide** | Inline docs for Docker Compose setup and service access |

## File Structure Highlights

```
/
├── package.json         (all deps: React, Express, pg, ws, Tailwind, Vite, esbuild)
├── tsconfig.json        (TypeScript 5.8.2, strict mode)
├── vite.config.ts       (Vite 6.2.3 + React + Tailwind plugins)
├── server.ts            (Express + WS server entry)
├── Dockerfile           (containerized app)
├── docker-compose.yml   (app + postgres + pgAdmin)
│
├── src/
│   ├── App.tsx          (main React container, user switcher, state management)
│   ├── main.tsx         (React 19 DOM render)
│   ├── types.ts         (all TypeScript interfaces: User, Ticket, Attachment, etc.)
│   ├── dataStore.ts     (DB abstraction: PostgreSQL and JSON modes)
│   ├── index.css        (Tailwind imports)
│   ├── components/
│   │   ├── TicketDashboard.tsx
│   │   ├── TicketForm.tsx
│   │   ├── NotificationCenter.tsx
│   │   └── DockerGuide.tsx
│   └── data/
│       └── stores.ts    (likely Zustand or similar state management helper)
│
├── tests/
│   └── core.test.ts     (Node.js native test suite: seed data, CRUD ops, role checks)
│
├── index.html           (Vite entry point)
├── metadata.json        (project metadata)
└── README.md            (Polish & English docs, Docker setup guide)
```

## Testing & Quality Assurance

**Test Suite (`tests/core.test.ts`):**
- Uses Node.js native `test` + `assert` modules (no external runner)
- Validates: initial seeded data, ticket CRUD operations, message threading, notifications
- Run: `npm test`
- **Important:** Tests assume database is initialized (check `initializeDatabase()` call in server.ts)

**Type Safety:**
- Full TypeScript with strict mode enabled
- Run `npm run lint` to catch type errors before runtime

## Deployment

### Docker Compose (Recommended)
```bash
docker compose up --build -d
```
Launches all three services in one command; use `docker compose logs -f` to monitor.

### Manual Node Execution
```bash
npm run build  # Vite + esbuild
npm start      # Runs dist/server.cjs
```
Requires manual PostgreSQL setup or JSON mode fallback.

## Common Pitfalls & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| WebSocket connection fails | CORS/firewall | Verify WS URL in App.tsx matches server origin |
| Database connection hangs | PostgreSQL unavailable | Check Docker is running; logs show fallback to JSON |
| Tests fail silently | `tickets_db.json` not writable | Run from project root; ensure directory permissions |
| HMR flicker in editor | File watcher overhead | Set `DISABLE_HMR=true` during agent edits |
| Attachments lost | Exceeds 10MB limit | Validate file size before upload |

## Google GenAI Integration

The project includes `@google/genai` package (v1.29.0) in dependencies but exact usage is not visible in provided code snippets. Likely used for:
- Auto-categorization of tickets
- Priority suggestion from description
- Draft response generation

Check server.ts or component files for `genai` API calls when adding AI-powered features.

---

**For detailed deployment & Polish documentation, see [README.md](README.md).**

**Last Updated:** May 2026

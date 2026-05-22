# IT Support Request & Ticket Management System

An enterprise-ready IT Helpdesk Support and Ticket Management application featuring real-time state tracking, role-based access control (RBAC), simulated notification dispatches, and responsive attachments. The application is completely dockerized for seamless local deployment.

---

## 🎨 Core Architectural Features

1. **Dual DB Adapter Engine:** Connects natively to a **PostgreSQL Database** when running in Docker, and falls back to a **high-speed JSON File DB (`tickets_db.json`)** in isolated or dev-sandbox environments.
2. **Real-time Synchronization (WebSockets):** Status transitions, operator dispatching, and conversational reply widgets synchronized live across both customers and engineers.
3. **Role-Based Access Control (RBAC):**
   - **Client Panel:** View submitted tickets, register complaints, attach files (logs/screenshots), and chat with technicians.
   - **Agent/Admin Dashboard:** Manipulate ticket statuses, upgrade impact urgency, allocate cases to technicians, and log private/internal discussion notes.
4. **Dynamic SMTP Email Simulation:** Dispatches formatted HTML/text email content for all critical events (creation, transitions, team dispatches) with a beautiful interactive audit mailbox in the UI.
5. **Robust Testing Scaffold:** Fast Node.js native unit tests testing persistence integrity, RBAC transition parameters, and thread appending.

---

## 🚀 Easy Start with Docker Compose (Recommended)

To run the entire suite locally (App + PostgreSQL database + pgAdmin Admin panel) in isolated containers:

### Prerequisites
- [Docker Client](https://www.docker.com/products/docker-desktop/) installed and running.

### Boot containers
From the project workspace root, run:
```bash
docker compose up --build -d
```

This starts three orchestrated servers:
- 🌐 **IT Helpdesk Web Portal:** [http://localhost:3000](http://localhost:3000)
- 🗄️ **PostgreSQL DB Service:** Runs on `localhost:5432`
- 🖥️ **pgAdmin Panel Utility:** [http://localhost:5050](http://localhost:5050)
  - *Login email:* `admin@bagietka.pl`
  - *Login password:* `AdminPassword_99`

### Stop containers
```bash
docker compose down -v
```

---

## 🛠️ Local Development (Manual Setup)

Run the backend and frontend locally without containers using Node.js:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start hybrid HTTP + WebSocket Server:**
   ```bash
   npm run dev
   ```
   *The Express portal will boot and serve the frontend at [http://localhost:3000](http://localhost:3000) immediately.*

3. **Check local database fallback:**
   - Without active PG connection strings in `.env`, the server automatically creates `/tickets_db.json` and seeds mock diagnostic tickets immediately!

---

## 🧪 Running Automated Unit Tests

A comprehensive suite of unit tests has been designed using Node's native built-in testing harness. To execute core test scopes:

```bash
npm run test
```

Standard Output logs trace test validations for:
- Initial database pre-seeding.
- Submitting newly registered tickets.
- Status transition upgrades under simulated RBAC parameters.
- Chat board insertions and message queues.
- Security audit logging of client emails.

---

## 📁 System Blueprint & Directory Layout

- `/server.ts` - Core full-stack HTTP and WebSocket server handling REST routes and WebSockets upgrades.
- `/src/types.ts` - Shared TS interfaces (Ticket, User, Attachment, TicketMessage, NotificationLog).
- `/src/dataStore.ts` - Dual-mode database integration pool (PostgreSQL + local JSON stream fallback).
- `/src/components/` - Highly structured UI modules:
  - `TicketForm.tsx` - File submits with attachment convertors.
  - `TicketDashboard.tsx` - Ticket grids, filter panels, conversations, and state actions.
  - `NotificationCenter.tsx` - Visual audit logs tracking outgoing simulated SMTP emails.
  - `DockerGuide.tsx` - Interactive local container guides.
- `/tests/core.test.ts` - Lightweight high-reliability core test harness.

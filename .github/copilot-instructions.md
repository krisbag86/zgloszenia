# AI Agent Guidelines for zgloszenia Ticket System

## Project Overview
A full-stack React + Express helpdesk application with:
- Real-time WebSocket synchronization
- Role-Based Access Control (RBAC) with `client`, `agent`, and `admin` roles
- Dual database modes: PostgreSQL (production) and JSON fallback (development)
- Simulated email notifications
- Attachments handling (Base64, 10MB limit)

## Key Conventions
- **RBAC**: Backend validates `currentUser.role` on every API call
- **Demo Users**: Hardcoded in `App.tsx` (`DEMO_USERS` array)
- **ID Generation**: `${prefix}-${randomString}` pattern (e.g., `tk-101`, `agent-1`)
- **Database**: Auto-fallback from PostgreSQL to `tickets_db.json` if connection fails
- **HMR**: Can be disabled with `DISABLE_HMR=true` env var (useful for agent edits)

## Development Workflow
- **Start**: `npm run dev` (watch mode)
- **Build**: `npm run build`
- **Start Production**: `npm start`
- **Tests**: `npm test` (native Node.js tests)
- **Type Check**: `npm run lint`

## Common Pitfalls
- WebSocket CORS issues – ensure WS URL matches server origin
- Database fallback – verify `isPostgresConnected()` status
- HMR flicker – set `DISABLE_HMR=true` when editing with agents
- Attachments – respect 10MB limit

## Useful Links
- [README.md](README.md) – detailed deployment docs
- [AGENTS.md](AGENTS.md) – comprehensive architecture guide
- [src/types.ts](src/types.ts) – TypeScript interfaces
- [src/dataStore.ts](src/dataStore.ts) – DB abstraction layer
- [tests/core.test.ts](tests/core.test.ts) – test suite

*Link to external documentation rather than duplicating content. Keep this file concise and actionable for AI agents.*
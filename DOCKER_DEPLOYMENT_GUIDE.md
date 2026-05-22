# Docker Deployment & Orchestration Guide

## Quick Start with Docker Compose

Docker Compose is the **recommended** approach for development and testing. It orchestrates three services in one command:

```bash
docker compose up --build -d
```

This launches:
- **app** container (port 3000) - React frontend + Express backend
- **postgres** container (port 5432) - PostgreSQL database
- **pgAdmin** container (port 5050) - Database management UI

### Check Service Status
```bash
docker compose ps
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres

# Follow last 50 lines
docker compose logs -f --tail=50 app
```

### Stop Everything
```bash
docker compose down -v  # -v removes named volumes (resets database)
docker compose down     # keeps volumes
```

---

## Service-by-Service Breakdown

### **1. App Service (Frontend + Backend)**

**Docker Configuration:**
- Base image: `node:22-alpine`
- Exposed port: `3000`
- Volumes: None (images are baked in during `--build`)
- Environment variables passed from `.env`:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`

**Build Process (Dockerfile):**
1. **Stage 1 - Frontend Build (Vite)**
   ```dockerfile
   npm ci
   npm run build  # outputs to dist/
   ```

2. **Stage 2 - Backend Bundle (esbuild)**
   ```dockerfile
   esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/server.cjs
   ```

3. **Stage 3 - Runtime**
   - Starts with lean Alpine Node image
   - Copies bundled server and frontend from earlier stages
   - Runs: `node dist/server.cjs`

**Troubleshooting:**
- If app fails to start, check: `docker compose logs app`
- If database connection times out, ensure postgres service is running: `docker compose ps postgres`
- If frontend shows 404, verify Vite build succeeded (check `dist/` folder exists in Docker image)

---

### **2. PostgreSQL Service**

**Configuration:**
- Image: `postgres:15-alpine`
- Port: `5432` (internal) → `5432` (host)
- Initial database: `tickets_db` (created via `POSTGRES_DB` env var)
- Default credentials:
  - **User**: `postgres`
  - **Password**: `postgres_password` (from docker-compose.yml)

**Data Persistence:**
- Volume: `postgres_data` (named Docker volume, survives `docker compose down`)
- Location on host: Docker-managed (see `docker volume ls`)
- To **reset** database: `docker compose down -v` (removes volume)

**Connecting to Postgres from Host:**
```bash
# Using psql command-line
psql -h localhost -p 5432 -U postgres -d tickets_db

# From app container
docker exec -it zgloszenia-postgres-1 psql -U postgres -d tickets_db
```

**Common Queries:**
```sql
-- List tables
\dt

-- Inspect tickets table
\d tickets

-- Check rows
SELECT COUNT(*) FROM tickets;
```

**Troubleshooting:**
- `connection refused` → Postgres not running or not fully initialized (wait 10-15s after `docker compose up`)
- `FATAL: password authentication failed` → Check `POSTGRES_PASSWORD` env var in docker-compose.yml
- Port conflict (5432 already in use) → Change `ports:` mapping in docker-compose.yml, e.g., `"5433:5432"`

---

### **3. pgAdmin Service**

**Configuration:**
- Image: `dpage/pgadmin4:latest`
- Port: `5050`
- Default login:
  - **Email**: `admin@bagietka.pl`
  - **Password**: `AdminPassword_99`

**Connecting to Postgres:**
1. Navigate to `http://localhost:5050`
2. Log in with above credentials
3. Click **Add New Server** → **Create**
4. **General** tab:
   - Name: `tickets_db_local`
5. **Connection** tab:
   - Host: `postgres` (Docker internal hostname, NOT `localhost`)
   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: `postgres`
   - Password: `postgres_password`
6. Click **Save**

Once connected, you can:
- View tables, schemas, and data
- Run SQL queries
- Create backups
- Manage users and permissions

**Troubleshooting:**
- `connection refused` → Check that hostname is `postgres` (Docker service name), not `localhost`
- Can't log in → Verify email/password match docker-compose.yml `PGADMIN_*` vars

---

## Environment Variables & Configuration

**File:** `.env` or set directly in `docker-compose.yml`

### Key Variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_HOST` | `postgres` | PostgreSQL hostname (use Docker service name in compose) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres_password` | Database password |
| `DB_NAME` | `tickets_db` | Initial database name |
| `DB_SSL` | `false` | Enable SSL for connections (set `true` for production) |
| `NODE_ENV` | `development` | App environment |

**Example `.env` for Docker:**
```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres_password
DB_NAME=tickets_db
DB_SSL=false
NODE_ENV=development
```

---

## Common Docker Compose Tasks

### Rebuild After Code Changes
```bash
docker compose up --build  # Rebuilds images, reuses volumes
```

### Wipe Everything & Start Fresh
```bash
docker compose down -v      # Remove containers + volumes
docker compose up --build   # Rebuild from scratch
```

### Run a One-Off Command (e.g., migrations, seeds)
```bash
docker compose run --rm app npm run seed
docker compose run --rm app npm test
```

### Access App Container Shell
```bash
docker compose exec app sh
# Inside container: npm test, ls dist/, etc.
```

### Monitor Container Resource Usage
```bash
docker stats zgloszenia-app-1 zgloszenia-postgres-1
```

---

## Production Considerations

### Before Deploying:

1. **Set `DB_SSL=true`** in production environment
2. **Use strong passwords** (not `postgres_password`)
3. **Pin image versions** (replace `postgres:15-alpine` with `postgres:15.2-alpine`)
4. **Separate `.env.production`** file (never commit secrets)
5. **Enable restart policies** in docker-compose.yml:
   ```yaml
   services:
     app:
       restart: unless-stopped
     postgres:
       restart: unless-stopped
   ```

6. **Run health checks:**
   ```yaml
   app:
     healthcheck:
       test: ["CMD", "curl", "-f", "http://localhost:3000"]
       interval: 30s
       timeout: 10s
       retries: 3
   ```

7. **Bind to specific interfaces** (not 0.0.0.0 if behind a reverse proxy)

### Backup PostgreSQL Data:
```bash
docker compose exec postgres pg_dump -U postgres tickets_db > backup.sql

# Restore:
cat backup.sql | docker compose exec -T postgres psql -U postgres tickets_db
```

---

## Debugging Docker Issues

### Issue: Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### Issue: App Starts But Can't Connect to Database
```bash
# Check if postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Verify hostname is correct (should be 'postgres', not 'localhost')
docker compose exec app printenv | grep DB_
```

### Issue: Changes Not Reflected After Code Update
```bash
# Rebuild without cache
docker compose build --no-cache app

# Then restart
docker compose up app
```

### Issue: pgAdmin Can't Connect to Postgres
- Use hostname **`postgres`** (not `localhost`)
- Postgres port inside Docker is always `5432` (even if host-mapped differently)

---

## Network Architecture

```
Host Machine (localhost)
├── http://localhost:3000  → docker-compose forwards to app:3000
├── http://localhost:5050  → docker-compose forwards to pgAdmin:5050
└── localhost:5432        → docker-compose forwards to postgres:5432

Docker Network (internal)
├── app        (port 3000)   - can reach postgres:5432 directly
├── postgres   (port 5432)   - PostgreSQL service
└── pgAdmin    (port 5050)   - management UI
```

All three services share the `zgloszenia_default` network (created automatically by Docker Compose), so:
- App connects to `postgres:5432` (not `localhost`)
- pgAdmin connects to `postgres:5432`

---

## See Also

- [AGENTS.md](AGENTS.md) for full architecture overview
- [README.md](README.md) for Polish/English deployment docs
- Docker Compose docs: https://docs.docker.com/compose/

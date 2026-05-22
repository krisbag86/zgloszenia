# Database Operations Guide: PostgreSQL & JSON Schema

Patterns and scripts for database schema management, migrations, backups, and optimization.

---

## Part 1: PostgreSQL Schema Reference

### Current Tables

#### tickets
```sql
CREATE TABLE tickets (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,  -- 'hardware', 'software', 'network', 'access', 'other'
  priority VARCHAR NOT NULL,  -- 'low', 'medium', 'high', 'urgent'
  status VARCHAR NOT NULL,    -- 'open', 'in_progress', 'resolved', 'closed'
  client_id VARCHAR NOT NULL,
  client_name VARCHAR,
  client_email VARCHAR,
  assigned_to VARCHAR,        -- Agent ID
  assigned_name VARCHAR,      -- Agent Name
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  location VARCHAR,           -- Store code or description
  attachments JSONB DEFAULT '[]',
  messages JSONB DEFAULT '[]'
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_client_id ON tickets(client_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
```

#### notifications (email logs)
```sql
CREATE TABLE notifications (
  id VARCHAR PRIMARY KEY,
  ticket_id VARCHAR,
  recipient_email VARCHAR NOT NULL,
  recipient_name VARCHAR,
  subject VARCHAR,
  body TEXT,
  event_type VARCHAR,  -- 'ticket_created', 'status_changed', 'assigned'
  sent_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
```

---

## Part 2: Setting Up PostgreSQL Locally

### Option 1: Docker (Recommended)

Already configured in `docker-compose.yml`:

```bash
docker compose up -d postgres pgAdmin
```

Access pgAdmin at http://localhost:5050 with:
- Email: `admin@bagietka.pl`
- Password: `AdminPassword_99`

### Option 2: Manual Installation (macOS)

```bash
# Install via Homebrew
brew install postgresql@15

# Start service
brew services start postgresql@15

# Create database
createdb tickets_db

# Create user
createuser --interactive postgres
```

### Option 3: Manual Installation (Linux - Ubuntu/Debian)

```bash
# Install
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Access as default postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE tickets_db;
CREATE USER tickets_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE tickets_db TO tickets_user;
```

---

## Part 3: Creating Tables (Initial Schema)

### Script: scripts/init-schema.sql

```sql
-- Run this once to initialize the database schema

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('hardware', 'software', 'network', 'access', 'other')),
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  client_id VARCHAR(50) NOT NULL,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  assigned_to VARCHAR(50),
  assigned_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  location VARCHAR(255),
  attachments JSONB DEFAULT '[]',
  messages JSONB DEFAULT '[]'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(20) PRIMARY KEY,
  ticket_id VARCHAR(20) REFERENCES tickets(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  event_type VARCHAR(50),
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);
```

### Run Schema Initialization

```bash
# Via Docker
docker compose exec postgres psql -U postgres -d tickets_db < scripts/init-schema.sql

# Via local psql
psql -h localhost -U postgres -d tickets_db < scripts/init-schema.sql
```

---

## Part 4: Migrations & Schema Changes

### Pattern: Dated Migration Files

Create migrations in `scripts/migrations/`:

```
scripts/migrations/
├── 001_init_schema.sql
├── 002_add_priority_index.sql
├── 003_add_location_field.sql
└── 004_add_audit_log_table.sql
```

### Example Migration: Add Audit Log Table

**File:** `scripts/migrations/004_add_audit_log_table.sql`

```sql
-- Migration: Add audit logging for ticket changes
-- Date: 2026-05-22
-- Reversible: Yes (includes DROP at end)

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS ticket_audit_log (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(20) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by VARCHAR(50),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  old_priority VARCHAR(50),
  new_priority VARCHAR(50),
  change_reason TEXT
);

CREATE INDEX idx_audit_log_ticket_id ON ticket_audit_log(ticket_id);
CREATE INDEX idx_audit_log_changed_at ON ticket_audit_log(changed_at DESC);

COMMIT;

-- Rollback (if needed):
-- DROP TABLE ticket_audit_log;
```

### Running Migrations

```bash
# Manual execution
docker compose exec postgres psql -U postgres -d tickets_db < scripts/migrations/004_add_audit_log_table.sql

# With confirmation
cat scripts/migrations/004_add_audit_log_table.sql | docker compose exec -T postgres psql -U postgres -d tickets_db
```

### Tracking Applied Migrations (Optional)

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (migration) VALUES ('001_init_schema.sql');
INSERT INTO schema_migrations (migration) VALUES ('004_add_audit_log_table.sql');

-- Check applied migrations
SELECT * FROM schema_migrations ORDER BY applied_at;
```

---

## Part 5: Data Management

### Seed Data for Testing

**File:** `scripts/seed.sql`

```sql
-- Insert test data
INSERT INTO tickets (id, title, description, category, priority, status, client_id, client_name, client_email, created_at, updated_at)
VALUES
  ('tk-test-1', 'Test VPN Issue', 'Cannot connect', 'network', 'high', 'open', 'client-test-1', 'Test User', 'test@example.com', NOW(), NOW()),
  ('tk-test-2', 'Test Software Bug', 'Application crashes', 'software', 'urgent', 'in_progress', 'client-test-2', 'Another User', 'another@example.com', NOW(), NOW());

-- Verify
SELECT COUNT(*) as total_tickets FROM tickets;
```

```bash
docker compose exec postgres psql -U postgres -d tickets_db < scripts/seed.sql
```

### Export Data to CSV

```bash
docker compose exec postgres psql -U postgres -d tickets_db \
  -c "COPY tickets TO STDOUT WITH CSV HEADER" > tickets_export.csv
```

### Import CSV Data

```bash
docker compose exec postgres psql -U postgres -d tickets_db \
  -c "COPY tickets FROM STDIN WITH CSV HEADER" < tickets_data.csv
```

---

## Part 6: Backups & Recovery

### Backup with pg_dump

```bash
# Full database backup
docker compose exec postgres pg_dump -U postgres tickets_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
docker compose exec postgres pg_dump -U postgres -Fc tickets_db > backup.dump

# Backup specific table
docker compose exec postgres pg_dump -U postgres -t tickets tickets_db > tickets_only.sql
```

### Restore from Backup

```bash
# From SQL file
docker compose exec -T postgres psql -U postgres tickets_db < backup_20260522_120000.sql

# From compressed dump
docker compose exec -T postgres pg_restore -U postgres -d tickets_db backup.dump

# Drop and recreate database before restore (fresh start)
docker compose exec postgres psql -U postgres -c "DROP DATABASE tickets_db;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE tickets_db;"
docker compose exec -T postgres psql -U postgres tickets_db < backup_20260522_120000.sql
```

### Automated Backup Script

**File:** `scripts/backup.sh`

```bash
#!/bin/bash

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tickets_db_$TIMESTAMP.sql"

echo "Creating backup: $BACKUP_FILE"
docker compose exec postgres pg_dump -U postgres tickets_db > "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "tickets_db_*.sql" -mtime +7 -delete

echo "Backup complete."
ls -lh "$BACKUP_FILE"
```

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

---

## Part 7: Performance Tuning

### Analyze Query Performance

```bash
# Connect to postgres
docker compose exec postgres psql -U postgres -d tickets_db
```

```sql
-- Show query execution plan
EXPLAIN ANALYZE SELECT * FROM tickets WHERE status = 'open' AND priority = 'urgent';

-- Check index usage
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'tickets';

-- Find slow queries (requires log_statement = 'all')
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### Add Missing Indexes

```sql
-- Query tickets by status often? Add index:
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority);

-- Searching by client? Add:
CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON tickets(client_id, status);

-- Date range queries? Add:
CREATE INDEX IF NOT EXISTS idx_tickets_created_range ON tickets(created_at DESC) INCLUDE (status, priority);
```

### Maintenance Tasks

```sql
-- Clean up dead rows (reclaim space)
VACUUM ANALYZE tickets;

-- Reindex fragmented indexes
REINDEX INDEX idx_tickets_created_at;

-- Check table size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Part 8: JSON Fallback Mode (tickets_db.json)

When PostgreSQL is unavailable, the app falls back to `tickets_db.json`:

```json
{
  "tickets": [
    {
      "id": "tk-101",
      "title": "VPN Authentication Fails",
      "category": "network",
      "priority": "high",
      "status": "in_progress",
      "clientId": "client-1",
      "createdAt": "2026-05-22T10:00:00Z",
      "messages": [],
      "attachments": []
    }
  ],
  "notifications": [
    {
      "id": "n-1",
      "ticketId": "tk-101",
      "recipientEmail": "agent@example.com",
      "eventType": "ticket_created",
      "sentAt": "2026-05-22T10:00:00Z"
    }
  ]
}
```

**Important:** JSON mode is **not suitable for production** because:
- No concurrent write safety (locks entire file)
- Slow with large datasets
- No transactions or rollback

Use PostgreSQL for all production deployments.

---

## Part 9: Monitoring & Health Checks

### Database Connection Health

```typescript
// In server.ts or a monitoring module
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (usePostgres && pool) {
      const result = await pool.query('SELECT 1');
      console.log('✓ PostgreSQL connection healthy');
      return true;
    } else {
      console.log('✓ JSON mode (PostgreSQL unavailable)');
      return true;
    }
  } catch (err) {
    console.error('✗ Database unhealthy:', err);
    return false;
  }
}

// Call during startup
const dbHealthy = await checkDatabaseHealth();
if (!dbHealthy && !usePostgres) {
  console.warn('Database unavailable; using JSON fallback');
}
```

### Monitoring Queries

```sql
-- Active connections
SELECT
  pid,
  usename,
  application_name,
  state,
  query,
  query_start
FROM pg_stat_activity
WHERE datname = 'tickets_db';

-- Connection count
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Slow query log (if enabled)
SELECT query, calls, mean_time, max_time FROM pg_stat_statements
WHERE query LIKE '%tickets%'
ORDER BY mean_time DESC;
```

---

## Checklist for Database Ops

- [ ] Schema initialized (`scripts/init-schema.sql`)
- [ ] Indexes created for common queries
- [ ] Backup script set up (`scripts/backup.sh`)
- [ ] Migrations tracked in version control
- [ ] Seed data available for testing
- [ ] Health check implemented in `server.ts`
- [ ] Connection pooling configured in `dataStore.ts`
- [ ] JSON fallback tested and working
- [ ] Performance baseline measured (query times)
- [ ] Recovery plan documented

---

## See Also

- [AGENTS.md](AGENTS.md) - Architecture
- [API_EXTENSION_GUIDE.md](API_EXTENSION_GUIDE.md) - Adding endpoints
- [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md) - Container setup
- [src/dataStore.ts](src/dataStore.ts) - Current queries
- [docker-compose.yml](docker-compose.yml) - PostgreSQL config

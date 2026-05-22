# API Extension Guide: Adding New Endpoints & WebSocket Messages

Guide for extending the backend with new ticket operations, WebSocket synchronization, and database queries.

---

## Part 1: Adding a New REST API Endpoint

### Step 1: Define Types (src/types.ts)

Add any new data types or interfaces:

```typescript
// Example: New endpoint to get tickets by status
export interface TicketsFilterRequest {
  status: TicketStatus[];
  priority?: TicketPriority;
  limit?: number;
  offset?: number;
}

export interface TicketsFilterResponse {
  tickets: Ticket[];
  total: number;
  hasMore: boolean;
}
```

### Step 2: Add Database Function (src/dataStore.ts)

Add the data access logic **before** the export statements:

```typescript
// Inside dataStore.ts (before exports)
async function getTicketsByFilter(
  statuses: TicketStatus[],
  priority?: TicketPriority
): Promise<Ticket[]> {
  if (usePostgres && pool) {
    const query = `
      SELECT * FROM tickets 
      WHERE status = ANY($1)
      ${priority ? 'AND priority = $2' : ''}
      ORDER BY created_at DESC
    `;
    const params = priority ? [statuses, priority] : [statuses];
    const result = await pool.query(query, params);
    return result.rows;
  } else {
    // JSON mode
    const db = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8')) as DBState;
    return db.tickets.filter(
      t => statuses.includes(t.status) && (!priority || t.priority === priority)
    );
  }
}

// Export it
export { getTicketsByFilter };
```

### Step 3: Add Express Route (server.ts)

Add the route **after** the WebSocket setup and **before** `server.listen()`:

```typescript
// GET /api/tickets/filter
app.get('/api/tickets/filter', async (req, res) => {
  try {
    const statuses = (req.query.statuses as string)?.split(',') as TicketStatus[];
    const priority = req.query.priority as TicketPriority | undefined;

    if (!statuses || statuses.length === 0) {
      return res.status(400).json({ error: 'statuses required' });
    }

    const tickets = await getTicketsByFilter(statuses, priority);
    
    // Broadcast to all WebSocket clients
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'ticketsUpdated',
          data: { filtered: true, tickets }
        }));
      }
    });

    res.json({ tickets, total: tickets.length });
  } catch (err) {
    console.error('Error filtering tickets:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Step 4: Update Frontend (src/dataStore.ts client side)

Add the fetch call to the API client:

```typescript
export async function fetchTicketsByFilter(
  statuses: TicketStatus[],
  priority?: TicketPriority
): Promise<Ticket[]> {
  const params = new URLSearchParams({
    statuses: statuses.join(','),
    ...(priority && { priority })
  });
  
  const response = await fetch(`/api/tickets/filter?${params}`);
  if (!response.ok) throw new Error('Failed to fetch filtered tickets');
  const { tickets } = await response.json();
  return tickets;
}
```

### Step 5: Call from Components (src/components/TicketDashboard.tsx)

```typescript
import { fetchTicketsByFilter } from '../dataStore';

// In your component
const handleFilterByStatus = async (statuses: TicketStatus[]) => {
  try {
    const filtered = await fetchTicketsByFilter(statuses, 'high');
    setTickets(filtered);
  } catch (err) {
    console.error(err);
  }
};
```

---

## Part 2: Adding WebSocket Message Types & Broadcasts

### Step 1: Define Message Types (types.ts)

```typescript
export type WebSocketMessageType =
  | 'ticketsUpdated'
  | 'ticketCreated'
  | 'ticketChanged'
  | 'notificationSent'
  | 'messageAdded'
  | 'connectionStatus';  // New type

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp?: string;
}
```

### Step 2: Broadcast from Server (server.ts)

Create a helper to broadcast to all clients:

```typescript
function broadcastToClients(message: WebSocketMessage) {
  const payload = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Then in your route, use it:
app.post('/api/tickets/:id/assign', async (req, res) => {
  const { ticketId } = req.params;
  const { agentId } = req.body;
  
  const updated = await updateTicket(ticketId, { assignedTo: agentId });
  
  // Notify all clients
  broadcastToClients({
    type: 'ticketChanged',
    data: { ticketId, changed: { assignedTo: agentId } },
    timestamp: new Date().toISOString()
  });

  res.json(updated);
});
```

### Step 3: Handle Messages on Frontend (src/App.tsx)

```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3000');

  ws.onmessage = (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);

    switch (message.type) {
      case 'ticketsUpdated':
        setTickets(message.data.tickets);
        break;
      case 'ticketChanged':
        setTickets(prev =>
          prev.map(t =>
            t.id === message.data.ticketId
              ? { ...t, ...message.data.changed }
              : t
          )
        );
        break;
      case 'connectionStatus':
        setWsConnected(message.data.connected);
        break;
    }
  };

  return () => ws.close();
}, []);
```

---

## Part 3: Adding Database Queries (PostgreSQL)

### Common Patterns

#### Parameterized Queries (Safe from SQL Injection)
```typescript
const result = await pool.query(
  'SELECT * FROM tickets WHERE status = $1 AND priority = $2',
  [status, priority]
);
```

#### INSERT with RETURNING
```typescript
const result = await pool.query(
  `INSERT INTO tickets (id, title, status, created_at)
   VALUES ($1, $2, $3, $4)
   RETURNING *`,
  [newId, title, 'open', new Date().toISOString()]
);
const ticket = result.rows[0];
```

#### UPDATE with Conditional Logic
```typescript
const result = await pool.query(
  `UPDATE tickets 
   SET status = $1, updated_at = $2
   WHERE id = $3 AND client_id = $4
   RETURNING *`,
  [newStatus, new Date().toISOString(), ticketId, clientId]
);
if (result.rows.length === 0) {
  throw new Error('Ticket not found or unauthorized');
}
```

#### JOIN to Get Related Data
```typescript
const result = await pool.query(
  `SELECT t.*, m.id as message_id, m.message, m.created_at
   FROM tickets t
   LEFT JOIN ticket_messages m ON t.id = m.ticket_id
   WHERE t.id = $1
   ORDER BY m.created_at ASC`,
  [ticketId]
);
```

#### Transactions (Multiple Operations)
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  await client.query('UPDATE tickets SET status = $1 WHERE id = $2', ['resolved', ticketId]);
  await client.query('INSERT INTO notifications (...) VALUES (...)', [...]);
  
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Adding a Migration Script

Create `scripts/migrations/add_priority_index.sql`:

```sql
-- Run manually or during deploy
ALTER TABLE tickets ADD COLUMN priority_index INT;
CREATE INDEX idx_tickets_priority ON tickets(priority);
```

Run in postgres container:
```bash
docker compose exec postgres psql -U postgres -d tickets_db < scripts/migrations/add_priority_index.sql
```

---

## Part 4: JSON Mode Fallback (No PostgreSQL)

When database is unavailable, the app falls back to `tickets_db.json`. Your dataStore functions should handle both:

```typescript
async function getHighPriorityTickets(): Promise<Ticket[]> {
  if (usePostgres && pool) {
    const result = await pool.query(
      'SELECT * FROM tickets WHERE priority = $1',
      ['urgent']
    );
    return result.rows;
  } else {
    // JSON fallback
    const db = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8')) as DBState;
    return db.tickets.filter(t => t.priority === 'urgent');
  }
}
```

**Important:** JSON mode writes are **synchronous** (slow), so avoid in high-frequency operations.

---

## Part 5: Error Handling & Validation

### Validation Pattern
```typescript
function validateTicketCreation(req: Request): Ticket {
  const { title, description, category } = req.body;
  
  if (!title?.trim()) {
    throw new Error('Title is required');
  }
  if (!['hardware', 'software', 'network', 'access', 'other'].includes(category)) {
    throw new Error('Invalid category');
  }
  
  return {
    id: generateId('tk'),
    title: title.trim(),
    description: description || '',
    category,
    // ... other fields
  };
}

app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = validateTicketCreation(req);
    const saved = await createTicket(ticket);
    broadcastToClients({ type: 'ticketCreated', data: saved });
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
```

### Standard Error Responses
```typescript
// 400 Bad Request - validation error
res.status(400).json({ error: 'Missing required field: title' });

// 401 Unauthorized - not authenticated
res.status(401).json({ error: 'Authentication required' });

// 403 Forbidden - insufficient permissions
res.status(403).json({ error: 'Agents cannot create tickets' });

// 404 Not Found
res.status(404).json({ error: 'Ticket not found' });

// 500 Internal Server Error
res.status(500).json({ error: 'Database error' });
```

---

## Testing Your Endpoint

### With curl
```bash
# GET
curl http://localhost:3000/api/tickets/filter?statuses=open,in_progress

# POST
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"New issue","category":"software"}'
```

### With fetch (browser console)
```javascript
fetch('/api/tickets/filter?statuses=open')
  .then(r => r.json())
  .then(data => console.log(data));
```

### In Tests (tests/core.test.ts)
```typescript
test('Filter tickets by status', async () => {
  const tickets = await getTicketsByFilter(['open']);
  assert.ok(Array.isArray(tickets));
  assert.ok(tickets.every(t => t.status === 'open'));
});
```

---

## Checklist for New Endpoints

- [ ] Types added to `src/types.ts`
- [ ] Database function added to `src/dataStore.ts` (handles both PostgreSQL + JSON)
- [ ] Express route added to `server.ts`
- [ ] WebSocket broadcast added if data changes
- [ ] Frontend fetch function added to `src/dataStore.ts` (client)
- [ ] Component updated to call new API
- [ ] Error handling with proper HTTP status codes
- [ ] Input validation
- [ ] Tests added to `tests/core.test.ts`
- [ ] Documentation updated

---

## See Also

- [AGENTS.md](AGENTS.md) - Architecture overview
- [src/dataStore.ts](src/dataStore.ts) - Existing patterns
- [server.ts](server.ts) - Current route implementations
- [tests/core.test.ts](tests/core.test.ts) - Test examples

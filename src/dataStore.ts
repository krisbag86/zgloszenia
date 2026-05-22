import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { Ticket, NotificationLog, DBState, TicketMessage, TicketStatus, TicketPriority } from './types';

const JSON_DB_PATH = path.join(process.cwd(), 'tickets_db.json');

// Initialize Pool depending on environment variables
let pool: Pool | null = null;
let usePostgres = false;

const pgConfig = {
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || undefined,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || undefined,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

if (pgConfig.connectionString || (pgConfig.host && pgConfig.user)) {
  try {
    pool = new Pool(pgConfig);
    usePostgres = true;
    console.log('PostgreSQL configuration detected. Trying to connect...');
  } catch (err) {
    console.error('Failed to configure PostgreSQL pool, falling back to JSON. Error:', err);
    usePostgres = false;
  }
} else {
  console.log('No PostgreSQL configuration found. Defaulting to local JSON storage for live environment.');
}

// Initial Mock/Seed Tickets to keep the app populated with interesting data immediately
const INITIAL_SEED: DBState = {
  tickets: [
    {
      id: "tk-101",
      title: "VPN Authentication Fails with OAuth2 Error",
      description: "Getting connection rejected errors immediately after completing the duo push notification during the workplace VPN initialization. Diagnostics log says: ERR_OAUTH_TOKEN_EXPIRED.",
      category: "network",
      priority: "high",
      status: "in_progress",
      clientId: "client-1",
      clientName: "Jane Doe",
      clientEmail: "jane.doe@workplace.com",
      assignedTo: "agent-1",
      assignedName: "Alex Vance (IT Support)",
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4h ago
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2h ago
      attachments: [],
      messages: [
        {
          id: "m-1",
          ticketId: "tk-101",
          senderId: "client-1",
          senderName: "Jane Doe",
          senderRole: "client",
          message: "Could we expedite this? I am unable to access the test servers for the release candidate.",
          createdAt: new Date(Date.now() - 3600000 * 3.5).toISOString()
        },
        {
          id: "m-2",
          ticketId: "tk-101",
          senderId: "agent-1",
          senderName: "Alex Vance (IT Support)",
          senderRole: "agent",
          message: "Looking into the logs. It seems the VPN gateway LDAP sync failed this morning. Resetting your session token, please try re-authenticating in 5 minutes.",
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ]
    },
    {
      id: "tk-102",
      title: "Broken MacBook M3 Keyboard (Liquid Spill)",
      description: "My tea spilled onto the enter key. Now the keys 'Q', 'W', and 'Enter' are registers sporadically or trigger repeats. I need a replacement workstation or keyboard repair.",
      category: "hardware",
      priority: "medium",
      status: "open",
      clientId: "client-2",
      clientName: "John Smith",
      clientEmail: "john.smith@co.com",
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), // 12h ago
      updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      attachments: [],
      messages: []
    },
    {
      id: "tk-103",
      title: "Access Request for Production Analytics DB",
      description: "Need read-only access to PostgreSQL production replicas for generating weekly performance KPI metrics. Manager approved. Role: analytics_readonly.",
      category: "access",
      priority: "low",
      status: "resolved",
      clientId: "client-1",
      clientName: "Jane Doe",
      clientEmail: "jane.doe@workplace.com",
      assignedTo: "agent-1",
      assignedName: "Alex Vance (IT Support)",
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
      attachments: [],
      messages: [
        {
          id: "m-10",
          ticketId: "tk-103",
          senderId: "agent-1",
          senderName: "Alex Vance (IT Support)",
          senderRole: "agent",
          message: "Database credentials generated and securely saved to your credentials vault. Verified connectivity.",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ]
    }
  ],
  notifications: [
    {
      id: "notif-1",
      ticketId: "tk-101",
      recipientEmail: "jane.doe@workplace.com",
      recipientName: "Jane Doe",
      subject: "IT Support Update: VPN Authentication Fails with OAuth2 Error",
      body: "Hi Jane Doe, your ticket status has changed to In Progress under the assignment of Alex Vance (IT Support). Details: Resetting your session token...",
      sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      status: "simulated"
    }
  ]
};

// Memory store fallback
let memoryDB: DBState = { ...INITIAL_SEED };

// Save helper for JSON store
function saveJSONStore() {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to local JSON database file:', err);
  }
}

// Load helper for JSON store
function loadJSONStore() {
  try {
    if (fs.existsSync(JSON_DB_PATH)) {
      const content = fs.readFileSync(JSON_DB_PATH, 'utf-8');
      memoryDB = JSON.parse(content);
    } else {
      saveJSONStore();
    }
  } catch (err) {
    console.error('Error loading local JSON database file, re-initializing...', err);
    saveJSONStore();
  }
}

// Ensure local db is loaded if not using Postgres
loadJSONStore();

// Setup DB Tables if we use PostgreSQL
export async function initializeDatabase() {
  if (!usePostgres || !pool) {
    console.log('Running adapter in JSON persistence mode.');
    return true;
  }

  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully. Running schema initializations...');

    // Create tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        priority VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        client_id VARCHAR(100) NOT NULL,
        client_name VARCHAR(150) NOT NULL,
        client_email VARCHAR(150) NOT NULL,
        assigned_to VARCHAR(100),
        assigned_name VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        attachments JSONB DEFAULT '[]'::jsonb,
        messages JSONB DEFAULT '[]'::jsonb,
        location VARCHAR(255)
      );
    `);

    // Ensure the location column is added for existing environments
    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id VARCHAR(50) PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(150) NOT NULL,
        recipient_name VARCHAR(150) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL
      );
    `);

    // Check if table is empty, if so, seed sample data
    const resCount = await client.query('SELECT COUNT(*) FROM tickets');
    if (parseInt(resCount.rows[0].count) === 0) {
      console.log('PostgreSQL database empty. Seeding initial test tickets...');
      for (const t of INITIAL_SEED.tickets) {
        await client.query(`
          INSERT INTO tickets (
            id, title, description, category, priority, status, client_id, client_name, client_email, 
            assigned_to, assigned_name, created_at, updated_at, attachments, messages, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          t.id, t.title, t.description, t.category, t.priority, t.status, t.clientId, t.clientName, t.clientEmail,
          t.assignedTo, t.assignedName, t.createdAt, t.updatedAt, JSON.stringify(t.attachments), JSON.stringify(t.messages), t.location || null
        ]);
      }

      for (const n of INITIAL_SEED.notifications) {
        await client.query(`
          INSERT INTO notification_logs (
            id, ticket_id, recipient_email, recipient_name, subject, body, sent_at, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          n.id, n.ticketId, n.recipientEmail, n.recipientName, n.subject, n.body, n.sentAt, n.status
        ]);
      }
    }

    client.release();
    console.log('PostgreSQL schema verification and seeding complete.');
    return true;
  } catch (err) {
    console.error('CRITICAL: PostgreSQL schema creation failed! Dropping PostgreSQL capability and falling back to JSON storage.', err);
    usePostgres = false;
    return false;
  }
}

// Retrieve all tickets
export async function getTickets(): Promise<Ticket[]> {
  if (usePostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
      return res.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        clientId: row.client_id,
        clientName: row.client_name,
        clientEmail: row.client_email,
        assignedTo: row.assigned_to || undefined,
        assignedName: row.assigned_name || undefined,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments || [],
        messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages || [],
        location: row.location || undefined,
      }));
    } catch (err) {
      console.error('PostgreSQL query error, using local memory store:', err);
    }
  }
  return memoryDB.tickets;
}

// Find ticket by ID
export async function getTicketById(id: string): Promise<Ticket | null> {
  if (usePostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          priority: row.priority,
          status: row.status,
          clientId: row.client_id,
          clientName: row.client_name,
          clientEmail: row.client_email,
          assignedTo: row.assigned_to || undefined,
          assignedName: row.assigned_name || undefined,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments || [],
          messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages || [],
          location: row.location || undefined,
        };
      }
      return null;
    } catch (err) {
      console.error('PostgreSQL search error:', err);
    }
  }
  return memoryDB.tickets.find(t => t.id === id) || null;
}

// Create a new support ticket
export async function createTicket(ticket: Ticket): Promise<Ticket> {
  if (usePostgres && pool) {
    try {
      await pool.query(`
        INSERT INTO tickets (
          id, title, description, category, priority, status, client_id, client_name, client_email, 
          assigned_to, assigned_name, created_at, updated_at, attachments, messages, location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        ticket.id, ticket.title, ticket.description, ticket.category, ticket.priority, ticket.status,
        ticket.clientId, ticket.clientName, ticket.clientEmail, ticket.assignedTo || null, ticket.assignedName || null,
        ticket.createdAt, ticket.updatedAt, JSON.stringify(ticket.attachments), JSON.stringify(ticket.messages), ticket.location || null
      ]);
      return ticket;
    } catch (err) {
      console.error('PostgreSQL insert error, trying memory store:', err);
    }
  }

  memoryDB.tickets.unshift(ticket);
  saveJSONStore();
  return ticket;
}

// Update partial ticket fields (such as status, priority, or assignee)
export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  const timeNow = new Date().toISOString();
  if (usePostgres && pool) {
    try {
      const original = await getTicketById(id);
      if (original) {
        const merged = { ...original, ...updates, updatedAt: timeNow };
        await pool.query(`
          UPDATE tickets SET 
            title = $1, description = $2, category = $3, priority = $4, status = $5, 
            assigned_to = $6, assigned_name = $7, updated_at = $8, attachments = $9, messages = $10,
            location = $11
          WHERE id = $12
        `, [
          merged.title, merged.description, merged.category, merged.priority, merged.status,
          merged.assignedTo || null, merged.assignedName || null, merged.updatedAt,
          JSON.stringify(merged.attachments), JSON.stringify(merged.messages), merged.location || null, id
        ]);
        return merged;
      }
    } catch (err) {
      console.error('PostgreSQL update error:', err);
    }
  }

  const index = memoryDB.tickets.findIndex(t => t.id === id);
  if (index !== -1) {
    const updatedTicket = {
      ...memoryDB.tickets[index],
      ...updates,
      updatedAt: timeNow
    };
    memoryDB.tickets[index] = updatedTicket;
    saveJSONStore();
    return updatedTicket;
  }
  return null;
}

// Post a new discussion reply in chat
export async function addTicketMessage(ticketId: string, message: TicketMessage): Promise<Ticket | null> {
  const original = await getTicketById(ticketId);
  if (!original) return null;

  const updatedMessages = [...original.messages, message];
  return await updateTicket(ticketId, { messages: updatedMessages });
}

// Add logs of mock or actual notifications dispatched
export async function addNotification(log: NotificationLog): Promise<NotificationLog> {
  if (usePostgres && pool) {
    try {
      await pool.query(`
        INSERT INTO notification_logs (id, ticket_id, recipient_email, recipient_name, subject, body, sent_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        log.id, log.ticketId, log.recipientEmail, log.recipientName, log.subject, log.body, log.sentAt, log.status
      ]);
      return log;
    } catch (err) {
      console.error('PostgreSQL insert log error:', err);
    }
  }

  memoryDB.notifications.unshift(log);
  saveJSONStore();
  return log;
}

// Retrieve notification logs
export async function getNotifications(): Promise<NotificationLog[]> {
  if (usePostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 100');
      return res.rows.map(row => ({
        id: row.id,
        ticketId: row.ticket_id,
        recipientEmail: row.recipient_email,
        recipientName: row.recipient_name,
        subject: row.subject,
        body: row.body,
        sentAt: new Date(row.sent_at).toISOString(),
        status: row.status
      }));
    } catch (err) {
      console.error('PostgreSQL queries failed for notification logs:', err);
    }
  }
  return memoryDB.notifications;
}

// Status check function
export function isPostgresConnected(): boolean {
  return usePostgres;
}

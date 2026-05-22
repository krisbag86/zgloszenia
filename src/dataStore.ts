import fs from "fs";
import path from "path";
import { Pool } from "pg";
import {
  Ticket,
  NotificationLog,
  DBState,
  TicketMessage,
  TicketStatus,
  TicketPriority,
  DashboardData,
  TicketMetrics,
  TicketTrendData,
  AgentPerformance,
  CategoryBreakdown,
  PriorityBreakdown,
} from "./types";

const JSON_DB_PATH = path.join(process.cwd(), "tickets_db.json");

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
  ssl:
    process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
};

if (pgConfig.connectionString || (pgConfig.host && pgConfig.user)) {
  try {
    pool = new Pool(pgConfig);
    usePostgres = true;
    console.log("PostgreSQL configuration detected. Trying to connect...");
  } catch (err) {
    console.error(
      "Failed to configure PostgreSQL pool, falling back to JSON. Error:",
      err,
    );
    usePostgres = false;
  }
} else {
  console.log(
    "No PostgreSQL configuration found. Defaulting to local JSON storage for live environment.",
  );
}

// Empty initial state — no demo data
const INITIAL_SEED: DBState = {
  tickets: [],
  notifications: [],
};

// Memory store fallback
let memoryDB: DBState = { tickets: [], notifications: [] };

// Reset to empty state — used by the test suite between runs
export function resetStore(): void {
  memoryDB = { tickets: [], notifications: [] };
}

// Save helper for JSON store
function saveJSONStore() {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(memoryDB, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to local JSON database file:", err);
  }
}

// Load helper for JSON store
function loadJSONStore() {
  try {
    if (fs.existsSync(JSON_DB_PATH)) {
      const content = fs.readFileSync(JSON_DB_PATH, "utf-8");
      memoryDB = JSON.parse(content);
    } else {
      saveJSONStore();
    }
  } catch (err) {
    console.error(
      "Error loading local JSON database file, re-initializing...",
      err,
    );
    saveJSONStore();
  }
}

// Ensure local db is loaded if not using Postgres
loadJSONStore();

// Setup DB Tables if we use PostgreSQL
export async function initializeDatabase() {
  if (!usePostgres || !pool) {
    console.log("Running adapter in JSON persistence mode.");
    return true;
  }

  try {
    const client = await pool.connect();
    console.log(
      "Connected to PostgreSQL successfully. Running schema initializations...",
    );

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
    const resCount = await client.query("SELECT COUNT(*) FROM tickets");
    if (parseInt(resCount.rows[0].count) === 0) {
      console.log("PostgreSQL database empty. Seeding initial test tickets...");
      for (const t of INITIAL_SEED.tickets) {
        await client.query(
          `
          INSERT INTO tickets (
            id, title, description, category, priority, status, client_id, client_name, client_email,
            assigned_to, assigned_name, created_at, updated_at, attachments, messages, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
          [
            t.id,
            t.title,
            t.description,
            t.category,
            t.priority,
            t.status,
            t.clientId,
            t.clientName,
            t.clientEmail,
            t.assignedTo,
            t.assignedName,
            t.createdAt,
            t.updatedAt,
            JSON.stringify(t.attachments),
            JSON.stringify(t.messages),
            t.location || null,
          ],
        );
      }

      for (const n of INITIAL_SEED.notifications) {
        await client.query(
          `
          INSERT INTO notification_logs (
            id, ticket_id, recipient_email, recipient_name, subject, body, sent_at, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            n.id,
            n.ticketId,
            n.recipientEmail,
            n.recipientName,
            n.subject,
            n.body,
            n.sentAt,
            n.status,
          ],
        );
      }
    }

    client.release();
    console.log("PostgreSQL schema verification and seeding complete.");
    return true;
  } catch (err) {
    console.error(
      "CRITICAL: PostgreSQL schema creation failed! Dropping PostgreSQL capability and falling back to JSON storage.",
      err,
    );
    usePostgres = false;
    return false;
  }
}

// Retrieve all tickets
export async function getTickets(): Promise<Ticket[]> {
  if (usePostgres && pool) {
    try {
      const res = await pool.query(
        "SELECT * FROM tickets ORDER BY created_at DESC",
      );
      return res.rows.map((row) => ({
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
        attachments:
          typeof row.attachments === "string"
            ? JSON.parse(row.attachments)
            : row.attachments || [],
        messages:
          typeof row.messages === "string"
            ? JSON.parse(row.messages)
            : row.messages || [],
        location: row.location || undefined,
      }));
    } catch (err) {
      console.error("PostgreSQL query error, using local memory store:", err);
    }
  }
  return memoryDB.tickets;
}

// Find ticket by ID
export async function getTicketById(id: string): Promise<Ticket | null> {
  if (usePostgres && pool) {
    try {
      const res = await pool.query("SELECT * FROM tickets WHERE id = $1", [id]);
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
          attachments:
            typeof row.attachments === "string"
              ? JSON.parse(row.attachments)
              : row.attachments || [],
          messages:
            typeof row.messages === "string"
              ? JSON.parse(row.messages)
              : row.messages || [],
          location: row.location || undefined,
        };
      }
      return null;
    } catch (err) {
      console.error("PostgreSQL search error:", err);
    }
  }
  return memoryDB.tickets.find((t) => t.id === id) || null;
}

// Create a new support ticket
export async function createTicket(ticket: Ticket): Promise<Ticket> {
  if (usePostgres && pool) {
    try {
      await pool.query(
        `
        INSERT INTO tickets (
          id, title, description, category, priority, status, client_id, client_name, client_email,
          assigned_to, assigned_name, created_at, updated_at, attachments, messages, location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
        [
          ticket.id,
          ticket.title,
          ticket.description,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.clientId,
          ticket.clientName,
          ticket.clientEmail,
          ticket.assignedTo || null,
          ticket.assignedName || null,
          ticket.createdAt,
          ticket.updatedAt,
          JSON.stringify(ticket.attachments),
          JSON.stringify(ticket.messages),
          ticket.location || null,
        ],
      );
      return ticket;
    } catch (err) {
      console.error("PostgreSQL insert error, trying memory store:", err);
    }
  }

  memoryDB.tickets.unshift(ticket);
  saveJSONStore();
  return ticket;
}

// Update partial ticket fields (such as status, priority, or assignee)
export async function updateTicket(
  id: string,
  updates: Partial<Ticket>,
): Promise<Ticket | null> {
  const timeNow = new Date().toISOString();
  if (usePostgres && pool) {
    try {
      const original = await getTicketById(id);
      if (original) {
        const merged = { ...original, ...updates, updatedAt: timeNow };
        await pool.query(
          `
          UPDATE tickets SET
            title = $1, description = $2, category = $3, priority = $4, status = $5,
            assigned_to = $6, assigned_name = $7, updated_at = $8, attachments = $9, messages = $10,
            location = $11
          WHERE id = $12
        `,
          [
            merged.title,
            merged.description,
            merged.category,
            merged.priority,
            merged.status,
            merged.assignedTo || null,
            merged.assignedName || null,
            merged.updatedAt,
            JSON.stringify(merged.attachments),
            JSON.stringify(merged.messages),
            merged.location || null,
            id,
          ],
        );
        return merged;
      }
    } catch (err) {
      console.error("PostgreSQL update error:", err);
    }
  }

  const index = memoryDB.tickets.findIndex((t) => t.id === id);
  if (index !== -1) {
    const updatedTicket = {
      ...memoryDB.tickets[index],
      ...updates,
      updatedAt: timeNow,
    };
    memoryDB.tickets[index] = updatedTicket;
    saveJSONStore();
    return updatedTicket;
  }
  return null;
}

// Post a new discussion reply in chat
export async function addTicketMessage(
  ticketId: string,
  message: TicketMessage,
): Promise<Ticket | null> {
  const original = await getTicketById(ticketId);
  if (!original) return null;

  const updatedMessages = [...original.messages, message];
  return await updateTicket(ticketId, { messages: updatedMessages });
}

// Add logs of mock or actual notifications dispatched
export async function addNotification(
  log: NotificationLog,
): Promise<NotificationLog> {
  if (usePostgres && pool) {
    try {
      await pool.query(
        `
        INSERT INTO notification_logs (id, ticket_id, recipient_email, recipient_name, subject, body, sent_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          log.id,
          log.ticketId,
          log.recipientEmail,
          log.recipientName,
          log.subject,
          log.body,
          log.sentAt,
          log.status,
        ],
      );
      return log;
    } catch (err) {
      console.error("PostgreSQL insert log error:", err);
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
      const res = await pool.query(
        "SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 100",
      );
      return res.rows.map((row) => ({
        id: row.id,
        ticketId: row.ticket_id,
        recipientEmail: row.recipient_email,
        recipientName: row.recipient_name,
        subject: row.subject,
        body: row.body,
        sentAt: new Date(row.sent_at).toISOString(),
        status: row.status,
      }));
    } catch (err) {
      console.error("PostgreSQL queries failed for notification logs:", err);
    }
  }
  return memoryDB.notifications;
}

// Status check function
export function isPostgresConnected(): boolean {
  return usePostgres;
}

// ===== ANALYTICS & REPORTING FUNCTIONS =====

// Calculate resolution time in hours for a ticket
function getResolutionTimeHours(ticket: Ticket): number {
  if (ticket.status !== "resolved" && ticket.status !== "closed") {
    return 0; // Unresolved tickets don't count
  }
  const createdTime = new Date(ticket.createdAt).getTime();
  const updatedTime = new Date(ticket.updatedAt).getTime();
  return (updatedTime - createdTime) / (1000 * 60 * 60);
}

// Get high-level ticket metrics
export async function getTicketMetrics(): Promise<TicketMetrics> {
  const tickets = await getTickets();

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress",
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;

  const criticalCount = tickets.filter(
    (t) =>
      (t.priority === "urgent" || t.priority === "high") &&
      (t.status === "open" || t.status === "in_progress"),
  ).length;

  // Calculate average resolution time (only for resolved/closed tickets)
  const resolvedTickets = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  );
  const avgResolutionTime =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + getResolutionTimeHours(t), 0) /
        resolvedTickets.length
      : 0;

  return {
    totalTickets: tickets.length,
    openTickets: openCount,
    inProgressTickets: inProgressCount,
    resolvedTickets: resolvedCount,
    closedTickets: closedCount,
    avgResolutionTimeHours: Math.round(avgResolutionTime * 10) / 10,
    criticalTickets: criticalCount,
    overallSatisfactionScore: 85, // Placeholder: would come from feedback system
  };
}

// Get ticket trends over the last 30 days
export async function getTicketTrends(): Promise<TicketTrendData[]> {
  const tickets = await getTickets();
  const trends: Record<string, { created: number; resolved: number }> = {};

  // Initialize last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    trends[dateStr] = { created: 0, resolved: 0 };
  }

  // Count tickets created/resolved by date
  tickets.forEach((ticket) => {
    const createdDate = new Date(ticket.createdAt).toISOString().split("T")[0];
    if (trends[createdDate]) trends[createdDate].created++;

    if (ticket.status === "resolved" || ticket.status === "closed") {
      const updatedDate = new Date(ticket.updatedAt)
        .toISOString()
        .split("T")[0];
      if (trends[updatedDate]) trends[updatedDate].resolved++;
    }
  });

  // Convert to array and sort by date
  return Object.entries(trends)
    .map(([date, data]) => ({
      date,
      created: data.created,
      resolved: data.resolved,
      total: tickets.filter(
        (t) => new Date(t.createdAt).toISOString().split("T")[0] <= date,
      ).length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Get agent performance metrics
export async function getAgentPerformance(): Promise<AgentPerformance[]> {
  const tickets = await getTickets();
  const agentMap: Record<
    string,
    { name: string; assigned: Ticket[]; resolved: Ticket[] }
  > = {};

  // Group tickets by agent
  tickets.forEach((ticket) => {
    if (ticket.assignedTo) {
      if (!agentMap[ticket.assignedTo]) {
        agentMap[ticket.assignedTo] = {
          name: ticket.assignedName || "Unknown Agent",
          assigned: [],
          resolved: [],
        };
      }
      agentMap[ticket.assignedTo].assigned.push(ticket);

      if (ticket.status === "resolved" || ticket.status === "closed") {
        agentMap[ticket.assignedTo].resolved.push(ticket);
      }
    }
  });

  // Calculate performance metrics per agent
  return Object.entries(agentMap)
    .map(([agentId, data]) => {
      const avgResTime =
        data.resolved.length > 0
          ? data.resolved.reduce(
              (sum, t) => sum + getResolutionTimeHours(t),
              0,
            ) / data.resolved.length
          : 0;

      const responseRate =
        data.assigned.length > 0
          ? (data.assigned.filter((t) => t.messages.length > 0).length /
              data.assigned.length) *
            100
          : 0;

      return {
        agentId,
        agentName: data.name,
        assignedTickets: data.assigned.length,
        resolvedTickets: data.resolved.length,
        avgResolutionTimeHours: Math.round(avgResTime * 10) / 10,
        responseRatePercent: Math.round(responseRate),
      };
    })
    .sort((a, b) => b.resolvedTickets - a.resolvedTickets);
}

// Get category breakdown
export async function getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  const tickets = await getTickets();
  const categories: Record<string, Ticket[]> = {
    hardware: [],
    software: [],
    network: [],
    access: [],
    other: [],
  };

  tickets.forEach((ticket) => {
    categories[ticket.category].push(ticket);
  });

  const total = tickets.length;

  return Object.entries(categories).map(([category, catTickets]) => {
    const resolvedTickets = catTickets.filter(
      (t) => t.status === "resolved" || t.status === "closed",
    );
    const avgResTime =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce(
            (sum, t) => sum + getResolutionTimeHours(t),
            0,
          ) / resolvedTickets.length
        : 0;

    return {
      category: category as any,
      count: catTickets.length,
      percentage: total > 0 ? Math.round((catTickets.length / total) * 100) : 0,
      avgResolutionTimeHours: Math.round(avgResTime * 10) / 10,
    };
  });
}

// Get priority breakdown
export async function getPriorityBreakdown(): Promise<PriorityBreakdown[]> {
  const tickets = await getTickets();
  const priorities: Record<string, Ticket[]> = {
    low: [],
    medium: [],
    high: [],
    urgent: [],
  };

  tickets.forEach((ticket) => {
    priorities[ticket.priority].push(ticket);
  });

  const total = tickets.length;

  return Object.entries(priorities).map(([priority, priTickets]) => ({
    priority: priority as any,
    count: priTickets.length,
    percentage: total > 0 ? Math.round((priTickets.length / total) * 100) : 0,
  }));
}

// Get complete dashboard data
export async function getDashboardData(): Promise<DashboardData> {
  return {
    metrics: await getTicketMetrics(),
    trends: await getTicketTrends(),
    agentPerformance: await getAgentPerformance(),
    categoryBreakdown: await getCategoryBreakdown(),
    priorityBreakdown: await getPriorityBreakdown(),
    generatedAt: new Date().toISOString(),
  };
}

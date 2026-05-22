import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import {
  initializeDatabase,
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addTicketMessage,
  addNotification,
  getNotifications,
  isPostgresConnected,
  getDashboardData,
} from "./src/dataStore";
import {
  Ticket,
  TicketMessage,
  NotificationLog,
  TicketStatus,
  TicketPriority,
} from "./src/types";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Track websocket clients
  const wsClients = new Set<WebSocket>();

  // Parse JSON payloads with generous limit for attachments
  app.use(express.json({ limit: "10mb" }));

  // Helper to generate IDs
  function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    // Check if path is for WS
    const pathname = new URL(
      request.url || "",
      `http://${request.headers.host}`,
    ).pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // Allow Vite HMR ws upgrades to bypass
      if (process.env.NODE_ENV !== "production") {
        // Let Vite's server handle HMR upgrades if needed, or discard
      } else {
        socket.destroy();
      }
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    wsClients.add(ws);

    // Send immediate connection greeting
    ws.send(
      JSON.stringify({
        type: "system",
        message: "Connected to real-time support status gateway.",
        postgresActive: isPostgresConnected(),
      }),
    );

    ws.on("close", () => {
      wsClients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
      wsClients.delete(ws);
    });
  });

  // Helper to broadcast WS socket events to all clients
  function broadcast(payload: any) {
    const data = JSON.stringify(payload);
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          console.error("Failed to send WS broadcast:", err);
        }
      }
    }
  }

  // Trigger simulated emailing & record transaction
  async function triggerNotification(
    ticketId: string,
    recipientEmail: string,
    recipientName: string,
    subject: string,
    body: string,
  ): Promise<NotificationLog> {
    const log: NotificationLog = {
      id: generateId("notif"),
      ticketId,
      recipientEmail,
      recipientName,
      subject,
      body,
      sentAt: new Date().toISOString(),
      status: "simulated",
    };

    await addNotification(log);

    // Broadcast notification activity log
    broadcast({ type: "notification_logged", log });

    return log;
  }

  // Express API Routes

  // 1. Health & DB Status Info
  app.get("/api/status", async (req, res) => {
    const tickets = await getTickets();
    res.json({
      status: "healthy",
      database: isPostgresConnected() ? "postgresql" : "local-json-memory",
      connectedClients: wsClients.size,
      totalTicketsCount: tickets.length,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Fetch all tickets
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await getTickets();
      res.json(tickets);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to retrieve tickets.", details: err.message });
    }
  });

  // 3. Fetch ticket by ID
  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await getTicketById(req.params.id);
      if (!ticket) {
        return res
          .status(404)
          .json({ error: `Ticket ${req.params.id} not found.` });
      }
      res.json(ticket);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to retrieve ticket info.",
          details: err.message,
        });
    }
  });

  // 4. Create new ticket
  app.post("/api/tickets", async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        priority,
        clientName,
        clientEmail,
        clientId,
        attachments,
        location,
      } = req.body;

      if (
        !title ||
        !description ||
        !category ||
        !priority ||
        !clientName ||
        !clientEmail ||
        !clientId
      ) {
        return res
          .status(400)
          .json({
            error: "Missing mandatory fields required to file a ticket.",
          });
      }

      const ticketId = generateId("tk");
      const timeNow = new Date().toISOString();

      const newTicket: Ticket = {
        id: ticketId,
        title,
        description,
        category,
        priority,
        status: "open",
        clientId,
        clientName,
        clientEmail,
        createdAt: timeNow,
        updatedAt: timeNow,
        attachments: attachments || [],
        messages: [],
        location: location || undefined,
      };

      const savedTicket = await createTicket(newTicket);

      // Log notification
      await triggerNotification(
        ticketId,
        clientEmail,
        clientName,
        `Ticket Created: ${title} [${ticketId}]`,
        `Hi ${clientName},\n\nYour IT Support ticket has been successfully registered under ticket ID: ${ticketId}.\nIT engineers will review and respond shortly.\n\nDescription: ${description}`,
      );

      // Broadcast ticket created
      broadcast({ type: "ticket_created", ticket: savedTicket });

      res.status(201).json(savedTicket);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Ticket registration failed.", details: err.message });
    }
  });

  // 5. Update ticket (status, priority, assignment)
  app.patch("/api/tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const original = await getTicketById(id);
      if (!original) {
        return res.status(404).json({ error: "Ticket not found to update." });
      }

      const {
        status,
        priority,
        assignedTo,
        assignedName,
        currentUserRole,
        currentUserId,
      } = req.body;

      // RBAC: only agents and admins may modify tickets
      if (
        !currentUserRole ||
        (currentUserRole !== "agent" && currentUserRole !== "admin")
      ) {
        return res
          .status(403)
          .json({
            error: "Forbidden: only agents and admins can update tickets.",
          });
      }

      // Agents may only assign tickets to themselves
      if (
        currentUserRole === "agent" &&
        assignedTo !== undefined &&
        assignedTo !== currentUserId
      ) {
        return res
          .status(403)
          .json({
            error: "Forbidden: agents can only assign tickets to themselves.",
          });
      }

      const updates: Partial<Ticket> = {};

      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;
      if (assignedName !== undefined) updates.assignedName = assignedName;

      const updated = await updateTicket(id, updates);
      if (!updated) {
        return res.status(500).json({ error: "Failed to write updates." });
      }

      // Check differences for specialized notification templates
      if (status && status !== original.status) {
        await triggerNotification(
          id,
          original.clientEmail,
          original.clientName,
          `IT Support Ticket Updated: ${id} is now ${status.replace("_", " ").toUpperCase()}`,
          `Hi ${original.clientName},\n\nThe status of your IT Ticket [${id}] "${original.title}" has been updated.\n\nPrevious status: ${original.status.toUpperCase()}\nNew status: ${status.toUpperCase()}\n\nYou can track ongoing diagnostics feed inside the real-time panel.`,
        );
      } else if (assignedTo && assignedTo !== original.assignedTo) {
        await triggerNotification(
          id,
          original.clientEmail,
          original.clientName,
          `IT Support Ticket Assigned: ${id}`,
          `Hi ${original.clientName},\n\nYour IT Ticket [${id}] "${original.title}" has been placed in the queue of Support Engineer: ${assignedName}.`,
        );
      }

      // Broadcast to WebSockets
      broadcast({ type: "ticket_updated", ticket: updated });

      res.json(updated);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Update processing failed.", details: err.message });
    }
  });

  // 6. Post discussion / comment or internal note
  app.post("/api/tickets/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const { senderId, senderName, senderRole, message, isInternal } =
        req.body;

      if (!senderId || !senderName || !senderRole || !message) {
        return res.status(400).json({ error: "Missing chat message details." });
      }

      const ticket = await getTicketById(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found." });
      }

      // RBAC: clients may only message on their own tickets and cannot post internal notes
      if (senderRole === "client") {
        if (ticket.clientId !== senderId) {
          return res
            .status(403)
            .json({
              error:
                "Forbidden: clients can only post messages on their own tickets.",
            });
        }
        if (isInternal) {
          return res
            .status(403)
            .json({ error: "Forbidden: clients cannot post internal notes." });
        }
      }

      const messageObj: TicketMessage = {
        id: generateId("msg"),
        ticketId: id,
        senderId,
        senderName,
        senderRole,
        message,
        createdAt: new Date().toISOString(),
        isInternal: !!isInternal,
      };

      const updatedTicket = await addTicketMessage(id, messageObj);
      if (!updatedTicket) {
        return res.status(500).json({ error: "Failed to append message." });
      }

      // If it is regular message from agent/admin to client, send email update
      if (!isInternal && (senderRole === "agent" || senderRole === "admin")) {
        await triggerNotification(
          id,
          ticket.clientEmail,
          ticket.clientName,
          `New Support Message on Ticket [${id}]`,
          `Hi ${ticket.clientName},\n\nSupport Engineer ${senderName} left a message on your ticket [${id}]:\n\n"${message}"\n\nPlease check the support app to view active tracking.`,
        );
      }

      // Broadcast changes
      broadcast({ type: "ticket_updated", ticket: updatedTicket });

      res.status(201).json(messageObj);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Message post failed.", details: err.message });
    }
  });

  // 7. Retrieve overall logs of notifications sent
  app.get("/api/notifications", async (req, res) => {
    try {
      const logs = await getNotifications();
      res.json(logs);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to access audit notification logs.",
          details: err.message,
        });
    }
  });

  // 8. Analytics & Reporting Dashboard
  app.get("/api/dashboard", async (req, res) => {
    try {
      const dashboardData = await getDashboardData();
      res.json(dashboardData);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to generate dashboard data.",
          details: err.message,
        });
    }
  });

  // Initialize DB before starting Web server
  await initializeDatabase();

  // Mount Vite development server middleware if not running in production
  if (process.env.NODE_ENV !== "production") {
    console.log("Mounting Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static client files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`===============================================`);
    console.log(`IT SUPPORT TICKET SYSTEM BOOTED ON PORT ${PORT}`);
    console.log(`Server Address: http://0.0.0.0:${PORT}`);
    console.log(`WebSocket Service: ws://0.0.0.0:${PORT}/ws`);
    console.log(`===============================================`);
  });
}

startServer().catch((err) => {
  console.error("Server startup crashed:", err);
});

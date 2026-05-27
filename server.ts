import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import {
  initializeDatabase,
  addNotification,
  isPostgresConnected,
} from "./src/dataStore";
import { NotificationLog } from "./src/types";
import { createTicketRoutes } from "./src/server/routes/tickets";
import { createNotificationRoutes } from "./src/server/routes/notifications";
import { createStatusRoutes } from "./src/server/routes/status";
import { createDashboardRoutes } from "./src/server/routes/dashboard";
import { apiLimiter } from "./src/server/middleware/rateLimiter";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Track websocket clients
  const wsClients = new Set<WebSocket>();

  // Parse JSON payloads with generous limit for attachments
  app.use(express.json({ limit: "10mb" }));

  // Apply global rate limiting
  app.use("/api", apiLimiter);

  // Helper to generate IDs
  function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
      request.url || "",
      `http://${request.headers.host}`,
    ).pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      if (process.env.NODE_ENV !== "production") {
        // Let Vite's server handle HMR upgrades
      } else {
        socket.destroy();
      }
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    wsClients.add(ws);

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

  // Broadcast to all connected WS clients
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

  // Simulated email notification trigger
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
    broadcast({ type: "notification_logged", log });
    return log;
  }

  // Mount modular routes
  app.use("/api/tickets", createTicketRoutes(broadcast, generateId, triggerNotification));
  app.use("/api/notifications", createNotificationRoutes());
  app.use("/api/status", createStatusRoutes(() => wsClients.size));
  app.use("/api/dashboard", createDashboardRoutes());

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

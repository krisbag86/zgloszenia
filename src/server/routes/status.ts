import { Router, Request, Response } from "express";
import { WebSocket } from "ws";
import { getTickets, isPostgresConnected } from "../../dataStore";

export function createStatusRoutes(getClientsCount: () => number) {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    const tickets = await getTickets();
    res.json({
      status: "healthy",
      database: isPostgresConnected() ? "postgresql" : "local-json-memory",
      connectedClients: getClientsCount(),
      totalTicketsCount: tickets.length,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

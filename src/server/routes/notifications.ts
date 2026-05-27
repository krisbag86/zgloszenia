import { Router, Request, Response } from "express";
import { getNotifications } from "../../dataStore";

export function createNotificationRoutes() {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const logs = await getNotifications();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({
        error: "Failed to access audit notification logs.",
        details: err.message,
      });
    }
  });

  return router;
}

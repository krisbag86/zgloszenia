import { Router, Request, Response } from "express";
import { getDashboardData } from "../../dataStore";

export function createDashboardRoutes() {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const dashboardData = await getDashboardData();
      res.json(dashboardData);
    } catch (err: any) {
      res.status(500).json({
        error: "Failed to generate dashboard data.",
        details: err.message,
      });
    }
  });

  return router;
}

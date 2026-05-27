import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      res.status(400).json({
        error: "Validation failed",
        details: messages,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      res.status(400).json({
        error: "Invalid query parameters",
        details: messages,
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}

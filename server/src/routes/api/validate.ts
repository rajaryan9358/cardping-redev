import { Request, Response } from "express";
import { z } from "zod";

/** Parses req.body against `schema`; on failure, writes a 400 response
 * itself and returns null so the caller can just `if (!body) return;`. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, req: Request, res: Response): z.infer<T> | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "invalid_request",
      issues: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
    return null;
  }
  return result.data;
}

import cookieParser from "cookie-parser";
import express, { Express } from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { healthRouter } from "./routes/health.route";
import { whatsappWebhookRouter } from "./routes/whatsappWebhook.route";
import { telegramWebhookRouter } from "./routes/telegramWebhook.route";
import { cashfreeWebhookRouter } from "./routes/cashfreeWebhook.route";
import { apiRouter } from "./routes/api";

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cookieParser());

  // Captures the exact request bytes onto req.rawBody before parsing, so
  // webhook signature checks (WhatsApp, Cashfree) verify against what the
  // sender actually hashed rather than a re-serialised copy.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        // body-parser types this callback's req as the bare Node
        // IncomingMessage, not Express's augmented Request — the cast is
        // needed here even though rawBody is now properly typed on
        // Request for every route that reads it back.
        (req as any).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.use(healthRouter);
  app.use(whatsappWebhookRouter);
  app.use(telegramWebhookRouter);
  app.use(cashfreeWebhookRouter);
  app.use("/api", apiRouter);

  return app;
}

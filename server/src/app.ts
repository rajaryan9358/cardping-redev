import express, { Express } from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { healthRouter } from "./routes/health.route";
import { whatsappWebhookRouter } from "./routes/whatsappWebhook.route";
import { telegramWebhookRouter } from "./routes/telegramWebhook.route";
import { googleOAuthRouter } from "./routes/googleOAuth.route";
import { cashfreeWebhookRouter } from "./routes/cashfreeWebhook.route";

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));

  // Captures the exact request bytes onto req.rawBody before parsing, so
  // webhook signature checks (WhatsApp, Cashfree) verify against what the
  // sender actually hashed rather than a re-serialised copy.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.use(healthRouter);
  app.use(whatsappWebhookRouter);
  app.use(telegramWebhookRouter);
  app.use(googleOAuthRouter);
  app.use(cashfreeWebhookRouter);

  return app;
}

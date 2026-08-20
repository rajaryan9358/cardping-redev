import { Router } from "express";
import { env } from "../config/env";
import { whatsappClient } from "../integrations/whatsapp/client";
import { routeWhatsAppWebhook } from "../bots/whatsapp/router";
import { childLogger } from "../lib/logger";
import { watchBackgroundTask } from "../lib/watchBackgroundTask";

export const whatsappWebhookRouter = Router();
const log = childLogger("wa-webhook-route");

// Meta calls this once, when you save the webhook URL in the App Dashboard,
// to prove you control the endpoint.
whatsappWebhookRouter.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

whatsappWebhookRouter.post("/webhooks/whatsapp", (req, res) => {
  const signature = req.header("x-hub-signature-256");
  if (!whatsappClient.verifySignature(req.rawBody ?? Buffer.from(""), signature)) {
    log.warn("rejected WhatsApp webhook with invalid signature");
    res.sendStatus(401);
    return;
  }

  // Meta expects a fast 200 and retries aggressively on timeout/5xx — ack
  // immediately, then process the message without blocking the response.
  res.sendStatus(200);

  watchBackgroundTask("wa-webhook", "WhatsApp webhook processing", routeWhatsAppWebhook(req.body));
});

import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`CardPing server listening on port ${env.PORT}`);
  logger.info(`WhatsApp webhook: ${env.PUBLIC_BASE_URL}/webhooks/whatsapp`);
  logger.info(`Telegram webhook: ${env.PUBLIC_BASE_URL}/webhooks/telegram`);
  logger.info(`Google OAuth callback: ${env.GOOGLE_OAUTH_REDIRECT_URI}`);
});

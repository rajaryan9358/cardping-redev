/**
 * Registers this server's /webhooks/telegram endpoint with Telegram, or
 * removes it (`--delete`, useful when developing with long-polling instead).
 *
 * Usage:
 *   npm run register:telegram-webhook
 *   npm run unregister:telegram-webhook
 */
import "dotenv/config";
import { env } from "../src/config/env";
import { telegramClient } from "../src/integrations/telegram/client";

async function main() {
  if (process.argv.includes("--delete")) {
    await telegramClient.deleteWebhook();
    console.log("Telegram webhook removed.");
    return;
  }

  const url = `${env.PUBLIC_BASE_URL}/webhooks/telegram`;
  await telegramClient.setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
  console.log(`Telegram webhook set to ${url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { Router } from "express";
import { exchangeCodeForTokens, getGmailAddress } from "../integrations/gmail/oauth";
import { gmailTokensRepo } from "../db/repositories/gmailTokens.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { whatsappClient } from "../integrations/whatsapp/client";
import { telegramClient } from "../integrations/telegram/client";
import { env } from "../config/env";
import { childLogger } from "../lib/logger";

export const googleOAuthRouter = Router();
const log = childLogger("google-oauth-route");

const SUCCESS_HTML = `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">
<h1>Gmail connected ✅</h1><p>You can close this tab and go back to WhatsApp or Telegram.</p></body></html>`;

const ERROR_HTML = (message: string) =>
  `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">
<h1>Something went wrong</h1><p>${message}</p></body></html>`;

// `state` carries the internal user id — set when we build the auth URL in
// buildGoogleAuthUrl() (see integrations/gmail/oauth.ts).
googleOAuthRouter.get("/oauth/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const userId = req.query.state as string | undefined;

  if (!code || !userId) {
    res.status(400).send(ERROR_HTML("Missing code or state parameter."));
    return;
  }

  try {
    const { refreshToken, accessToken } = await exchangeCodeForTokens(code);
    const emailAddress = await getGmailAddress(accessToken);
    await gmailTokensRepo.upsert(userId, refreshToken, emailAddress);
    await usersRepo.setWriteEmail(userId, true);

    res.send(SUCCESS_HTML);

    const user = await usersRepo.findById(userId);
    if (user?.wa_id) {
      await whatsappClient.sendText(env.WHATSAPP_PHONE_NUMBER_ID, user.wa_id, "Gmail connected! You can now save AI-drafted follow-up emails as drafts.");
    }
    if (user?.telegram_chat_id) {
      await telegramClient.sendMessage(user.telegram_chat_id, "Gmail connected! You can now save AI-drafted follow-up emails as drafts.");
    }
  } catch (err) {
    log.error({ err, userId }, "Google OAuth callback failed");
    res.status(500).send(ERROR_HTML("We couldn't finish connecting your Gmail account. Please try again."));
  }
});

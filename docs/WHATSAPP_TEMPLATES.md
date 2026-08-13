# WhatsApp Cloud API setup

## Why this bot doesn't use Message Templates

WhatsApp requires a pre-approved **Message Template** only for *business-initiated* messages —
i.e. messages sent to a user who hasn't messaged you in the last 24 hours. The original n8n bot
referenced three templates by name (`welcome_visiting_card`, `event_visiting_card`,
`connect_gmail_visiting_card`), but their actual approved content isn't in the exported workflow
JSON — templates are configured in Meta Business Manager, not in the workflow that uses them.

This bot is purely reactive: every message it sends is a reply to something the user just sent,
which always happens inside that 24-hour window. So it never needs a template — every menu,
confirmation, and prompt is a freeform interactive message (buttons or a list) built directly in
`server/src/integrations/whatsapp/client.ts` and worded in `server/src/bots/whatsapp/messages.ts`.
Change the wording by editing that file; no Meta approval process involved.

**If you later add a proactive feature** (e.g. "your event starts in 1 hour" reminders, sent
without the user messaging first), that message *would* need an approved template. At that point:
create the template in Meta Business Manager → WhatsApp Manager → Message Templates, and send it
with `whatsappClient.sendTemplate(phoneNumberId, to, templateName, languageCode, components)`,
already implemented and ready to use.

## Meta App Dashboard setup

1. Create a Meta App (type **Business**) at [developers.facebook.com](https://developers.facebook.com/apps).
2. Add the **WhatsApp** product. This gives you a test phone number id and a temporary access
   token — fine for the first test message, but generate a permanent one before deploying (next
   section).
3. **Business Settings → Users → System Users** → create a System User → **Add Assets** → grant
   it your WhatsApp Business Account → **Generate New Token**, with the `whatsapp_business_messaging`
   and `whatsapp_business_management` permissions. This is the token that goes in
   `WHATSAPP_ACCESS_TOKEN` — it doesn't expire like the dashboard's quick-start token does.
4. **WhatsApp → Configuration → Webhook**:
   - Callback URL: `${PUBLIC_BASE_URL}/webhooks/whatsapp`
   - Verify token: whatever you set `WHATSAPP_VERIFY_TOKEN` to
   - Subscribe to the `messages` webhook field (that's the only one this bot needs)
5. Note the **Phone number ID** shown on the WhatsApp → API Setup page — that's
   `WHATSAPP_PHONE_NUMBER_ID`.
6. **App Settings → Basic** → copy the **App Secret** into `WHATSAPP_APP_SECRET`, so inbound
   webhook signatures can be verified.
7. To send messages to real numbers (not just the test numbers Meta pre-approves), submit the app
   for App Review with the `whatsapp_business_messaging` permission, and complete Business
   Verification.

## Webhook configuration

The verify-token handshake happens automatically when you click "Verify and Save" on the webhook
form in step 4 above — Meta sends a `GET` request with `hub.mode=subscribe`, which
`routes/whatsappWebhook.route.ts` answers by echoing back `hub.challenge` if `hub.verify_token`
matches `WHATSAPP_VERIFY_TOKEN`.

Every subsequent inbound message arrives as a `POST` to the same URL, and its
`X-Hub-Signature-256` header is checked against `WHATSAPP_APP_SECRET` before anything else
happens (`integrations/whatsapp/client.ts#verifySignature`).

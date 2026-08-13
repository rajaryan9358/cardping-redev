import { env } from "../../config/env";
import { openai, parseJsonResponse } from "./client";

export interface DraftEmailInput {
  senderName: string;
  recipientName: string;
  recipientCompany: string;
  recipientTitle: string;
  eventName: string | null;
  /** Optional voice-note transcript the user recorded about this contact
   * right after scanning their card — folded into the email if present,
   * same as the original Telegram bot's "summary of our conversation". */
  conversationSummary: string | null;
}

export interface DraftEmail {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You write short, friendly follow-up emails on behalf of the user, to
someone they just met at an in-person event and collected a business card from. The goal is
to keep the connection warm and suggest staying in touch — this is not a sales email.
Keep the subject line personalised and click-worthy, and the body under 100 words.`;

const INSTRUCTIONS = `Write a conversational, informal follow-up email to schedule time with a
prospect met at an event.
Requirements:
1. Output must be JSON only: {"subject": "...", "body": "..."}. No markdown fences.
2. Do not leave placeholders — use the realistic details given to you.
3. If a conversation summary is given, tailor the email to it; otherwise keep it general.
4. Use natural short forms of company names (e.g. "Acme" not "ACME PRIVATE LIMITED").
5. Sign off with the sender's name.`;

export async function draftFollowUpEmail(input: DraftEmailInput): Promise<DraftEmail> {
  const userContent = [
    `Sender name: ${input.senderName}`,
    `Recipient name: ${input.recipientName}`,
    `Recipient title: ${input.recipientTitle}`,
    `Recipient company: ${input.recipientCompany}`,
    `Event: ${input.eventName ?? "(not specified)"}`,
    `Conversation summary: ${input.conversationSummary ?? "(none)"}`,
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: env.OPENAI_EMAIL_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${INSTRUCTIONS}\n\n${userContent}` },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseJsonResponse<DraftEmail>(raw);
}

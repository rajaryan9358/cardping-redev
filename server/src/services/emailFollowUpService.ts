import { gmailTokensRepo } from "../db/repositories/gmailTokens.repo";
import { tempEmailsRepo } from "../db/repositories/tempEmails.repo";
import { draftFollowUpEmail } from "../integrations/openai/emailWriter";
import { createGmailDraft } from "../integrations/gmail/drafts";
import { getGmailAddress, refreshAccessToken } from "../integrations/gmail/oauth";
import { ExtractedCard, TempEmail, VisitingCard } from "../types/domain";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function pickRecipientEmail(card: VisitingCard): string | null {
  if (card.business_email && EMAIL_REGEX.test(card.business_email)) return card.business_email;
  if (card.personal_email && EMAIL_REGEX.test(card.personal_email)) return card.personal_email;
  return null;
}

/** Writes a follow-up email draft with GPT and stores it in `temp_emails`
 * for the user to review before it's actually created in Gmail. Returns
 * null when the card has no usable email address (mirrors the original
 * flow's "validate email exist" gate). */
export async function prepareFollowUpDraft(
  sender: { fullName: string | null; email: string | null },
  card: VisitingCard,
  extracted: Pick<ExtractedCard, "company_name" | "job_title">,
  eventName: string | null,
  conversationSummary: string | null,
): Promise<TempEmail | null> {
  const recipientEmail = pickRecipientEmail(card);
  if (!recipientEmail) return null;

  const draft = await draftFollowUpEmail({
    senderName: sender.fullName || "A CardPing user",
    recipientName: card.full_name || "there",
    recipientCompany: extracted.company_name || card.company_name || "",
    recipientTitle: extracted.job_title || card.position || "",
    eventName,
    conversationSummary,
  });

  return tempEmailsRepo.create({
    to: recipientEmail,
    from: sender.email,
    subject: draft.subject,
    body: draft.body,
    visitingCardId: card.id,
  });
}

export class GmailNotConnectedError extends Error {
  constructor() {
    super("User has not connected a Gmail account yet");
    this.name = "GmailNotConnectedError";
  }
}

/** Turns the most recently drafted follow-up email for a card into a real
 * Gmail draft in the user's mailbox, once they've approved it. */
export async function sendApprovedDraft(userId: string, cardId: string): Promise<void> {
  const [tokens, draft] = await Promise.all([
    gmailTokensRepo.findByUserId(userId),
    tempEmailsRepo.findLatestByVisitingCardId(cardId),
  ]);

  if (!tokens) throw new GmailNotConnectedError();
  if (!draft) throw new Error(`No drafted follow-up email found for card ${cardId}`);

  const accessToken = await refreshAccessToken(tokens.refresh_token);
  const fromAddress = tokens.email_address || (await getGmailAddress(accessToken));

  await createGmailDraft(accessToken, {
    from: fromAddress,
    to: draft.to,
    subject: draft.subject ?? "",
    body: draft.body ?? "",
  });
}

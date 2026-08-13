export type NormalizedMessageType =
  | "text"
  | "image"
  | "audio"
  | "button"
  | "list"
  | "interactive"
  | "status"
  | "unknown";

/** A message payload reduced to the handful of fields every handler
 * actually needs, regardless of which raw WhatsApp message shape it came
 * from (plain text, button reply, or the newer interactive reply). */
export interface NormalizedWhatsAppMessage {
  type: NormalizedMessageType;
  from: string;
  phoneNumberId: string;
  waMessageId: string;
  text: string | null;
  buttonText: string | null;
  buttonId: string | null;
  mediaId: string | null;
  /** message.context.id — set when this message is a reply to another
   * message. Used to match voice-note replies back to the card they
   * belong to. */
  contextMessageId: string | null;
  contactName: string | null;
}

export interface InteractiveButton {
  id: string;
  title: string;
}

// Not imported from server/'s domain types — admin/ never imports from
// server/, see adminHealth.repo.ts's isolation note (a compromised
// internet-facing server/ shouldn't be able to reach into admin/'s process
// either way, and keeping the two apps' dependency graphs disjoint is what
// guarantees that).
//
// `users` has no `channel` column — which channel a row came from is
// inferred from which id column is non-null. Shared by adminHealth.repo.ts
// and adminUsers.repo.ts's bot-contact listing so this mapping can't drift
// between the two.
export const CHANNELS = ["whatsapp", "telegram"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_ID_COLUMN: Record<Channel, "wa_id" | "telegram_id"> = {
  whatsapp: "wa_id",
  telegram: "telegram_id",
};

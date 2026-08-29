// Not "server-only" — imported by both the (server-only) broadcasts repo
// and the (client) BroadcastComposer, so this type/constant has to live
// somewhere without that restriction.
export type AudienceFilter = "all" | "subscribed" | "low_balance" | "trial" | "contacted_never_signed_up";

export const AUDIENCE_FILTER_LABELS: Record<AudienceFilter, string> = {
  all: "All opted-in",
  subscribed: "Subscribed",
  low_balance: "Low balance",
  trial: "Trial (no plan)",
  // Deliberately reads oddly lowercased into "N contacted, never signed up
  // whatsapp users" (see broadcasts/actions.ts's audienceDescription) —
  // that's fine, it's the one filter that bypasses the opt-in floor, so a
  // slightly unusual label is an acceptable tradeoff for staying distinct.
  contacted_never_signed_up: "Contacted, never signed up",
};

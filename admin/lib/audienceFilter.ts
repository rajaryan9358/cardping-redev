// Not "server-only" — imported by both the (server-only) broadcasts repo
// and the (client) BroadcastComposer, so this type/constant has to live
// somewhere without that restriction.
export type AudienceFilter = "all" | "subscribed" | "low_balance" | "trial";

export const AUDIENCE_FILTER_LABELS: Record<AudienceFilter, string> = {
  all: "All opted-in",
  subscribed: "Subscribed",
  low_balance: "Low balance",
  trial: "Trial (no plan)",
};

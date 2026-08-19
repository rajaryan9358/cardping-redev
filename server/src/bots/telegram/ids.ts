// Inline-keyboard callback_data values. Mirrors src/bots/whatsapp/ids.ts so
// both bots share the same mental model even though the transport differs.
export const Ids = {
  menuScan: "menu_scan",
  menuSetEvent: "menu_set_event",
  menuBuyCredits: "menu_buy_credits",
  menuAccount: "menu_account",

  eventChangeYes: "event_change_yes",
  eventChangeNo: "event_change_no",
  // Dynamic per-event rows use the prefix "event_pick:<eventId>" (see the
  // event picker in handlers/callback.ts) rather than a fixed Ids entry.
  eventPickerNew: "event_pick_new",
  eventPickPrefix: "event_pick:",

  accountSubscription: "account_subscription",
  accountScanBothSides: "account_scan_both_sides",
  accountEventLifetime: "account_event_lifetime",

  eventLifetime1h: "event_lifetime_1",
  eventLifetime6h: "event_lifetime_6",
  eventLifetime12h: "event_lifetime_12",
  eventLifetime24h: "event_lifetime_24",
  eventLifetime48h: "event_lifetime_48",
  eventLifetimeAlways: "event_lifetime_always",
} as const;

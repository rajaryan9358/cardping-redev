// Inline-keyboard callback_data values. Mirrors src/bots/whatsapp/ids.ts so
// both bots share the same mental model even though the transport differs.
export const Ids = {
  menuScan: "menu_scan",
  menuSetEvent: "menu_set_event",
  menuBuyCredits: "menu_buy_credits",
  menuAccount: "menu_account",

  eventChangeYes: "event_change_yes",
  eventChangeNo: "event_change_no",

  accountConnectGmail: "account_connect_gmail",
  accountCheckCredit: "account_check_credit",

  emailReviewApprove: "email_review_approve",
  emailReviewChange: "email_review_change",
} as const;

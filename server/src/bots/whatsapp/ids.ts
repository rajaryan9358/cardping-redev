// Interactive button/list-row ids. These are our own values (not tied to
// any Meta-approved Message Template) — see docs/WHATSAPP_TEMPLATES.md for
// why the rebuild avoids depending on pre-approved templates entirely.
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

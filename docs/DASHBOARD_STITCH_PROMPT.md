# Google Stitch prompt — CardPing Dashboard screens

Use this with [Stitch](https://stitch.withgoogle.com) to design the dashboard's screens *before*
any implementation starts, per [DASHBOARD_PLAN.md](./DASHBOARD_PLAN.md). Paste the **Product
brief** once at the start of a Stitch project so every screen shares one visual language, then
paste each numbered **screen prompt** one at a time (Stitch designs best one screen per
generation). Screens are ordered to match the user's actual first-run flow.

---

## Product brief (paste first, keep pinned/referenced for every screen)

CardPing is a desktop web dashboard for salespeople and founders who collect business cards at
conferences and events. They scan a card on WhatsApp or Telegram, our AI extracts the contact
details, and this dashboard is where they log in afterward to actually manage those leads: search
them, tag them, organize them by event, and follow up. It's a paid product — coins meter card
scans, and users are on a subscription plan or a coin balance they top up.

Design for **desktop only** (min-width ~1280px, no mobile/responsive concerns). Audience is
professional, time-pressed, slightly impatient — this is a tool they open between meetings, not a
leisurely browse. It should read as trustworthy and precise (it's handling contacts and payments)
without being cold or corporate-generic.

Visual direction — **plain and restrained, not decorative** (adjust freely, but keep it
consistent across screens):
- A clean, light neutral base (soft off-white, not stark white, not warm cream) with **black as
  the primary color** — used deliberately for primary buttons, active nav states, and links, not
  scattered everywhere. This is an understated, functional system: black does the work of
  hierarchy and emphasis, not decoration.
- Status/semantic color (success green, warning amber, danger red, neutral grey for "pending") is
  muted and strictly functional — plan status, payment status, low-balance warnings — never
  decorative, never competing with black for attention.
- Typography: a clear, quiet sans-serif for UI and data-dense tables, with a modestly heavier
  weight for page titles/section headers — enough to establish hierarchy, not enough to feel
  loud. This should read as considered and precise, not flashy.
- Layout: left sidebar navigation (Home, Directory, Events, Profile, and Admin if the logged-in
  user is an admin) + a top bar (search where relevant, coin balance always visible, avatar/menu).
  Generous whitespace throughout — forms and content breathe, tables stay dense only where the
  data genuinely requires it.
- The product's core object is a **business card** — it's fine to let that inform small details
  (card-shaped thumbnails, a card-catalog feel in the Directory) without becoming a gimmick.
- Use real, specific placeholder content everywhere (real-sounding names, companies, job titles,
  event names like "TechCrunch Disrupt 2026", realistic INR amounts) — never lorem ipsum or
  "Contact 1" / "Event A".

---

## Screens

### 1. Login
A method switcher between three tabs: **Mobile OTP**, **Google**, **Email & password**. Mobile
OTP tab: country-code + phone input, "Send code" button. Google tab: single "Continue with
Google" button. Email tab: email + password fields, "Log in" button, "Forgot password?" link, and
a "Don't have an account? Sign up" link. Centered card on a subtly branded background — this is
the very first thing a prospective paying user sees, so it should feel a notch more polished than
the internal app screens that follow.

### 2. Sign up (email & password)
Same centered-card layout as Login. Fields: full name, email, password, confirm password. A
short line of trust copy near the button (e.g. "50 free scans to start, no card required"). Link
back to Login for existing users.

### 3. Enter OTP code
Shown after requesting a mobile-OTP login (or during WhatsApp channel linking, reused). Shows the
masked phone number it was sent to, a 6-digit code input (individual boxes), a countdown/resend
control, and a "Change number" link. Minimal, focused — this is a brief interstitial, not a full
page of chrome.

### 4. Onboarding — welcome & how it works
First screen a brand-new account lands on, before ever seeing the real dashboard. A short,
confident multi-step walkthrough (progress dots at top, 3 steps): Step 1 explains scanning a card
via WhatsApp/Telegram; Step 2 explains the 50 free trial scans / coin balance and what happens
when it runs low; Step 3 is the call-to-action to link a channel now (button: "Connect
WhatsApp or Telegram") with a secondary "I'll do this later" link. Full-screen takeover, not a
modal — this sets the tone for a first-time paying customer.

### 5. Link a channel
Two tabs: **WhatsApp** and **Telegram**. WhatsApp tab: phone number input → "Send code" → OTP
entry (reuse the 6-digit input pattern from screen 3) → success state ("✓ +91 98765 43210
connected"). Telegram tab: a generated QR code plus a tappable `t.me/...` link, with a "waiting
for you to tap Start in Telegram..." pending state that will resolve to a success state. Also
design the **collision/error state**: a clear warning banner — "This WhatsApp number is already
connected to another CardPing account. Disconnect it there first, then try again." — shown in
place of the OTP step when linking fails for that reason.

### 6. Home
The default landing page after onboarding. Top: coin balance prominently displayed, with a
low-balance warning banner variant (amber, "You have 3 coins left — recharge to keep scanning")
and a plan-expiring banner variant (amber, "Your Pro plan expires in 2 days — renew now") — design
both banner states even though only one shows at a time. Below: a stat row (total contacts, total
events, this week's scans). Below that: a "Recent scans" list — 5-6 rows, each showing the
contact's name, company, which event, a small channel icon (WhatsApp/Telegram), and how long ago,
each row clickable through to Contact detail.

### 7. Directory
The main working screen. Top bar: a search input, an event filter dropdown, a tag filter, and an
"Archived" toggle. Below: a dense table of scanned cards — columns for a small channel icon
(WhatsApp/Telegram, showing which channel the scan came from), name, company, job title, event
badge, tag chips, scanned date, and a row-hover action menu (view, move event, archive, delete).
Each row has a checkbox; when 1+ rows are selected, the toolbar above the table swaps to a bulk
action bar (Add tag / Move to event / Delete, plus a count "3 selected" and a Clear button). Also
design an empty state (no cards yet, CTA to link a channel and start scanning) and the CSV export
button placement (top-right, near search).

### 8. Contact detail
Opens from a Directory row — design as a right-side slide-over panel (not a full page navigation,
since users will open many of these while working a list). Shows: the card photo thumbnail, full
name/title/company header, every extracted field grouped logically (contact info: phones/emails;
company info: website/address; social: LinkedIn/Twitter/Facebook), a row of action buttons (Call,
WhatsApp, Email — using the actual contact info), an editable tag chip area, an event picker to
move it to a different event, an "Archive" toggle, and — below the fields — a voice-memo player
(waveform or simple play bar) with its transcript shown as text underneath. Small metadata footer
(scanned via WhatsApp, on [date], at [event]).

### 9. Events
A grid of event cards (not a table — events benefit from visual thumbnails), each showing the
event thumbnail image, name, location, date, and a contact count badge ("47 contacts"). A
"Miscellaneous" event card is visually distinct (e.g. a neutral icon instead of a photo) since
it's the auto-created catch-all, not something the user named themselves. A prominent "+ New
event" card/button, top-right.

### 10. Create/edit event (modal)
A modal over the Events screen: name, location, date picker, and a thumbnail image upload
(drag-and-drop area with preview once an image is chosen). Save/Cancel actions.

### 11. Profile — Plan & wallet
One tab within a tabbed Profile screen (tabs: Plan & Wallet / Payment History / Sessions /
Account & Security — design the tab bar once, reuse across 11-14). Shows the current plan name,
price, and renewal/expiry date prominently, plan comparison cards below (2-3 plan tiers as cards,
current plan visually marked, others with an "Upgrade"/"Switch" button), and a separate coin
balance section with a big number and a "Recharge coins" button opening an amount/package
selector.

### 12. Profile — Payment history
A table: date, description ("Pro plan — 30 days" / "50 coins top-up"), amount, and a status chip
(Paid/green, Pending/grey, Failed/red). Each successful row has a "View invoice" / download-icon
action on the right.

### 13. Profile — Sessions
A list of active login sessions, each showing a device/browser label, approximate location if
available, "last active" time, and a "This device" badge on the current one. Each row has a
"Log out" button except the current session; a prominent "Log out of all devices" button sits
above the list, styled with slightly more weight (destructive-adjacent but not alarming — this is
a routine security action, not a dangerous one).

### 14. Profile — Account & security
Linked channels section (WhatsApp/Telegram, each showing connected status and a "Disconnect"
button, plus a "+ Link another channel" action reopening screen 5). Below: account details (name,
email, avatar). Below that: password section that adapts to login method — if the account has a
password, show "Change password" (current/new/confirm fields); if it doesn't (Google or OTP-only
signup), show "Set a password" with an explanation that this lets them also log in with email.

### 15. Admin — Users
(Only reachable by admin accounts — fine to note "Admin" in a sidebar section visually distinct
from the regular nav items.) A searchable table: name, email/phone, plan, coin balance, status
(Active/Blocked chip), joined date. Row actions: Block/Unblock, and "Adjust coins" opening a small
modal (amount +/-, reason text field).

### 16. Admin — Card review
A table filtered to low-confidence extractions: card thumbnail, extracted name/company, a
confidence percentage shown as a small colored indicator (red/amber/green by threshold), scanned
date, and a "Re-run extraction" button per row.

### 17. Admin — Health
A simple operational overview: scan volume over the last 7 days (a small bar or line chart),
counts of recent failed/pending payments, and last-successful-webhook timestamps per integration
(WhatsApp, Telegram, Cashfree) each as a small status card (green "healthy" / red "no recent
activity").

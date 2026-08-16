# Figma AI (First Draft) prompt — CardPing Dashboard screens

Use this with Figma's AI design generation ("First Draft") to design the dashboard's screens
*before* any implementation starts, per [DASHBOARD_PLAN.md](./DASHBOARD_PLAN.md). Unlike Stitch,
Figma AI generates real editable layers — so the first three prompts below build a small design
system (color/text styles, then components) before touching any screen; every screen prompt after
that asks it to build with those same styles/components rather than freelancing new ones each
time. Desktop only — frame width 1440px throughout.

**Figma AI First Draft has a ~2000-character prompt limit.** Every prompt below is already under
that on its own — none need further splitting. The 17 screen prompts are each a single generation.
The design system is the one part that didn't fit in one prompt, so it's broken into three
**phases**, meant to be sent as sequential follow-ups *in the same generation thread* (Figma AI
lets you keep refining a design with follow-up prompts) — send Phase A, let it generate, then send
Phase B as a follow-up in that same thread so it extends rather than replaces Phase A's work, then
Phase C the same way. After Phase C, start each numbered screen as its own new frame, reusing the
styles/components the three phases created.

If you'd rather I generate these directly into a Figma file myself instead of you pasting into
Figma's UI, say so — I have a Figma design-generation tool available and can drive it from these
same prompts.

---

## 0. Foundations — design system (3 phases, run in sequence as follow-ups)

### Phase A — styles

> Design a **maximalist** (not minimal), high-contrast desktop web design system for "CardPing," a
> B2B SaaS dashboard for salespeople who scan business cards at events via WhatsApp/Telegram and
> manage the leads. Bold and graphic, not restrained — trustworthy and precise, not cold or
> corporate-generic. Frame width 1440px.
>
> Create Figma color styles/variables: **black is the primary color**, used boldly across large
> surfaces (solid black sidebar/header blocks, solid black primary buttons, thick black
> borders/rules) — not just a small accent. An off-white ground (not stark white, not warm cream)
> for black to sit on. Semantic status colors, functional not decorative: success green, warning
> amber, danger red, neutral grey for "pending" — bold and saturated rather than muted, so they
> pop against the black/off-white base.
>
> Create Figma text styles: a heavy-weight, oversized display style for page titles and section
> headers — lean into scale contrast, don't be timid — plus body/label/caption styles in a clean,
> legible sans-serif for dense tables.
>
> Lay the color swatches and type scale out on one documentation frame, each swatch and style
> labeled.

### Phase B — chrome components (send as a follow-up in the same thread)

> Continuing the same CardPing design system file, using the color and text styles already
> established, create these reusable components with auto-layout, each added to the documentation
> frame:
>
> Sidebar nav — logo/wordmark at top, nav items with icon + label (Home, Directory, Events,
> Profile), an "Admin" section visually separated at the bottom, active/inactive states.
>
> Top bar — search input, a coin-balance pill (icon + number), avatar/menu.
>
> Button — primary/secondary/destructive variants, each with default/hover/disabled states.
>
> Status chip — Paid/Pending/Failed/Active/Blocked variants using the semantic colors from the
> palette.

### Phase C — content components (send as a follow-up in the same thread)

> Continuing the same CardPing design system file, using the existing styles, add these remaining
> reusable components to the documentation frame, with auto-layout:
>
> Table row — generic data-table row with checkbox, avatar/thumbnail slot, text columns, hover
> state, trailing action-menu icon.
>
> Banner — info/warning/danger variants, icon + message + optional action link, for low-balance
> and plan-expiring alerts.
>
> Tag chip — small removable pill for card tags.
>
> Card thumbnail — the business-card-photo shape used throughout the app (Directory rows, Contact
> detail header, Events grid).
>
> Show all variants of each component side by side, clearly labeled.

---

## Screens (run each as its own frame, reusing the components/styles above)

### 1. Login
> Using the CardPing design system components, design a centered-card login screen on a subtly
> branded 1440px-wide background. A three-tab method switcher: **Mobile OTP** (country-code +
> phone input, primary "Send code" button), **Google** (single "Continue with Google" button with
> the Google logo), **Email & password** (email + password fields, primary "Log in" button,
> "Forgot password?" link). Below the card: "Don't have an account? Sign up" link. This is the
> first thing a prospective paying customer sees — give it a touch more polish than the internal
> screens that follow it.

### 2. Sign up
> Same centered-card layout and background as the Login screen, using the same components. Fields
> for full name, email, password, confirm password, a primary "Create account" button, and a
> short trust line near the button: "50 free scans to start, no card required." Link back to
> Login.

### 3. Enter OTP code
> A minimal, focused interstitial screen (not full app chrome) — shown after requesting a
> mobile-OTP login or during WhatsApp channel linking. Shows the masked phone number the code was
> sent to, a 6-digit code entry made of individual boxes, a countdown timer with a disabled-until-
> countdown-ends "Resend code" link, and a "Change number" link.

### 4. Onboarding — welcome & how it works
> A full-screen takeover (not the app chrome, no sidebar) for a brand-new account's first
> experience. A 3-step walkthrough with progress dots at top: Step 1 explains scanning a card via
> WhatsApp or Telegram (with a small illustrative graphic of the flow); Step 2 explains the 50
> free trial scans and coin balance, and what happens when it runs low; Step 3 is a call to action
> — primary button "Connect WhatsApp or Telegram," secondary "I'll do this later" link.

### 5. Link a channel
> Using the design system, a two-tab screen: **WhatsApp** and **Telegram**. WhatsApp tab: phone
> number input → primary "Send code" button → the same 6-digit OTP entry pattern as screen 3 →
> a success state showing a green checkmark and "✓ +91 98765 43210 connected." Telegram tab: a
> generated QR code, a tappable `t.me/...` link/button beside it, and a pending state with a small
> spinner: "Waiting for you to tap Start in Telegram...". Also design the **collision/error
> state** using the warning Banner component: "This WhatsApp number is already connected to
> another CardPing account. Disconnect it there first, then try again" — shown in place of the
> OTP step.

### 6. Home
> The default app screen after onboarding, using the Sidebar nav + Top bar. Below the top bar: a
> Banner (warning variant) for "You have 3 coins left — recharge to keep scanning" — also design
> the alternate Banner content for a plan expiring in 2 days, so both variants exist even though
> only one shows at a time. Below that: a stat row of three cards (Total contacts, Total events,
> Scans this week) with large tabular numbers. Below that: a "Recent scans" section — a list of
> 5-6 rows using the Table row component, each showing contact name, company, event name, a small
> WhatsApp or Telegram channel icon, and a relative timestamp ("2 hours ago").

### 7. Directory
> Sidebar nav + top bar, then a filter bar: search input, an "Event" dropdown filter, a "Tag"
> dropdown filter, and an "Archived" toggle switch, with a CSV export button (secondary, icon +
> label) at the far right. Below: a data table using the Table row component — columns for a
> channel icon, name, company, job title, an event badge, tag chips, scanned date, and a
> trailing action-menu icon (view / move event / archive / delete) that appears on row hover. Each
> row has a leading checkbox. Design a second state of the same filter bar: when 2+ rows are
> checked, it becomes a bulk-action bar showing "3 selected," and buttons for Add tag / Move to
> event / Delete, plus a "Clear" link. Also design an empty state — no rows, a centered message
> and a primary CTA button to link a channel and start scanning.

### 8. Contact detail
> A right-side slide-over panel (not a full page) over a dimmed Directory background, using the
> Card thumbnail component at top next to the contact's name/title/company as a header. Below:
> grouped fields — Contact (phones, emails), Company (website, address), Social (LinkedIn,
> Twitter, Facebook) — each group with a small section label. A row of three secondary buttons:
> Call, WhatsApp, Email. An editable area of Tag chip components with an "+ Add tag" affordance.
> An event picker (dropdown showing the current event, changeable). An Archive toggle. Near the
> bottom: a voice-memo player (simple play button + a flat waveform bar) with the transcript text
> beneath it. A small caption footer: "Scanned via WhatsApp on Mar 14, 2026 at TechCrunch Disrupt
> 2026."

### 9. Events
> Sidebar nav + top bar, then a grid (3-4 per row) of event cards, each using the Card thumbnail
> component at a larger size as the event's photo, with name, location, date, and a count badge
> ("47 contacts") below. One card — "Miscellaneous" — is visually distinct: a neutral icon in
> place of a photo, since it's system-created, not user-named. A prominent "+ New event" card in
> the same grid, top-left or as the first tile.

### 10. Create/edit event (modal)
> A modal dialog over the Events screen (dimmed backdrop): fields for event name, location, a
> date picker, and a drag-and-drop image upload area for the thumbnail (with a preview once an
> image is set). Primary "Save" and secondary "Cancel" buttons, bottom-right of the modal.

### 11. Profile — Plan & wallet
> Sidebar nav + top bar, then a Profile screen with a horizontal tab bar: Plan & Wallet /
> Payment History / Sessions / Account & Security (design this tab bar once — screens 12-14 reuse
> it with a different tab active). On the Plan & Wallet tab: current plan name, price, and
> renewal date in a prominent header block; below, 2-3 plan-tier cards side by side, the current
> plan visually marked (border/badge), the others with a primary "Switch to this plan" button.
> Separately, a coin-balance section: a large tabular number and a primary "Recharge coins"
> button that would open an amount/package picker.

### 12. Profile — Payment history
> Same Profile tab-bar layout, "Payment History" active. A data table (Table row component):
> date, description ("Pro plan — 30 days" / "50 coins top-up"), amount, and a Status chip
> (Paid/Pending/Failed). Successful rows have a trailing "View invoice" icon-button.

### 13. Profile — Sessions
> Same Profile tab-bar layout, "Sessions" active. A prominent "Log out of all devices" button
> above the list (styled with weight but not alarm-red — a routine action, not a dangerous one).
> Below: a list of session rows, each showing a device/browser label, last-active time, and a
> "This device" badge on the current session; every row except the current one has a "Log out"
> button.

### 14. Profile — Account & security
> Same Profile tab-bar layout, "Account & Security" active. A "Linked channels" section: a row
> per connected channel (WhatsApp/Telegram icon, connected status, "Disconnect" button) plus a
> "+ Link another channel" action. Below: basic account fields (avatar, name, email). Below that,
> two alternate states of a password section — design both: (a) "Change password" with
> current/new/confirm fields, for accounts that already have a password; (b) "Set a password"
> with a short explanatory line ("so you can also log in with email"), for Google/OTP-only
> accounts.

### 15. Admin — Users
> Sidebar nav with the "Admin" section now active/expanded, top bar. A searchable data table:
> name, email/phone, plan, coin balance, a Status chip (Active/Blocked), joined date. Trailing
> row actions: a Block/Unblock button and an "Adjust coins" icon-button. Also design the "Adjust
> coins" modal it opens: an amount field (+/-), a reason text field, Save/Cancel.

### 16. Admin — Card review
> Same admin sidebar state. A data table filtered to low-confidence scans: card thumbnail, name,
> company, a confidence indicator (small colored dot or bar — red/amber/green by threshold) with
> its percentage, scanned date, and a "Re-run extraction" button per row.

### 17. Admin — Health
> Same admin sidebar state. A dashboard of small status cards: a 7-day scan-volume chart (simple
> bar or line), a card for recent failed/pending payments (count + link), and three integration
> status cards — WhatsApp, Telegram, Cashfree — each showing "Healthy" (green) or "No recent
> activity" (red) with a last-seen timestamp.

# SMASH Manager Portal — Operations Research Document

**Purpose:** Source material for the internal operations manual for Krista (office manager, the portal's primary user). This document describes exactly what the system does, what it does automatically, what requires a human, and every rule baked into the code — with file citations for every claim.

**How it was produced:** By reading the entire codebase (client and server) of the `manager-portal` repository. Nothing here was tested against the live system; everything is derived from the code as written. Where the code cannot answer a question, that is flagged in Section 16 ("Gaps & Open Questions") rather than guessed at.

**Big picture:** The portal is a website with a Node.js server (`server/`) and a React frontend (`client/`). Airtable is the single source of truth for all data — the portal reads and writes an Airtable base (base ID `appxDlniu6IPMVIVp`, defined in `server/src/services/airtable.js`). Payments go out through Checkbook.io, email goes out through Krista's Gmail account via the Gmail API, PDFs are generated on the server with `@react-pdf/renderer`, and the "Cash" chatbot and MD-payout-report reader both use Anthropic's Claude API.

---

## 1. Every page and route

The portal has **four pages** plus several modals (pop-up windows) that can open from any page. Routes are defined in `client/src/App.jsx` (the `<Routes>` block, lines 111–118).

All four pages **poll for fresh data every 2 minutes** — that is the default interval in the `usePolling` hook (`client/src/hooks/usePolling.js`, `intervalMs = 2 * 60 * 1000`). Nothing updates in true real time; Krista sees changes made in Airtable within about two minutes, or immediately after she performs an action herself (actions trigger an immediate refresh).

### Login screen

Before anything else, the portal shows a password gate (`client/src/components/AuthGate.jsx`). One shared password (checked against the `PORTAL_PASSWORD` environment variable in `server/src/routes/auth.js`) logs the user in. The session cookie lasts **24 hours** (`maxAge: 24 * 60 * 60 * 1000` in `server/src/index.js`), after which Krista must log in again. If any API call returns "not authenticated," the page automatically reloads back to the login screen (`client/src/api/client.js`, the 401 handler).

### Sidebar (visible on every page)

Defined in `client/src/components/Sidebar.jsx`. Items, top to bottom:

1. **Dashboard** — badge shows the count of Krista's active tasks: tasks whose assignee is "Office Manager" with status "To do" or "Doing" (computed in `client/src/App.jsx`, `activeTasks`). This badge is **orange** (`#ff5000`); all other badges are gray.
2. **Upcoming** — badge shows the count of upcoming fundraisers that "need attention" (at least one failed readiness check — see the Upcoming page below). Count comes from `GET /api/fundraisers/upcoming/count` (`server/src/routes/fundraisers.js`).
3. **Active** — badge shows the **total** count of In Progress fundraisers (`GET /api/fundraisers/active/count`). A small **red dot** appears on this badge if any of today's daily e-check payouts have status "failed" (`showRedDot` in `Sidebar.jsx`; failure count from `GET /api/payouts/today/summary`).
4. **Ended** — badge shows the count of ended fundraisers with at least one open Office Manager task (`needsAction` in `GET /api/fundraisers/ended/count`, `server/src/routes/fundraisers.js`).
5. **Log out** button at the bottom.

If a badge count is zero, the sidebar shows a small "—" dash instead of a number (except Dashboard, which shows nothing at zero).

The **Cash chat bubble** is not in the sidebar — it is a floating round button in the bottom-right corner of every page (`client/src/components/CashChat.jsx`).

On mobile, the sidebar collapses into a hamburger-menu drawer (`client/src/App.jsx`, mobile top bar and drawer).

### Page: Dashboard — route `/`

File: `client/src/pages/Dashboard.jsx`. This is the home page. Contents, top to bottom:

**a) Cash Status Bar** (`client/src/components/CashStatusBar.jsx`) — a one-line blue strip summarizing Cash's automated tasks: "Cash has N task(s) scheduled today." (counts Cash-assigned tasks with status "To do" and a deadline of today) or "Cash has no tasks scheduled today.", plus "Last completed: [task name] for [org] [team] ([date])." if any Cash task is Done. Next to it is the prominent orange **"+ Task"** button.

**b) Kanban board** — three columns: **To Do**, **Doing**, **Done** (`COLUMNS` in `Dashboard.jsx`). Task cards can be **dragged between columns**; dropping a card immediately saves the new status to Airtable (see Section 2). Each column header has a small **+** button that opens the New Task form pre-set to that column's status.

Which tasks appear on the board (`kristaTasks` filter in `Dashboard.jsx`, lines 66–79):
- Assignee must be "Office Manager". Cash's tasks never appear on the board.
- Status "On deck" is always hidden from the board.
- **Done** tasks appear only if completed within the **last 2 days** (`completed_at >= twoDaysAgoStr`); older completed tasks vanish from the board. Note: the Done column's **count badge** shows the total number of Done Office Manager tasks ever (`totalKristaDone`), not just the visible ones.
- Non-done tasks are visible by default; the only thing that hides one is a **show_date in the future** (`if (t.show_date && t.show_date > todayStr) return false`).

Sorting: To Do and Doing columns sort by deadline ascending (soonest first, no-deadline last); the Done column sorts by completion date, newest first (`getKristaColumnTasks`).

**c) Cash's Tasks section** — a flat gray list below the board showing what the automation "teammate" is up to. Filter (`filteredCashTasks` in `Dashboard.jsx`): Cash-assigned tasks that are either (a) "To do" or "On deck" with a deadline between today and 3 days from now, (b) "Doing" (always shown), or (c) "Done" with a deadline of exactly yesterday. Sorted by deadline, then by status priority Doing → To do → On deck → Done. Columns: Task, Fundraiser (colored chips), Run Date, Status. Empty state text: **"No upcoming Cash tasks"**.

### Page: Upcoming — route `/upcoming`

File: `client/src/pages/Upcoming.jsx`, data from `GET /api/fundraisers/upcoming` (`server/src/routes/fundraisers.js`, `getUpcomingFundraisers`).

**Filter:** fundraisers whose Airtable `status_rendered` formula field equals **"Upcoming"**. **Sort:** kickoff date ascending (soonest first) — set server-side in the Airtable query.

The page splits into two sections (`Upcoming.jsx`):
- **"Needs Attention"** — subtitle "These fundraisers have unresolved items before kickoff" — fundraisers failing at least one readiness check.
- **"Ready to Launch"** — subtitle "All pre-flight checks passed" — everything else. These cards get a green left border and a green "Ready" pill.

**Each card shows:** organization — team (clickable, opens the Fundraiser Detail modal), start/end dates, a **countdown chip** ("N days" until kickoff; green at 7+ days, amber at 3–6, red under 3 — `countdownClasses`), rep name + photo, product badges (primary = indigo, secondary = violet, donations = emerald), ASB type badge, primary contact name, accounting contact name (or an amber "No accounting contact" pill), a **Readiness checklist**, and orange **task badges** for each open Office Manager task linked to the fundraiser (clicking a badge opens the Task Detail modal).

**Readiness checks** (computed server-side in `getUpcomingFundraisers`, `server/src/routes/fundraisers.js` lines 179–195):
1. **Accounting contact** — passes if an accounting contact is linked.
2. **MD Portal URL** — passes if the MD Portal URL field is filled.
3. **ASB intro email sent** — only evaluated when the fundraiser's ASB type is exactly "WA State ASB". Passes if a linked task is Done whose `action_url` is `email:asb-onboarding` or whose name contains "asb onboarding email".
4. **Cookie dough presale submitted** — only evaluated when the primary product name contains "cookie dough". Passes if a linked task whose name contains "presale" or "pre-sale" is Done.

The sidebar "Upcoming" badge counts fundraisers failing any applicable check (`/upcoming/count` in `fundraisers.js`).

Empty state: **"No upcoming fundraisers"**.

### Page: Active — route `/active`

File: `client/src/pages/Active.jsx`; data from `GET /api/fundraisers/active` and `GET /api/payouts/today`.

**Section 1 — Active Fundraisers.** Filter: `status_rendered` = "In Progress"; sort: end date ascending (`getActiveFundraisers` in `server/src/routes/fundraisers.js`). Each card: org — team (clickable), date range, a chip showing days left ("Ending today" or "N days left"; green ≥5 days, amber 2–4, red under 2 — `daysRemainingClasses`), an animated **campaign progress bar** with milestone dots at 25/50/75/100%, rep, product badges, primary contact, accounting contact (or "No accounting contact"), ASB badge, and open-task badges (here **all** open tasks, both Krista's and Cash's — `open_tasks` filter in `getActiveFundraisers` only excludes status "Done"). Empty state: **"No active fundraisers"**.

**Section 2 — Daily e-checks table.** The heading label is computed from Pacific time (`getPayoutContext` in `server/src/routes/payouts.js`):
- **Before 2:00 PM Pacific:** shows *yesterday's* payout batch with the label "Last daily e-checks run — [date] (ran at 12:15am today)".
- **2:00 PM Pacific or later:** shows *today's* batch with the label "Next daily e-checks run — [date] (runs at 12:15am tonight)".

This mirrors the operating reality that daily payout records are created at 2 PM the day before, and the money actually moves at 12:15 AM Pacific (documented in the comments in `payouts.js` and in Cash's system prompt in `server/src/routes/chat.js`). **Important: the daily e-check engine itself is NOT in this codebase** — the portal only *displays* the `daily_payouts` records; something external (Airtable automations / Pipedream, per the spec `SMASH-Manager-Portal-Spec.md`) creates them and sends the money. See Sections 6 and 16.

Table columns: Org + Team (clickable to detail modal), Payee (accounting contact name), Payout Amount (a $0.00 amount is shown but visually muted), Status chip (Awaiting Data = blue, Pending = yellow, Sent = green, Failed = red), and **Check #** — an inline-editable cell (see Section 2).

If any payout in the batch failed, a **red banner** shows "N payout(s) failed" with each fundraiser's name and the Airtable `error_message` text.

**On Saturdays and Sundays (Pacific time)** the payout table is replaced by an amber note: **"No e-checks on the weekend. In fact, quit working and go play! ☕ —Cash"** (`Active.jsx`, weekend check).

Empty state for the table: **"No payouts scheduled for today"**.

### Page: Ended — route `/ended`

File: `client/src/pages/Ended.jsx`; data from `GET /api/fundraisers/ended` (`getEndedFundraisers` in `server/src/routes/fundraisers.js`).

**Filter:** `status_rendered` = "Campaign Ended" OR "Ready to Close". **Sort:** end date ascending (oldest-ended first — longest-sitting is most urgent).

Three sections (`Ended.jsx`, lines 342–366):
1. **"Needs Action"** (amber) — subtitle "These fundraisers have open tasks" — any fundraiser with `open_manager_tasks_count > 0` (an Airtable rollup counting non-Done Office Manager tasks).
2. **"Waiting"** (gray hourglass) — subtitle "No open tasks — waiting on external items" — no open manager tasks, but not yet ready to close.
3. **"Ready to Close Out"** (green) — subtitle "All items complete — ready to archive". A fundraiser lands here only when ALL of the following hold (`readyToClose` filter in `Ended.jsx`):
   - no open manager tasks;
   - if it has an MD product (primary product name contains "md"): MD Payout received is checked;
   - Check/Invoice sent is checked;
   - Rep paid is checked;
   - if it requires an invoice (WA State ASB, or product contains "traditional no-risk" or "traditional upfront"): Invoice payment received is checked;
   - none of the five "waiting" flags are raised (see below).

**Each card shows:** org — team (clickable), rep + photo, an "Ended N days ago" chip (green under 7 days, amber 7–13, red at 14+ — `daysAgoClasses`), product badges, ASB badge, Gross (gross_sales_md) and MD (md_payout) dollar figures, a **Closeout checklist strip** (✅/❌ for each applicable item: "MD Payout received" only for MD products, "Check/Invoice sent", "Rep paid", "Invoice payment received" only when an invoice is required — `CloseoutChecklist` in `Ended.jsx`), **waiting badges**, open-task badges, and (in the Ready section only) an orange **"Mark as Closed Out"** button.

**Waiting badges** (computed server-side in `getEndedFundraisers`, `fundraisers.js` lines 540–561; rendered in `WaitingBadges`, `Ended.jsx`):
- **"Rep Payment (Quarterly)"** (purple) — the rep is Dravin or Tahni (hard-coded record IDs `recdywD6yFFsan38u` and `recLmSrcuiM8uwxb9` in `QUARTERLY_REP_IDS`, `Ended.jsx`) and Rep paid is unchecked. This is informational: these two reps are paid quarterly in bulk, not per-fundraiser.
- **"Waiting on MD Payout"** (blue, with an inline **"Mark Received"** button) — MD Payout received is unchecked AND the fundraiser has an MD product (primary product contains "md", OR an MD Donations product is linked, OR an md_payout amount > 0 exists).
- **"Waiting on Invoice Payment"** (purple, with its own **"Mark Received"** button) — Invoice payment received is unchecked AND the fundraiser requires an invoice.
- **"Needs Accounting Contact"** (yellow) — no accounting contact linked.
- **"Org Name Needs Follow-Up"** (orange) — the Airtable checkbox `organization_name_needs_follow_up` is checked. (There is **no portal control to clear this** — it must be unchecked in Airtable.)
- **"Needs Card Count"** (red) — primary product is exactly "Team Cards - Traditional No-Risk" and `cards_sold_manual` is empty.

Empty state: **"No ended fundraisers — all caught up!"**

### Modal: Fundraiser Detail

File: `client/src/components/FundraiserDetailModal.jsx` (the largest UI file). Opens when Krista clicks any fundraiser name anywhere, or via a **deep link** URL of the form `?fundraiser=recXXXX` (handled in `client/src/App.jsx` — task action buttons can carry such links, see `isPortalDeepLink` in `client/src/components/TaskCard.jsx`).

Read-mode sections, in order: header (org — team, status chip color-coded per `STATUS_COLORS`, date range, progress bar when In Progress), **Key People** (Rep / Primary Contact / Accounting Contact, including the accounting contact's paper-check preference and mailing address when set; amber "No accounting contact assigned" warning when empty), **Setup** (products, "Include MD Donations", ASB type, team size, card counts — cards ordered/sold/lost shown only when the primary product contains "Traditional", "Open MD Portal" button), **Financials** (summary tiles for Gross Sales, Team Profit, Invoice Amount, Rep Commission, SMASH Profit, MD Payout — only populated values are shown; plus three collapsible breakdowns: **Rep Commission Breakdown**, **Team Profit Breakdown**, **SMASH Profit Breakdown**, each listing subtotal, adjustment lines, and final), **Closeout** (only for statuses Campaign Ended / Ready to Close / Closed Out), **Documents** (MD Payout Report slot only for MD fundraisers; FPR; RCR; Fundraiser Agreement unsigned + signed; Invoice — the last two are display-only slots with "No file uploaded" placeholders), **Tasks** (open + completed chips, "New Task" link), **Daily Payouts** (table, only for WA State ASB fundraisers, sorted newest first, failed rows show their error message), **Notes** (Admin Notes editable, Agreement Notes editable, Rep Notes read-only).

An **Edit** button switches the whole modal to edit mode with a sticky Save/Cancel bar (see Section 2 for the field inventory).

### Modal: Task Detail, Edit Task, New Task

`client/src/components/TaskDetailModal.jsx`, the `EditTaskModal` inside `client/src/components/TaskCard.jsx` (plus near-identical copies `EditTaskModalInline` in `Upcoming.jsx` and `EditTaskFromDetail` in `FundraiserDetailModal.jsx`), and `client/src/components/NewTaskModal.jsx`. Detailed in Section 2.

### Modal: workflow modals launched from task action buttons

A task's `action_url` field determines which special modal its action button opens (routing logic in `TaskCard.jsx` and `TaskDetailModal.jsx`):
- `email:asb-onboarding` → **Email Preview modal** (`EmailPreviewModal.jsx`)
- `echeck:team_profit` or `echeck:rep_commission` → **E-Check wizard** (`ECheckPreviewModal.jsx`)
- `echeck:bulk_rep_commission:dravin` or `...:tahni` → **Bulk Rep Commission modal** (`BulkECheckModal.jsx`)
- `cost:` prefix → **Product Cost modal** (`ProductCostModal.jsx`)
- a portal URL containing `?fundraiser=rec…` → opens the Fundraiser Detail modal in place
- any other URL → opens in a new browser tab

---

## 2. Every action Krista can take

Legend for "Fires": *immediate* = writes to Airtable the moment she clicks (no Save step); *on Save* = staged until a Save button is pressed. Airtable table/field IDs are from `server/src/services/airtable.js` unless noted. "Reversible" means Krista can undo it herself in the UI.

### Login / logout

| Action | Label | Where | What happens |
|---|---|---|---|
| Log in | **"Log in"** | Login screen (`AuthGate.jsx`) | Checks password server-side; sets a 24-hour session cookie. Error text: "Incorrect password". |
| Log out | **"Log out"** | Sidebar bottom (`Sidebar.jsx`) | Destroys the session; immediate; reversible by logging back in. |

### Dashboard / tasks

| Action | Label / gesture | Where | Writes | Fires | Confirm? | Reversible? |
|---|---|---|---|---|---|---|
| Move a task between columns | **drag-and-drop** | Dashboard board (`Dashboard.jsx`, `handleDragEnd`) | tasks table `tblA1Rndmnrey0e6L`, Status field `fldibO3tFh4ms0it7`. Moving to Done also stamps completed_at `fldOo5oTh4pXsgZfs` with today's date; moving out of Done clears it (`server/src/routes/tasks.js` PATCH handler). | Immediate (optimistic — the card moves instantly, reverts with an error toast "Failed to update \"[name]\" status" if the save fails) | No | Yes — drag it back |
| Create a task | **"+ Task"** (status bar) or the small **+** on each column header, then **"Create Task"** | Dashboard; also **"New Task"** inside the Fundraiser Detail modal (pre-linked to that fundraiser) | Creates a row in tasks: Name `fldiQjD8PPe18QThz`, Status `fldibO3tFh4ms0it7` (defaults "To do"), Assignee `fldJpqDYWaWtQdDXu` = always the "Office Manager" rep record (`recAva9jBaIR63MXl` — Krista cannot assign tasks to Cash from the portal), Deadline `fldMXHF3x37QyGdRV`, Creation method `fldtOO8JlwZu1Uhui` = "Manual", plus optional description, show date, fundraiser link, action URL, button label (`server/src/routes/tasks.js` POST) | On **"Create Task"** | No | Task can be edited but **not deleted** from the portal — only Cash (the chatbot) can delete tasks |
| Open a task | click the card | Any task card | Nothing | — | — | — |
| Edit a task | **pencil icon** on the card, or **"Edit"** in the Task Detail modal, then **"Save"** | `EditTaskModal` in `TaskCard.jsx` (copies in `Upcoming.jsx` and `FundraiserDetailModal.jsx`) | tasks table: name, description, status, deadline, show_date `fld9aBg9X1jcTcnOW`, action_url `fldn2QY5fufxJ03my`, button label `fldMypJRWWAdu9hzD`, linked fundraiser `flddkpCSJb2MUIMLU`. A typed action URL gets `https://` prepended automatically unless it starts with `email:`, `echeck:` or `cost:` (`TaskCard.jsx` `handleSave`). | On **"Save"** | No | Yes — edit again |
| Mark a task done | **"Mark as Done"** (green) | Task Detail modal (`TaskDetailModal.jsx`) | tasks Status → "Done" + completed_at = today | Immediate | No | Yes — drag back out of Done or edit status. Error text: "Failed to mark task as done" |
| Run a task's action | orange button labeled with whatever is in the task's **button_words** field (e.g. "Send Email", "Send E-Check") | Task card and Task Detail modal | Opens one of the workflow modals or an external link (see routing at the end of Section 1) | — | — | — |

Note: once an e-check task is Done, its action button is replaced by a gray, un-clickable **"Sent"** chip (`TaskCard.jsx` / `TaskDetailModal.jsx`) — a guard against double-sending money.

### Upcoming page

Task badges → Task Detail modal; fundraiser name → Fundraiser Detail modal. No unique writes on this page itself.

### Active page

| Action | Label / gesture | Writes | Fires | Confirm? | Reversible? |
|---|---|---|---|---|---|
| Record a check number for a daily payout | click the **Check #** cell, type, then blur or press Enter (`CheckNumberCell` in `Active.jsx`) | daily_payouts table `tblxoqfVPg322jNqA`, check_number field `fldOjxdPJc10D57lW` (`server/src/routes/payouts.js` PATCH) | Immediate on blur/Enter | No | Yes — edit again |

### Ended page

| Action | Label | Writes | Fires | Confirm? | Reversible? |
|---|---|---|---|---|---|
| Mark MD payout received | **"Mark Received"** (inside the blue "Waiting on MD Payout" badge) | fundraisers `tbl7aH2mtkAGC9jk9`, md_payout_received `fldKflCSEtVXCkj9I` → true (`Ended.jsx` `handleMarkReceived`) | Immediate | No | Only by unchecking in the Fundraiser Detail modal's edit mode (or Airtable/Cash) — there is no un-mark button on the card |
| Mark invoice payment received | **"Mark Received"** (inside the purple "Waiting on Invoice Payment" badge) | invoice_payment_received `fld1cS6i7BrZfqxuf` → true | Immediate | No | Same as above |
| Close out a fundraiser | **"Mark as Closed Out"** (orange, only in the Ready to Close Out section) | manual_status_override `fldFHxyf9DHd1qscd` → "Closed Out" (`Ended.jsx` `handleCloseOut`). The fundraiser disappears from every list page. | Immediate | **No confirmation** | Yes, but only via the Fundraiser Detail modal deep link, Cash, or Airtable — set the status override back to "Auto (calculated)". Once closed out it no longer appears on any list page to click on. |

### Fundraiser Detail modal — Edit mode

Entering edit mode: **"Edit"** button (top right). All changes below are **staged** and written only when Krista clicks **"Save"** in the sticky bottom bar; **"Cancel"** discards them. Save is disabled until something changed, and also disabled while "Extra boxes ordered" or "Product Cost" contain invalid values (`FundraiserDetailModal.jsx`, `hasChanges` / `cdBoxesInvalid` / `costProductInvalid`). Clicking outside the modal with unsaved changes asks: **"You have unsaved changes. Discard them?"** (`handleOverlayClick`).

Editable fields and their Airtable targets (all on fundraisers table `tbl7aH2mtkAGC9jk9`; PATCH handler `server/src/routes/fundraisers.js` lines 990–1060):

- Organization `fldxsdVs28DhSdbuw`, Team `fldx47Bwh7kPFlbYD` (header text boxes)
- Status override dropdown `fldFHxyf9DHd1qscd`: "Auto (calculated)" (clears it), "Cancelled", "Awaiting PO/Rep", "Ready to Close", "Closed Out"
- Kickoff date `fldbfZFcJj52SnB5C`, End date `fldEFQYQLPlh26i6O`
- Rep `fldKVtinL60lTrFzl`, Primary contact `fldU9j8KNl0prGM0t`, Accounting contact `fld6tNYzxnpV9EPX3` (dropdowns; the rep list excludes the "Office Manager" and "Cash" records — `lookup/reps` in `fundraisers.js`)
- Primary product `fldwq9D0y9YCU2dX4`, Secondary product `fldtIIUJvUtMyXusQ` (dropdowns)
- "Include MD Donations" checkbox `fldZ7EFPBXeADzc6T`
- ASB type `fldMCr5g20kATvA2s` (choices in the UI: WA State ASB / School - other than WA State ASB / Booster Club / Rec / I don't know yet)
- Team size `fldbQKlx5bpBBHCiL`, Cards ordered `fldzkXsedFeBVLAfK`, Cards sold `fldqhwtTuxnNHfsCp` (the manual field), Cards lost `fldWpLdiGIKxPQwCa`
- MD Portal URL `fldrZzkK8XNNDqqOQ`
- The four closeout checkboxes: md_payout_received `fldKflCSEtVXCkj9I`, check_invoice_sent `fld6HUrMft9MsDfIL`, rep_paid `fld11dZXfenyqzQbe`, invoice_payment_received `fld1cS6i7BrZfqxuf`
- Admin Notes `fldyB1gmXNXtM2ymV`, Agreement Notes `fldjlBySsJUZb7uvc`
- **Rep Commission Breakdown adjustments:** "Adjustment between Team & Rep" (the amount Krista types is stored **negated** into fpr_adj_team_to_rep `fldZBFkZCxhmxwNOj`, because the rep-side value is an Airtable formula mirroring the team-side field — comment at `fundraisers.js` line 1035; helper text in the UI: "Positive = team gives rep · Negative = rep gives team") with its label `fld1jNPQUhrowvwK8`; "Misc Adjustment" `fld0iQuhUQDk5L5IY` with comment `fld3vDtAwws1m9EUq` (comment max 500 characters); "Extra boxes ordered" `fldobBrd984o4OLhe` (cookie-dough products only; must be a whole number ≥ 0, error text "Must be 0 or more")
- **SMASH Profit Breakdown:** "Product Cost" cost_product `fldkYOO4LKa0dpDUV` (must be ≥ 0; server also rejects negatives with "cost_product must be a non-negative number")
- **Accounting-contact paper-check settings** — these save to the *accounting_contact* record (`tblw4wHSfztIJDBj8`), not the fundraiser: "Prefers paper check" `fldHDV7KoidMX2zYl` and mailing address line 1/2/city/state/zip (`fldrhuOMnd4TqwI5c` / `fldkKjKzdnRp2yaNr` / `fldTMGd2aeCcCeu1S` / `fldTo6di7BxdGpBD4` / `fldvxZk6Kz4ukg8sg`), via `PATCH /api/fundraisers/accounting-contact/:contactId` (`fundraisers.js` lines 969–987). Only saved if the selected accounting contact wasn't changed in the same edit session.

### Fundraiser Detail modal — Documents section (all immediate, no Save needed)

| Action | Label | What happens |
|---|---|---|
| Upload / replace the MD Payout Report | **"Attach MD Payout Report"** (orange, when empty) or **"Replace"** (when a file exists); button text becomes "Reading report and generating documents…" while working | Opens a file picker (PDF only, max 5 MB). The PDF is read by Claude, extracted numbers are written to the fundraiser, the PDF is attached to the MD Payout Report slot `fldYcxmoXJ16uuAE6` (replacing any old file), and the FPR + RCR PDFs are regenerated. Full pipeline in Section 11. Irreversible in the sense that the previous attachment and previous extracted numbers are overwritten. |
| Enter / edit the two-product split | **"Save split"** (amber blocking callout) or **"Edit split"** → **"Save changes"** (`ManualProductSplitCallout`) | Writes pp_gross_manual `fldWSgjOoFLij0LHJ` and sp_gross `fldJF31WTo9Cw88Ws` immediately. Validation: "Both fields must be valid positive numbers." Reference text shows the combined gross from the MD report and says the split "must add up to exactly this amount" (note: the code does **not** actually enforce that the two numbers sum to the reference — see Section 16). |
| Generate / regenerate the Fundraiser Profit Report | **"Generate Fundraiser Profit Report"** / **"Regenerate"** | Renders the FPR PDF server-side and attaches it (replacing the old one) to `fldDX1jRdrNc1zepO`. Blocked when a two-product split is missing. |
| Generate / regenerate the Rep Commission Report | **"Generate Rep Commission Report"** / **"Regenerate"** | Same, to `fld4hTL0dMQTCnoPG`. |
| Generate the Fundraiser Agreement | **"Generate Fundraiser Agreement (Unsigned)"** / **"Regenerate"** | Renders the agreement PDF and attaches to `fld3EdTDzU7YDRK4T`. |

A stale report (underlying numbers changed since it was generated — fingerprint comparison, see Section 5) shows an amber warning: **"This report may be out of date — regenerate to apply recent changes."**

The **signed** agreement slot and the **Invoice** slot are display-only; those files must be uploaded in Airtable directly.

### Email Preview modal (ASB onboarding email)

`client/src/components/EmailPreviewModal.jsx`. Opened from a task whose action URL is `email:asb-onboarding`.

| Action | Label | Notes |
|---|---|---|
| Move a recipient between To and CC | small **"To"/"CC"** toggle on each chip | Recipients are the fundraiser's accounting contacts (all of them, "To" by default), with the rep auto-added as CC. Contacts with no email on file are listed under "Excluded" with "— no email on file". |
| Remove / restore a recipient | **X** on the chip / **"Add back to To"** | |
| Edit subject and body | free-text subject field; the body is a click-and-type rich area | Krista can rewrite anything before sending. The signature block is fixed (not editable). |
| Generate the missing agreement | **"Generate Now"** (amber bar: "Fundraiser Agreement not generated yet. Generate it before sending.") | Calls the agreement generator, then re-checks. Failure text: "Could not generate agreement: …". |
| Send | **"Send Email"** | Disabled until there is at least one To recipient **and** the agreement exists (tooltips: "Add at least one recipient to To" / "Generate the Fundraiser Agreement first"). Sends via Gmail with the agreement PDF attached, then marks the task Done automatically (`server/src/routes/email.js` POST /send). **Not reversible — the email is out.** Success text: "Email sent!" |

### E-Check wizard (single fundraiser)

`client/src/components/ECheckPreviewModal.jsx`. Two flavors depending on the task's action URL:

**Team Profit (`echeck:team_profit`)** — a two-step wizard ("Step 1 of 2: Send E-Check" → "Step 2 of 2: Send Profit Report"):
- Step 1 buttons: **"Send E-Check"** (digital, via Checkbook), **"Mail Paper Check"** (appears when the "Send as a mailed paper check instead of a digital e-check" checkbox is ticked — with address form), **"Skip E-Check"** (jump to step 2 without paying — for cases where payment happened another way), **"Cancel"**.
- Step 2 buttons: **"Send Email"** (the profit-report email, editable before sending), **"Skip"**, **"Back"** (only if no check was actually sent in step 1).
- The task is marked Done only after step 2 finishes (send or skip) — not after the check itself (`finishAndClose` / `markTaskDone`).

**Rep Commission (`echeck:rep_commission`)** — single step, title "Send rep commission e-check":
- **"Send E-Check"** — sends the check AND automatically emails the rep the commission report PDF (no preview of that email); the task is marked Done server-side.
- If the commission is **$0 or negative**, the send button is replaced by **"Zero out & send report to rep"** with the explanation: "This will adjust the misc line to bring the commission to $0, regenerate the commission report, email it to [name], and mark the rep as paid." Success text: "Report sent to the rep, marked paid."

**None of the money-sending buttons have a confirmation dialog** — the modal itself (showing recipient, amount, and memo) is the confirmation. **Sending money is not reversible.** Full payment mechanics in Section 3.

### Bulk Rep Commission modal

`client/src/components/BulkECheckModal.jsx`. Opened from a task whose action URL is `echeck:bulk_rep_commission:dravin` or `echeck:bulk_rep_commission:tahni`.

| Action | Label |
|---|---|
| Toggle one fundraiser in/out of the batch | row checkbox (all checked by default) |
| Toggle all | **"Select All"** / **"Deselect All"** |
| Send | **"Send E-Check — $[total]"** — one combined Checkbook e-check to the rep for the sum of selected commissions, memo "SMASH Fundraising — Q[n] [year] Rep Commissions". Marks every selected fundraiser rep_paid = true and marks the task Done. No confirmation dialog; not reversible. |

### Product Cost modal

`client/src/components/ProductCostModal.jsx`, for tasks with a `cost:` action URL. Buttons: **"Open frmgr.com"** (external supplier-invoice site, hard-coded link `https://frmgr.com`), **"Save"** (writes cost_product `fldkYOO4LKa0dpDUV` on the fundraiser and marks the task Done — `server/src/routes/cost.js`). Validation: "Enter a valid non-negative number". Success: "Cost saved!"

### Cash chat

Floating button opens the chat (`CashChat.jsx`). Quick-action chips on first open: **"Show overdue tasks"**, **"Fundraiser summary"**, **"Today's payouts"**. Through conversation, Cash can also **write**: create tasks, update tasks, update fundraiser checkboxes/notes/status override, and **delete tasks** (the only delete path in the whole system) — see Section 10.

---

## 3. Payments

All payment code lives in `server/src/routes/echeck.js`. Money moves through **Checkbook.io**; the portal calls Checkbook's REST API directly.

### Sandbox vs production

`getCheckbookBaseUrl()` (`echeck.js` lines 50–54): if the `CHECKBOOK_ENV` environment variable is exactly `sandbox`, all requests go to `https://sandbox.checkbook.io/v3` (fake money); otherwise `https://checkbook.io/v3` (real money). Nothing in the UI indicates which mode is active — it is purely a server configuration.

### Flow A — digital e-check for Team Profit (the two-step wizard)

1. Krista clicks the action button on a team-profit e-check task. The frontend calls `GET /api/echeck/preview/:taskId` (`echeck.js` lines 100–227). The server reads the task, follows its linked fundraiser, and assembles: amount = **final_team_profit**, recipient name = the **organization name**, recipient email = the **accounting contact's email**, memo = "Team profit — [org] [team]", the attached FPR PDF (if any), plus the data used in the step-2 email (end date, gross sales, rep name, product, primary contact) and the accounting contact's paper-check preference and saved address.
2. The modal shows everything. The **"Send E-Check"** button is disabled unless amount > 0 and a recipient email exists (`canSend` in `ECheckPreviewModal.jsx`).
3. On send, `POST /api/echeck/send` (`echeck.js` lines 353–476) posts to Checkbook `POST /check/digital` with name, recipient email, amount, and description.
4. On success the server: (a) sets the fundraiser's **check_invoice_sent** checkbox to true (best-effort — a failure here is logged but doesn't fail the payment); (b) creates a tracking row in the **fundraiser_payouts** table (`tbl2o1R97fQNWcqaj`) with purpose "Team Profit", status "sent", Checkbook's check ID as reference_number, the check number, a Pacific-time sent_at stamp, and the idempotency key. It deliberately does **not** mark the task Done yet.
5. The wizard advances to Step 2: an editable email ("Your Team Profit Report — [org] [team]", body built by `buildProfitReportHtml` in `ECheckPreviewModal.jsx` — see Section 4). Sending it calls `POST /api/echeck/send-report-email`, which emails the accounting contact with the FPR PDF attached.
6. After the email is sent **or skipped**, the frontend marks the task Done (`finishAndClose`).

### Flow B — mailed paper check for Team Profit

Only offered for team-profit payments; the server hard-rejects any other type with **"Paper checks are only supported for Team Profit payments"** (`POST /api/echeck/send-physical`, `echeck.js` lines 478–680).

How the system decides digital vs paper: the accounting contact record has a **"prefers paper check"** checkbox. If it's checked, the wizard's paper-check checkbox comes pre-ticked with the saved address pre-filled (`ECheckPreviewModal.jsx`, the preview `useEffect`); Krista can untick it to send digitally, or tick it on any fundraiser ad hoc. **The final choice is always Krista's click** — nothing sends automatically.

Steps:
1. Address requires Line 1, City, State, ZIP (client check `addressComplete`; server check returns "Mailing address requires Line 1, City, State, and ZIP"). UI note: "Checkbook mails this via USPS (arrives ~1–5 business days). Submit before 1:00 PM PT to mail today. Physical checks cost more than e-checks." (The 1 PM cutoff is informational text only, not enforced by code.)
2. **Before** sending, the server saves the paper-check preference and address back onto the accounting contact record, "so it sticks even if the send fails" (comment at `echeck.js` line 505).
3. The server downloads the FPR PDF and tries to attach it **to the physical check itself** via a multipart request to Checkbook `POST /check/physical`. Attachments over **7 MB** are skipped (Checkbook's limit; `echeck.js` line 539). It tries two multipart encodings ("json" then "bracketed" recipient formats) and, if both fail, falls back to a plain JSON request **without** the attachment — "never let attachment problems block the check" (comment at line 549). The response tells the frontend whether the attachment made it (`attachmentIncluded`).
4. On success: check_invoice_sent → true; a fundraiser_payouts row with notes "Paper check (mailed) — [full address]"; then the wizard's Step 2 email switches to the paper-check variant ("Your team profit is on its way as a **paper check mailed via USPS**… We mailed it to: [address]"). The task is marked Done after Step 2, same as digital.

### Flow C — digital e-check for a single Rep Commission

`POST /api/echeck/send` with type `rep_commission`. Differences from team profit: amount = **rep_commission**; recipient name = the rep's **business name** (field `fldR3QP3GQCFvgqu7` on the reps table); recipient email = the rep's email; memo "Rep commission — [org] [team]". On success the server: marks the **task Done immediately** (no step 2), sets **rep_paid** → true, creates the fundraiser_payouts row (purpose "Rep Commission"), and then — best-effort — downloads the RCR PDF and emails it to the rep as a "companion email" (Section 4). If the companion email fails, the check still counts as sent; the response carries `emailSent: false` and the error.

### Flow D — zero-commission close-out

`POST /api/echeck/zero-commission` (`echeck.js` lines 726–816). For small fundraisers where the computed commission is ≤ $0. Guard: if the commission is actually positive it refuses with **"Rep commission is positive — use the normal e-check flow"**. Otherwise it: (1) increases the misc adjustment (rcr_adj_misc) by exactly the amount needed to bring rep_commission to $0; (2) regenerates the RCR PDF; (3) emails the fresh report to the rep ("…there's no commission payout this time…"); (4) sets rep_paid → true; (5) marks the task Done. **No money moves.**

### Flow E — quarterly bulk rep commission (Dravin / Tahni)

`GET /api/echeck/bulk-preview/:repKey` + `POST /api/echeck/bulk-send` (`echeck.js` lines 56–98 and 229–351). The two reps are hard-coded in `BULK_REP_CONFIG` (`echeck.js` lines 21–34): Dravin McGaughy (dravin@smashfundraising.com, rep record `recdywD6yFFsan38u`, Airtable view **"Dravin's Quarterly Rep Commissions"**) and Tahni McGaughy (tahni@smashfundraising.com, `recLmSrcuiM8uwxb9`, view **"Tahni's Quarterly Rep Commissions"**).

The preview pulls every fundraiser in the rep's named Airtable view, **skipping any already marked rep_paid** (a safety net — comment "Safety net — exclude already-paid"). Before sending, the server **re-fetches the fundraisers and recomputes the total itself**; if the client's total differs from Airtable's by more than **$0.01** it refuses with: *"Amount mismatch: client sent $X but Airtable totals $Y. Please refresh and try again."* One combined digital check is sent, one fundraiser_payouts row is created linking all included fundraisers, and every fundraiser is marked rep_paid = true in batches of 10 (Airtable's batch limit). The unpaid-fundraiser empty state reads: "No unpaid fundraisers — There are no fundraisers in the [rep] view that need a rep commission payout right now."

### What must be present before a payment can send, and what happens if it's missing

- **Recipient email** (digital): send button disabled; amber warning "No email found — cannot send". Server double-checks: "Recipient email is required".
- **Amount > 0**: server rejects "Amount must be greater than 0". UI warning when $0: "Amount is $0.00 — please verify in Airtable before sending" (team profit) — for rep commission ≤ $0 the flow becomes the zero-commission path instead.
- **Mailing address** (paper): both client and server enforce Line 1 + City + State + ZIP.
- **Payee name** (paper): server rejects "Payee name is required".
- **Report PDF**: never blocks a payment. Missing FPR → step 2 shows "No profit report PDF — email will send without attachment"; missing RCR → "No commission report PDF is attached to this fundraiser. The e-check will still be sent, but no companion email will go out."

### Idempotency and duplicate-send protection

Every Checkbook request carries an `Idempotency-Key` header:
- Single sends: `echeck-{taskId}` — so retrying the *same task* cannot produce a second check even if clicked twice (`echeck.js` line 365).
- Paper checks: `physical-echeck-{taskId}` (line 503).
- **Bulk sends: `bulk-rep-{repKey}-{timestamp}`** (line 264) — the timestamp means a *retry after a reported failure* would generate a **new** key. If Checkbook actually processed the first attempt but the response was lost, retrying the bulk flow could double-pay. (Flagged in Section 16.)

UI-level protection: e-check tasks whose status is Done show a dead "Sent" chip instead of the button; the bulk preview skips rep_paid fundraisers; single sends flip closeout checkboxes that feed the Ended-page logic.

**Every failed Checkbook call is also recorded** as a fundraiser_payouts row with status "failed" and the error message (all three send routes), so there is an audit trail in Airtable even for failures.

### Deliberately excluded from these flows

- **Daily ASB e-checks are not sent by this app.** The portal only displays `daily_payouts` records; the nightly 12:15 AM Pacific run and the 2 PM record creation happen in external automations (comments in `server/src/routes/payouts.js`; Cash's system prompt in `server/src/routes/chat.js`).
- Paper checks for **rep commissions** — explicitly rejected server-side.
- The task is intentionally **not** auto-completed on a team-profit send (comment at `echeck.js` line 404: "skip for team_profit — frontend marks done after step 2"), so a half-finished wizard leaves the task open as a reminder.
- No refunds, voids, or check-cancellation features exist anywhere in the portal.

### Every payment error state (exact text)

| Text | Cause | File |
|---|---|---|
| "Recipient email is required" | digital send with no email | `echeck.js` |
| "Amount must be greater than 0" | any send with amount ≤ 0 | `echeck.js` |
| "Paper checks are only supported for Team Profit payments" | physical send with wrong type | `echeck.js` |
| "Payee name is required" | physical send missing name | `echeck.js` |
| "Mailing address requires Line 1, City, State, and ZIP" | physical send incomplete address | `echeck.js` |
| "Unknown rep key: [key]" | bulk task action URL names a rep other than dravin/tahni | `echeck.js` |
| "fundraiserIds must be a non-empty array" / "totalAmount must be greater than 0" / "description is required" / "Some fundraiser IDs were not found" | malformed bulk send | `echeck.js` |
| "Amount mismatch: client sent $X but Airtable totals $Y. Please refresh and try again." | commissions changed in Airtable between preview and send | `echeck.js` |
| "Rep commission is positive — use the normal e-check flow" | zero-commission on a positive commission | `echeck.js` |
| "Unknown e-check type" | task action URL isn't team_profit / rep_commission | `echeck.js` |
| "Task has no linked fundraiser" | e-check/email/cost task missing its fundraiser link | `echeck.js`, `email.js`, `cost.js` |
| Checkbook's own message, or "Checkbook API error: [status]" | Checkbook rejected the request | `echeck.js` (all send routes) |
| "Failed to send e-check" / "Failed to mail paper check" / "Failed to send bulk e-check" / "Failed to process zero commission" | generic fallbacks shown in the modal | `ECheckPreviewModal.jsx`, `BulkECheckModal.jsx`, `echeck.js` |
| "No email found — cannot send" (amber, non-blocking display) / "Amount is $0.00 — please verify in Airtable before sending" / "Line 1, City, State, and ZIP are required to mail a paper check" | UI pre-send warnings | `ECheckPreviewModal.jsx` |

---

## 4. Email

**Every email the system sends goes through Krista's own Gmail account** via the Gmail API (`server/src/services/gmail.js`, `sendEmail`). The From address is whatever the `GMAIL_SEND_AS` environment variable is set to. There is no Resend or other email service anywhere in the code. Every outbound business email gets **Krista's signature block** appended (name "Krista McGaughy • Business Manager", krista@smashfundraising.com, "A Washington School Fundraising Partner", SMASH logo) — the identical HTML is defined three times: `KRISTA_SIGNATURE` in `server/src/routes/echeck.js`, in `server/src/routes/email.js`, and `KRISTA_SIGNATURE_HTML` in `client/src/components/ECheckPreviewModal.jsx`.

### Email 1 — ASB Onboarding email

- **Trigger:** Krista clicks the action button on a task whose action_url is `email:asb-onboarding`, reviews/edits, and clicks "Send Email". Fully previewed and editable.
- **To:** all of the fundraiser's accounting contacts that have an email on file (from the accounting_contact table, email field `fldhRKFgMo43Dlu6p`). **CC:** the fundraiser's rep (added automatically — `email.js` lines 137–146). Krista can rearrange/remove anyone.
- **Subject:** `[team] fundraiser: ASB Compliant Onboarding with SMASH Fundraising`
- **Template source:** `EMAIL_TEMPLATES['asb-onboarding']` in `server/src/routes/email.js` (lines 42–69). It is the **only** template in the system. Full body text (with merge fields in brackets):

  > Hello [first names of accounting contacts — "Hello there," if none; "Hello A and B," for two; Oxford-comma list for more — `buildGreeting`],
  >
  > [Organization] [Team] has a fundraiser scheduled to start on [kickoff date, e.g. "March 5, 2026", or "[date TBD]"] with our rep, [rep name]. I understand that this fundraiser will be run through ASB, and therefore may require our fully ASB-compliant program.
  >
  > If this is our first time working together, please confirm receipt of this email before fundraiser kickoff for security purposes.
  >
  > If you're new to this, or just need a refresher, here's how it works:
  >
  > 1. At the end of each weekday the fundraiser is active, we will send an e-check to this email, totaling the gross funds raised for that day. These checks can be printed and deposited just like a normal check. **These funds are intact, meaning that no fees, charges, or costs are taken out.**
  >
  > 2. At the fundraiser close, you hold the gross total funds raised. We will then send you an itemized invoice for all fundraiser costs.
  >
  > *Optional:* Some districts require a signed contract in place before each fundraiser. For your convenience, I attached a pre-filled and pre-signed ASB-compliant Fundraiser Agreement to this email. If your district prefers/requires district-wide vendor approval, we do that too. Just put us in touch with the right person and we'll take it from there.
  >
  > If you have any questions or if your district has additional needs, please let me know. You can respond to me here, or text/call (360) 482-3341. We love simplifying the work of our ASB/financial advisors.

- **Attachment:** the **unsigned Fundraiser Agreement** PDF. Sending is blocked until it exists (Krista can generate it inline with "Generate Now").
- **After sending:** the task is automatically marked Done with today's completion date (`email.js` POST /send, lines 230–235). This is also what satisfies the "ASB intro email sent" readiness check on the Upcoming page.

### Email 2 — Team Profit report email (wizard Step 2, digital variant)

- **Trigger:** Step 2 of the team-profit e-check wizard. **Previewed and fully editable** (subject and body) before sending; can be skipped.
- **To:** the accounting contact's email (single recipient — `preview.recipientEmail`).
- **Subject:** `Your Team Profit Report — [org] [team]`
- **Template source:** `buildProfitReportHtml` in `client/src/components/ECheckPreviewModal.jsx` (lines 22–62). Body: "Hi [organization]," / "Great news, your [team] fundraiser is officially wrapped up!" / a summary table (Team, Fundraiser Ended, Total Sales, Your Team Profit in green, Your Rep) / "You'll receive a separate email from Checkbook with deposit instructions for your e-check. Your detailed profit report is attached to this email for your records." / "If a mailed paper check is preferred, please let us know before printing the check or selecting the ACH transfer option. Once the payment has been initiated, it cannot be modified or reversed." / "Thank you for fundraising with SMASH — it was a pleasure working with your team!"
- **Attachment:** the FPR PDF (downloaded from Airtable server-side; if the download fails the email still sends without it — `send-report-email` in `echeck.js` lines 682–724).
- **After sending (or skipping):** the frontend marks the task Done.

### Email 3 — Team Profit report email (paper-check variant)

Same trigger/recipient/subject/attachment as Email 2, but body from `buildPaperCheckReportHtml` (`ECheckPreviewModal.jsx` lines 64–112): instead of Checkbook deposit instructions it says "Your team profit is on its way as a **paper check mailed via USPS**. Please allow about 1–5 business days for it to arrive. We mailed it to:" followed by the mailing address.

### Email 4 — Rep commission companion email

- **Trigger:** automatic, immediately after a successful single rep-commission e-check, **only if** an RCR PDF is attached to the fundraiser. **No preview — Krista never sees this one before it goes.**
- **To:** the rep's email. **Subject:** `Your SMASH Fundraising Commission Report — [org] [team]`
- **Body** (`echeck.js` line 458): "Hi [rep business name]," / "Your commission e-check for [org] [team] has been sent via Checkbook.io. You'll receive a separate email from Checkbook with deposit instructions." / "Your commission report is attached for your records." / "Thank you, Krista McGaughy, SMASH Fundraising" + signature.
- **Attachment:** the RCR PDF. **On failure:** the check still counts; the failure is only logged.

### Email 5 — Zero-commission report email

- **Trigger:** automatic during the "Zero out & send report to rep" flow, if the rep has an email and the regenerated RCR exists. No preview.
- **To:** rep's email. **Subject:** same as Email 4.
- **Body** (`echeck.js` line 793): "Hi [rep business name]," / "Here's your commission report for [org] [team]. This was a smaller fundraiser, so there's no commission payout this time — your report is attached for your records." / "Thank you, Krista McGaughy, SMASH Fundraising" + signature. Attachment: the RCR PDF.

### Email 6 — AI-model-retired alert (internal)

- **Trigger:** automatic, whenever any Claude API call fails with a "model not found" error (see Section 11). Throttled to at most once per **6 hours** (`SIX_HOURS_MS` in `server/src/services/modelHealth.js`).
- **To:** hard-coded `tahni@smashfundraising.com`. **Subject:** `⚠️ SMASH Manager Portal — Claude AI model retired, needs a code update`
- **Body** (`modelHealth.js` lines 21–24): names the retired model, names the feature that failed, and includes a copy-paste prompt for Claude Code explaining exactly which file/constant to update ("Open the file server/src/services/modelHealth.js and change the ANTHROPIC_MODEL constant…").

---

## 5. Documents and PDF generation

Three PDFs are generated server-side with `@react-pdf/renderer` (`server/src/services/pdf/render.js`; fonts and brand styling in `fonts.js` and `styles.js`). All finished PDFs are stored **as Airtable attachments on the fundraiser record**, using **replace semantics**: the new file becomes the only attachment in the slot; the previous file is removed from the field (`uploadAttachmentReplacing` in `server/src/services/airtable.js`). There is no other file storage.

### Fundraiser Profit Report (FPR)

- **Template:** `server/src/services/pdf/templates/FundraiserProfitReport.jsx`. **Filename:** `FPR - [org] - [team].pdf`. **Stored in:** field `fldDX1jRdrNc1zepO`.
- **Triggers:** (1) automatically after an MD Payout Report is saved through the extraction pipeline (`saveMdPayoutData` in `server/src/services/mdPayoutExtractor.js`); (2) automatically after a raw MD-report upload via the delayed poller (Section 6); (3) manually via the "Generate/Regenerate" button (`POST /api/reports/fpr/:fundraiserId`, `server/src/routes/reports.js`).
- **Data:** rep/org/team/season header, gross total collected, one profit line per product (primary with its % to team; secondary; MD Donations), subtotal, adjustment rows (50% Prize Share, Adjustment between team & rep, ASB Fee, and — Traditional No-Risk only — Discount on lost cards; adjustment rows render **only when non-zero**, `AdjustmentRow.jsx`), and a black "FINAL PROFIT" box. Data assembly: `fetchFundraiserDataForReports` in `reports.js`.
- **Product-type variations** (flags at the top of the template): Traditional Upfront hides the profit-summary section and the gross-total line, shows a Qty Sold column, prices the invoice per-card instead of by percentage, and adds the CAD tier footnote ("Comments: Please send payment in USD only. / Tiers are converted to USD for payment using live USD/CAD conversion. / 1000 ct = $8 CAD/card / 1500 ct = $7 CAD/card / 2000+ ct = $6 CAD/card"). An **INVOICE section** (mirror of the profit lines with inverted adjustments and a "FINAL INVOICE" box) appears only for WA State ASB, Traditional No-Risk, or Traditional Upfront fundraisers. MD Donations gets its own line unless the primary product *is* "MD Donations - Digital".
- **Sanity check before rendering:** for invoice-bearing variants, if final_team_profit + final_invoice_amount differs from gross by more than **$0.05**, a warning is logged to the server console — *"Report will still render."* (`generateFprForFundraiser` in `reports.js`). **Krista is never shown this warning.**
- **Staleness:** after generating, a "fingerprint" of the source numbers (MD report attachment ID, manual split values, gross, profit, invoice, commission — `computeReportFingerprint` in `airtable.js`) is written to `fldrFTjfaCC5SVK1H`. When the detail modal loads, the stored fingerprint is compared to a fresh one; a mismatch shows the amber "may be out of date" warning.

### Rep Commission Report (RCR)

- **Template:** `server/src/services/pdf/templates/RepCommissionReport.jsx`. **Filename:** `RCR - [org] - [team].pdf`. **Stored in:** `fld4hTL0dMQTCnoPG`. Fingerprint field: `fld1yLk2UEPDT5yKB`.
- **Triggers:** same three as the FPR, plus automatic regeneration inside the zero-commission flow.
- **Data:** commission line per product with % Comm, subtotal, adjustment rows — "Adjustment between team & rep", ASB fee (labeled "WA State ASB Fee" for ASB fundraisers, otherwise "ASB Fee (charged to rep by default)"), "50% MD prize shop (if elected by rep)", "Small fundraiser adj", "Excess printing adj", "Extra cookie dough boxes ordered at cost (N × $7)", "Misc adjustment" with its comment — and a "FINAL PAYOUT" box.

### Fundraiser Agreement (unsigned)

- **Template:** `server/src/services/pdf/templates/FundraiserAgreement.jsx` (a full one-page contract). **Filename:** `FA - [org] [team] - [season].pdf`. **Stored in:** `fld3EdTDzU7YDRK4T` (the *unsigned* slot; the signed copy lives in `fldDZerdCLGXpBO11` and is upload-only via Airtable).
- **Triggers:** the "Generate" button in the detail modal (`POST /api/reports/agreement/:fundraiserId`) or "Generate Now" inside the Email Preview modal. Never auto-generated.
- **Data:** start/end dates, product table with each product's profit % (pulled from the products table field `fldgThkrxMzkurPK7`, with an asterisk for tiered products), fund-management checkbox auto-ticked by type (Digital / Traditional / WA State ASB Compliant — logic at the top of the template), the ASB-fee clause with a checkbox that is ticked when the fundraiser's `rep_pays_asb_fee` checkbox (`fldDKKa5DBBiTBhS1`) is set ("if representative is waiving this fee" — note this field is **not editable in the portal**, only in Airtable), an Additional Notes box (tiered-pricing note auto-filled for card products + any manual Agreement Notes — `buildAgreementNotes` in `reports.js`), Krista's pre-printed script signature ("Krista McGaughy, Business Manager") dated with the generation date, a blank signature line for the organization, and a records table (org/group/rep/SMASH record #/contacts).
- The full contract text (SMASH's obligations, the organization's obligations including the 2% ASB fee and discount-card exclusivity terms, and the termination/reimbursement clause) is hard-coded in the template — changing any wording requires a code change.

### MD Payout Report (inbound, not generated)

The MD Payout Report PDF comes **from MoneyDolly**; the portal stores it in `fldYcxmoXJ16uuAE6` (again replace-semantics) when uploaded through the modal or the webhook. See Section 11.

### What happens if generation fails

Manual generation: the error string appears in red under the button in the detail modal (`reportError` state in `FundraiserDetailModal.jsx`); nothing is written. During the extraction pipeline, FPR and RCR generation are each independent best-effort steps — a failure is recorded in the response (`reports: { fpr: 'failed', … }` in `saveMdPayoutData`) and logged, but the extracted values and the PDF attachment still save. In the delayed auto-generate poller a failure is logged to the console only.

---

## 6. Automations and scheduled jobs

**There are no cron jobs in this codebase.** The automation surface consists of one inbound webhook, one delayed background poller, several client-side timers, and external systems (Airtable Automations / Pipedream) that this repo references but does not contain.

### Inbound webhook: `POST /api/automations/md-payout-report`

File: `server/src/routes/automations.js`. This is the endpoint an external automation (Pipedream-style) calls when MoneyDolly emails a payout report.

- **Auth:** NOT the portal session. It requires a header `x-automation-secret` matching the `MD_PAYOUT_WEBHOOK_SECRET` environment variable. Missing config → 500 "Webhook secret not configured on server."; wrong/missing header → 401 "Invalid or missing automation secret."
- **Expected payload (JSON, up to 10 MB):** `{ campaignId, filename, fileBase64 }` — all three required (400: "Missing required fields: campaignId, filename, and fileBase64 are all required.").
- **What it does:** looks up the fundraiser whose **"MD Campaign ID"** Airtable field equals the campaignId (note: this lookup uses the field **name** `{MD Campaign ID}`, not a field ID — the only place in the codebase that does; renaming that field in Airtable silently breaks the webhook). Then it runs the full Claude extraction, writes the extracted values, attaches the PDF, and generates FPR + RCR — the same pipeline as a manual upload.
- **Responses:** 404 `{ matched:false, reason:'no_fundraiser_for_campaign_id' }` if no match; 409 `reason:'multiple_matches'` if more than one fundraiser shares the campaign ID; 422 with the extraction result if Claude couldn't read the PDF; 200 with extraction + save details on success. **Nobody is emailed on failure** — the outcome only goes back to the caller and the server log, so the external automation is responsible for alerting.

### Delayed report auto-generation poller

File: `server/src/services/pdf/autoGenerate.js` (`scheduleAutoGenerate`). Fired (fire-and-forget) when a raw MD Payout Report file is uploaded via `POST /api/fundraisers/:id/upload-md-payout-report` **and** both the FPR and RCR slots were empty **and** no manual product split is needed (`server/src/routes/fundraisers.js` lines 1127–1138). It waits 5 seconds, then polls Airtable **every 5 seconds for up to 15 minutes** waiting for the fundraiser's gross_sales_md, final_team_profit, and rep_commission formula fields to become non-empty (this covers the case where Airtable-side automations populate numbers asynchronously). Once ready it generates whichever of FPR/RCR is still missing; it aborts silently if a manual split turns out to be required, if both reports appear in the meantime, or on timeout ("Auto-generate timed out for [id] — data not ready within 15 minutes." — console only).

### Client-side timers

- Every list page re-fetches data every **2 minutes** (`usePolling.js`).
- Cash's proactive-message check runs on page load and every **5 minutes** (`PROACTIVE_CHECK_INTERVAL` in `CashChat.jsx`) — see Section 10.

### Server-side caches (not jobs, but timing behavior)

The fundraiser list and rep list used for dropdowns/name resolution are cached for **5 minutes** (`CACHE_TTL` in `airtable.js`), and the weekly-summary stats for Cash are cached for **5 minutes** (`SUMMARY_CACHE_TTL` in `chat.js`). Newly created fundraisers/reps may take up to 5 minutes to appear in dropdowns.

### External automations referenced but not in this repo

- **Daily ASB e-checks:** payout records created at **2:00 PM Pacific the day before**, money sent at **12:15 AM Pacific**, weekdays only. Sources: comments in `server/src/routes/payouts.js` ("Before 2pm PT: show yesterday's payouts (ran at 12:15am today)") and Cash's system prompt ("Automated ACH payments run at 12:15am Pacific. Payout records are created at 2pm the day before"; `chat.js`). The engine, its error handling, and its notifications are all outside this codebase.
- **Auto-generated tasks:** "Auto-generated tasks are created by Airtable automations at various lifecycle triggers" (Cash's system prompt, `chat.js`; also `SMASH-Manager-Portal-Spec.md`, Tech Stack section). The triggers themselves live in Airtable and cannot be described from this code — see Sections 7 and 16.
- The spec also names **Pipedream** as the webhook-workflow layer (`SMASH-Manager-Portal-Spec.md`, "Automations" line). The only Pipedream-facing endpoint in this server is the MD-payout webhook above.

---

## 7. Task generation logic

### Where tasks come from

1. **Auto-generated (Airtable Automations).** Created outside this codebase with Creation method "Auto-generated" (field `fldtOO8JlwZu1Uhui`; the value is referenced in the spec's task-field table). The specific lifecycle triggers, and which get an `action_url` like `echeck:team_profit`, `email:asb-onboarding`, `cost:…`, or `echeck:bulk_rep_commission:dravin`, are configured in Airtable — **not documented in this repo** (see Section 16). The portal's special workflows key entirely off those `action_url` prefixes.
2. **Manual via the portal.** New Task modal (Section 2). Always assignee = Office Manager, creation method "Manual" (`server/src/routes/tasks.js` POST).
3. **Manual via Cash.** The chatbot's `create_task` tool — same defaults: "Always assigned to Office Manager unless explicitly told otherwise" per the tool description, and in practice the code always assigns Office Manager (`createTask` in `chat.js`); status defaults "To do"; name and deadline are required.

### Assignee

The Assignee field links to the reps table; two special rep records exist: **"Office Manager"** (`recAva9jBaIR63MXl`) = Krista and **"Cash"** (`recg1tf2UwurrEcnW`) = the automation persona (`REP_IDS` in `airtable.js`). Everything created in the portal is Office Manager's; Cash-assigned tasks come only from Airtable automations. Any assignee name containing "cash" is normalized to display as "Cash" (`tasks.js` and elsewhere).

### show_date and deadline

Both are plain date fields set by whoever creates the task (Airtable automation, the New Task form, or Cash). The portal never computes them. The form helper text says: "When this task becomes visible on the board. If empty, this task will show 1 month before deadline." (`NewTaskModal.jsx` / `TaskCard.jsx`) — **but the actual Dashboard code does not implement the one-month rule**: with no show_date, a task is simply visible immediately (`Dashboard.jsx` lines 76–78). Flagged in Section 16.

### Visibility on Krista's board (actual behavior, `Dashboard.jsx`)

- Office Manager tasks only; "On deck" never shows; a future show_date hides a task until that date; otherwise every non-Done task shows regardless of deadline, and stays visible indefinitely once open.
- **Done tasks disappear from the board 2 days after completion** (`completed_at >= two days ago`). They still exist in Airtable and still count in the Done column badge.

### Auto-completion

Tasks are marked Done automatically (status + completed_at) by: sending the ASB email (`email.js`), a successful rep-commission e-check (`echeck.js` /send), the zero-commission flow, finishing/skipping Step 2 of the team-profit wizard (client-side `markTaskDone`), a successful bulk send (client-side), and saving a product cost (`cost.js`). Cash's `update_task` tool also stamps/clears completed_at when it changes status.

---

## 8. Business rules encoded in code

### Commission / profit / invoice math

The **core financial formulas live in Airtable**, not in this code — final_team_profit, final_invoice_amount, rep_commission, smash_profit, status_rendered, etc. are Airtable formula fields (spec schema table; the code only reads them). What the code itself encodes:

- **Balance identity (checked, not enforced):** Team Profit + Invoice Amount should equal Gross, tolerance **$0.05**, for invoice-bearing types; violation only logs a console warning and the report still renders (`generateFprForFundraiser`, `reports.js`).
- **SMASH profit presentation:** SMASH Profit = Gross Sales − Team Profit − Rep Commission − MD Cut − Product Cost (the SMASH Profit Breakdown in `FundraiserDetailModal.jsx` displays it this way; the actual arithmetic is Airtable's).
- **Team↔Rep adjustment mirroring:** the rep-side "Adjustment between Team & Rep" is stored as the **negation** of the team-side field — editing it in the portal writes `-value` to fpr_adj_team_to_rep (`fundraisers.js` lines 1034–1038).
- **Invoice-line inversion on the FPR:** each invoice adjustment is the negative of the corresponding profit adjustment (`FundraiserProfitReport.jsx` invoice section).
- **Zero-commission math:** new misc adjustment = current misc − current commission, bringing the final to exactly $0 (`echeck.js` zero-commission route).

### Tiered pricing (printed on the Fundraiser Agreement; `server/src/constants/tieredProducts.js`)

- **Team Cards - Traditional Upfront Purchase:** 1500+ cards → **80%**; 1000–1499 → **76%**; 800–999 → **72%**; under 800 → **68%**.
- **Team Cards - Traditional No-Risk** and **Team Cards - MD Digital:** 1000+ cards → **64%**; 500–999 → **60%**; under 500 → **56%**.

### Hard-coded dollar amounts, percentages, and rates

- **2% ASB fee** on gross fundraiser revenue for ASB-compliant fundraisers, invoiced to the district at close, waivable by the rep via the `rep_pays_asb_fee` checkbox (`FundraiserAgreement.jsx`, clause 6).
- **Cancellation reimbursement** (discount-card products): **$20 per merchant signed + 25% of printing/designing/shipping costs** (`FundraiserAgreement.jsx`, termination clause 2).
- **Extra cookie dough boxes billed to the rep at $7 per box** (label "(N × $7)" in `RepCommissionReport.jsx`; the multiplication itself is an Airtable formula fed by the extra_cd_boxes_ordered count Krista enters).
- **Traditional Upfront CAD card cost tiers** (FPR footnote): 1000 ct = $8 CAD/card, 1500 ct = $7 CAD/card, 2000+ ct = $6 CAD/card; payment in USD only.

### Product-type branching (string matching on the primary product name)

- Contains **"md"** (case-insensitive) → it's an MD/MoneyDolly fundraiser: MD Payout Report slot appears; "MD Payout received" appears in closeout; report generation waits for the MD report; "Waiting on MD Payout" badge applies (`FundraiserDetailModal.jsx`, `Ended.jsx`, `fundraisers.js`).
- Contains **"traditional"** → card-count fields (ordered/sold/lost) appear in Setup (`FundraiserDetailModal.jsx`).
- Contains **"traditional no-risk"** or **"traditional upfront"**, or ASB type is exactly **"WA State ASB"** → an invoice is required: the FPR gets an INVOICE section, "Invoice payment received" joins the closeout checklist, and the "Waiting on Invoice Payment" badge applies (`FundraiserProfitReport.jsx`, `Ended.jsx`, `fundraisers.js`, `FundraiserDetailModal.jsx`).
- Exactly **"Team Cards - Traditional No-Risk"** with no manual card count → "Needs Card Count" badge (`fundraisers.js`); this product also gets the "Discount on lost cards" adjustment row on the FPR.
- Exactly **"Team Cards - Traditional Upfront Purchase"** → FPR drops the profit summary (upfront purchases have no profit share to report), shows per-card invoice pricing and the CAD footnote.
- Contains **"cookie dough"** → the presale readiness check applies (Upcoming), and the extra-boxes adjustment fields appear in the detail modal.
- Primary product exactly **"MD Donations - Digital"** → the MD Donations line is suppressed on FPR/RCR (it would duplicate the primary line).
- **Two-product MD fundraisers** (MD primary + any secondary): the MD report lumps both products into one gross number, so reports are **blocked** until Krista manually splits the gross between the products (`checkNeedsManualProductSplit` in `airtable.js`: MD primary + secondary present + either split value empty/zero).

### ASB-type branching

Values: "WA State ASB", "School - other than WA State ASB", "Booster Club", "Rec", "I don't know yet" (edit dropdown, `FundraiserDetailModal.jsx`). Only **WA State ASB** gets: daily e-check payouts (and the Daily Payouts section), the ASB onboarding email readiness check, mandatory invoicing, and the "WA State ASB Fee" RCR label. Badge colors: WA State ASB blue, School green, Booster Club purple; "Rec" has no badge color (`client/src/utils/asb.js`).

### Card count logic

cards_sold is an Airtable formula; the portal edits **cards_sold_manual** (plus cards_ordered / cards_lost). The "Needs Card Count" rule above is the only gate; lost cards feed the No-Risk "Discount on lost cards" adjustment.

### Time and date rules

- Business timezone is **America/Los_Angeles** throughout (payout context, Cash's clock, sent_at stamps, weekend check).
- Daily payout display cutover at **2:00 PM Pacific**; run time **12:15 AM Pacific**; **no weekend payouts** (UI suppression in `Active.jsx`; the engine itself is external).
- Dashboard Done cards linger **2 days**; Cash's task list looks **3 days ahead** and shows yesterday's Done items.
- Countdown color thresholds: Upcoming kickoff — green ≥7 days / amber 3–6 / red <3; Active days-left — green ≥5 / amber 2–4 / red <2; Ended days-ago — green <7 / amber 7–13 / red ≥14; task deadlines — red today/overdue, orange due tomorrow, gray otherwise.
- Session lifetime 24 hours; caches 5 minutes; polling 2 minutes.

### Other numeric limits

- Upload size limit **5 MB** for any PDF sent to the server (multer config, `fundraisers.js`); the automations webhook accepts up to **10 MB** JSON (`automations.js`).
- Checkbook physical-check attachment limit **7 MB** (`echeck.js`).
- Bulk-send verification tolerance **$0.01**; extraction cross-check tolerance **$1.00**; FPR balance tolerance **$0.05**.
- Cash: max **5** tool-use loops per question (`MAX_TOOL_LOOPS`), max **20** messages of history sent per request (`MAX_HISTORY` in `CashChat.jsx`), max_tokens 4096, Google Drive file reads truncated at **15,000 characters**, Airtable deletes batched **10** at a time.

---

## 9. Fundraiser lifecycle and status

### Where status comes from

The displayed status is Airtable's **status_rendered formula field** (`fldnx3K4heNUqs96t`) — the portal never computes it, only reads and filters on it. The formula itself lives in Airtable and is not in this repo. The intended semantics, as documented in Cash's system prompt (`server/src/routes/chat.js`, "Fundraiser Lifecycle" section):

- **Upcoming** — kickoff date in the future (pre-flight phase).
- **In Progress** — between kickoff and end date.
- **Campaign Ended** — past end date; closeout work pending.
- **Ready to Close** — MD payout has been received; final steps.
- **Closed Out** — everything done; archived (set via manual override).
- **Cancelled** — cancelled (manual override).
- **Awaiting PO/Rep** — on hold (manual override).

### The manual override

`manual_status_override` (`fldFHxyf9DHd1qscd`) forces the status regardless of dates. Portal options: Auto (clears it), Cancelled, Awaiting PO/Rep, Ready to Close, Closed Out. Set from the detail modal's edit header, the Ended page's "Mark as Closed Out" button, or Cash's `update_fundraiser` tool. Closed Out and Cancelled fundraisers are excluded from every list page and from task-linking dropdowns (`fundraisers.js` /list filter), so a closed-out fundraiser effectively vanishes from the portal (still reachable by deep link or Cash).

### What moves a fundraiser forward

Date passage handles Upcoming → In Progress → Campaign Ended automatically (via the Airtable formula). Campaign Ended → Ready to Close appears tied to MD payout receipt per the prompt above, though the exact formula is in Airtable. Ready to Close → Closed Out is **always a human action** (the override).

### What blocks close-out

The "Mark as Closed Out" button is only *offered* in the Ready to Close Out section, which requires (see Section 1, Ended page): zero open manager tasks; MD payout received (MD products); Check/Invoice sent; Rep paid; Invoice payment received (invoice-requiring types); and no waiting flags (accounting contact missing, org-name follow-up, card count missing, waiting on MD payout / invoice payment). **However, nothing prevents closing out through the detail modal's status dropdown or Cash regardless of these conditions** — the gating is UI-placement only.

---

## 10. Cash chatbot

Backend: `server/src/routes/chat.js` (system prompt in `getSystemPrompt()`, tools in `TOOLS`, tool implementations below them). Frontend: `client/src/components/CashChat.jsx`. Model: the shared `ANTHROPIC_MODEL` constant, currently `claude-sonnet-4-6` (`server/src/services/modelHealth.js`). Up to 5 tool-use round-trips per question; if exceeded, Cash answers: "That question required a lot of data lookups and I ran out of steps. Try asking something more specific!" Chat history is session-only (lost on page reload) and capped at the last 20 messages.

### Tools (what Cash can read and write)

| Tool | Read/Write | What it touches |
|---|---|---|
| `search_fundraisers` | Read | All fundraisers; filters by status, org/team/rep/product substrings, ASB type, date ranges. |
| `search_tasks` | Read | All tasks; filters by name, assignee, status, linked fundraiser, deadline range. |
| `search_payouts` | Read | daily_payouts by date/fundraiser/status. |
| `get_fundraiser_details` | Read | Full fundraiser profile including contacts, financials, tasks, payouts. Accepts a name search ("first match" — can pick the wrong record for ambiguous names). |
| `create_task` | **Write** | Creates a task (Office Manager assignee, Manual creation method). |
| `update_task` | **Write** | Name/description/status/deadline/show_date/action_url/button label; sets or clears completed_at with status changes. |
| `update_fundraiser` | **Write** | Only: the four closeout checkboxes, admin_notes, and manual_status_override. |
| `delete_tasks` | **Write (destructive)** | Permanently deletes task records — the only delete capability in the entire system. Tool description commands: "USE WITH CAUTION — always confirm with the user before deleting." |
| `search_drive_files` / `read_file_content` / `get_file_link` | Read | SMASH's Google Drive (all shared drives). Docs/Sheets/Slides are read as text (truncated at 15,000 chars); PDFs/images are link-only ("This is a binary file (PDF, image, etc.) — I can't read its contents directly, but I can share the link."). Implementation: `server/src/services/google-drive.js`. |

Cash **cannot**: upload/edit/delete Drive files or change sharing (explicitly listed in the prompt); send email or money; edit fundraiser fields beyond the six above; create or delete fundraisers.

### System prompt (summary — full text at `server/src/routes/chat.js`, `getSystemPrompt`)

Cash is "a gorilla in a business suit with a headset — professional but fun," Krista's teammate. The prompt teaches it: the SMASH business model; the full data model (lifecycle statuses, product types, ASB types, the daily-payout schedule, task statuses and portal visibility rules, the closeout checklist); behavioral rules — confirm before destructive changes but just do explicitly-requested single-field updates; be concise with data (answer only what was asked, no data dumps); give **very detailed step-by-step Airtable instructions** because "She's not tech-proficient"; never mention Airtable field IDs; be flexible with fuzzy name matching; gorilla personality in roughly 1 in 4 messages; always confirm writes with specifics. It's told today's date and current Pacific time on every request.

### Easter eggs (scripted in the prompt)

- "I'm bored" / "bored" → a random gorilla fact plus an offer to find something fun in the data.
- "tell me a joke" / "joke" → gorilla/fundraising puns (three examples are scripted, including "I told the daily e-checks a joke but they didn't laugh. They just kept bouncing. 💸").
- "how are you" → a mood based on **actual data** (failed payouts, overdue tasks, stuck fundraisers).
- "thank you" → occasionally a heartfelt reply ("I'm just a gorilla with a database. You're the one actually making these kids' teams happen.").
- "good morning" / "good night" → warm replies; mornings may mention the day's plate.

### Proactive messages (client-side, `CashChat.jsx`)

Checked on load and every 5 minutes; each fires **at most once per browser session** and appears as a red "1" badge on the chat bubble, delivered when the chat is opened:

- **November 18** — Krista's birthday message ("🎂 HAPPY BIRTHDAY KRISTA!! …").
- **October 10** — SMASH's anniversary / "Cash's birthday" message (references October 10, 2024 as SMASH's start; jokes about taking the company card out to celebrate).
- **Monday 7 AM–12 PM Pacific** — week-ahead summary using live stats from `GET /api/chat/weekly-summary`: dashboard task count, active fundraisers, ending this week, ended awaiting closeout.
- **Friday 2 PM–6 PM Pacific** — week-in-review: tasks completed this week, ending this week, still active. ("You earned this weekend. Now go enjoy it! 🍌")

If the model has been retired, Cash answers: "🦍 My AI brain got retired and needs a quick one-line update — I've emailed Tahni the exact fix, and I'll be back online once it's done." Generic failure bubble: "Oops, I hit a snag. Try asking again! 🍌"

---

## 11. AI extraction pipeline and model health

### What gets extracted

File: `server/src/services/mdPayoutExtractor.js`. When a **MoneyDolly Pro Payout Report PDF** arrives (manual upload in the detail modal, or the automations webhook), the PDF is sent to the Claude API with a strict prompt (`EXTRACTION_PROMPT`) that demands JSON only. Extracted values → Airtable fundraiser fields (mapping `VALUE_TO_FIELD` + `FUNDRAISER_FIELDS`):

| Extracted item (PDF line) | Airtable field ID |
|---|---|
| "Supporter Contribution Total" → gross_sales_md | `fldBUUIBsDws9RgLV` |
| "From Product" → pp_gross_automated | `fldPA0s3g4bfSrHYR` |
| "From Donation" → mddonations_gross_automated | `fldkbVwfY7f3POWcR` |
| "Platform Fee" / "Pro Platform Fee" | `flddukN9cEZHauvrg` |
| "Product Fee" | `fldCHmAuUiSR1ycMA` |
| "Prize Shop Fee" | `fldaTxoSLQDkfw86F` |
| "Product API Admin Fee" | `fldXGtz1NAThbKwnZ` |
| "SaaS Tax" (any % rate) | `fldIip9vNpcZOjMBs` |
| "Pro Payout Total" → md_payout | `fldjYCVPq9QFAbAOt` |
| "This will be paid out on:" → md_payout_date (YYYY-MM-DD) | `fldWgHa5p9t8qzwF0` |

All fees are normalized to positive numbers; absent lines return 0.

### Validation before saving

`extractMdPayoutData` checks every numeric field is a finite number and the date matches YYYY-MM-DD (failures listed as `missingFields`), then runs two cross-checks with a **$1.00 tolerance**:
1. From Product + From Donation ≈ Supporter Contribution Total. Failure warning: "From Product ($X) + From Donation ($Y) = $Z, but Supporter Contribution Total reads $W — these don't match. Please verify against the PDF."
2. Gross − all fees ≈ Pro Payout Total. Failure warning: "Gross ($X) - fees ($Y) = $Z, but Pro Payout Total reads $W — these don't match. Please verify against the PDF."

Cross-check failures produce warnings but **do not block saving** (only `missingFields` block: `success = missingFields.length === 0`). In the **manual upload flow**, a non-success extraction stops everything and shows the first warning to Krista (or "Could not read the payout report. Please check the file and try again." — `handleMdPayoutFileChange` in `FundraiserDetailModal.jsx`); note that in this flow **cross-check warnings are never shown to Krista** when extraction succeeds — the save proceeds silently. In the **webhook flow**, failure returns a 422 to the calling automation.

If the PDF isn't a MoneyDolly report or is unreadable, the model returns `readable: false` with an explanation, and nothing is written. A completely failed API call yields: "The AI extractor could not process this file: [error]".

After a successful save: values written → PDF attached (replacing) → FPR and RCR generated best-effort (Section 5).

### Model health / retirement alerting

File: `server/src/services/modelHealth.js`. Both AI features (extractor and Cash) share the `ANTHROPIC_MODEL` constant (`claude-sonnet-4-6`). If Anthropic retires the model, API calls return 404 with a "not_found_error"; `isModelNotFoundError` detects exactly that (status 404 + body containing `not_found_error` or `model:`). When detected:
- **Tahni is emailed** at tahni@smashfundraising.com (subject "⚠️ SMASH Manager Portal — Claude AI model retired, needs a code update") with the failing feature named and a paste-ready fix prompt. Throttled to once per 6 hours across both features.
- Cash tells Krista its brain was retired (Section 10); the extractor returns "The AI model has been retired and needs a one-line code update. Tahni has been emailed the exact fix."

The fix is a one-line change to the `ANTHROPIC_MODEL` constant.

---

## 12. What is NOT automated (the human checklist)

Things a person — usually Krista — must do by hand, including things that must happen **in Airtable directly** because the portal has no control for them:

**In the portal (manual clicks required):**
1. Send the ASB onboarding email (review + click Send; only the task creation is automated).
2. Generate the Fundraiser Agreement (never auto-generated).
3. Send every payment — team profit e-check/paper check, single rep commission, bulk quarterly commission, zero-commission close. Nothing pays out automatically from this app.
4. Send the Step-2 team-profit report email (or consciously skip it).
5. Enter the product cost from the supplier invoice (open frmgr.com, read the invoice, type the number).
6. Enter the manual product split for two-product MD fundraisers — the code explicitly says the breakdown "can't be detected automatically" (`ManualProductSplitCallout`, `FundraiserDetailModal.jsx`).
7. Enter card counts (ordered / sold / lost) for traditional card fundraisers.
8. Enter check numbers for daily payouts (inline cell on the Active page).
9. Mark "MD Payout received" and "Invoice payment received" — the system has no bank feed; receipt of money is always attested by a human.
10. Mark "Check/Invoice sent" for invoices (auto-checked only when a payment is sent through the portal; actual invoices are produced and sent outside the system).
11. Click "Mark as Closed Out" — closing out is never automatic.
12. Regenerate stale reports (the portal flags staleness but does not regenerate on its own — except within the MD-upload pipeline).
13. Manually upload the MD Payout Report when the webhook automation didn't match or wasn't triggered.
14. Set the MD Portal URL, assign accounting contacts, and fix readiness items before kickoff.

**Only in Airtable (no portal control exists):**
1. Creating, editing, or deleting **fundraiser records** themselves (the portal edits existing ones only).
2. Creating or editing **reps, primary contacts, accounting contacts, and products** — portal dropdowns select existing records only. (Exception: the accounting contact's paper-check preference/address IS editable from the portal.)
3. Uploading the **signed** Fundraiser Agreement and the **Invoice** file (display-only slots; the original spec states "Krista uploads documents directly in Airtable", `SMASH-Manager-Portal-Spec.md`, Document Handling).
4. Clearing the **"Org Name Needs Follow-Up"** checkbox (badge shown, no button).
5. Setting the **"rep pays ASB fee"** waiver checkbox used by the agreement.
6. Setting the **"MD Campaign ID"** on a fundraiser so the payout webhook can match it.
7. Maintaining the two quarterly-commission **Airtable views** ("Dravin's/Tahni's Quarterly Rep Commissions") that feed the bulk flow.
8. Editing most RCR adjustments (ASB fee, half prize fee, small-fundraiser adj, excess printing) and all core financial formulas — the portal edits only team↔rep, misc, extra boxes, and product cost.
9. Maintaining the Airtable Automations that generate tasks, and whatever external system runs daily payouts.
10. **Deleting tasks** — possible only by asking Cash, or in Airtable.

**Nobody is notified automatically** when: a daily payout fails (it shows in red in the portal, but no email/text goes out from this codebase), the payout webhook fails to match, report auto-generation times out, or an FPR balance check fails. The only automatic notification in the entire system is the model-retired email to Tahni.

---

## 13. Failure modes and error messages

Exact user-facing strings and their causes. (Payment-specific errors are in Section 3; extraction warnings in Section 11.)

**Login / session**
- "Incorrect password" — wrong portal password (`AuthGate.jsx` / `auth.js`).
- Silent page reload back to login — any API call after session expiry (`client.js` 401 handler).

**Page-level load failures** (server unreachable or Airtable error; each with the underlying message below it)
- "Failed to load tasks" (Dashboard); "Failed to load fundraisers" (Upcoming); "Failed to load data" (Active, Ended); "Failed to load fundraiser" (detail modal); "Loading..." states throughout.
- Server-side 500 bodies: "Failed to fetch tasks/fundraisers/upcoming fundraisers/active fundraisers/ended fundraisers/fundraiser detail/today payouts/payout summary/weekly summary/reps/contacts/accounting contacts/products" (all in the respective route files).

**Empty states**
- "No tasks" (a kanban column); "No upcoming Cash tasks"; "No upcoming fundraisers"; "No active fundraisers"; "No payouts scheduled for today"; "No ended fundraisers — all caught up!"; "No tasks linked to this fundraiser."; "No file uploaded" (document slots); "No admin notes."; "Not set" (contacts/MD portal); "No accounting contact assigned" / "No accounting contact"; "Unknown" (missing rep).

**Task operations**
- Toast "Failed to update \"[task name]\" status" — drag-and-drop save failed; card snaps back (`Dashboard.jsx`).
- "Failed to mark task as done" (`TaskDetailModal.jsx`).
- "Task name and deadline are required." (`NewTaskModal.jsx`).
- "Failed to update task" / "Failed to create task" (server 500s, `tasks.js`).

**Fundraiser editing**
- "You have unsaved changes. Discard them?" — browser confirm on closing the edit modal with changes.
- "No valid fields to update" — PATCH with an empty payload (`fundraisers.js`, `payouts.js`).
- "cost_product must be a non-negative number" (server); "Must be 0 or more" (inline, for extra boxes and product cost).
- "Both fields must be valid positive numbers." — product split validation.

**Reports / documents**
- "Manual product split required before generating reports for this two-product fundraiser." (server, code `MANUAL_SPLIT_REQUIRED`) → shown to Krista as "Please complete the product split above before generating." (`FundraiserDetailModal.jsx`).
- "[FPR/RCR] — waiting on manual product split / This is a two-product fundraiser. Enter the product split in the form above before reports can be generated."
- "Will auto-generate once MD Payout Report is uploaded." (MD fundraiser, empty report slot).
- "Make sure Qty Sold is entered above before generating." (non-MD fundraiser, data not ready).
- "This report may be out of date — regenerate to apply recent changes." (stale fingerprint).
- "Failed to generate FPR." / "Failed to generate RCR." / "Failed to generate Fundraiser Agreement." (server 500s, `reports.js`); "Generation failed" fallback.
- "Fundraiser Agreement not generated yet. Generate it before sending." + "Could not generate agreement: [reason]" (email modal).

**Uploads**
- "No file provided." — empty upload; "File is too large. Max 5 MB." — over the multer limit; "Invalid values payload." — malformed save-md-payout call; "Upload failed." (all in `fundraisers.js`).
- "Could not read the payout report. Please check the file and try again." — extraction returned unreadable (`FundraiserDetailModal.jsx`).
- "Could not identify newly uploaded file." — Airtable attachment bookkeeping failure (`airtable.js`).

**Email**
- "At least one recipient is required in \"to\"" / "Missing required fields: subject, body" (server, `email.js`); "No recipients selected — email cannot be sent." (UI); "Failed to send email"; "Gmail send failed: [Google's message]" (`gmail.js`); "Gmail config missing: [VAR NAME]" — a Gmail environment variable is unset.
- "Missing required fields: recipientEmail, subject, htmlBody" (report email route, `echeck.js`).

**Cash**
- "Oops, I hit a snag. Try asking again! 🍌" — any chat request failure.
- "That question required a lot of data lookups and I ran out of steps. Try asking something more specific!" — tool-loop limit.
- "🦍 My AI brain got retired and needs a quick one-line update — I've emailed Tahni the exact fix, and I'll be back online once it's done."
- Tool-level errors returned to the model (which Cash then explains): "No fundraiser found matching \"X\"", "No task found matching \"X\"", "Failed to execute [tool]: [error]", Drive errors "Failed to search Drive/read file/get file link: …".

**Webhook (machine-facing, `automations.js`)** — "Webhook secret not configured on server." / "Invalid or missing automation secret." / "Missing required fields: campaignId, filename, and fileBase64 are all required." / `no_fundraiser_for_campaign_id` / `multiple_matches` / "Extraction failed" / "Internal server error."

---

## 14. Environment variables and external services

Names only, grouped by the service they belong to (all read in `server/src/` files; none are used client-side):

**Airtable** (all data storage; base `appxDlniu6IPMVIVp`)
- `AIRTABLE_API_TOKEN` — used in `services/airtable.js` for every read/write and attachment upload.

**Checkbook.io** (e-checks and mailed paper checks)
- `CHECKBOOK_API_KEY`, `CHECKBOOK_API_SECRET` — auth header on every payment call (`routes/echeck.js`).
- `CHECKBOOK_ENV` — set to `sandbox` for the test environment; anything else = production.

**Anthropic / Claude API** (Cash chatbot + MD payout extraction)
- `ANTHROPIC_API_KEY` (`routes/chat.js`, `services/mdPayoutExtractor.js`).

**Google — Gmail API** (all outbound email, sent from Krista's account)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth app (shared with Drive).
- `GOOGLE_GMAIL_REFRESH_TOKEN` — the Gmail-scope token (`services/gmail.js`).
- `GMAIL_SEND_AS` — the From address.

**Google — Drive API** (Cash's document search)
- `GOOGLE_REFRESH_TOKEN` — a separate Drive-scope token (`services/google-drive.js`). Note this is distinct from the Gmail token.

**Portal itself**
- `PORTAL_PASSWORD` — the shared login password (`routes/auth.js`; also the session-secret fallback).
- `SESSION_SECRET` — cookie-signing secret (`index.js`; falls back to `PORTAL_PASSWORD`, then the literal `'fallback-secret'`).
- `MD_PAYOUT_WEBHOOK_SECRET` — shared secret for the Pipedream-facing webhook (`routes/automations.js`).
- `PORT` (default 3001), `NODE_ENV` (`production` enables secure cookies and serving the built frontend; anything else enables CORS for the local dev server) — `index.js`.

**External services with no credentials in this app:** frmgr.com (linked for supplier invoices), the Squarespace CDN (hosts the signature-block logo image), MoneyDolly (source of payout PDFs and the per-fundraiser "MD Portal URL"), Railway (hosting, per the spec), and whatever external system (Airtable Automations / Pipedream) runs task generation and the daily payout engine.

---

## 15. Known TODOs, FIXMEs, and dead code

**TODO/FIXME/HACK comments:** a repo-wide search (`grep -rniE "TODO|FIXME|HACK|XXX"` over `server/src` and `client/src`) found **none**. The codebase carries no flagged unfinished work.

**Dead, unused, or vestigial items found by inspection:**
- `FUNDRAISER_PAYOUT_FIELDS.memo` (`fldS42L5aYr2bOMlP`) and `.payout_id` are defined in `server/src/services/airtable.js` but never written or read — bulk-check memos go into Checkbook's `description`, not this field.
- The root `package.json` lists `googleapis` and `open` as dependencies of the *repo root* (not the server), with no root-level code using them — most likely leftovers from a one-time OAuth token-generation script that is no longer in the repo.
- `Lock` is imported but unused in `client/src/components/FundraiserDetailModal.jsx`.
- The products-table name field ID `'fldUgmP61xsxj5tie'` is hard-coded inline at `server/src/routes/reports.js` line 44 even though `PRODUCT_FIELDS.name` already holds the same ID; similarly `PRODUCT_PROFIT_PCT_FIELD = 'fldgThkrxMzkurPK7'` lives only in `reports.js` rather than the central field map.
- Krista's signature HTML exists in three copies (`echeck.js`, `email.js`, `ECheckPreviewModal.jsx`) — an edit to one does not propagate.
- The spec (`SMASH-Manager-Portal-Spec.md`) references `territories` and `resources` Airtable tables that no code touches.
- `getUpcomingFundraisers`, `getActiveFundraisers`, and `getEndedFundraisers` in `server/src/routes/fundraisers.js` are three near-identical ~150-line copies of the same resolution logic — not dead code, but triplicated logic where a fix to one is easy to miss in the others.
- The spec describes several behaviors the shipped code replaced (status *toggles* instead of drag-and-drop; a read-only Cash; no uploads from the portal; an "On Deck" dashboard section; five document slots) — the spec should be treated as historical, with the code as the truth.

---

## 16. Gaps & Open Questions

Things the code cannot answer, plus inconsistencies a manual-writer should resolve with Tahni before publishing:

1. **The status_rendered formula lives in Airtable.** The exact conditions that flip a fundraiser between Upcoming / In Progress / Campaign Ended / Ready to Close (especially what precisely triggers "Ready to Close") cannot be verified from this repo — only the summary in Cash's prompt exists here.
2. **The daily e-check payout engine is entirely external.** Which system creates `daily_payouts` records at 2 PM, sends money at 12:15 AM, sets statuses/error messages, and whether anyone is alerted on failure besides the portal's red banner — all unknown from this code.
3. **The Airtable task-generation automations are undocumented here.** Which lifecycle events create which tasks (including the money-moving `echeck:` tasks and the quarterly bulk tasks), their deadlines/show dates, and their exact wording are configured in Airtable. The manual's task catalogue must be sourced from Airtable directly.
4. **Task-visibility inconsistency:** Cash's system prompt and the New/Edit Task helper text both describe a "show 1 month before deadline" rule for tasks without a show_date, but `Dashboard.jsx` shows such tasks immediately. Krista may be told one thing by Cash and see another on the board.
5. **Bulk-send idempotency gap:** the bulk rep-commission Checkbook key embeds a timestamp (`bulk-rep-{repKey}-{Date.now()}`, `echeck.js` line 264), so retrying after an ambiguous failure could theoretically double-pay; single sends do not have this weakness. Worth an operating rule: after a bulk-send error, verify in Checkbook before retrying.
6. **The product-split "must add up exactly" claim is not enforced.** The UI text says the split must equal the MD report's combined gross, but the code accepts any two non-negative numbers (`ManualProductSplitCallout`). A wrong split flows straight into the reports.
7. **Cross-check warnings from AI extraction are invisible in the manual-upload flow.** If Claude's numbers pass field validation but fail the balance cross-checks, the save proceeds and Krista is never shown the warnings (`handleMdPayoutFileChange` only surfaces warnings when `success` is false, and cross-check failures don't set success false). The FPR's own $0.05 balance check likewise only logs to the server console.
8. **The webhook matches on a field *name*** (`{MD Campaign ID}` in `automations.js`) — the only name-based lookup in a codebase that otherwise religiously uses field IDs. Renaming that field in Airtable breaks the automation silently (payout reports would start returning "no match" to Pipedream).
9. **Close-out gating is advisory.** The Ready-to-Close checks only control where the button appears; the detail-modal dropdown and Cash can close out (or cancel) any fundraiser at any time with no checks and no confirmation.
10. **"Mark as Closed Out" is hard to undo in practice** — no confirmation, and the fundraiser immediately disappears from every list. Recovery requires Cash, Airtable, or knowing the deep-link URL.
11. **No visual indicator of Checkbook sandbox vs production.** If `CHECKBOOK_ENV` were misconfigured, Krista would have no way to tell from the UI whether real money is moving.
12. **Single shared login, no audit trail of who did what.** Anyone with the password is "Krista" as far as the system is concerned; Airtable record history would show only the API token's identity.
13. **The invoice lifecycle is mostly outside the system.** The portal tracks "Check/Invoice sent" and "Invoice payment received" checkboxes and displays an uploaded invoice file, but who generates invoices, from what template, and how they're delivered is not in this codebase.
14. **The "Awaiting PO/Rep" status** exists as an override option and a status color, but no page filters for it — an on-hold fundraiser appears wherever its dates place it or drops off lists entirely; unclear whether that is intended.
15. **`rep_pays_asb_fee` and `organization_name_needs_follow_up`** are read by the portal but only settable in Airtable — confirm whose job it is to maintain them.
16. **Ended-page "open tasks" asymmetry:** the Needs Action section keys off *manager* open tasks (`open_manager_tasks_count`), but the task badges on Active/Ended cards show all non-Done tasks including Cash's — a card can show task badges while sitting in "Waiting".
17. **The spec vs. the build:** `SMASH-Manager-Portal-Spec.md` is v1.0 from March 2026 and no longer matches the shipped product in several places (see Section 15). Anyone writing the manual should work from this document and the live app, not the spec.
18. **Timezone edge cases in client-side date math:** several visibility windows (Done-card 2-day linger, Cash's 3-day lookahead, "today" in the status bar) use the browser's local ISO date rather than Pacific time, so behavior can shift for a user traveling across timezones. Server-side payout logic does use Pacific consistently.

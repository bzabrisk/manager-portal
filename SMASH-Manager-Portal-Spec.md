# SMASH Manager Portal — Product Specification

**Version**: 1.0
**Date**: March 13, 2026
**Primary User**: Krista (Office Manager)
**Owner**: Tahni (SMASH Fundraising)

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Authentication](#authentication)
4. [Navigation & Sidebar](#navigation--sidebar)
5. [Page 1: Tasks / Dashboard](#page-1-tasks--dashboard)
6. [Page 2: Upcoming Fundraisers](#page-2-upcoming-fundraisers)
7. [Page 3: Active Fundraisers](#page-3-active-fundraisers)
8. [Page 4: Ended Fundraisers](#page-4-ended-fundraisers)
9. [Fundraiser Detail View](#fundraiser-detail-view)
10. [Cash AI Chatbot](#cash-ai-chatbot)
11. [Airtable Schema Reference](#airtable-schema-reference)
12. [Airtable Fields to Add](#airtable-fields-to-add)
13. [Design Principles](#design-principles)

---

## Overview

The SMASH Manager Portal is an internal admin tool for Krista, the SMASH Fundraising office manager. It provides a centralized view of all fundraiser operations — tasks, fundraiser lifecycle tracking, daily payouts, and closeout workflows — backed by Airtable as the source of truth.

The portal replaces Krista's current workflow of navigating Airtable views directly. It should feel intuitive, hand-hold Krista through what needs to get done, and surface the right information at the right time without requiring her to hunt for it.

### Key Design Goals

- **Pure functionality**: Smooth, intuitive, not clunky. Every element earns its place.
- **Task-driven**: The dashboard answers "what do I need to do right now?" before Krista clicks anything.
- **Lifecycle-aware**: Fundraisers flow through Upcoming → Active → Ended → Closed Out, and the portal mirrors that journey.
- **"Cash" as a teammate**: Automated actions are personified as "Cash," the digital assistant, giving Krista visibility into what automations are doing and building her trust in the system.

---

## Tech Stack & Architecture

### Core Stack

- **Frontend**: Built from scratch (framework TBD — React recommended)
- **Backend**: Node.js or similar, hosted on **Railway**
- **Source control**: **GitHub**
- **Data layer**: **Airtable** (source of truth for all data)
- **Automations**: **Airtable Automations** for auto-generated tasks; **Pipedream** for webhook-triggered workflows
- **AI Chatbot**: **Claude API** (Sonnet) for the Cash chatbot

### Data Sync Strategy

- **Airtable → Portal**: Polling approach. The portal backend polls Airtable on a 2-3 minute interval for data refresh. No real-time push needed — Krista isn't refreshing constantly.
- **Portal → Airtable**: Direct Airtable API writes when Krista takes actions (updating tasks, toggling checkboxes, editing notes, marking payouts received).
- **Pipedream**: Webhook buttons in the portal trigger Pipedream workflows for complex multi-step automations.

### Document Handling

- **Viewing/downloading PDFs**: Supported from the portal. Airtable attachment URLs are temporary (expire after ~2 hours), so the portal fetches fresh URLs from the Airtable API each time a user clicks to view/download a document.
- **Uploading PDFs**: Not supported in the portal at launch. Krista uploads documents directly in Airtable. This can be revisited if it becomes a pain point.

---

## Authentication

**Simple password gate.** A single shared password protects the portal since only Krista uses it.

- The portal is hosted on a public Railway URL, so auth is required to protect real business data.
- On first visit (or after session expiry), Krista sees a password prompt.
- After entering the correct password, a session cookie keeps her logged in.
- Password is stored as an environment variable on Railway (not hardcoded).

---

## Navigation & Sidebar

**Always-expanded left sidebar with labels.** Visible on every page.

### Sidebar Items

1. **Dashboard** (Tasks) — Default landing page
   - Badge: count of active Krista tasks (status = "To do" or "Doing")
2. **Upcoming** — Upcoming fundraisers
   - Badge: count of upcoming fundraisers with at least one incomplete readiness indicator
3. **Active** — In-progress fundraisers
   - Badge: count of active fundraisers. Red dot if any daily payouts have status = "failed" today
4. **Ended** — Ended but not closed-out fundraisers
   - Badge: count of fundraisers in the "Needs Action" section (open_manager_tasks_count > 0)
5. **Cash** (AI chatbot) — At the bottom of sidebar, distinct from nav items. Chat bubble icon. Opens floating chat overlay.

### Navigation Behavior

- The **Fundraiser Detail View** is not a sidebar entry — it's accessed by clicking a fundraiser name/badge from any page.
- A **back button** on the detail view returns Krista to whichever list page she came from.
- Sidebar badges update on each data refresh.

---

## Page 1: Tasks / Dashboard

This is Krista's home screen. It answers "what do I need to do right now?"

### Cash Status Bar

A single line at the top of the page summarizing Cash's activity.

Example: *"Cash has 2 tasks scheduled today. Last completed: Sent daily payout for Elma HS Soccer (Mar 11)."*

Built by querying: count of Cash's tasks where status = "To do" and deadline = today, plus the most recent Cash task with status = "Done."

### Section 1: Krista's Tasks

**Filter**: Assignee = "Office Manager", status = "To do" or "Doing", show_date ≤ today.
**Sort**: Deadline ascending (most urgent first).

**Each task card displays:**

| Element | Details |
|---------|---------|
| Task name | Primary text |
| Fundraiser badge | Clickable chip showing org + team (e.g. "Lakes HS Girls Tennis"). Links to fundraiser detail page. Hidden if no fundraiser linked. |
| Deadline | Color-coded: gray = 3+ days out, yellow = due tomorrow, red = due today or overdue |
| Status toggle | Inline toggle: To do → Doing → Done (no modal needed) |
| Action button | External link icon. Only renders if `action_url` field has a value. Opens in new tab. |
| Edit button | Always present. Opens editable form: task name, description, deadline, fundraiser link, action_url, status. |

### Completed Today Strip

Tasks marked "Done" in the last 24 hours show in a muted row at the bottom of Section 1. After 24 hours, they disappear from this view entirely.

### On Deck Section (collapsed by default)

Tasks where `show_date` is in the future (within the next 7 days) OR status = "On deck."

- Collapsed by default — Krista clicks to expand.
- Same card layout as active tasks but visually muted.
- Allows Krista to peek ahead without being distracted.

### Section 2: Cash's Tasks

**Filter**: Assignee = "Cash", status ≠ "Done".
**Sort**: Deadline ascending.

Visually distinct from Krista's section (different background tint or Cash icon/avatar).

**Each task card displays:**

| Element | Details |
|---------|---------|
| Task name | Primary text |
| Fundraiser badge | Same as Krista's tasks |
| Deadline | Same color coding as Krista's tasks |
| Status chip | Read-only: On deck / To do / Doing / Done |
| Edit button | **Deadline only** — opens a simple date picker, not a full edit form |

Cash's tasks are **not** toggleable by Krista — they complete via automation.

### New Task Button

Pinned/always accessible. Opens a creation form:

| Field | Required | Default |
|-------|----------|---------|
| Task name | Yes | — |
| Description | No | — |
| Deadline | Yes | — |
| Fundraiser link | No | Dropdown of non-closed fundraisers |
| Action URL | No | — |
| Status | Auto | "To do" |
| Creation method | Auto | "Manual" |
| Assignee | Auto | "Office Manager" (always — Krista cannot assign to Cash) |

---

## Page 2: Upcoming Fundraisers

The pre-flight checklist view. Shows fundraisers that haven't started yet.

**Filter**: `status_rendered` = "Upcoming" (kickoff_date is in the future).
**Sort**: `kickoff_date` ascending (soonest first). Flat list, no grouping.

### Each Fundraiser Card

**Header row:**
- **Organization + Team** (clickable → fundraiser detail page), e.g. "Mount Tahoma High School — Girls Tennis"
- **Kickoff date with countdown**: "Starts Mar 17 (5 days)" — color-coded: green = 7+ days, yellow = 3-6 days, red = under 3 days
- **End date** (smaller/secondary)

**Key info row:**
- Rep name
- Product (primary)
- ASB/Boosters type
- Primary contact name
- Accounting contact name (or **warning indicator** if empty)

**Readiness checklist** (small checkmark/warning icons):

| Check | Condition | When Shown |
|-------|-----------|------------|
| Accounting contact assigned | `accounting_contact` is not empty | Always |
| MD Portal URL set | `MD Portal URL` is not empty | Always |
| ASB intro email sent | Linked "Send ASB Onboarding Email" task has status = "Done" | Only when `asb_boosters` = "WA State ASB" |
| Cookie dough presale submitted | Linked presale task has status = "Done" | Only when `product_primary` name contains "Cookie Dough" |

**Task count badge**: "2 open tasks" — clickable, links to dashboard filtered to that fundraiser's tasks. Hidden if 0 open tasks.

---

## Page 3: Active Fundraisers

Shows fundraisers currently running, plus today's daily payout status.

### Section 1: Active Fundraisers List

**Filter**: `status_rendered` = "In Progress".
**Sort**: `end_date` ascending (ending soonest first).

**Each fundraiser row:**

| Element | Details |
|---------|---------|
| Organization + Team | Clickable → detail page |
| Rep name | — |
| Date range | "Mar 6 – Mar 22" with thin progress bar showing % of campaign elapsed |
| Days remaining | "9 days left" — yellow under 5 days, red under 2 |
| Gross sales | `gross_sales_md`, displayed as currency. Dash if not yet available. |
| Task count badge | "2 open tasks" clickable → filtered dashboard. Hidden if 0. |

### Section 2: Today's Payouts

**Filter**: daily_payouts where `run_date` = today.
**Sort**: By status priority: failed → awaiting_data → pending → sent.

**Failed payout alert**: If any payouts have status = "failed," a **red banner** appears at the top of this section showing the count and fundraiser name(s), with error message visible.

**Compact table layout:**

| Column | Source |
|--------|--------|
| Org + Team | Compact format (e.g. "Mark Morris — Baseball") |
| Payee | Accounting contact name |
| Payout amount | Currency. $0.00 rows are **included** but visually muted (lighter text). |
| Status chip | awaiting_data (blue), pending (yellow), sent (green), failed (red) |

---

## Page 4: Ended Fundraisers

The triage view. Shows fundraisers that have ended but aren't closed out yet. Split into two sections based on whether Krista has active tasks.

**Filter**: `status_rendered` = "Campaign Ended" OR "Ready to Close."
**Sort** (both sections): `end_date` ascending (oldest ended first — sitting longest = most urgent).

### Section 1: Needs Action

Fundraisers where `open_manager_tasks_count` > 0. Krista has something to do.

### Section 2: Waiting

Fundraisers where `open_manager_tasks_count` = 0. Nothing for Krista to do — she just needs to see why it's stuck.

### Card Layout (both sections)

Cards are **clickable → fundraiser detail page**. Simplified to support quick scanning:

| Element | Details |
|---------|---------|
| Organization + Team | Clickable → detail page |
| Rep name | — |
| End date | + "ended X days ago" |
| Gross sales | `gross_sales_md` |
| MD Payout Received | If checked: green checkmark. If unchecked: **"Mark Received" button** — saves immediately to Airtable on click, card updates in place (no confirmation, no navigation). |
| Waiting badges | Chips for all active waiting conditions (shown in both sections) |
| Task count badge | Clickable → filtered dashboard. Only shown if open tasks exist. |

### Waiting Badge Logic

Four possible badges. A fundraiser can have multiple simultaneously. Only shown when the condition is true:

| Badge | Color | Condition |
|-------|-------|-----------|
| Waiting on MD Payout | Blue | `MD Payout $ Received` is unchecked |
| Needs Accounting Contact | Yellow | `accounting_contact` is empty |
| Org Name Needs Follow-Up | Orange | `organization_name_needs_follow_up` is checked |
| Needs Card Count | Red | `product_primary_string` = "Team Cards - Traditional No-Risk" AND `cards_sold_manual` is empty |

All waiting logic lives in **frontend code**, not Airtable formulas.

### "Mark MD Payout Received" Button Behavior

1. Saves immediately on click (no confirmation dialog)
2. Writes `true` to `MD Payout $ Received` in Airtable
3. Card updates in place: checkmark replaces button, "Waiting on MD Payout" badge disappears
4. Stays on the Ended page (no navigation)
5. If this triggers `status_rendered` to change (e.g., to "Ready to Close") and a closeout task auto-generates via Airtable automation, the fundraiser may shift from Section 2 to Section 1 on the next data refresh

---

## Fundraiser Detail View

The hub page that ties everything together. Accessed by clicking a fundraiser name/badge from any list page. Works across all lifecycle stages (upcoming through closed out) — sections show or hide based on available data.

### Header Area

- **Organization — Team** as the page title
- **Status chip** (`status_rendered`) with color coding: Upcoming (blue), In Progress (yellow), Campaign Ended (orange), Ready to Close (purple), Closed Out (green), Cancelled (red)
- **Date range**: with progress bar when in progress, plain dates otherwise
- **Back button**: returns to whichever list page Krista came from

### Save / Cancel Bar (sticky at bottom of page)

| Element | Behavior |
|---------|----------|
| Save button | **Grayed out / disabled** when no changes made. Becomes **colored / active** when any editable field is modified. Saves all pending changes to Airtable in one batch API call. |
| Cancel button | Always visible. If no unsaved changes: navigates back (same as back button). If unsaved changes: shows "Discard changes?" confirmation before navigating. |
| Back button | Same behavior as Cancel — prompts if unsaved changes exist. |

**Editable fields that batch-save together**: the three closeout checkboxes and admin_notes (up to 4 fields in one Airtable update call).

### Section 1: Key People

| Field | Source |
|-------|--------|
| Rep | Name from linked rep record |
| Primary contact | Name, email, phone (from linked client_book record) |
| Accounting contact | Name, email, payment method, status (from linked accounting_contact record). **Warning indicator if empty.** |

### Section 2: Fundraiser Setup

| Field | Condition |
|-------|-----------|
| Product (primary) | Always shown |
| Product (secondary) | Only if populated |
| ASB/Boosters type | Always shown |
| Team size | Always shown |
| Cards ordered / Cards sold / Cards lost | **Only if `product_primary_string` contains "Traditional"** |
| MD Portal URL | **Always shown** as clickable "Open MD Portal" button |

### Section 3: Financials

Only shows fields that are populated. For an upcoming fundraiser this section may be mostly empty; for a closed-out one it shows the full picture.

Summary grid:

| Metric | Field |
|--------|-------|
| Gross Sales | `gross_sales_md` |
| Team Profit | `final_team_profit` |
| Invoice Amount | `final_invoice_amount` |
| Rep Commission | `rep_commission` |
| SMASH Profit | `smash_profit` |
| MD Payout | `MD Payout` |

### Section 4: Closeout Checklist (editable — saves with Save button)

Three checkboxes, in this order:

1. **MD Payout received** (`MD Payout $ Received`)
2. **Check/Invoice sent** (`Check/invoice sent`)
3. **Rep paid** (`Rep paid`)

Changes are staged and saved when Krista clicks the Save button (not immediately on toggle).

### Section 5: Documents

**All five document slots are always shown**, regardless of whether a file exists.

| Document | Field |
|----------|-------|
| Fundraiser Agreement | `fundraiser_agreement` |
| Fundraiser Profit Report | `fundraiser_profit_report` |
| Rep Commission Report | `rep_commission_report` |
| Invoice | `Invoice` |
| MD Payout Report | `MD Payout Report` |

**Two states per slot:**
- **File exists**: Show filename as a clickable download/open link. Portal fetches a fresh Airtable attachment URL on click.
- **No file**: Show empty-state placeholder (grayed-out card with "No file uploaded" or dashed border).

**No upload functionality from the portal.** Krista uploads documents in Airtable.

### Section 6: Tasks

All tasks linked to this fundraiser (both Krista's and Cash's). Same card layout as the Dashboard.

Includes a **"New Task" button** pre-linked to this fundraiser (the fundraiser field is pre-filled in the creation form).

### Section 7: Daily Payouts (conditionally shown)

**Only visible when `asb_boosters` = "WA State ASB."** Hidden for all other fundraiser types (daily payouts only apply to WA State ASB fundraisers).

Compact table of all daily payouts linked to this fundraiser.
**Sort**: `run_date` descending (most recent first).

| Column | Source |
|--------|--------|
| Date | `run_date` |
| Gross that day | `gross_sales_today` |
| Payout amount | `payout_amount` |
| Status | Status chip (awaiting_data / pending / sent / failed) |
| Reference number | `reference number` |

### Section 8: Notes (admin_notes editable — saves with Save button)

| Field | Behavior |
|-------|----------|
| Admin notes (`admin_notes`) | Editable text area. Changes saved with the Save button. |
| Rep notes (`rep_notes`) | **Read-only.** This is the comment thread from reps. |

---

## Cash AI Chatbot

An AI-powered chat interface where Krista can ask natural language questions about Airtable data.

### Interface

- **Floating chat bubble** that overlays the current page.
- Accessible from the sidebar (bottom item, chat bubble icon).
- Clicking opens a chat panel; clicking again (or an X) closes it.
- Krista's current page remains visible behind the overlay.
- Chat history persists within the session but does not need to persist across sessions.

### Architecture

```
Krista types question
    → Portal frontend sends to Railway backend
        → Backend sends to Claude API (Sonnet) with:
            - System prompt ("You are Cash, the SMASH Fundraising assistant")
            - Tool definitions for querying Airtable
            - Krista's message
        → Claude decides which Airtable queries to run (tool use)
        → Backend executes those Airtable API calls
        → Results returned to Claude
        → Claude synthesizes a natural language response
    → Response displayed in chat panel
```

### Claude Tools (read-only at launch)

| Tool | Description |
|------|-------------|
| `search_fundraisers` | Query fundraisers by status, date range, rep, org name, product, etc. |
| `search_tasks` | Query tasks by assignee, status, fundraiser, deadline |
| `search_payouts` | Query daily payouts by date, fundraiser, status |
| `get_fundraiser_details` | Pull all fields for a specific fundraiser by ID or name |

### System Prompt Guidelines

The system prompt for Cash should:
- Describe the SMASH data model (tables, key fields, relationships)
- Define the fundraiser lifecycle (Upcoming → In Progress → Campaign Ended → Ready to Close → Closed Out)
- Explain what each status means
- Know the product types and their differences
- Respond conversationally — Cash is a teammate, not a database query tool

### Cost Estimate

Claude Sonnet at ~$3/M input tokens and ~$15/M output tokens. Even 50 questions/day would cost well under $1/month.

### Future Enhancement (not at launch)

Cash could also **write** data — "Create a task for Lincoln HS to send the ASB email by Friday." Start read-only, add write capabilities once the query side is trusted.

---

## Airtable Schema Reference

### Base

- **Name**: Fundraiser Organizer - synced to portal
- **ID**: `appxDlniu6IPMVIVp`

### Tables

| Table | ID | Purpose |
|-------|-----|---------|
| fundraisers | `tbl7aH2mtkAGC9jk9` | Core fundraiser records |
| reps | `tbljkTGJ7y1WmkXw0` | Sales reps |
| client_book | `tblq3raxwvAZlh4Im` | Primary contacts (coaches, etc.) |
| accounting_contact | `tblw4wHSfztIJDBj8` | Accounting/payment contacts |
| products | `tblkppUiIEMjxIjmB` | Fundraiser product types |
| tasks | `tblA1Rndmnrey0e6L` | Task records (manual + auto-generated) |
| territories | `tblRo6n5FHeJfQlxb` | Rep territories |
| resources | `tbl5U4nQOOht9260f` | Resource links/files |
| daily_payouts | `tblxoqfVPg322jNqA` | Daily payout records |

### Key Fundraiser Fields

| Field | ID | Type | Notes |
|-------|----|------|-------|
| Fundraiser ID | `fldALod2koNbrdzvH` | formula | Primary field, e.g. "181-Rainer High School Baseball-Spring 2026" |
| organization | `fldxsdVs28DhSdbuw` | singleLineText | |
| team | `fldx47Bwh7kPFlbYD` | singleLineText | |
| rep | `fldKVtinL60lTrFzl` | multipleRecordLinks → reps | |
| primary_contact | `fldU9j8KNl0prGM0t` | multipleRecordLinks → client_book | |
| accounting_contact | `fld6tNYzxnpV9EPX3` | multipleRecordLinks → accounting_contact | |
| product_primary | `fldwq9D0y9YCU2dX4` | multipleRecordLinks → products | |
| product_secondary | `fldtIIUJvUtMyXusQ` | multipleRecordLinks → products | |
| asb_boosters | `fldMCr5g20kATvA2s` | singleSelect | Options: "WA State ASB", "School - other than WA State ASB", "Booster Club" |
| kickoff_date | `fldbfZFcJj52SnB5C` | date | |
| end_date | `fldEFQYQLPlh26i6O` | date | |
| status_rendered | `fldnx3K4heNUqs96t` | formula | Values: "Upcoming", "In Progress", "Campaign Ended", "Ready to Close", "Closed Out", "Cancelled", "Awaiting PO/Rep" |
| manual_status_override | `fldFHxyf9DHd1qscd` | singleSelect | Options: "Cancelled", "Awaiting PO/Rep", "Ready to Close", "Closed Out" |
| gross_sales_md | `fldBUUIBsDws9RgLV` | currency | |
| final_team_profit | `fldWu3s6so1xByWwr` | formula | |
| final_invoice_amount | `fldD1KsRcsfc0lbcZ` | formula | |
| rep_commission | `fldLSmaj4JksmsNUh` | formula | |
| smash_profit | `fld2ZsDnr8ZIKzsL5` | formula | |
| MD Payout | `fldjYCVPq9QFAbAOt` | currency | |
| MD Payout $ Received | `fldKflCSEtVXCkj9I` | checkbox | |
| Check/invoice sent | `fld6HUrMft9MsDfIL` | checkbox | |
| Rep paid | `fld11dZXfenyqzQbe` | checkbox | |
| organization_name_needs_follow_up | `fldRT8zcP6WrSacBM` | checkbox | |
| cards_ordered | `fldzkXsedFeBVLAfK` | number | |
| cards_sold_manual | `fldqhwtTuxnNHfsCp` | number | |
| cards_sold | `fldfqPmHKccZr6QEb` | formula | |
| team_size | `fldbQKlx5bpBBHCiL` | number | |
| MD Portal URL | `fldrZzkK8XNNDqqOQ` | url | |
| admin_notes | `fldyB1gmXNXtM2ymV` | multilineText | |
| rep_notes | `fldbcDRWd7AHtdkh9` | multilineText | |
| Tasks | `fldKhDyGO2IHj7Ru8` | multipleRecordLinks → tasks | |
| daily_payouts | `fldZOe15DJT4G61Bh` | multipleRecordLinks → daily_payouts | |
| fundraiser_agreement | `fld3EdTDzU7YDRK4T` | multipleAttachments | |
| fundraiser_profit_report | `fldDX1jRdrNc1zepO` | multipleAttachments | |
| rep_commission_report | `fld4hTL0dMQTCnoPG` | multipleAttachments | |
| Invoice | `fldX31hTUnVFuafhN` | multipleAttachments | |
| MD Payout Report | `fldYcxmoXJ16uuAE6` | multipleAttachments | |

### Key Task Fields

| Field | ID | Type | Notes |
|-------|----|------|-------|
| Task Name | `fldiQjD8PPe18QThz` | singleLineText | |
| Task Description | `fldFN6LItax00X18m` | multilineText | |
| Status | `fldibO3tFh4ms0it7` | singleSelect | Options: "On deck", "To do", "Doing", "Done" |
| Assignee | `fldJpqDYWaWtQdDXu` | multipleRecordLinks → reps | Links to "Office Manager" for Krista, "Cash" for automated tasks |
| Deadline | `fldMXHF3x37QyGdRV` | date | |
| show_date | (newly created) | date | When the task becomes visible on the dashboard |
| action_url | (newly created) | url | External link for completing the task |
| Creation method | `fldtOO8JlwZu1Uhui` | singleSelect | Options: "Auto-generated", "Manual" |
| Fundraisers | `flddkpCSJb2MUIMLU` | multipleRecordLinks → fundraisers | |
| created_at | `fldxWDRScYq2gkogl` | date | |

### Key Daily Payout Fields

| Field | ID | Type | Notes |
|-------|----|------|-------|
| payout_id | `fldWDuLeQbiscnP0J` | formula | e.g. "po875" |
| fundraiser | `fldrpEVdAfBhpSB32` | multipleRecordLinks → fundraisers | |
| accounting_contact | `fldGM5JgFiXU7rFMb` | multipleRecordLinks → accounting_contact | |
| accounting_contact_name | `fldwjOR1VrcFaPcTL` | formula | |
| run_date | `fld1sArgKrWLemvTx` | dateTime | |
| gross_sales_today | `fldSUT1FxxucUb65Q` | currency | |
| gross_sales_last_payout | `fldDMGxRC1AQ1YP6y` | currency | |
| payout_amount | `fld6EieozqJRIcjeu` | formula | gross_today - gross_last_payout |
| status | `fldSFFGZe6WsyGluk` | singleSelect | Options: "awaiting_data", "pending", "sent", "failed" |
| reference number | `fldOsL9CZyodprYzK` | singleLineText | |
| error_message | `fldQgdZBqUonHMFMO` | multilineText | |
| organization (lookup) | `fldCeq63Ak9faXCdo` | multipleLookupValues | |
| team (lookup) | `fldPl4uWY8ugNeAqf` | multipleLookupValues | |

---

## Airtable Fields to Add

These fields need to be created to support the portal:

### In the tasks table

**Field: `is_open_manager_task`** (formula)

```
IF(
  AND(
    {Status} != "Done",
    FIND("Office Manager", ARRAYJOIN({Assignee})) > 0
  ),
  1,
  0
)
```

Outputs 1 for tasks assigned to Office Manager that aren't Done, 0 otherwise. Used by the rollup on the fundraisers table.

### In the fundraisers table

**Field: `open_manager_tasks_count`** (rollup)

- Linked record field: `Tasks`
- Field to roll up: `is_open_manager_task`
- Aggregation formula: `SUM(values)`

Used to split the Ended page into "Needs Action" (> 0) vs "Waiting" (= 0).

**Field: `product_primary_string`** (lookup — already created)

Pulls the Name from the linked `product_primary` record. Used for frontend logic like "contains Traditional" checks without resolving linked records.

### In the tasks table (already created)

**Field: `show_date`** (date) — When the task becomes visible on the dashboard.

**Field: `action_url`** (url) — External link for completing the task.

### Assignee setup

Add a **"Cash"** record to the reps table (alongside the existing "Office Manager" record) so that Cash tasks can be assigned via the existing Assignee linked field.

---

## Design Principles

### For Krista

- **Hand-holding UX**: Every screen should make it obvious what needs to be done next. Badges, color coding, and task counts do the talking.
- **Minimize clicks**: Status toggles are inline, action buttons are on the card, confirmations are skipped where safe.
- **No dead ends**: Every piece of data connects to its context. Task → Fundraiser. Fundraiser → Tasks. Payout → Fundraiser.
- **Progressive disclosure**: Don't overwhelm. On Deck is collapsed. Financials only show populated fields. Documents show empty states gracefully.

### For the codebase

- **Airtable is the source of truth**: The portal reads and writes to Airtable. It does not maintain its own database.
- **Field IDs over field names**: Always reference Airtable fields by ID (e.g. `fldKflCSEtVXCkj9I`), not by name. Names can change; IDs are stable.
- **Batch writes where possible**: The detail view save button collects all changes and sends one Airtable update call.
- **Keep waiting logic in frontend**: The four waiting conditions on the Ended page are simple field checks — no need for complex Airtable formulas.

### Color Coding Reference

**Deadline colors**: Gray (3+ days), Yellow (due tomorrow), Red (due today or overdue)

**Fundraiser countdown colors**: Green (7+ days to kickoff), Yellow (3-6 days), Red (under 3 days)

**Days remaining colors (active)**: Yellow (under 5 days), Red (under 2 days)

**Payout status chips**: awaiting_data (blue), pending (yellow), sent (green), failed (red)

**Waiting badges**: Waiting on MD Payout (blue), Needs Accounting Contact (yellow), Org Name Needs Follow-Up (orange), Needs Card Count (red)

**Fundraiser status chips**: Upcoming (blue), In Progress (yellow), Campaign Ended (orange), Ready to Close (purple), Closed Out (green), Cancelled (red)

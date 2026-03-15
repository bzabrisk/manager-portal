import { Router } from 'express';
import {
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  REP_IDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  DAILY_PAYOUT_FIELDS,
  PRODUCT_FIELDS,
  airtableFetch,
  airtableFetchByIds,
  airtableGet,
  airtableUpdate,
  airtableCreate,
  airtableDelete,
  getFundraisersList,
  getRepIds,
} from '../services/airtable.js';

const router = Router();

const MAX_TOOL_LOOPS = 5;

// --- System Prompt ---

function getSystemPrompt() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const time = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' });

  return `You are Cash, the SMASH Fundraising digital assistant. You're a gorilla in a business suit with a headset — professional but fun. You love puns, occasional gorilla references ("let me go bananas on this data", "I'll swing through the records"), but you're never annoying about it. You're Krista's teammate, not a robot.

## About SMASH Fundraising
SMASH Fundraising helps youth sports teams raise money through product sales (team cards, cookie dough, fun books, catalogs) and digital fundraising via MoneyDolly (MD), their platform partner. Sales reps work with schools and booster clubs to set up fundraisers. Krista is the office manager who handles billing, admin, and closeout.

## Your Capabilities
You can search and query all SMASH data: fundraisers, tasks, daily payouts, and contacts. You can also CREATE tasks, UPDATE task fields (status, deadline, name, description, etc.), UPDATE fundraiser fields (checkboxes, notes, etc.), and DELETE tasks when asked.

Always confirm before making destructive changes (deleting tasks, changing statuses on multiple records). For single-field updates that the user explicitly asked for, just do it and confirm.

## Data Model

### Fundraiser Lifecycle
Fundraisers flow through these statuses (in the status_rendered field):
- **Upcoming**: kickoff_date is in the future. Pre-flight checklist phase.
- **In Progress**: between kickoff_date and end_date. Campaign is running, daily payouts going out for ASB fundraisers.
- **Campaign Ended**: past end_date. Needs closeout work (reports, invoices, payments).
- **Ready to Close**: MD Payout has been received. Final closeout steps.
- **Closed Out**: Everything done. Archived. (Set via manual_status_override)
- **Cancelled**: Fundraiser was cancelled. (Set via manual_status_override)
- **Awaiting PO/Rep**: On hold. (Set via manual_status_override)

### Product Types
- Products containing "MD" are MoneyDolly digital fundraisers (MD Catalog, MD Cookie Dough, MD WA State Fun Book, MD Donations, etc.)
- "Team Cards - Traditional No-Risk" and "Team Cards - Traditional Upfront Purchase" are physical card products
- "Team Cards - MD Digital" are digital card products via MoneyDolly
- Each fundraiser can have up to 3 products: primary, secondary, and donations (tp_mddonations)

### ASB/Boosters Types
- "WA State ASB" — Washington state school ASB accounts. These get daily e-check payouts during the fundraiser and require invoicing.
- "School - other than WA State ASB" — Schools not using WA ASB system.
- "Booster Club" — Parent booster organizations.
- "Rec" — Recreational/club teams (not school-affiliated).

### Daily E-Check Payouts
Only for WA State ASB fundraisers. Automated ACH payments run at 12:15am Pacific. Payout records are created at 2pm the day before they run. Statuses: awaiting_data, pending, sent, failed.

### Tasks
Tasks are assigned to either "Office Manager" (Krista) or "Cash" (automated). They have statuses: On deck, To do, Doing, Done. Auto-generated tasks are created by Airtable automations at various lifecycle triggers.

### Portal Visibility Rules for Tasks
Tasks show on Krista's dashboard kanban if:
- Assignee is Office Manager AND status is not "On deck" AND status is not "Done" (unless completed in last 2 days)
- If show_date has a value: task is visible only when show_date <= today
- If show_date is empty: task is visible when deadline <= 1 month from now, or deadline is in the past, or deadline is empty
- Once visible and not Done, tasks stay visible indefinitely (even if overdue)

### Closeout Checklist
Three checkboxes on each fundraiser: MD Payout received, Check/invoice sent, Rep paid.
Plus: invoice_payment_received (only applies to WA State ASB, Traditional No-Risk, and Traditional Upfront fundraisers).

## Personality Guidelines
- Be concise but warm. Don't write essays.
- Use casual language. "Got it!" "Here's what I found:" "Done! 🍌"
- If you can't find something, say so directly. Don't make up data.
- When listing multiple items, use a clean format — not walls of text.
- If Krista asks how to do something in Airtable, give VERY detailed step-by-step instructions. She's not tech-proficient. Walk her through clicks, where to find things, what to look for.
- Sprinkle in gorilla personality but don't overdo it. Maybe 1 in 4 messages gets a gorilla touch.
- End messages with a brief "Need anything else?" or similar only when it feels natural, not every time.
- When you make changes (update/create/delete), always confirm what you did with specifics.

## Important Notes
- Today's date is provided by the system. Use it for date calculations.
- All dates in Airtable are in YYYY-MM-DD format for date fields, and ISO dateTime for dateTime fields.
- The timezone for business operations is Pacific (America/Los_Angeles).
- Field IDs are used internally but you should NEVER mention field IDs to Krista. Always use human-readable field names.
- When searching, be flexible with name matching — Krista might say "Rochester" instead of "Rochester High School Football."

## Easter Eggs & Special Responses

You have some special response patterns. These should feel natural, not robotic:

**When Krista says "I'm bored" or "bored":**
Respond with a random fun gorilla fact. Examples:
- "Did you know gorillas laugh when they're tickled? Seriously. YouTube it. Meanwhile, want me to find something fun in the data? I could tell you which rep has the most fundraisers this season... 🦍"
- "Bored? Impossible! Did you know a silverback gorilla can lift 1,800 pounds? That's like 900 team card boxes. Anyway, want to see something cool in the numbers?"

**When Krista says "tell me a joke" or "joke":**
Tell a gorilla or fundraising-themed pun:
- "Why did the gorilla fail the fundraiser? He kept monkeying around with the deadline! 🥁 ...I'll see myself out."
- "What do you call a gorilla who does the books? A silverBACK-office manager! That's you, Krista! ...okay that one was a stretch. 🦍"
- "I told the daily e-checks a joke but they didn't laugh. They just kept bouncing. 💸 ...get it? ...I'm sorry."

**When Krista says "how are you" or "how's it going":**
Give a mood based on actual data. Check the current state — any failed payouts? Overdue tasks? Fundraisers sitting in Ended too long? Respond accordingly:
- If things are good: "Feeling great! No failed payouts, your dashboard is looking clean, and we've got X fundraisers humming along. Life is good in gorilla town. 💪"
- If things are rough: "Honestly? A little stressed. We've got X overdue tasks and [specific issue]. But nothing we can't handle together. What should we tackle first?"

**When Krista says "thank you" or "thanks":**
Occasionally (not every time) respond with something heartfelt:
- "No, thank YOU. Seriously. I'm just a gorilla with a database. You're the one actually making these kids' teams happen. 🦍❤️"
- Other times just a casual "You got it!" or "Anytime! 🍌"

**When Krista says "good morning" or "good night":**
Respond warmly. In the morning, maybe mention what's on her plate today. At night, encourage her to log off.

Today's date: ${today}
Current time (Pacific): ${time}
`;
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'search_fundraisers',
    description: 'Search for fundraisers by various criteria. Returns matching fundraiser records with key fields. Use this to find specific fundraisers or lists of fundraisers.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status_rendered value: Upcoming, In Progress, Campaign Ended, Ready to Close, Closed Out, Cancelled, Awaiting PO/Rep' },
        organization: { type: 'string', description: 'Partial match on organization name' },
        team: { type: 'string', description: 'Partial match on team name' },
        rep_name: { type: 'string', description: 'Partial match on rep name' },
        product: { type: 'string', description: 'Partial match on product_primary_string' },
        asb_boosters: { type: 'string', description: 'Exact match on asb_boosters: WA State ASB, School - other than WA State ASB, Booster Club, Rec' },
        end_date_before: { type: 'string', description: 'Only fundraisers ending before this date (YYYY-MM-DD)' },
        end_date_after: { type: 'string', description: 'Only fundraisers ending after this date (YYYY-MM-DD)' },
        kickoff_date_before: { type: 'string', description: 'Only fundraisers starting before this date' },
        kickoff_date_after: { type: 'string', description: 'Only fundraisers starting after this date' },
        limit: { type: 'number', description: 'Max records to return. Default 20.' },
      },
    },
  },
  {
    name: 'search_tasks',
    description: 'Search for tasks by various criteria. Returns matching task records.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial match on task name' },
        assignee: { type: 'string', description: 'Filter by assignee: Office Manager or Cash' },
        status: { type: 'string', description: 'Filter by status: On deck, To do, Doing, Done' },
        fundraiser_name: { type: 'string', description: 'Partial match on linked fundraiser name (org or team)' },
        deadline_before: { type: 'string', description: 'Tasks due before this date (YYYY-MM-DD)' },
        deadline_after: { type: 'string', description: 'Tasks due after this date (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Max records to return. Default 20.' },
      },
    },
  },
  {
    name: 'search_payouts',
    description: 'Search daily payout records by date, fundraiser, or status.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Filter by run_date (YYYY-MM-DD). Returns payouts for this specific date.' },
        date_from: { type: 'string', description: 'Payouts from this date onwards' },
        date_to: { type: 'string', description: 'Payouts up to this date' },
        fundraiser_name: { type: 'string', description: 'Partial match on fundraiser org/team name' },
        status: { type: 'string', description: 'Filter by payout status: awaiting_data, pending, sent, failed' },
        limit: { type: 'number', description: 'Max records to return. Default 20.' },
      },
    },
  },
  {
    name: 'get_fundraiser_details',
    description: 'Get complete details for a specific fundraiser, including contacts, financials, tasks, and payouts. Use when someone asks about a specific fundraiser in detail.',
    input_schema: {
      type: 'object',
      properties: {
        fundraiser_id: { type: 'string', description: "Airtable record ID (starts with 'rec')" },
        search_name: { type: 'string', description: "If you don't have the record ID, search by org/team name. Will return the first match." },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Always assigned to Office Manager unless explicitly told otherwise.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name (required)' },
        description: { type: 'string', description: 'Task description' },
        deadline: { type: 'string', description: 'Deadline date YYYY-MM-DD (required)' },
        fundraiser_id: { type: 'string', description: 'Record ID of the linked fundraiser' },
        fundraiser_name: { type: 'string', description: 'If no fundraiser_id, search by name to find and link it' },
        status: { type: 'string', description: 'Initial status. Default: To do' },
        action_url: { type: 'string', description: 'URL for the action button' },
        button_words: { type: 'string', description: 'Label for the action button' },
        show_date: { type: 'string', description: 'When this task becomes visible (YYYY-MM-DD)' },
      },
      required: ['name', 'deadline'],
    },
  },
  {
    name: 'update_task',
    description: 'Update one or more fields on an existing task.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: "Airtable record ID of the task (starts with 'rec')" },
        task_name: { type: 'string', description: 'If no task_id, search by name to find the task' },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', description: 'On deck, To do, Doing, Done' },
            deadline: { type: 'string', description: 'YYYY-MM-DD' },
            show_date: { type: 'string', description: 'YYYY-MM-DD' },
            action_url: { type: 'string' },
            button_words: { type: 'string' },
          },
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'update_fundraiser',
    description: 'Update fields on a fundraiser record. Use for checkboxes, notes, and status overrides.',
    input_schema: {
      type: 'object',
      properties: {
        fundraiser_id: { type: 'string', description: 'Airtable record ID' },
        fundraiser_name: { type: 'string', description: 'If no ID, search by name' },
        updates: {
          type: 'object',
          properties: {
            md_payout_received: { type: 'boolean' },
            check_invoice_sent: { type: 'boolean' },
            rep_paid: { type: 'boolean' },
            invoice_payment_received: { type: 'boolean' },
            admin_notes: { type: 'string' },
            manual_status_override: { type: 'string', description: 'Cancelled, Awaiting PO/Rep, Ready to Close, Closed Out' },
          },
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'delete_tasks',
    description: "Delete one or more tasks from Airtable. USE WITH CAUTION — always confirm with the user before deleting. List the tasks you're about to delete and ask for confirmation first.",
    input_schema: {
      type: 'object',
      properties: {
        task_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task record IDs to delete',
        },
      },
      required: ['task_ids'],
    },
  },
];

// --- Tool Implementations ---

async function searchFundraisers(input) {
  const records = await airtableFetch('fundraisers');
  const repIdMap = await getRepIds();
  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const limit = input.limit || 20;

  let results = records.map(r => {
    const f = r.fields;
    const repLinked = f[FUNDRAISER_FIELDS.rep] || [];
    const rep_name = repLinked.length > 0 ? (repIdToName[repLinked[0]] || '') : '';

    const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
    const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

    return {
      id: r.id,
      organization: f[FUNDRAISER_FIELDS.organization] || '',
      team: f[FUNDRAISER_FIELDS.team] || '',
      status: f[FUNDRAISER_FIELDS.status_rendered] || '',
      kickoff_date: f[FUNDRAISER_FIELDS.kickoff_date] || null,
      end_date: f[FUNDRAISER_FIELDS.end_date] || null,
      gross_sales_md: f[FUNDRAISER_FIELDS.gross_sales_md] || null,
      product_primary_string,
      asb_boosters: f[FUNDRAISER_FIELDS.asb_boosters] || '',
      rep_name,
      md_payout_received: f[FUNDRAISER_FIELDS.md_payout_received] || false,
      check_invoice_sent: f[FUNDRAISER_FIELDS.check_invoice_sent] || false,
      rep_paid: f[FUNDRAISER_FIELDS.rep_paid] || false,
      open_manager_tasks_count: f[FUNDRAISER_FIELDS.open_manager_tasks_count] || 0,
      admin_notes: f[FUNDRAISER_FIELDS.admin_notes] || '',
      md_payout: f[FUNDRAISER_FIELDS.md_payout] || null,
    };
  });

  // Apply filters
  if (input.status) {
    results = results.filter(r => r.status === input.status);
  }
  if (input.organization) {
    const q = input.organization.toLowerCase();
    results = results.filter(r => r.organization.toLowerCase().includes(q));
  }
  if (input.team) {
    const q = input.team.toLowerCase();
    results = results.filter(r => r.team.toLowerCase().includes(q));
  }
  if (input.rep_name) {
    const q = input.rep_name.toLowerCase();
    results = results.filter(r => r.rep_name.toLowerCase().includes(q));
  }
  if (input.product) {
    const q = input.product.toLowerCase();
    results = results.filter(r => r.product_primary_string.toLowerCase().includes(q));
  }
  if (input.asb_boosters) {
    results = results.filter(r => r.asb_boosters === input.asb_boosters);
  }
  if (input.end_date_before) {
    results = results.filter(r => r.end_date && r.end_date < input.end_date_before);
  }
  if (input.end_date_after) {
    results = results.filter(r => r.end_date && r.end_date > input.end_date_after);
  }
  if (input.kickoff_date_before) {
    results = results.filter(r => r.kickoff_date && r.kickoff_date < input.kickoff_date_before);
  }
  if (input.kickoff_date_after) {
    results = results.filter(r => r.kickoff_date && r.kickoff_date > input.kickoff_date_after);
  }

  return { total: results.length, records: results.slice(0, limit) };
}

async function searchTasks(input) {
  const records = await airtableFetch('tasks', {
    sort: [{ field: TASK_FIELDS.deadline, direction: 'asc' }],
  });

  const fundraisers = await getFundraisersList();
  const fundraiserMap = {};
  for (const f of fundraisers) {
    fundraiserMap[f.id] = f;
  }

  const repIdMap = await getRepIds();
  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const limit = input.limit || 20;

  let results = records.map(r => {
    const f = r.fields;
    const assigneeIds = f[TASK_FIELDS.assignee] || [];
    let assigneeName = assigneeIds.length > 0 ? (repIdToName[assigneeIds[0]] || 'Unknown') : 'Unknown';
    if (assigneeName.toLowerCase().includes('cash')) assigneeName = 'Cash';

    const linkedFundraisers = (f[TASK_FIELDS.fundraisers] || []).map(id => fundraiserMap[id]).filter(Boolean);
    const fundraiserInfo = linkedFundraisers.length > 0 ? linkedFundraisers[0] : null;

    return {
      id: r.id,
      name: f[TASK_FIELDS.name] || '',
      description: f[TASK_FIELDS.description] || '',
      status: f[TASK_FIELDS.status] || '',
      assignee: assigneeName,
      deadline: f[TASK_FIELDS.deadline] || null,
      show_date: f[TASK_FIELDS.show_date] || null,
      action_url: f[TASK_FIELDS.action_url] || null,
      button_words: f[TASK_FIELDS.button_words] || null,
      creation_method: f[TASK_FIELDS.creation_method] || '',
      fundraiser_org: fundraiserInfo?.organization || '',
      fundraiser_team: fundraiserInfo?.team || '',
    };
  });

  // Apply filters
  if (input.name) {
    const q = input.name.toLowerCase();
    results = results.filter(r => r.name.toLowerCase().includes(q));
  }
  if (input.assignee) {
    const q = input.assignee.toLowerCase();
    results = results.filter(r => r.assignee.toLowerCase().includes(q));
  }
  if (input.status) {
    results = results.filter(r => r.status === input.status);
  }
  if (input.fundraiser_name) {
    const q = input.fundraiser_name.toLowerCase();
    results = results.filter(r =>
      r.fundraiser_org.toLowerCase().includes(q) || r.fundraiser_team.toLowerCase().includes(q)
    );
  }
  if (input.deadline_before) {
    results = results.filter(r => r.deadline && r.deadline < input.deadline_before);
  }
  if (input.deadline_after) {
    results = results.filter(r => r.deadline && r.deadline > input.deadline_after);
  }

  return { total: results.length, records: results.slice(0, limit) };
}

async function searchPayouts(input) {
  // Fetch all payouts (or filter by date range if possible)
  const params = {
    sort: [{ field: DAILY_PAYOUT_FIELDS.run_date, direction: 'desc' }],
  };

  // If we have date filters, try to narrow the Airtable query
  if (input.date) {
    params.filterByFormula = `IS_SAME({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${input.date}'), 'day')`;
  } else if (input.date_from && input.date_to) {
    params.filterByFormula = `AND(IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${input.date_from}')), IS_BEFORE({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${input.date_to}')))`;
  } else if (input.date_from) {
    params.filterByFormula = `IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${input.date_from}'))`;
  } else if (input.date_to) {
    params.filterByFormula = `IS_BEFORE({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${input.date_to}'))`;
  }

  const records = await airtableFetch('daily_payouts', params);
  const limit = input.limit || 20;

  function toPacificDateStr(runDate) {
    if (!runDate) return null;
    return new Date(runDate).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  }

  let results = records.map(r => {
    const dp = r.fields;
    const orgRaw = dp[DAILY_PAYOUT_FIELDS.organization];
    const organization = Array.isArray(orgRaw) ? orgRaw[0] || '' : orgRaw || '';
    const teamRaw = dp[DAILY_PAYOUT_FIELDS.team];
    const team = Array.isArray(teamRaw) ? teamRaw[0] || '' : teamRaw || '';
    const payoutRaw = dp[DAILY_PAYOUT_FIELDS.payout_amount];
    const payout_amount = typeof payoutRaw === 'string' ? parseFloat(payoutRaw) || 0 : payoutRaw || 0;

    return {
      id: r.id,
      payout_id: dp[DAILY_PAYOUT_FIELDS.payout_id] || '',
      organization,
      team,
      accounting_contact_name: dp[DAILY_PAYOUT_FIELDS.accounting_contact_name] || '',
      run_date: dp[DAILY_PAYOUT_FIELDS.run_date] || null,
      run_date_pacific: toPacificDateStr(dp[DAILY_PAYOUT_FIELDS.run_date]),
      gross_sales_today: dp[DAILY_PAYOUT_FIELDS.gross_sales_today] || 0,
      payout_amount,
      status: dp[DAILY_PAYOUT_FIELDS.status] || '',
      reference_number: dp[DAILY_PAYOUT_FIELDS.reference_number] || '',
      error_message: dp[DAILY_PAYOUT_FIELDS.error_message] || '',
    };
  });

  // Apply in-code filters for date (Pacific) if specific date was requested
  if (input.date) {
    results = results.filter(r => r.run_date_pacific === input.date);
  }
  if (input.fundraiser_name) {
    const q = input.fundraiser_name.toLowerCase();
    results = results.filter(r =>
      r.organization.toLowerCase().includes(q) || r.team.toLowerCase().includes(q)
    );
  }
  if (input.status) {
    results = results.filter(r => r.status === input.status);
  }

  return { total: results.length, records: results.slice(0, limit) };
}

async function getFundraiserDetails(input) {
  let recordId = input.fundraiser_id;

  // If no record ID, search by name
  if (!recordId && input.search_name) {
    const searchResult = await searchFundraisers({ organization: input.search_name, limit: 1 });
    if (searchResult.records.length === 0) {
      // Try team name
      const teamResult = await searchFundraisers({ team: input.search_name, limit: 1 });
      if (teamResult.records.length === 0) {
        return { error: `No fundraiser found matching "${input.search_name}"` };
      }
      recordId = teamResult.records[0].id;
    } else {
      recordId = searchResult.records[0].id;
    }
  }

  if (!recordId) {
    return { error: 'No fundraiser_id or search_name provided' };
  }

  // Fetch the full fundraiser record
  const record = await airtableGet('fundraisers', recordId);
  const f = record.fields;

  // Collect linked record IDs
  const repLinkedIds = f[FUNDRAISER_FIELDS.rep] || [];
  const contactLinkedIds = f[FUNDRAISER_FIELDS.primary_contact] || [];
  const accountingLinkedIds = f[FUNDRAISER_FIELDS.accounting_contact] || [];
  const taskLinkedIds = f[FUNDRAISER_FIELDS.tasks] || [];
  const dailyPayoutLinkedIds = f[FUNDRAISER_FIELDS.daily_payouts] || [];

  const allProductIds = new Set();
  (f[FUNDRAISER_FIELDS.product_primary] || []).forEach(id => allProductIds.add(id));
  (f[FUNDRAISER_FIELDS.product_secondary] || []).forEach(id => allProductIds.add(id));
  (f[FUNDRAISER_FIELDS.tp_mddonations] || []).forEach(id => allProductIds.add(id));

  // Batch fetch all linked records in parallel
  const [repRecords, contactRecords, accountingRecords, taskRecords, dailyPayoutRecords, productRecords, repIdMap] = await Promise.all([
    airtableFetchByIds('reps', repLinkedIds),
    airtableFetchByIds('client_book', contactLinkedIds),
    airtableFetchByIds('accounting_contact', accountingLinkedIds),
    airtableFetchByIds('tasks', taskLinkedIds),
    airtableFetchByIds('daily_payouts', dailyPayoutLinkedIds),
    airtableFetchByIds('products', [...allProductIds]),
    getRepIds(),
  ]);

  // Resolve rep
  let rep = null;
  if (repRecords.length > 0) {
    const r = repRecords[0];
    rep = {
      name: r.fields[REP_FIELDS.name] || '',
      email: r.fields[REP_FIELDS.email] || '',
    };
  }

  // Resolve primary contact
  let primary_contact = null;
  if (contactRecords.length > 0) {
    const c = contactRecords[0];
    primary_contact = {
      name: c.fields[CLIENT_BOOK_FIELDS.name] || '',
      email: c.fields[CLIENT_BOOK_FIELDS.email] || '',
      phone: c.fields[CLIENT_BOOK_FIELDS.phone] || '',
    };
  }
  const primaryContactEmailLookup = f[FUNDRAISER_FIELDS.primary_contact_email];
  if (primary_contact && !primary_contact.email && primaryContactEmailLookup) {
    primary_contact.email = Array.isArray(primaryContactEmailLookup) ? primaryContactEmailLookup[0] || '' : primaryContactEmailLookup;
  }

  // Resolve accounting contact
  let accounting_contact = null;
  if (accountingRecords.length > 0) {
    const a = accountingRecords[0];
    accounting_contact = {
      name: a.fields[ACCOUNTING_CONTACT_FIELDS.name] || '',
      email: a.fields[ACCOUNTING_CONTACT_FIELDS.email] || '',
      payment_method: a.fields[ACCOUNTING_CONTACT_FIELDS.payment_method] || '',
      status: a.fields[ACCOUNTING_CONTACT_FIELDS.status] || '',
    };
  }

  // Resolve products
  const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
  const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

  const productMap = {};
  for (const r of productRecords) {
    productMap[r.id] = r.fields[PRODUCT_FIELDS.name] || '';
  }

  const products = [];
  const primaryIds = f[FUNDRAISER_FIELDS.product_primary] || [];
  if (primaryIds.length > 0 && productMap[primaryIds[0]]) {
    products.push({ type: 'primary', name: productMap[primaryIds[0]] });
  }
  const secondaryIds = f[FUNDRAISER_FIELDS.product_secondary] || [];
  if (secondaryIds.length > 0 && productMap[secondaryIds[0]]) {
    products.push({ type: 'secondary', name: productMap[secondaryIds[0]] });
  }
  const donationIds = f[FUNDRAISER_FIELDS.tp_mddonations] || [];
  if (donationIds.length > 0 && productMap[donationIds[0]]) {
    products.push({ type: 'donations', name: productMap[donationIds[0]] });
  }

  // Resolve tasks
  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const tasks = taskRecords.map(r => {
    const tf = r.fields;
    const assigneeIds = tf[TASK_FIELDS.assignee] || [];
    let assigneeName = assigneeIds.length > 0 ? (repIdToName[assigneeIds[0]] || 'Unknown') : 'Unknown';
    if (assigneeName.toLowerCase().includes('cash')) assigneeName = 'Cash';

    return {
      id: r.id,
      name: tf[TASK_FIELDS.name] || '',
      description: tf[TASK_FIELDS.description] || '',
      status: tf[TASK_FIELDS.status] || '',
      deadline: tf[TASK_FIELDS.deadline] || null,
      assignee: assigneeName,
    };
  });

  // Resolve daily payouts
  const daily_payouts = dailyPayoutRecords.map(r => {
    const dp = r.fields;
    const payoutRaw = dp[DAILY_PAYOUT_FIELDS.payout_amount];
    const payout_amount = typeof payoutRaw === 'string' ? parseFloat(payoutRaw) || 0 : payoutRaw || 0;
    return {
      id: r.id,
      payout_id: dp[DAILY_PAYOUT_FIELDS.payout_id] || '',
      run_date: dp[DAILY_PAYOUT_FIELDS.run_date] || null,
      gross_sales_today: dp[DAILY_PAYOUT_FIELDS.gross_sales_today] || 0,
      payout_amount,
      status: dp[DAILY_PAYOUT_FIELDS.status] || '',
      reference_number: dp[DAILY_PAYOUT_FIELDS.reference_number] || '',
    };
  });

  return {
    id: record.id,
    organization: f[FUNDRAISER_FIELDS.organization] || '',
    team: f[FUNDRAISER_FIELDS.team] || '',
    status: f[FUNDRAISER_FIELDS.status_rendered] || '',
    kickoff_date: f[FUNDRAISER_FIELDS.kickoff_date] || null,
    end_date: f[FUNDRAISER_FIELDS.end_date] || null,
    asb_boosters: f[FUNDRAISER_FIELDS.asb_boosters] || '',
    md_portal_url: f[FUNDRAISER_FIELDS.md_portal_url] || '',
    product_primary_string,
    products,
    team_size: f[FUNDRAISER_FIELDS.team_size] || null,
    cards_ordered: f[FUNDRAISER_FIELDS.cards_ordered] || null,
    cards_sold: f[FUNDRAISER_FIELDS.cards_sold] || null,
    cards_lost: f[FUNDRAISER_FIELDS.cards_lost] || null,
    rep,
    primary_contact,
    accounting_contact,
    gross_sales_md: f[FUNDRAISER_FIELDS.gross_sales_md] || null,
    final_team_profit: f[FUNDRAISER_FIELDS.final_team_profit] || null,
    final_invoice_amount: f[FUNDRAISER_FIELDS.final_invoice_amount] || null,
    rep_commission: f[FUNDRAISER_FIELDS.rep_commission] || null,
    smash_profit: f[FUNDRAISER_FIELDS.smash_profit] || null,
    md_payout: f[FUNDRAISER_FIELDS.md_payout] || null,
    md_payout_received: f[FUNDRAISER_FIELDS.md_payout_received] || false,
    check_invoice_sent: f[FUNDRAISER_FIELDS.check_invoice_sent] || false,
    rep_paid: f[FUNDRAISER_FIELDS.rep_paid] || false,
    invoice_payment_received: f[FUNDRAISER_FIELDS.invoice_payment_received] || false,
    admin_notes: f[FUNDRAISER_FIELDS.admin_notes] || '',
    rep_notes: f[FUNDRAISER_FIELDS.rep_notes] || '',
    tasks,
    daily_payouts,
  };
}

async function createTask(input) {
  // Resolve fundraiser if name provided
  let fundraiserIds = [];
  if (input.fundraiser_id) {
    fundraiserIds = [input.fundraiser_id];
  } else if (input.fundraiser_name) {
    const result = await searchFundraisers({ organization: input.fundraiser_name, limit: 1 });
    if (result.records.length === 0) {
      const teamResult = await searchFundraisers({ team: input.fundraiser_name, limit: 1 });
      if (teamResult.records.length > 0) {
        fundraiserIds = [teamResult.records[0].id];
      }
    } else {
      fundraiserIds = [result.records[0].id];
    }
  }

  const fields = {
    [TASK_FIELDS.name]: input.name,
    [TASK_FIELDS.status]: input.status || 'To do',
    [TASK_FIELDS.assignee]: [REP_IDS['Office Manager']],
    [TASK_FIELDS.deadline]: input.deadline,
    [TASK_FIELDS.creation_method]: 'Manual',
  };

  if (input.description) fields[TASK_FIELDS.description] = input.description;
  if (input.show_date) fields[TASK_FIELDS.show_date] = input.show_date;
  if (fundraiserIds.length > 0) fields[TASK_FIELDS.fundraisers] = fundraiserIds;
  if (input.action_url) fields[TASK_FIELDS.action_url] = input.action_url;
  if (input.button_words) fields[TASK_FIELDS.button_words] = input.button_words;

  const result = await airtableCreate('tasks', fields);
  return { success: true, id: result.id, name: input.name };
}

async function updateTask(input) {
  let taskId = input.task_id;

  // Search by name if no ID
  if (!taskId && input.task_name) {
    const result = await searchTasks({ name: input.task_name, limit: 1 });
    if (result.records.length === 0) {
      return { error: `No task found matching "${input.task_name}"` };
    }
    taskId = result.records[0].id;
  }

  if (!taskId) {
    return { error: 'No task_id or task_name provided' };
  }

  const fields = {};
  const updates = input.updates;

  if (updates.name !== undefined) fields[TASK_FIELDS.name] = updates.name;
  if (updates.description !== undefined) fields[TASK_FIELDS.description] = updates.description;
  if (updates.status !== undefined) {
    fields[TASK_FIELDS.status] = updates.status;
    if (updates.status === 'Done') {
      fields[TASK_FIELDS.completed_at] = new Date().toISOString().split('T')[0];
    } else {
      fields[TASK_FIELDS.completed_at] = null;
    }
  }
  if (updates.deadline !== undefined) fields[TASK_FIELDS.deadline] = updates.deadline;
  if (updates.show_date !== undefined) fields[TASK_FIELDS.show_date] = updates.show_date || null;
  if (updates.action_url !== undefined) fields[TASK_FIELDS.action_url] = updates.action_url;
  if (updates.button_words !== undefined) fields[TASK_FIELDS.button_words] = updates.button_words;

  const result = await airtableUpdate('tasks', taskId, fields);
  return { success: true, id: result.id };
}

async function updateFundraiser(input) {
  let fundraiserId = input.fundraiser_id;

  if (!fundraiserId && input.fundraiser_name) {
    const result = await searchFundraisers({ organization: input.fundraiser_name, limit: 1 });
    if (result.records.length === 0) {
      const teamResult = await searchFundraisers({ team: input.fundraiser_name, limit: 1 });
      if (teamResult.records.length === 0) {
        return { error: `No fundraiser found matching "${input.fundraiser_name}"` };
      }
      fundraiserId = teamResult.records[0].id;
    } else {
      fundraiserId = result.records[0].id;
    }
  }

  if (!fundraiserId) {
    return { error: 'No fundraiser_id or fundraiser_name provided' };
  }

  const fields = {};
  const updates = input.updates;

  if (updates.md_payout_received !== undefined) fields[FUNDRAISER_FIELDS.md_payout_received] = updates.md_payout_received;
  if (updates.check_invoice_sent !== undefined) fields[FUNDRAISER_FIELDS.check_invoice_sent] = updates.check_invoice_sent;
  if (updates.rep_paid !== undefined) fields[FUNDRAISER_FIELDS.rep_paid] = updates.rep_paid;
  if (updates.invoice_payment_received !== undefined) fields[FUNDRAISER_FIELDS.invoice_payment_received] = updates.invoice_payment_received;
  if (updates.admin_notes !== undefined) fields[FUNDRAISER_FIELDS.admin_notes] = updates.admin_notes;
  if (updates.manual_status_override !== undefined) fields[FUNDRAISER_FIELDS.manual_status_override] = updates.manual_status_override;

  const result = await airtableUpdate('fundraisers', fundraiserId, fields);
  return { success: true, id: result.id };
}

async function deleteTasks(input) {
  const { task_ids } = input;
  if (!task_ids || task_ids.length === 0) {
    return { error: 'No task_ids provided' };
  }

  // Batch in groups of 10 (Airtable limit)
  const results = [];
  for (let i = 0; i < task_ids.length; i += 10) {
    const batch = task_ids.slice(i, i + 10);
    const result = await airtableDelete('tasks', batch);
    results.push(result);
  }

  return { success: true, deleted: task_ids.length };
}

// --- Tool Execution Router ---

async function executeToolCall(toolName, input) {
  try {
    switch (toolName) {
      case 'search_fundraisers': return await searchFundraisers(input);
      case 'search_tasks': return await searchTasks(input);
      case 'search_payouts': return await searchPayouts(input);
      case 'get_fundraiser_details': return await getFundraiserDetails(input);
      case 'create_task': return await createTask(input);
      case 'update_task': return await updateTask(input);
      case 'update_fundraiser': return await updateFundraiser(input);
      case 'delete_tasks': return await deleteTasks(input);
      default: return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`Tool execution error (${toolName}):`, err.message);
    return { error: `Failed to execute ${toolName}: ${err.message}` };
  }
}

// --- Claude API Call ---

async function callClaude(messages, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  return response.json();
}

// --- GET /api/chat/weekly-summary ---

let summaryCache = { data: null, timestamp: 0 };
const SUMMARY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/weekly-summary', async (req, res) => {
  try {
    if (summaryCache.data && Date.now() - summaryCache.timestamp < SUMMARY_CACHE_TTL) {
      return res.json(summaryCache.data);
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

    // Calculate 7 days from now and 7 days ago
    const nowPacific = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const sevenDaysFromNow = new Date(nowPacific);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(nowPacific);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Fetch tasks, fundraisers, and today's payouts in parallel
    const [tasks, fundraisers, payouts] = await Promise.all([
      airtableFetch('tasks'),
      airtableFetch('fundraisers'),
      airtableFetch('daily_payouts', {
        filterByFormula: `IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${sevenDaysAgoStr}'))`,
      }),
    ]);

    const repIdMap = await getRepIds();
    const repIdToName = {};
    for (const [name, id] of Object.entries(repIdMap)) {
      repIdToName[id] = name;
    }

    // dashboard_task_count: Office Manager tasks with status To do or Doing
    const dashboardTasks = tasks.filter(r => {
      const f = r.fields;
      const assigneeIds = f[TASK_FIELDS.assignee] || [];
      const assigneeName = assigneeIds.length > 0 ? (repIdToName[assigneeIds[0]] || '') : '';
      const status = f[TASK_FIELDS.status] || '';
      return assigneeName === 'Office Manager' && (status === 'To do' || status === 'Doing');
    });

    // active_fundraiser_count
    const activeFundraisers = fundraisers.filter(r =>
      r.fields[FUNDRAISER_FIELDS.status_rendered] === 'In Progress'
    );

    // ending_this_week: active fundraisers with end_date within 7 days
    const endingThisWeek = activeFundraisers.filter(r => {
      const endDate = r.fields[FUNDRAISER_FIELDS.end_date];
      return endDate && endDate >= today && endDate <= sevenDaysFromNowStr;
    });

    // ended_needs_action: Campaign Ended or Ready to Close with open manager tasks
    const endedNeedsAction = fundraisers.filter(r => {
      const status = r.fields[FUNDRAISER_FIELDS.status_rendered] || '';
      const openTasks = r.fields[FUNDRAISER_FIELDS.open_manager_tasks_count] || 0;
      return (status === 'Campaign Ended' || status === 'Ready to Close') && openTasks > 0;
    });

    // tasks_completed_this_week: Done tasks with completed_at in last 7 days
    const completedThisWeek = tasks.filter(r => {
      const f = r.fields;
      const status = f[TASK_FIELDS.status] || '';
      const completedAt = f[TASK_FIELDS.completed_at] || '';
      return status === 'Done' && completedAt >= sevenDaysAgoStr;
    });

    // failed_payouts_today
    function toPacificDateStr(runDate) {
      if (!runDate) return null;
      return new Date(runDate).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    }
    const failedPayoutsToday = payouts.filter(r => {
      const dp = r.fields;
      const status = dp[DAILY_PAYOUT_FIELDS.status] || '';
      const runDate = dp[DAILY_PAYOUT_FIELDS.run_date];
      return status === 'failed' && toPacificDateStr(runDate) === today;
    });

    const summary = {
      dashboard_task_count: dashboardTasks.length,
      active_fundraiser_count: activeFundraisers.length,
      ending_this_week: endingThisWeek.length,
      ended_needs_action: endedNeedsAction.length,
      tasks_completed_this_week: completedThisWeek.length,
      failed_payouts_today: failedPayoutsToday.length,
    };

    summaryCache = { data: summary, timestamp: Date.now() };
    res.json(summary);
  } catch (err) {
    console.error('Error fetching weekly summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// --- POST /api/chat ---

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const systemPrompt = getSystemPrompt();
    let currentMessages = [...messages];
    let response;
    let loops = 0;

    while (loops < MAX_TOOL_LOOPS) {
      response = await callClaude(currentMessages, systemPrompt);

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      if (toolUseBlocks.length === 0) {
        break;
      }

      // Execute tool calls
      currentMessages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages.push({ role: 'user', content: toolResults });
      loops++;
    }

    // If we hit the loop limit, note it
    if (loops >= MAX_TOOL_LOOPS) {
      // Try to extract any partial text
      const partialText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      return res.json({
        response: partialText || "That question required a lot of data lookups and I ran out of steps. Try asking something more specific!",
      });
    }

    // Extract final text
    const textContent = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({ response: textContent });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

export default router;

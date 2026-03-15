import { Router } from 'express';
import {
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  DAILY_PAYOUT_FIELDS,
  PRODUCT_FIELDS,
  airtableFetch,
  airtableFetchByIds,
  airtableGet,
  airtableUpdate,
  getFundraisersList,
  getRepIds,
} from '../services/airtable.js';

const router = Router();

// GET /api/fundraisers/list — lightweight list for dropdowns and badges
router.get('/list', async (req, res) => {
  try {
    const fundraisers = await getFundraisersList();
    // Filter out Closed Out and Cancelled for dropdown use
    const filtered = fundraisers.filter(f => f.status !== 'Closed Out' && f.status !== 'Cancelled');
    res.json(filtered);
  } catch (err) {
    console.error('Error fetching fundraisers:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundraisers' });
  }
});

// Shared logic for upcoming fundraisers with full data resolution
async function getUpcomingFundraisers() {
  // 1. Fetch all upcoming fundraisers
  const records = await airtableFetch('fundraisers', {
    filterByFormula: `{${FUNDRAISER_FIELDS.status_rendered}} = "Upcoming"`,
    sort: [{ field: FUNDRAISER_FIELDS.kickoff_date, direction: 'asc' }],
  });

  // 2. Collect all linked record IDs
  const repIds = new Set();
  const contactIds = new Set();
  const accountingIds = new Set();
  const taskIds = new Set();

  for (const r of records) {
    const f = r.fields;
    (f[FUNDRAISER_FIELDS.rep] || []).forEach(id => repIds.add(id));
    (f[FUNDRAISER_FIELDS.primary_contact] || []).forEach(id => contactIds.add(id));
    (f[FUNDRAISER_FIELDS.accounting_contact] || []).forEach(id => accountingIds.add(id));
    (f[FUNDRAISER_FIELDS.tasks] || []).forEach(id => taskIds.add(id));
  }

  // 3. Batch fetch linked records in parallel
  const [repRecords, contactRecords, accountingRecords, taskRecords, repIdMap] = await Promise.all([
    airtableFetchByIds('reps', [...repIds]),
    airtableFetchByIds('client_book', [...contactIds]),
    airtableFetchByIds('accounting_contact', [...accountingIds]),
    airtableFetchByIds('tasks', [...taskIds]),
    getRepIds(),
  ]);

  // 4. Build lookup maps
  const repMap = {};
  for (const r of repRecords) {
    repMap[r.id] = r.fields[REP_FIELDS.name] || '';
  }

  const contactMap = {};
  for (const r of contactRecords) {
    contactMap[r.id] = r.fields[CLIENT_BOOK_FIELDS.name] || '';
  }

  const accountingMap = {};
  for (const r of accountingRecords) {
    accountingMap[r.id] = r.fields[ACCOUNTING_CONTACT_FIELDS.name] || '';
  }

  // Reverse map: rep record ID -> rep name
  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const taskMap = {};
  for (const r of taskRecords) {
    const assigneeIds = r.fields[TASK_FIELDS.assignee] || [];
    let assigneeName = assigneeIds.length > 0 ? (repIdToName[assigneeIds[0]] || 'Unknown') : 'Unknown';
    if (assigneeName.toLowerCase().includes('cash')) assigneeName = 'Cash';

    taskMap[r.id] = {
      id: r.id,
      name: r.fields[TASK_FIELDS.name] || '',
      status: r.fields[TASK_FIELDS.status] || '',
      description: r.fields[TASK_FIELDS.description] || '',
      deadline: r.fields[TASK_FIELDS.deadline] || null,
      show_date: r.fields[TASK_FIELDS.show_date] || null,
      action_url: r.fields[TASK_FIELDS.action_url] || null,
      button_words: r.fields[TASK_FIELDS.button_words] || null,
      completed_at: r.fields[TASK_FIELDS.completed_at] || null,
      assignee: assigneeName,
      fundraiserIds: r.fields[TASK_FIELDS.fundraisers] || [],
    };
  }

  // 5. Build response
  return records.map(r => {
    const f = r.fields;

    // Resolve names
    const repLinked = f[FUNDRAISER_FIELDS.rep] || [];
    const rep_name = repLinked.length > 0 ? repMap[repLinked[0]] || '' : '';

    const contactLinked = f[FUNDRAISER_FIELDS.primary_contact] || [];
    const primary_contact_name = contactLinked.length > 0 ? contactMap[contactLinked[0]] || '' : '';

    const accountingLinked = f[FUNDRAISER_FIELDS.accounting_contact] || [];
    const accounting_contact_name = accountingLinked.length > 0 ? accountingMap[accountingLinked[0]] || '' : '';

    // Rep photo
    const photoAttachments = f[FUNDRAISER_FIELDS.rep_photo] || [];
    let rep_photo = null;
    if (photoAttachments.length > 0) {
      const att = photoAttachments[0];
      rep_photo = att.thumbnails?.large?.url || att.url || null;
    }

    // product_primary_string is a lookup field — returns an array
    const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
    const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

    const asb_boosters = f[FUNDRAISER_FIELDS.asb_boosters] || '';
    const md_portal_url = f[FUNDRAISER_FIELDS.md_portal_url] || '';
    const open_manager_tasks_count = f[FUNDRAISER_FIELDS.open_manager_tasks_count] || 0;

    // Resolve tasks for readiness checks
    const linkedTaskIds = f[FUNDRAISER_FIELDS.tasks] || [];
    const linkedTasks = linkedTaskIds.map(id => taskMap[id]).filter(Boolean);

    // Readiness checks
    const readiness = {
      accounting_contact_assigned: accountingLinked.length > 0,
      md_portal_url_set: !!md_portal_url,
      asb_intro_email_sent: asb_boosters === 'WA State ASB'
        ? linkedTasks.some(t => t.name.includes('ASB Onboarding Email') && t.status === 'Done')
        : null,
      cookie_dough_presale_submitted: product_primary_string.toLowerCase().includes('cookie dough')
        ? linkedTasks.some(t => t.name.toLowerCase().includes('presale') && t.status === 'Done')
        : null,
    };

    // Open tasks for Office Manager only (not Done)
    const open_tasks = linkedTasks.filter(t =>
      t.status !== 'Done' && t.assignee === 'Office Manager'
    );

    return {
      id: r.id,
      organization: f[FUNDRAISER_FIELDS.organization] || '',
      team: f[FUNDRAISER_FIELDS.team] || '',
      kickoff_date: f[FUNDRAISER_FIELDS.kickoff_date] || null,
      end_date: f[FUNDRAISER_FIELDS.end_date] || null,
      status: 'Upcoming',
      rep_name,
      rep_photo,
      product_primary_string,
      asb_boosters,
      primary_contact_name,
      accounting_contact_name,
      md_portal_url,
      open_manager_tasks_count,
      readiness,
      open_tasks,
    };
  });
}

// GET /api/fundraisers/upcoming/count — lightweight count for sidebar badge
router.get('/upcoming/count', async (req, res) => {
  try {
    const fundraisers = await getUpcomingFundraisers();
    const needsAttention = fundraisers.filter(f => {
      const r = f.readiness;
      return !r.accounting_contact_assigned
        || !r.md_portal_url_set
        || r.asb_intro_email_sent === false
        || r.cookie_dough_presale_submitted === false;
    }).length;
    res.json({ total: fundraisers.length, needsAttention });
  } catch (err) {
    console.error('Error fetching upcoming count:', err.message);
    res.status(500).json({ error: 'Failed to fetch upcoming count' });
  }
});

// GET /api/fundraisers/upcoming — full data for upcoming page
router.get('/upcoming', async (req, res) => {
  try {
    const fundraisers = await getUpcomingFundraisers();
    res.json(fundraisers);
  } catch (err) {
    console.error('Error fetching upcoming fundraisers:', err.message);
    res.status(500).json({ error: 'Failed to fetch upcoming fundraisers' });
  }
});

// GET /api/fundraisers/:recordId — full detail with all resolved linked records
router.get('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;

    // 1. Fetch the fundraiser record
    const record = await airtableGet('fundraisers', recordId);
    const f = record.fields;

    // 2. Collect linked record IDs
    const repLinkedIds = f[FUNDRAISER_FIELDS.rep] || [];
    const contactLinkedIds = f[FUNDRAISER_FIELDS.primary_contact] || [];
    const accountingLinkedIds = f[FUNDRAISER_FIELDS.accounting_contact] || [];
    const taskLinkedIds = f[FUNDRAISER_FIELDS.tasks] || [];
    const dailyPayoutLinkedIds = f[FUNDRAISER_FIELDS.daily_payouts] || [];
    const productSecondaryLinkedIds = f[FUNDRAISER_FIELDS.product_secondary] || [];

    // 3. Batch fetch all linked records in parallel
    const [repRecords, contactRecords, accountingRecords, taskRecords, dailyPayoutRecords, productRecords, repIdMap] = await Promise.all([
      airtableFetchByIds('reps', repLinkedIds),
      airtableFetchByIds('client_book', contactLinkedIds),
      airtableFetchByIds('accounting_contact', accountingLinkedIds),
      airtableFetchByIds('tasks', taskLinkedIds),
      airtableFetchByIds('daily_payouts', dailyPayoutLinkedIds),
      airtableFetchByIds('products', productSecondaryLinkedIds),
      getRepIds(),
    ]);

    // 4. Resolve rep
    let rep = null;
    if (repRecords.length > 0) {
      const r = repRecords[0];
      const photoAttachments = r.fields[REP_FIELDS.photo] || [];
      let photo = null;
      if (photoAttachments.length > 0) {
        const att = photoAttachments[0];
        photo = att.thumbnails?.large?.url || att.url || null;
      }
      rep = {
        name: r.fields[REP_FIELDS.name] || '',
        email: r.fields[REP_FIELDS.email] || '',
        photo,
      };
    }

    // 5. Resolve primary contact
    let primary_contact = null;
    if (contactRecords.length > 0) {
      const c = contactRecords[0];
      primary_contact = {
        name: c.fields[CLIENT_BOOK_FIELDS.name] || '',
        email: c.fields[CLIENT_BOOK_FIELDS.email] || '',
        phone: c.fields[CLIENT_BOOK_FIELDS.phone] || '',
      };
    }

    // Also check lookup email field on fundraiser itself
    const primaryContactEmailLookup = f[FUNDRAISER_FIELDS.primary_contact_email];
    if (primary_contact && !primary_contact.email && primaryContactEmailLookup) {
      primary_contact.email = Array.isArray(primaryContactEmailLookup) ? primaryContactEmailLookup[0] || '' : primaryContactEmailLookup;
    }

    // 6. Resolve accounting contact
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

    // 7. Resolve product names
    const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
    const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

    let product_secondary_name = '';
    if (productRecords.length > 0) {
      product_secondary_name = productRecords[0].fields[PRODUCT_FIELDS.name] || '';
    }

    // 8. Resolve tasks
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
        show_date: tf[TASK_FIELDS.show_date] || null,
        action_url: tf[TASK_FIELDS.action_url] || null,
        button_words: tf[TASK_FIELDS.button_words] || null,
        completed_at: tf[TASK_FIELDS.completed_at] || null,
        created_at: tf[TASK_FIELDS.created_at] || null,
        assignee: assigneeName,
        fundraiserIds: tf[TASK_FIELDS.fundraisers] || [],
      };
    });

    // 9. Resolve daily payouts
    const daily_payouts = dailyPayoutRecords.map(r => {
      const dp = r.fields;
      return {
        id: r.id,
        payout_id: dp[DAILY_PAYOUT_FIELDS.payout_id] || '',
        run_date: dp[DAILY_PAYOUT_FIELDS.run_date] || null,
        gross_sales_today: dp[DAILY_PAYOUT_FIELDS.gross_sales_today] || null,
        payout_amount: dp[DAILY_PAYOUT_FIELDS.payout_amount] || null,
        status: dp[DAILY_PAYOUT_FIELDS.status] || '',
        reference_number: dp[DAILY_PAYOUT_FIELDS.reference_number] || '',
        error_message: dp[DAILY_PAYOUT_FIELDS.error_message] || '',
      };
    });

    // 10. Rep photo from fundraiser record (lookup field)
    const photoAttachments = f[FUNDRAISER_FIELDS.rep_photo] || [];
    let rep_photo = null;
    if (photoAttachments.length > 0) {
      const att = photoAttachments[0];
      rep_photo = att.thumbnails?.large?.url || att.url || null;
    }

    // 11. Extract attachment fields
    const extractAttachment = (field) => {
      const attachments = f[field] || [];
      if (attachments.length === 0) return null;
      return attachments.map(a => ({
        filename: a.filename,
        url: a.url,
        type: a.type || '',
      }));
    };

    // 12. Build response
    res.json({
      id: record.id,
      organization: f[FUNDRAISER_FIELDS.organization] || '',
      team: f[FUNDRAISER_FIELDS.team] || '',
      status: f[FUNDRAISER_FIELDS.status_rendered] || '',
      kickoff_date: f[FUNDRAISER_FIELDS.kickoff_date] || null,
      end_date: f[FUNDRAISER_FIELDS.end_date] || null,
      asb_boosters: f[FUNDRAISER_FIELDS.asb_boosters] || '',
      md_portal_url: f[FUNDRAISER_FIELDS.md_portal_url] || '',
      product_primary_string,
      product_secondary_name,
      team_size: f[FUNDRAISER_FIELDS.team_size] || null,
      cards_ordered: f[FUNDRAISER_FIELDS.cards_ordered] || null,
      cards_sold: f[FUNDRAISER_FIELDS.cards_sold] || null,
      cards_lost: f[FUNDRAISER_FIELDS.cards_lost] || null,
      rep,
      rep_photo,
      primary_contact,
      accounting_contact,
      // Financials
      gross_sales_md: f[FUNDRAISER_FIELDS.gross_sales_md] || null,
      final_team_profit: f[FUNDRAISER_FIELDS.final_team_profit] || null,
      final_invoice_amount: f[FUNDRAISER_FIELDS.final_invoice_amount] || null,
      rep_commission: f[FUNDRAISER_FIELDS.rep_commission] || null,
      smash_profit: f[FUNDRAISER_FIELDS.smash_profit] || null,
      md_payout: f[FUNDRAISER_FIELDS.md_payout] || null,
      // Closeout
      md_payout_received: f[FUNDRAISER_FIELDS.md_payout_received] || false,
      check_invoice_sent: f[FUNDRAISER_FIELDS.check_invoice_sent] || false,
      rep_paid: f[FUNDRAISER_FIELDS.rep_paid] || false,
      // Documents
      fundraiser_agreement: extractAttachment(FUNDRAISER_FIELDS.fundraiser_agreement),
      fundraiser_profit_report: extractAttachment(FUNDRAISER_FIELDS.fundraiser_profit_report),
      rep_commission_report: extractAttachment(FUNDRAISER_FIELDS.rep_commission_report),
      invoice_attachment: extractAttachment(FUNDRAISER_FIELDS.invoice_attachment),
      md_payout_report: extractAttachment(FUNDRAISER_FIELDS.md_payout_report),
      // Notes
      admin_notes: f[FUNDRAISER_FIELDS.admin_notes] || '',
      rep_notes: f[FUNDRAISER_FIELDS.rep_notes] || '',
      // Linked records
      tasks,
      daily_payouts,
    });
  } catch (err) {
    console.error('Error fetching fundraiser detail:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundraiser detail' });
  }
});

// PATCH /api/fundraisers/:recordId — update closeout checkboxes + admin notes
router.patch('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const updates = req.body;
    const fields = {};

    if (updates.md_payout_received !== undefined) fields[FUNDRAISER_FIELDS.md_payout_received] = updates.md_payout_received;
    if (updates.check_invoice_sent !== undefined) fields[FUNDRAISER_FIELDS.check_invoice_sent] = updates.check_invoice_sent;
    if (updates.rep_paid !== undefined) fields[FUNDRAISER_FIELDS.rep_paid] = updates.rep_paid;
    if (updates.admin_notes !== undefined) fields[FUNDRAISER_FIELDS.admin_notes] = updates.admin_notes;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await airtableUpdate('fundraisers', recordId, fields);
    res.json({ success: true, id: result.id });
  } catch (err) {
    console.error('Error updating fundraiser:', err.message);
    res.status(500).json({ error: 'Failed to update fundraiser' });
  }
});

export default router;

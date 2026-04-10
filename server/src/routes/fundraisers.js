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
  const productIds = new Set();

  for (const r of records) {
    const f = r.fields;
    (f[FUNDRAISER_FIELDS.rep] || []).forEach(id => repIds.add(id));
    (f[FUNDRAISER_FIELDS.primary_contact] || []).forEach(id => contactIds.add(id));
    (f[FUNDRAISER_FIELDS.accounting_contact] || []).forEach(id => accountingIds.add(id));
    (f[FUNDRAISER_FIELDS.tasks] || []).forEach(id => taskIds.add(id));
    (f[FUNDRAISER_FIELDS.product_primary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.product_secondary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.tp_mddonations] || []).forEach(id => productIds.add(id));
  }

  // 3. Batch fetch linked records in parallel
  const [repRecords, contactRecords, accountingRecords, taskRecords, productRecords, repIdMap] = await Promise.all([
    airtableFetchByIds('reps', [...repIds]),
    airtableFetchByIds('client_book', [...contactIds]),
    airtableFetchByIds('accounting_contact', [...accountingIds]),
    airtableFetchByIds('tasks', [...taskIds]),
    airtableFetchByIds('products', [...productIds]),
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

  const productMap = {};
  for (const r of productRecords) {
    productMap[r.id] = r.fields[PRODUCT_FIELDS.name] || '';
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

  // Helper to build products array from linked IDs
  function buildProducts(fields) {
    const products = [];
    const primaryIds = fields[FUNDRAISER_FIELDS.product_primary] || [];
    if (primaryIds.length > 0 && productMap[primaryIds[0]]) {
      products.push({ type: 'primary', name: productMap[primaryIds[0]] });
    }
    const secondaryIds = fields[FUNDRAISER_FIELDS.product_secondary] || [];
    if (secondaryIds.length > 0 && productMap[secondaryIds[0]]) {
      products.push({ type: 'secondary', name: productMap[secondaryIds[0]] });
    }
    const donationIds = fields[FUNDRAISER_FIELDS.tp_mddonations] || [];
    if (donationIds.length > 0 && productMap[donationIds[0]]) {
      products.push({ type: 'donations', name: productMap[donationIds[0]] });
    }
    return products;
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
      products: buildProducts(f),
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

// Shared logic for active (In Progress) fundraisers with full data resolution
async function getActiveFundraisers() {
  const records = await airtableFetch('fundraisers', {
    filterByFormula: `{${FUNDRAISER_FIELDS.status_rendered}} = "In Progress"`,
    sort: [{ field: FUNDRAISER_FIELDS.end_date, direction: 'asc' }],
  });

  // Collect linked record IDs
  const repIds = new Set();
  const contactIds = new Set();
  const accountingIds = new Set();
  const taskIds = new Set();
  const productIds = new Set();

  for (const r of records) {
    const f = r.fields;
    (f[FUNDRAISER_FIELDS.rep] || []).forEach(id => repIds.add(id));
    (f[FUNDRAISER_FIELDS.primary_contact] || []).forEach(id => contactIds.add(id));
    (f[FUNDRAISER_FIELDS.accounting_contact] || []).forEach(id => accountingIds.add(id));
    (f[FUNDRAISER_FIELDS.tasks] || []).forEach(id => taskIds.add(id));
    (f[FUNDRAISER_FIELDS.product_primary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.product_secondary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.tp_mddonations] || []).forEach(id => productIds.add(id));
  }

  // Batch fetch linked records in parallel
  const [repRecords, contactRecords, accountingRecords, taskRecords, productRecords, repIdMap] = await Promise.all([
    airtableFetchByIds('reps', [...repIds]),
    airtableFetchByIds('client_book', [...contactIds]),
    airtableFetchByIds('accounting_contact', [...accountingIds]),
    airtableFetchByIds('tasks', [...taskIds]),
    airtableFetchByIds('products', [...productIds]),
    getRepIds(),
  ]);

  // Build lookup maps
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

  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const productMap = {};
  for (const r of productRecords) {
    productMap[r.id] = r.fields[PRODUCT_FIELDS.name] || '';
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

  // Helper to build products array from linked IDs
  function buildProducts(fields) {
    const products = [];
    const primaryIds = fields[FUNDRAISER_FIELDS.product_primary] || [];
    if (primaryIds.length > 0 && productMap[primaryIds[0]]) {
      products.push({ type: 'primary', name: productMap[primaryIds[0]] });
    }
    const secondaryIds = fields[FUNDRAISER_FIELDS.product_secondary] || [];
    if (secondaryIds.length > 0 && productMap[secondaryIds[0]]) {
      products.push({ type: 'secondary', name: productMap[secondaryIds[0]] });
    }
    const donationIds = fields[FUNDRAISER_FIELDS.tp_mddonations] || [];
    if (donationIds.length > 0 && productMap[donationIds[0]]) {
      products.push({ type: 'donations', name: productMap[donationIds[0]] });
    }
    return products;
  }

  // Build response
  return records.map(r => {
    const f = r.fields;

    const repLinked = f[FUNDRAISER_FIELDS.rep] || [];
    const rep_name = repLinked.length > 0 ? repMap[repLinked[0]] || '' : '';

    const contactLinked = f[FUNDRAISER_FIELDS.primary_contact] || [];
    const primary_contact_name = contactLinked.length > 0 ? contactMap[contactLinked[0]] || '' : '';

    const accountingLinked = f[FUNDRAISER_FIELDS.accounting_contact] || [];
    const accounting_contact_name = accountingLinked.length > 0 ? accountingMap[accountingLinked[0]] || '' : '';

    const photoAttachments = f[FUNDRAISER_FIELDS.rep_photo] || [];
    let rep_photo = null;
    if (photoAttachments.length > 0) {
      const att = photoAttachments[0];
      rep_photo = att.thumbnails?.large?.url || att.url || null;
    }

    const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
    const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

    const linkedTaskIds = f[FUNDRAISER_FIELDS.tasks] || [];
    const linkedTasks = linkedTaskIds.map(id => taskMap[id]).filter(Boolean);
    const open_tasks = linkedTasks.filter(t => t.status !== 'Done');

    return {
      id: r.id,
      organization: f[FUNDRAISER_FIELDS.organization] || '',
      team: f[FUNDRAISER_FIELDS.team] || '',
      kickoff_date: f[FUNDRAISER_FIELDS.kickoff_date] || null,
      end_date: f[FUNDRAISER_FIELDS.end_date] || null,
      gross_sales_md: f[FUNDRAISER_FIELDS.gross_sales_md] || null,
      rep_name,
      rep_photo,
      asb_boosters: f[FUNDRAISER_FIELDS.asb_boosters] || '',
      product_primary_string,
      products: buildProducts(f),
      primary_contact_name,
      accounting_contact_name,
      open_manager_tasks_count: f[FUNDRAISER_FIELDS.open_manager_tasks_count] || 0,
      open_tasks,
    };
  });
}

// GET /api/fundraisers/active — full data for active page
router.get('/active', async (req, res) => {
  try {
    const fundraisers = await getActiveFundraisers();
    res.json(fundraisers);
  } catch (err) {
    console.error('Error fetching active fundraisers:', err.message);
    res.status(500).json({ error: 'Failed to fetch active fundraisers' });
  }
});

// GET /api/fundraisers/active/count — lightweight count for sidebar badge
router.get('/active/count', async (req, res) => {
  try {
    const fundraisers = await getActiveFundraisers();
    res.json({ total: fundraisers.length });
  } catch (err) {
    console.error('Error fetching active count:', err.message);
    res.status(500).json({ error: 'Failed to fetch active count' });
  }
});

// Shared logic for ended fundraisers with full data resolution
async function getEndedFundraisers() {
  const records = await airtableFetch('fundraisers', {
    filterByFormula: `OR({${FUNDRAISER_FIELDS.status_rendered}} = "Campaign Ended", {${FUNDRAISER_FIELDS.status_rendered}} = "Ready to Close")`,
    sort: [{ field: FUNDRAISER_FIELDS.end_date, direction: 'asc' }],
  });

  // Collect linked record IDs
  const repIds = new Set();
  const accountingIds = new Set();
  const taskIds = new Set();
  const productIds = new Set();

  for (const r of records) {
    const f = r.fields;
    (f[FUNDRAISER_FIELDS.rep] || []).forEach(id => repIds.add(id));
    (f[FUNDRAISER_FIELDS.accounting_contact] || []).forEach(id => accountingIds.add(id));
    (f[FUNDRAISER_FIELDS.tasks] || []).forEach(id => taskIds.add(id));
    (f[FUNDRAISER_FIELDS.product_primary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.product_secondary] || []).forEach(id => productIds.add(id));
    (f[FUNDRAISER_FIELDS.tp_mddonations] || []).forEach(id => productIds.add(id));
  }

  // Batch fetch linked records in parallel
  const [repRecords, accountingRecords, taskRecords, productRecords, repIdMap] = await Promise.all([
    airtableFetchByIds('reps', [...repIds]),
    airtableFetchByIds('accounting_contact', [...accountingIds]),
    airtableFetchByIds('tasks', [...taskIds]),
    airtableFetchByIds('products', [...productIds]),
    getRepIds(),
  ]);

  // Build lookup maps
  const repMap = {};
  for (const r of repRecords) {
    repMap[r.id] = r.fields[REP_FIELDS.name] || '';
  }

  const accountingMap = {};
  for (const r of accountingRecords) {
    accountingMap[r.id] = r.fields[ACCOUNTING_CONTACT_FIELDS.name] || '';
  }

  const repIdToName = {};
  for (const [name, id] of Object.entries(repIdMap)) {
    repIdToName[id] = name;
  }

  const productMap = {};
  for (const r of productRecords) {
    productMap[r.id] = r.fields[PRODUCT_FIELDS.name] || '';
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

  // Helper to build products array
  function buildProducts(fields) {
    const products = [];
    const primaryIds = fields[FUNDRAISER_FIELDS.product_primary] || [];
    if (primaryIds.length > 0 && productMap[primaryIds[0]]) {
      products.push({ type: 'primary', name: productMap[primaryIds[0]] });
    }
    const secondaryIds = fields[FUNDRAISER_FIELDS.product_secondary] || [];
    if (secondaryIds.length > 0 && productMap[secondaryIds[0]]) {
      products.push({ type: 'secondary', name: productMap[secondaryIds[0]] });
    }
    const donationIds = fields[FUNDRAISER_FIELDS.tp_mddonations] || [];
    if (donationIds.length > 0 && productMap[donationIds[0]]) {
      products.push({ type: 'donations', name: productMap[donationIds[0]] });
    }
    return products;
  }

  // Build response
  return records.map(r => {
    const f = r.fields;

    const repLinked = f[FUNDRAISER_FIELDS.rep] || [];
    const rep_name = repLinked.length > 0 ? repMap[repLinked[0]] || '' : '';

    const accountingLinked = f[FUNDRAISER_FIELDS.accounting_contact] || [];
    const accounting_contact_name = accountingLinked.length > 0 ? accountingMap[accountingLinked[0]] || '' : '';

    const photoAttachments = f[FUNDRAISER_FIELDS.rep_photo] || [];
    let rep_photo = null;
    if (photoAttachments.length > 0) {
      const att = photoAttachments[0];
      rep_photo = att.thumbnails?.large?.url || att.url || null;
    }

    const productRaw = f[FUNDRAISER_FIELDS.product_primary_string];
    const product_primary_string = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';
    const asb_boosters = f[FUNDRAISER_FIELDS.asb_boosters] || '';

    const linkedTaskIds = f[FUNDRAISER_FIELDS.tasks] || [];
    const linkedTasks = linkedTaskIds.map(id => taskMap[id]).filter(Boolean);
    const open_tasks = linkedTasks.filter(t => t.status !== 'Done');

    // Closeout flags
    const md_payout_received = f[FUNDRAISER_FIELDS.md_payout_received] || false;
    const check_invoice_sent = f[FUNDRAISER_FIELDS.check_invoice_sent] || false;
    const rep_paid = f[FUNDRAISER_FIELDS.rep_paid] || false;
    const invoice_payment_received = f[FUNDRAISER_FIELDS.invoice_payment_received] || false;

    // MD payout applies when any MD-related product is linked or an md_payout amount exists
    const mdDonationIds = f[FUNDRAISER_FIELDS.tp_mddonations] || [];
    const has_md_product = product_primary_string.toLowerCase().includes('md')
      || mdDonationIds.length > 0
      || (f[FUNDRAISER_FIELDS.md_payout] != null && f[FUNDRAISER_FIELDS.md_payout] > 0);
    // Invoice required for WA State ASB, Traditional No-Risk, or Traditional Upfront
    const requires_invoice = asb_boosters === 'WA State ASB'
      || product_primary_string.toLowerCase().includes('traditional no-risk')
      || product_primary_string.toLowerCase().includes('traditional upfront');

    // Waiting badge logic
    const waiting_on_md_payout = !md_payout_received && has_md_product;
    const waiting_on_invoice_payment = !invoice_payment_received && requires_invoice;
    const needs_accounting_contact = accountingLinked.length === 0;
    const org_name_needs_follow_up = f[FUNDRAISER_FIELDS.organization_name_needs_follow_up] || false;
    const needs_card_count = product_primary_string === 'Team Cards - Traditional No-Risk'
      && (f[FUNDRAISER_FIELDS.cards_sold_manual] == null || f[FUNDRAISER_FIELDS.cards_sold_manual] === '');

    return {
      id: r.id,
      organization: f[FUNDRAISER_FIELDS.organization] || '',
      team: f[FUNDRAISER_FIELDS.team] || '',
      status: f[FUNDRAISER_FIELDS.status_rendered] || '',
      end_date: f[FUNDRAISER_FIELDS.end_date] || null,
      gross_sales_md: f[FUNDRAISER_FIELDS.gross_sales_md] || null,
      md_payout: f[FUNDRAISER_FIELDS.md_payout] || null,
      rep_ids: repLinked,
      rep_name,
      rep_photo,
      asb_boosters,
      product_primary_string,
      products: buildProducts(f),
      open_manager_tasks_count: f[FUNDRAISER_FIELDS.open_manager_tasks_count] || 0,
      open_tasks,
      accounting_contact_name,
      closeout: {
        md_payout_received,
        check_invoice_sent,
        rep_paid,
        invoice_payment_received,
      },
      waiting: {
        waiting_on_md_payout,
        waiting_on_invoice_payment,
        needs_accounting_contact,
        org_name_needs_follow_up,
        needs_card_count,
      },
    };
  });
}

// GET /api/fundraisers/ended — full data for ended page
router.get('/ended', async (req, res) => {
  try {
    const fundraisers = await getEndedFundraisers();
    res.json(fundraisers);
  } catch (err) {
    console.error('Error fetching ended fundraisers:', err.message);
    res.status(500).json({ error: 'Failed to fetch ended fundraisers' });
  }
});

// GET /api/fundraisers/ended/count — lightweight count for sidebar badge
router.get('/ended/count', async (req, res) => {
  try {
    const fundraisers = await getEndedFundraisers();
    const needsAction = fundraisers.filter(f => f.open_manager_tasks_count > 0).length;
    res.json({ total: fundraisers.length, needsAction });
  } catch (err) {
    console.error('Error fetching ended count:', err.message);
    res.status(500).json({ error: 'Failed to fetch ended count' });
  }
});

// GET /api/fundraisers/lookup/reps — dropdown options for reps
router.get('/lookup/reps', async (req, res) => {
  try {
    const records = await airtableFetch('reps', {});
    const result = records
      .map(r => ({
        id: r.id,
        name: r.fields[REP_FIELDS.name] || '',
        email: r.fields[REP_FIELDS.email] || '',
      }))
      .filter(r => r.name !== 'Office Manager' && r.name !== 'Cash');
    res.json(result);
  } catch (err) {
    console.error('Error fetching rep lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch reps' });
  }
});

// GET /api/fundraisers/lookup/contacts — dropdown options for primary contacts
router.get('/lookup/contacts', async (req, res) => {
  try {
    const records = await airtableFetch('client_book', {});
    const result = records.map(r => ({
      id: r.id,
      name: r.fields[CLIENT_BOOK_FIELDS.name] || '',
      email: r.fields[CLIENT_BOOK_FIELDS.email] || '',
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching contact lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/fundraisers/lookup/accounting-contacts — dropdown options for accounting contacts
router.get('/lookup/accounting-contacts', async (req, res) => {
  try {
    const records = await airtableFetch('accounting_contact', {});
    const result = records.map(r => ({
      id: r.id,
      name: r.fields[ACCOUNTING_CONTACT_FIELDS.name] || '',
      email: r.fields[ACCOUNTING_CONTACT_FIELDS.email] || '',
      status: r.fields[ACCOUNTING_CONTACT_FIELDS.status] || '',
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching accounting contact lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounting contacts' });
  }
});

// GET /api/fundraisers/lookup/products — dropdown options for products
router.get('/lookup/products', async (req, res) => {
  try {
    const records = await airtableFetch('products', {});
    const result = records.map(r => ({
      id: r.id,
      name: r.fields[PRODUCT_FIELDS.name] || '',
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching product lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
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

    // Collect all product IDs from all three product fields
    const allProductIds = new Set();
    (f[FUNDRAISER_FIELDS.product_primary] || []).forEach(id => allProductIds.add(id));
    (f[FUNDRAISER_FIELDS.product_secondary] || []).forEach(id => allProductIds.add(id));
    (f[FUNDRAISER_FIELDS.tp_mddonations] || []).forEach(id => allProductIds.add(id));

    // 3. Batch fetch all linked records in parallel
    const [repRecords, contactRecords, accountingRecords, taskRecords, dailyPayoutRecords, productRecords, repIdMap] = await Promise.all([
      airtableFetchByIds('reps', repLinkedIds),
      airtableFetchByIds('client_book', contactLinkedIds),
      airtableFetchByIds('accounting_contact', accountingLinkedIds),
      airtableFetchByIds('tasks', taskLinkedIds),
      airtableFetchByIds('daily_payouts', dailyPayoutLinkedIds),
      airtableFetchByIds('products', [...allProductIds]),
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

    const detailProductMap = {};
    for (const r of productRecords) {
      detailProductMap[r.id] = r.fields[PRODUCT_FIELDS.name] || '';
    }

    let product_secondary_name = '';
    const secondaryIds = f[FUNDRAISER_FIELDS.product_secondary] || [];
    if (secondaryIds.length > 0 && detailProductMap[secondaryIds[0]]) {
      product_secondary_name = detailProductMap[secondaryIds[0]];
    }

    // Build products array
    const products = [];
    const primaryIds = f[FUNDRAISER_FIELDS.product_primary] || [];
    if (primaryIds.length > 0 && detailProductMap[primaryIds[0]]) {
      products.push({ type: 'primary', name: detailProductMap[primaryIds[0]] });
    }
    if (product_secondary_name) {
      products.push({ type: 'secondary', name: product_secondary_name });
    }
    const donationIds = f[FUNDRAISER_FIELDS.tp_mddonations] || [];
    if (donationIds.length > 0 && detailProductMap[donationIds[0]]) {
      products.push({ type: 'donations', name: detailProductMap[donationIds[0]] });
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
      products,
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
      invoice_payment_received: f[FUNDRAISER_FIELDS.invoice_payment_received] || false,
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
      // Raw linked record IDs for edit mode dropdowns
      rep_id: repLinkedIds[0] || null,
      primary_contact_id: contactLinkedIds[0] || null,
      accounting_contact_id: accountingLinkedIds[0] || null,
      product_primary_id: (f[FUNDRAISER_FIELDS.product_primary] || [])[0] || null,
      product_secondary_id: (f[FUNDRAISER_FIELDS.product_secondary] || [])[0] || null,
      // Additional editable fields
      manual_status_override: f[FUNDRAISER_FIELDS.manual_status_override] || null,
      include_md_donations: f[FUNDRAISER_FIELDS.include_md_donations] || false,
      cards_sold_manual: f[FUNDRAISER_FIELDS.cards_sold_manual] || null,
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

    // Closeout checkboxes
    if (updates.md_payout_received !== undefined) fields[FUNDRAISER_FIELDS.md_payout_received] = updates.md_payout_received;
    if (updates.check_invoice_sent !== undefined) fields[FUNDRAISER_FIELDS.check_invoice_sent] = updates.check_invoice_sent;
    if (updates.rep_paid !== undefined) fields[FUNDRAISER_FIELDS.rep_paid] = updates.rep_paid;
    if (updates.invoice_payment_received !== undefined) fields[FUNDRAISER_FIELDS.invoice_payment_received] = updates.invoice_payment_received;
    // Notes
    if (updates.admin_notes !== undefined) fields[FUNDRAISER_FIELDS.admin_notes] = updates.admin_notes;
    // Status override
    if (updates.manual_status_override !== undefined) fields[FUNDRAISER_FIELDS.manual_status_override] = updates.manual_status_override;
    // Text fields
    if (updates.organization !== undefined) fields[FUNDRAISER_FIELDS.organization] = updates.organization;
    if (updates.team !== undefined) fields[FUNDRAISER_FIELDS.team] = updates.team;
    if (updates.md_portal_url !== undefined) fields[FUNDRAISER_FIELDS.md_portal_url] = updates.md_portal_url;
    // Date fields
    if (updates.kickoff_date !== undefined) fields[FUNDRAISER_FIELDS.kickoff_date] = updates.kickoff_date || null;
    if (updates.end_date !== undefined) fields[FUNDRAISER_FIELDS.end_date] = updates.end_date || null;
    // Select field
    if (updates.asb_boosters !== undefined) fields[FUNDRAISER_FIELDS.asb_boosters] = updates.asb_boosters || null;
    // Number fields
    if (updates.team_size !== undefined) fields[FUNDRAISER_FIELDS.team_size] = updates.team_size !== null && updates.team_size !== '' ? Number(updates.team_size) : null;
    if (updates.cards_ordered !== undefined) fields[FUNDRAISER_FIELDS.cards_ordered] = updates.cards_ordered !== null && updates.cards_ordered !== '' ? Number(updates.cards_ordered) : null;
    if (updates.cards_sold_manual !== undefined) fields[FUNDRAISER_FIELDS.cards_sold_manual] = updates.cards_sold_manual !== null && updates.cards_sold_manual !== '' ? Number(updates.cards_sold_manual) : null;
    if (updates.cards_lost !== undefined) fields[FUNDRAISER_FIELDS.cards_lost] = updates.cards_lost !== null && updates.cards_lost !== '' ? Number(updates.cards_lost) : null;
    // Currency fields
    if (updates.gross_sales_md !== undefined) fields[FUNDRAISER_FIELDS.gross_sales_md] = updates.gross_sales_md !== null && updates.gross_sales_md !== '' ? Number(updates.gross_sales_md) : null;
    if (updates.md_payout !== undefined) fields[FUNDRAISER_FIELDS.md_payout] = updates.md_payout !== null && updates.md_payout !== '' ? Number(updates.md_payout) : null;
    // Linked record fields
    if (updates.rep_id !== undefined) fields[FUNDRAISER_FIELDS.rep] = updates.rep_id ? [updates.rep_id] : [];
    if (updates.primary_contact_id !== undefined) fields[FUNDRAISER_FIELDS.primary_contact] = updates.primary_contact_id ? [updates.primary_contact_id] : [];
    if (updates.accounting_contact_id !== undefined) fields[FUNDRAISER_FIELDS.accounting_contact] = updates.accounting_contact_id ? [updates.accounting_contact_id] : [];
    if (updates.product_primary_id !== undefined) fields[FUNDRAISER_FIELDS.product_primary] = updates.product_primary_id ? [updates.product_primary_id] : [];
    if (updates.product_secondary_id !== undefined) fields[FUNDRAISER_FIELDS.product_secondary] = updates.product_secondary_id ? [updates.product_secondary_id] : [];
    // Checkbox
    if (updates.include_md_donations !== undefined) fields[FUNDRAISER_FIELDS.include_md_donations] = updates.include_md_donations;

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

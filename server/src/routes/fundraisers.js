import { Router } from 'express';
import {
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  airtableFetch,
  airtableFetchByIds,
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

export default router;

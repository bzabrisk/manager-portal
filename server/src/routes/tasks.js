import { Router } from 'express';
import {
  airtableFetch,
  airtableUpdate,
  airtableCreate,
  getFundraisersList,
  getRepIds,
  TASK_FIELDS,
  REP_IDS,
} from '../services/airtable.js';

const router = Router();

// GET /api/tasks — fetch tasks with resolved fundraiser data
router.get('/', async (req, res) => {
  try {
    const records = await airtableFetch('tasks', {
      sort: [{ field: TASK_FIELDS.deadline, direction: 'asc' }],
    });

    // Get fundraiser list for badge resolution
    const fundraisers = await getFundraisersList();
    const fundraiserMap = {};
    for (const f of fundraisers) {
      fundraiserMap[f.id] = f;
    }

    // Get rep IDs to resolve assignee names
    const repIds = await getRepIds();
    const repIdToName = {};
    for (const [name, id] of Object.entries(repIds)) {
      repIdToName[id] = name;
    }

    const tasks = records.map(r => {
      const f = r.fields;
      const linkedFundraisers = f[TASK_FIELDS.fundraisers] || [];
      const fundraiserInfo = linkedFundraisers.length > 0
        ? fundraiserMap[linkedFundraisers[0]] || null
        : null;

      const assigneeIds = f[TASK_FIELDS.assignee] || [];
      let assigneeName = assigneeIds.length > 0
        ? repIdToName[assigneeIds[0]] || 'Unknown'
        : 'Unknown';
      // Normalize names to match expected values
      if (assigneeName.toLowerCase().includes('cash')) assigneeName = 'Cash';
      if (assigneeName === 'Office Manager') assigneeName = 'Office Manager';

      return {
        id: r.id,
        name: f[TASK_FIELDS.name] || '',
        description: f[TASK_FIELDS.description] || '',
        status: f[TASK_FIELDS.status] || '',
        assignee: assigneeName,
        assigneeIds,
        deadline: f[TASK_FIELDS.deadline] || null,
        show_date: f[TASK_FIELDS.show_date] || f['show_date'] || null,
        action_url: f[TASK_FIELDS.action_url] || f['action_url'] || null,
        creation_method: f[TASK_FIELDS.creation_method] || '',
        created_at: f[TASK_FIELDS.created_at] || null,
        fundraiser: fundraiserInfo,
        fundraiserIds: linkedFundraisers,
      };
    });

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// PATCH /api/tasks/:recordId — update a task
router.patch('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const updates = req.body;
    const fields = {};

    if (updates.name !== undefined) fields[TASK_FIELDS.name] = updates.name;
    if (updates.description !== undefined) fields[TASK_FIELDS.description] = updates.description;
    if (updates.status !== undefined) fields[TASK_FIELDS.status] = updates.status;
    if (updates.deadline !== undefined) fields[TASK_FIELDS.deadline] = updates.deadline;
    if (updates.action_url !== undefined) fields[TASK_FIELDS.action_url] = updates.action_url;
    if (updates.fundraiserIds !== undefined) fields[TASK_FIELDS.fundraisers] = updates.fundraiserIds;

    const result = await airtableUpdate('tasks', recordId, fields);
    res.json(result);
  } catch (err) {
    console.error('Error updating task:', err.message);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /api/tasks — create a new task
router.post('/', async (req, res) => {
  try {
    const { name, description, deadline, fundraiserIds, action_url } = req.body;

    const officeManagerId = REP_IDS['Office Manager'];

    const fields = {
      [TASK_FIELDS.name]: name,
      [TASK_FIELDS.status]: 'To do',
      [TASK_FIELDS.assignee]: [officeManagerId],
      [TASK_FIELDS.deadline]: deadline,
      [TASK_FIELDS.creation_method]: 'Manual',
    };

    if (description) fields[TASK_FIELDS.description] = description;
    if (fundraiserIds && fundraiserIds.length > 0) fields[TASK_FIELDS.fundraisers] = fundraiserIds;
    if (action_url) fields[TASK_FIELDS.action_url] = action_url;

    const result = await airtableCreate('tasks', fields);
    res.json(result);
  } catch (err) {
    console.error('Error creating task:', err.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

export default router;

import { Router } from 'express';
import {
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  airtableGet,
  airtableUpdate,
} from '../services/airtable.js';

const router = Router();

// GET /api/cost/preview/:taskId
router.get('/preview/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const taskRecord = await airtableGet('tasks', taskId);
    const taskFields = taskRecord.fields;

    const fundraiserIds = taskFields[TASK_FIELDS.fundraisers] || [];
    if (fundraiserIds.length === 0) {
      return res.status(400).json({ error: 'Task has no linked fundraiser' });
    }

    const fundraiserRecord = await airtableGet('fundraisers', fundraiserIds[0]);
    const fr = fundraiserRecord.fields;

    const organization = fr[FUNDRAISER_FIELDS.organization] || '';
    const team = fr[FUNDRAISER_FIELDS.team] || '';
    const productRaw = fr[FUNDRAISER_FIELDS.product_primary_string];
    const productPrimary = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';
    const mdPortalUrl = fr[FUNDRAISER_FIELDS.md_portal_url] || '';
    const currentCost = fr[FUNDRAISER_FIELDS.cost_product] ?? null;

    res.json({
      organization,
      team,
      productPrimary,
      mdPortalUrl,
      currentCost,
      taskId,
      fundraiserId: fundraiserIds[0],
    });
  } catch (err) {
    console.error('Cost preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to load cost preview' });
  }
});

// POST /api/cost/save
router.post('/save', async (req, res) => {
  try {
    const { taskId, costProduct } = req.body;

    if (costProduct === undefined || costProduct === null || costProduct === '') {
      return res.status(400).json({ error: 'costProduct is required' });
    }

    const numVal = Number(costProduct);
    if (isNaN(numVal) || numVal < 0) {
      return res.status(400).json({ error: 'costProduct must be a non-negative number' });
    }

    const taskRecord = await airtableGet('tasks', taskId);
    const fundraiserIds = taskRecord.fields[TASK_FIELDS.fundraisers] || [];
    if (fundraiserIds.length === 0) {
      return res.status(400).json({ error: 'Task has no linked fundraiser' });
    }

    // Update fundraiser cost_product
    await airtableUpdate('fundraisers', fundraiserIds[0], {
      [FUNDRAISER_FIELDS.cost_product]: numVal,
    });

    // Mark task as Done
    await airtableUpdate('tasks', taskId, {
      [TASK_FIELDS.status]: 'Done',
      [TASK_FIELDS.completed_at]: new Date().toISOString().split('T')[0],
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cost save error:', err);
    res.status(500).json({ error: err.message || 'Failed to save product cost' });
  }
});

export default router;

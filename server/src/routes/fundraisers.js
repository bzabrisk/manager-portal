import { Router } from 'express';
import { getFundraisersList } from '../services/airtable.js';

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

export default router;

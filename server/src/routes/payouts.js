import { Router } from 'express';
import {
  DAILY_PAYOUT_FIELDS,
  airtableFetch,
  airtableUpdate,
} from '../services/airtable.js';

const router = Router();

// Determine which payout date to show based on Pacific time.
// Before 2pm PT: show yesterday's payouts (ran at 12:15am today).
// 2pm PT or after: show today's payouts (will run at 12:15am tonight).
function getPayoutContext() {
  const nowPacific = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = nowPacific.getHours();

  const todayPacific = new Date(nowPacific);
  todayPacific.setHours(0, 0, 0, 0);

  const yesterdayPacific = new Date(todayPacific);
  yesterdayPacific.setDate(yesterdayPacific.getDate() - 1);

  // Fetch window: 3 days back from today to handle timezone edge cases
  const fetchStartPacific = new Date(todayPacific);
  fetchStartPacific.setDate(fetchStartPacific.getDate() - 3);

  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const toLabel = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const fetchStartStr = toDateStr(fetchStartPacific);

  if (hour < 14) {
    const targetDate = toDateStr(yesterdayPacific);
    return {
      targetDate,
      fetchStartStr,
      displayContext: 'last_run',
      displayLabel: `Last daily e-checks run \u2014 ${toLabel(yesterdayPacific)} (ran at 12:15am today)`,
    };
  }
  const targetDate = toDateStr(todayPacific);
  return {
    targetDate,
    fetchStartStr,
    displayContext: 'next_run',
    displayLabel: `Next daily e-checks run \u2014 ${toLabel(todayPacific)} (runs at 12:15am tonight)`,
  };
}

// Convert a UTC run_date to a YYYY-MM-DD string in Pacific time
function toPacificDateStr(runDate) {
  if (!runDate) return null;
  return new Date(runDate).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// GET /api/payouts/today — daily payouts based on Pacific time context
router.get('/today', async (req, res) => {
  try {
    const ctx = getPayoutContext();
    // Fetch payouts from the last 3 days, then filter in code using Pacific timezone
    const allRecords = await airtableFetch('daily_payouts', {
      filterByFormula: `IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${ctx.fetchStartStr}'))`,
      sort: [{ field: DAILY_PAYOUT_FIELDS.run_date, direction: 'desc' }],
    });

    const records = allRecords.filter(r => {
      const runDate = r.fields[DAILY_PAYOUT_FIELDS.run_date];
      return toPacificDateStr(runDate) === ctx.targetDate;
    });

    const payouts = records.map(r => {
      const dp = r.fields;

      // organization and team are lookup fields — return as arrays
      const orgRaw = dp[DAILY_PAYOUT_FIELDS.organization];
      const organization = Array.isArray(orgRaw) ? orgRaw[0] || '' : orgRaw || '';

      const teamRaw = dp[DAILY_PAYOUT_FIELDS.team];
      const team = Array.isArray(teamRaw) ? teamRaw[0] || '' : teamRaw || '';

      // accounting_contact_name is a formula field — string directly
      const accounting_contact_name = dp[DAILY_PAYOUT_FIELDS.accounting_contact_name] || '';

      // payout_amount may be string or number
      const payoutRaw = dp[DAILY_PAYOUT_FIELDS.payout_amount];
      const payout_amount = typeof payoutRaw === 'string' ? parseFloat(payoutRaw) || 0 : payoutRaw || 0;

      // fundraiser is a linked record — array
      const fundraiserLinked = dp[DAILY_PAYOUT_FIELDS.fundraiser] || [];
      const fundraiser_id = fundraiserLinked.length > 0 ? fundraiserLinked[0] : null;

      return {
        id: r.id,
        payout_id: dp[DAILY_PAYOUT_FIELDS.payout_id] || '',
        organization,
        team,
        accounting_contact_name,
        run_date: dp[DAILY_PAYOUT_FIELDS.run_date] || null,
        gross_sales_today: dp[DAILY_PAYOUT_FIELDS.gross_sales_today] || 0,
        payout_amount,
        status: dp[DAILY_PAYOUT_FIELDS.status] || '',
        reference_number: dp[DAILY_PAYOUT_FIELDS.reference_number] || '',
        error_message: dp[DAILY_PAYOUT_FIELDS.error_message] || '',
        check_number: dp[DAILY_PAYOUT_FIELDS.check_number] || '',
        fundraiser_id,
      };
    });

    // Build summary
    const summary = {
      total: payouts.length,
      failed: payouts.filter(p => p.status === 'failed').length,
      awaiting_data: payouts.filter(p => p.status === 'awaiting_data').length,
      pending: payouts.filter(p => p.status === 'pending').length,
      sent: payouts.filter(p => p.status === 'sent').length,
    };

    res.json({
      payouts,
      summary,
      displayContext: ctx.displayContext,
      displayLabel: ctx.displayLabel,
    });
  } catch (err) {
    console.error('Error fetching today payouts:', err.message);
    res.status(500).json({ error: 'Failed to fetch today payouts' });
  }
});

// GET /api/payouts/today/summary — lightweight summary for sidebar badge
router.get('/today/summary', async (req, res) => {
  try {
    const ctx = getPayoutContext();
    // Fetch payouts from the last 3 days, then filter in code using Pacific timezone
    const allRecords = await airtableFetch('daily_payouts', {
      filterByFormula: `IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${ctx.fetchStartStr}'))`,
    });

    const records = allRecords.filter(r => {
      const runDate = r.fields[DAILY_PAYOUT_FIELDS.run_date];
      return toPacificDateStr(runDate) === ctx.targetDate;
    });

    const statuses = records.map(r => r.fields[DAILY_PAYOUT_FIELDS.status] || '');
    res.json({
      total: records.length,
      failed: statuses.filter(s => s === 'failed').length,
    });
  } catch (err) {
    console.error('Error fetching payout summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch payout summary' });
  }
});

// PATCH /api/payouts/:recordId — update payout fields (e.g. check_number)
router.patch('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { check_number } = req.body;
    const fields = {};
    if (check_number !== undefined) fields[DAILY_PAYOUT_FIELDS.check_number] = check_number;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await airtableUpdate('daily_payouts', recordId, fields);
    res.json({ success: true, id: result.id });
  } catch (err) {
    console.error('Error updating payout:', err.message);
    res.status(500).json({ error: 'Failed to update payout' });
  }
});

export default router;

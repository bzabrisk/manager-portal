import { Router } from 'express';
import {
  airtableGet,
  airtableFetchByIds,
  airtableUpdate,
  airtableCreate,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  REP_FIELDS,
  FUNDRAISER_PAYOUT_FIELDS,
} from '../services/airtable.js';

const router = Router();

function getCheckbookBaseUrl() {
  return process.env.CHECKBOOK_ENV === 'sandbox'
    ? 'https://sandbox.checkbook.io/v3'
    : 'https://checkbook.io/v3';
}

// GET /api/echeck/preview/:taskId
router.get('/preview/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const taskRecord = await airtableGet('tasks', taskId);
    const taskFields = taskRecord.fields;

    const actionUrl = taskFields[TASK_FIELDS.action_url] || '';
    const type = actionUrl.replace('echeck:', '');

    if (type !== 'team_profit' && type !== 'rep_commission') {
      return res.status(400).json({ error: 'Unknown e-check type' });
    }

    const fundraiserIds = taskFields[TASK_FIELDS.fundraisers] || [];
    if (fundraiserIds.length === 0) {
      return res.status(400).json({ error: 'Task has no linked fundraiser' });
    }

    const fundraiserRecord = await airtableGet('fundraisers', fundraiserIds[0]);
    const fr = fundraiserRecord.fields;

    const organization = fr[FUNDRAISER_FIELDS.organization] || '';
    const team = fr[FUNDRAISER_FIELDS.team] || '';

    let amount, recipientName, recipientEmail, pdfAttachments, description;

    if (type === 'team_profit') {
      amount = fr[FUNDRAISER_FIELDS.final_team_profit] || 0;
      description = `Team profit — ${organization} ${team}`;
      pdfAttachments = fr[FUNDRAISER_FIELDS.fundraiser_profit_report] || [];

      const accountingContactIds = fr[FUNDRAISER_FIELDS.accounting_contact] || [];
      if (accountingContactIds.length > 0) {
        const contacts = await airtableFetchByIds('accounting_contact', accountingContactIds);
        const contact = contacts[0];
        recipientName = contact ? (contact.fields[ACCOUNTING_CONTACT_FIELDS.name] || '') : '';
        recipientEmail = contact ? (contact.fields[ACCOUNTING_CONTACT_FIELDS.email] || '') : '';
      } else {
        recipientName = '';
        recipientEmail = '';
      }
    } else {
      // rep_commission
      amount = fr[FUNDRAISER_FIELDS.rep_commission] || 0;
      description = `Rep commission — ${organization} ${team}`;
      pdfAttachments = fr[FUNDRAISER_FIELDS.rep_commission_report] || [];

      const repIds = fr[FUNDRAISER_FIELDS.rep] || [];
      if (repIds.length > 0) {
        const reps = await airtableFetchByIds('reps', repIds);
        const rep = reps[0];
        recipientName = rep ? (rep.fields[REP_FIELDS.name] || '') : '';
        recipientEmail = rep ? (rep.fields[REP_FIELDS.email] || '') : '';
      } else {
        recipientName = '';
        recipientEmail = '';
      }
    }

    const hasPdf = pdfAttachments.length > 0;
    const pdfUrl = hasPdf ? pdfAttachments[0].url : null;
    const pdfFilename = hasPdf ? pdfAttachments[0].filename : null;

    res.json({
      type,
      recipientName,
      recipientEmail,
      amount,
      description,
      pdfUrl,
      pdfFilename,
      hasPdf,
      fundraiserId: fundraiserIds[0],
      taskId,
      organization,
      team,
    });
  } catch (err) {
    console.error('E-check preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate e-check preview' });
  }
});

// POST /api/echeck/send
router.post('/send', async (req, res) => {
  try {
    const { taskId, fundraiserId, type, recipientName, recipientEmail, amount, description } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const idempotencyKey = `echeck-${taskId}`;

    const response = await fetch(`${getCheckbookBaseUrl()}/check/digital`, {
      method: 'POST',
      headers: {
        'Authorization': `${process.env.CHECKBOOK_API_KEY}:${process.env.CHECKBOOK_API_SECRET}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        name: recipientName,
        recipient: recipientEmail,
        amount: amount,
        description: description,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));

      // Record the failed attempt in fundraiser_payouts
      try {
        await airtableCreate('fundraiser_payouts', {
          [FUNDRAISER_PAYOUT_FIELDS.fundraiser]: [fundraiserId],
          [FUNDRAISER_PAYOUT_FIELDS.payout_purpose]: type === 'team_profit' ? 'Team Profit' : 'Rep Commission',
          [FUNDRAISER_PAYOUT_FIELDS.status]: 'failed',
          [FUNDRAISER_PAYOUT_FIELDS.error_message]: errBody.message || errBody.error || `HTTP ${response.status}`,
          [FUNDRAISER_PAYOUT_FIELDS.idempotency_key]: idempotencyKey,
          [FUNDRAISER_PAYOUT_FIELDS.sent_at]: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        });
      } catch (payoutErr) {
        console.error('Warning: Failed to create fundraiser_payouts record for failed send:', payoutErr.message);
      }

      throw new Error(errBody.message || errBody.error || `Checkbook API error: ${response.status}`);
    }

    const data = await response.json();

    // Mark task as Done
    await airtableUpdate('tasks', taskId, {
      [TASK_FIELDS.status]: 'Done',
      [TASK_FIELDS.completed_at]: new Date().toISOString().split('T')[0],
    });

    // Create fundraiser_payouts record to track this payment
    const payoutPurpose = type === 'team_profit' ? 'Team Profit' : 'Rep Commission';

    try {
      await airtableCreate('fundraiser_payouts', {
        [FUNDRAISER_PAYOUT_FIELDS.fundraiser]: [fundraiserId],
        [FUNDRAISER_PAYOUT_FIELDS.payout_purpose]: payoutPurpose,
        [FUNDRAISER_PAYOUT_FIELDS.status]: 'sent',
        [FUNDRAISER_PAYOUT_FIELDS.reference_number]: String(data.id),
        [FUNDRAISER_PAYOUT_FIELDS.check_number]: data.number || null,
        [FUNDRAISER_PAYOUT_FIELDS.sent_at]: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        [FUNDRAISER_PAYOUT_FIELDS.idempotency_key]: idempotencyKey,
      });
    } catch (payoutErr) {
      console.error('Warning: E-check sent successfully but failed to create fundraiser_payouts record:', payoutErr.message);
      // Don't fail the whole request — the check was already sent successfully
    }

    res.json({ success: true, checkId: data.id });
  } catch (err) {
    console.error('E-check send error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send e-check' });
  }
});

export default router;

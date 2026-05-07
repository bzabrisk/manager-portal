import { Router } from 'express';
import {
  airtableGet,
  airtableFetch,
  airtableFetchByIds,
  airtableUpdate,
  airtableCreate,
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  CLIENT_BOOK_FIELDS,
  REP_FIELDS,
  FUNDRAISER_PAYOUT_FIELDS,
} from '../services/airtable.js';
import { sendEmail } from '../services/gmail.js';

const router = Router();

const BULK_REP_CONFIG = {
  dravin: {
    name: 'Dravin McGaughy',
    email: 'dravin@smashfundraising.com',
    recordId: 'recdywD6yFFsan38u',
    airtableView: "Dravin's Quarterly Rep Commissions",
  },
  tahni: {
    name: 'Tahni McGaughy',
    email: 'tahni@smashfundraising.com',
    recordId: 'recLmSrcuiM8uwxb9',
    airtableView: "Tahni's Quarterly Rep Commissions",
  },
};

const KRISTA_SIGNATURE = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; padding-top: 15px;">
  <tr>
    <td style="padding-right: 15px; vertical-align: middle;">
      <img src="https://images.squarespace-cdn.com/content/v1/654db8b24e5e08109904da97/6df12bb7-98af-47dc-93f7-34e6a25eeaf2/blacklogo_1%403x.png" alt="SMASH" width="80" style="display: block;" />
    </td>
    <td style="padding-left: 15px; vertical-align: middle; font-family: Arial, sans-serif;">
      <strong style="font-size: 14px; color: #333;">Krista McGaughy</strong> <span style="font-size: 14px; color: #333;">• <em>Business Manager</em></span><br/>
      <a href="mailto:krista@smashfundraising.com" style="font-size: 13px; color: #1a73e8; text-decoration: none;">krista@smashfundraising.com</a><br/>
      <span style="font-size: 12px; color: #777;">A Washington School Fundraising Partner</span>
    </td>
  </tr>
</table>`;

function getCheckbookBaseUrl() {
  return process.env.CHECKBOOK_ENV === 'sandbox'
    ? 'https://sandbox.checkbook.io/v3'
    : 'https://checkbook.io/v3';
}

// GET /api/echeck/bulk-preview/:repKey
// NOTE: Must come before /preview/:taskId so Express doesn't match "bulk-preview" as a taskId.
router.get('/bulk-preview/:repKey', async (req, res) => {
  try {
    const { repKey } = req.params;
    const config = BULK_REP_CONFIG[repKey];
    if (!config) {
      return res.status(400).json({ error: `Unknown rep key: ${repKey}` });
    }

    const records = await airtableFetch('fundraisers', { view: config.airtableView });

    const fundraisers = [];
    for (const r of records) {
      const f = r.fields;
      // Safety net — exclude already-paid
      if (f[FUNDRAISER_FIELDS.rep_paid]) continue;

      const attachments = f[FUNDRAISER_FIELDS.rep_commission_report] || [];
      const hasPdf = attachments.length > 0;

      fundraisers.push({
        id: r.id,
        organization: f[FUNDRAISER_FIELDS.organization] || '',
        team: f[FUNDRAISER_FIELDS.team] || '',
        endDate: f[FUNDRAISER_FIELDS.end_date] || null,
        commission: f[FUNDRAISER_FIELDS.rep_commission] || 0,
        statusRendered: f[FUNDRAISER_FIELDS.status_rendered] || '',
        hasPdf,
        pdfUrl: hasPdf ? attachments[0].url : null,
        pdfFilename: hasPdf ? attachments[0].filename : null,
      });
    }

    res.json({
      rep: { name: config.name, email: config.email },
      fundraisers,
    });
  } catch (err) {
    console.error('Bulk e-check preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to load bulk e-check preview' });
  }
});

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

    let endDate, grossSales, repName, productName, primaryContactName;

    if (type === 'team_profit') {
      amount = fr[FUNDRAISER_FIELDS.final_team_profit] || 0;
      description = `Team profit — ${organization} ${team}`;
      pdfAttachments = fr[FUNDRAISER_FIELDS.fundraiser_profit_report] || [];

      // Extra fields for team_profit email template
      const rawEndDate = fr[FUNDRAISER_FIELDS.end_date] || '';
      endDate = rawEndDate
        ? new Date(rawEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';
      grossSales = fr[FUNDRAISER_FIELDS.gross_sales_md] || 0;
      console.log(`[echeck preview] grossSales raw value for fundraiser ${fundraiserIds[0]}:`, fr[FUNDRAISER_FIELDS.gross_sales_md]);
      const productRaw = fr[FUNDRAISER_FIELDS.product_primary_string];
      productName = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

      const accountingContactIds = fr[FUNDRAISER_FIELDS.accounting_contact] || [];
      const repIds = fr[FUNDRAISER_FIELDS.rep] || [];
      const primaryContactIds = fr[FUNDRAISER_FIELDS.primary_contact] || [];

      const [contacts, reps, primaryContacts] = await Promise.all([
        accountingContactIds.length > 0 ? airtableFetchByIds('accounting_contact', accountingContactIds) : [],
        repIds.length > 0 ? airtableFetchByIds('reps', repIds) : [],
        primaryContactIds.length > 0 ? airtableFetchByIds('client_book', primaryContactIds) : [],
      ]);

      const contact = contacts[0];
      recipientName = organization;
      recipientEmail = contact ? (contact.fields[ACCOUNTING_CONTACT_FIELDS.email] || '') : '';

      const rep = reps[0];
      repName = rep ? (rep.fields[REP_FIELDS.name] || '') : '';

      const pc = primaryContacts[0];
      primaryContactName = pc ? (pc.fields[CLIENT_BOOK_FIELDS.name] || '') : '';
    } else {
      // rep_commission
      amount = fr[FUNDRAISER_FIELDS.rep_commission] || 0;
      description = `Rep commission — ${organization} ${team}`;
      pdfAttachments = fr[FUNDRAISER_FIELDS.rep_commission_report] || [];

      const repIds = fr[FUNDRAISER_FIELDS.rep] || [];
      if (repIds.length > 0) {
        const reps = await airtableFetchByIds('reps', repIds);
        const rep = reps[0];
        recipientName = rep ? (rep.fields[REP_FIELDS.business_name] || '') : '';
        recipientEmail = rep ? (rep.fields[REP_FIELDS.email] || '') : '';
      } else {
        recipientName = '';
        recipientEmail = '';
      }
    }

    const hasPdf = pdfAttachments.length > 0;
    const pdfUrl = hasPdf ? pdfAttachments[0].url : null;
    const pdfFilename = hasPdf ? pdfAttachments[0].filename : null;

    const previewData = {
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
    };

    if (type === 'team_profit') {
      previewData.endDate = endDate;
      previewData.grossSales = grossSales;
      previewData.repName = repName;
      previewData.productName = productName;
      previewData.primaryContactName = primaryContactName;
    }

    res.json(previewData);
  } catch (err) {
    console.error('E-check preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate e-check preview' });
  }
});

// POST /api/echeck/bulk-send
// NOTE: Must come before /send so Express route ordering works correctly alongside the bulk-preview pair.
router.post('/bulk-send', async (req, res) => {
  try {
    const { repKey, fundraiserIds, totalAmount, description } = req.body;

    const config = BULK_REP_CONFIG[repKey];
    if (!config) {
      return res.status(400).json({ error: `Unknown rep key: ${repKey}` });
    }
    if (!Array.isArray(fundraiserIds) || fundraiserIds.length === 0) {
      return res.status(400).json({ error: 'fundraiserIds must be a non-empty array' });
    }
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'totalAmount must be greater than 0' });
    }
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Re-fetch fundraisers to validate amount
    const fundraiserRecords = await airtableFetchByIds('fundraisers', fundraiserIds);
    if (fundraiserRecords.length !== fundraiserIds.length) {
      return res.status(400).json({ error: 'Some fundraiser IDs were not found' });
    }
    const computedTotal = fundraiserRecords.reduce(
      (sum, r) => sum + (r.fields[FUNDRAISER_FIELDS.rep_commission] || 0),
      0
    );
    if (Math.abs(computedTotal - totalAmount) > 0.01) {
      return res.status(400).json({
        error: `Amount mismatch: client sent $${totalAmount.toFixed(2)} but Airtable totals $${computedTotal.toFixed(2)}. Please refresh and try again.`,
      });
    }

    const idempotencyKey = `bulk-rep-${repKey}-${Date.now()}`;

    // Send the e-check via Checkbook.io
    const response = await fetch(`${getCheckbookBaseUrl()}/check/digital`, {
      method: 'POST',
      headers: {
        'Authorization': `${process.env.CHECKBOOK_API_KEY}:${process.env.CHECKBOOK_API_SECRET}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        name: config.name,
        recipient: config.email,
        amount: totalAmount,
        description: description,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      try {
        await airtableCreate('fundraiser_payouts', {
          [FUNDRAISER_PAYOUT_FIELDS.fundraiser]: fundraiserIds,
          [FUNDRAISER_PAYOUT_FIELDS.payout_purpose]: 'Rep Commission',
          [FUNDRAISER_PAYOUT_FIELDS.status]: 'failed',
          [FUNDRAISER_PAYOUT_FIELDS.error_message]: errBody.message || errBody.error || `HTTP ${response.status}`,
          [FUNDRAISER_PAYOUT_FIELDS.idempotency_key]: idempotencyKey,
          [FUNDRAISER_PAYOUT_FIELDS.sent_at]: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        });
      } catch (payoutErr) {
        console.error('Warning: Failed to record bulk failed send:', payoutErr.message);
      }
      throw new Error(errBody.message || errBody.error || `Checkbook API error: ${response.status}`);
    }

    const data = await response.json();

    // Record one fundraiser_payouts row linking all fundraisers
    try {
      await airtableCreate('fundraiser_payouts', {
        [FUNDRAISER_PAYOUT_FIELDS.fundraiser]: fundraiserIds,
        [FUNDRAISER_PAYOUT_FIELDS.payout_purpose]: 'Rep Commission',
        [FUNDRAISER_PAYOUT_FIELDS.status]: 'sent',
        [FUNDRAISER_PAYOUT_FIELDS.reference_number]: String(data.id),
        [FUNDRAISER_PAYOUT_FIELDS.check_number]: data.number || null,
        [FUNDRAISER_PAYOUT_FIELDS.sent_at]: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        [FUNDRAISER_PAYOUT_FIELDS.idempotency_key]: idempotencyKey,
      });
    } catch (payoutErr) {
      console.error('Warning: Bulk e-check sent but failed to create fundraiser_payouts record:', payoutErr.message);
    }

    // Mark fundraisers as rep_paid (Airtable batch endpoint accepts up to 10 records at a time)
    const tableId = TABLES.fundraisers;
    const apiUrl = `https://api.airtable.com/v0/appxDlniu6IPMVIVp/${tableId}`;
    for (let i = 0; i < fundraiserIds.length; i += 10) {
      const batch = fundraiserIds.slice(i, i + 10);
      const updateRes = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: batch.map(id => ({
            id,
            fields: { [FUNDRAISER_FIELDS.rep_paid]: true },
          })),
        }),
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error(`Warning: Failed to mark batch as rep_paid: ${errText}`);
      }
    }

    res.json({
      success: true,
      checkId: data.id,
      checkNumber: data.number || null,
      amount: totalAmount,
      fundraiserCount: fundraiserIds.length,
    });
  } catch (err) {
    console.error('Bulk e-check send error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send bulk e-check' });
  }
});

// POST /api/echeck/send
router.post('/send', async (req, res) => {
  try {
    const { taskId, fundraiserId, type, recipientName, recipientEmail, amount, description, pdfUrl, pdfFilename, organization, team } = req.body;

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

    // Mark task as Done (skip for team_profit — frontend marks done after step 2)
    if (type !== 'team_profit') {
      await airtableUpdate('tasks', taskId, {
        [TASK_FIELDS.status]: 'Done',
        [TASK_FIELDS.completed_at]: new Date().toISOString().split('T')[0],
      });
    }

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

    // Best-effort companion email with PDF report (rep_commission only)
    // Team profit emails are sent manually from the frontend wizard step 2
    const result = { success: true, checkId: data.id };

    if (type === 'rep_commission' && pdfUrl && pdfFilename) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        await sendEmail({
          to: recipientEmail,
          subject: `Your SMASH Fundraising Commission Report — ${organization} ${team}`,
          html: `Hi ${recipientName},<br><br>Your commission e-check for ${organization} ${team} has been sent via Checkbook.io. You'll receive a separate email from Checkbook with deposit instructions.<br><br>Your commission report is attached for your records.<br><br>Thank you,<br>Krista McGaughy<br>SMASH Fundraising` + KRISTA_SIGNATURE,
          attachments: [{ filename: pdfFilename, content: pdfBuffer }],
        });

        console.log(`Companion email with PDF sent to ${recipientEmail} for check ${data.id}`);
        result.emailSent = true;
      } catch (emailErr) {
        console.error(`Companion email failed for check ${data.id}:`, emailErr.message);
        result.emailSent = false;
        result.emailError = emailErr.message;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('E-check send error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send e-check' });
  }
});

// POST /api/echeck/send-report-email
router.post('/send-report-email', async (req, res) => {
  try {
    const { recipientEmail, recipientName, subject, htmlBody, pdfUrl, pdfFilename } = req.body;

    if (!recipientEmail || !subject || !htmlBody) {
      return res.status(400).json({ error: 'Missing required fields: recipientEmail, subject, htmlBody' });
    }

    const fullHtml = htmlBody + KRISTA_SIGNATURE;

    const attachments = [];
    if (pdfUrl) {
      try {
        const fileResponse = await fetch(pdfUrl);
        if (fileResponse.ok) {
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          attachments.push({
            filename: pdfFilename || 'report.pdf',
            content: buffer,
          });
        } else {
          console.warn('Could not download PDF for report email:', fileResponse.status);
        }
      } catch (err) {
        console.warn('Error downloading PDF for report email attachment:', err.message);
      }
    }

    await sendEmail({
      to: recipientEmail,
      subject,
      html: fullHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log(`Report email sent to ${recipientEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Report email send error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send report email' });
  }
});

export default router;

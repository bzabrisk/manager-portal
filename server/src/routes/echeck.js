import { Router } from 'express';
import {
  airtableGet,
  airtableFetchByIds,
  airtableUpdate,
  airtableCreate,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  CLIENT_BOOK_FIELDS,
  REP_FIELDS,
  FUNDRAISER_PAYOUT_FIELDS,
} from '../services/airtable.js';

const router = Router();

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
      recipientName = contact ? (contact.fields[ACCOUNTING_CONTACT_FIELDS.name] || '') : '';
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

    // Best-effort companion email with PDF report via Resend (rep_commission only)
    // Team profit emails are sent manually from the frontend wizard step 2
    const result = { success: true, checkId: data.id };

    if (type === 'rep_commission' && pdfUrl && pdfFilename) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const base64Content = pdfBuffer.toString('base64');

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Krista — SMASH Fundraising <krista@send.smashfundraising.com>',
            to: [recipientEmail],
            subject: `Your SMASH Fundraising Commission Report — ${organization} ${team}`,
            html: `Hi ${recipientName},<br><br>Your commission e-check for ${organization} ${team} has been sent via Checkbook.io. You'll receive a separate email from Checkbook with deposit instructions.<br><br>Your commission report is attached for your records.<br><br>Thank you,<br>Krista McGaughy<br>SMASH Fundraising` + KRISTA_SIGNATURE,
            attachments: [{ filename: pdfFilename, content: base64Content }],
          }),
        });

        if (!resendResponse.ok) {
          const resendError = await resendResponse.json().catch(() => ({}));
          throw new Error(resendError.message || `Resend API error: ${resendResponse.status}`);
        }

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

    const resendPayload = {
      from: 'Krista — SMASH Fundraising <krista@send.smashfundraising.com>',
      to: [recipientEmail],
      subject,
      html: fullHtml,
    };

    if (pdfUrl) {
      try {
        const fileResponse = await fetch(pdfUrl);
        if (fileResponse.ok) {
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          const base64Content = buffer.toString('base64');
          resendPayload.attachments = [{
            filename: pdfFilename || 'report.pdf',
            content: base64Content,
          }];
        } else {
          console.warn('Could not download PDF for report email:', fileResponse.status);
        }
      } catch (err) {
        console.warn('Error downloading PDF for report email attachment:', err.message);
      }
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.json().catch(() => ({}));
      throw new Error(resendError.message || `Resend API error: ${resendResponse.status}`);
    }

    console.log(`Report email sent to ${recipientEmail}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Report email send error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send report email' });
  }
});

export default router;

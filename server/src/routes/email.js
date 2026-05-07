import { Router } from 'express';
import {
  airtableGet,
  airtableFetchByIds,
  airtableUpdate,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  CLIENT_BOOK_FIELDS,
  REP_FIELDS,
} from '../services/airtable.js';
import { sendEmail } from '../services/gmail.js';

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

const getFirstName = (fullName) => (fullName || '').split(' ')[0];

const EMAIL_TEMPLATES = {
  'asb-onboarding': {
    subject: (data) => `${data.team} fundraiser: ASB Compliant Onboarding with SMASH Fundraising`,
    body: (data) => {
      const kickoffFormatted = data.kickoff_date
        ? new Date(data.kickoff_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '[date TBD]';

      return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
<p>Hello ${getFirstName(data.accounting_contact_name)},</p>

<p>I'm Krista, Business Manager at SMASH Fundraising. ${data.organization} ${data.team} has a fundraiser scheduled to start on ${kickoffFormatted} with our rep, ${data.rep_name}. I understand that this fundraiser will be run through ASB, and therefore will require our fully ASB-compliant program.</p>

<p>If this is our first time working together, please confirm receipt of this email before fundraiser kickoff for security purposes.</p>

<p>If you're new to this, or just need a refresher, here's how it works:</p>

<p style="margin-left: 20px;">1. At the end of each weekday the fundraiser is active, we will send an e-check to this email, totaling the gross funds raised for that day. These checks can be printed and deposited just like a normal check. <strong>These funds are intact, meaning that no fees, charges, or costs are taken out.</strong></p>

<p style="margin-left: 20px;">2. At the fundraiser close, you hold the gross total funds raised. We will then send you an itemized invoice for all fundraiser costs.</p>

<p><em>Optional:</em> Some districts require a signed contract in place before each fundraiser. For your convenience, I attached a pre-filled and pre-signed ASB-compliant Fundraiser Agreement to this email. If your district prefers/requires district-wide vendor approval, we do that too. Just put us in touch with the right person and we'll take it from there.</p>

<p>If you have any questions or if your district has additional needs, I would love to chat. You can respond to me here, or text/call (360) 482-3341. We love simplifying the work of our ASB/financial advisors.</p>
</div>`;
    },
  },
};

// GET /api/email/preview/:taskId
router.get('/preview/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const taskRecord = await airtableGet('tasks', taskId);
    const taskFields = taskRecord.fields;

    const actionUrl = taskFields[TASK_FIELDS.action_url] || '';
    const templateId = actionUrl.replace('email:', '');

    if (!EMAIL_TEMPLATES[templateId]) {
      return res.status(400).json({ error: 'Unknown email template' });
    }

    const fundraiserIds = taskFields[TASK_FIELDS.fundraisers] || [];
    if (fundraiserIds.length === 0) {
      return res.status(400).json({ error: 'Task has no linked fundraiser' });
    }

    const fundraiserRecord = await airtableGet('fundraisers', fundraiserIds[0]);
    const fr = fundraiserRecord.fields;

    const organization = fr[FUNDRAISER_FIELDS.organization] || '';
    const team = fr[FUNDRAISER_FIELDS.team] || '';
    const kickoff_date = fr[FUNDRAISER_FIELDS.kickoff_date] || '';
    const accountingContactIds = fr[FUNDRAISER_FIELDS.accounting_contact] || [];
    const primaryContactIds = fr[FUNDRAISER_FIELDS.primary_contact] || [];
    const repIds = fr[FUNDRAISER_FIELDS.rep] || [];
    const productRaw = fr[FUNDRAISER_FIELDS.product_primary_string];
    const product = Array.isArray(productRaw) ? productRaw[0] || '' : productRaw || '';

    // Fetch linked records in parallel
    const [accountingContacts, primaryContacts, reps] = await Promise.all([
      accountingContactIds.length > 0 ? airtableFetchByIds('accounting_contact', accountingContactIds) : [],
      primaryContactIds.length > 0 ? airtableFetchByIds('client_book', primaryContactIds) : [],
      repIds.length > 0 ? airtableFetchByIds('reps', repIds) : [],
    ]);

    const acRecord = accountingContacts[0];
    const acEmail = acRecord ? (acRecord.fields[ACCOUNTING_CONTACT_FIELDS.email] || '') : '';
    const acName = acRecord ? (acRecord.fields[ACCOUNTING_CONTACT_FIELDS.name] || '') : '';

    const pcRecord = primaryContacts[0];
    const pcName = pcRecord ? (pcRecord.fields[CLIENT_BOOK_FIELDS.name] || '') : '';

    const repRecord = reps[0];
    const repName = repRecord ? (repRecord.fields[REP_FIELDS.name] || '') : '';

    const mergeData = {
      organization,
      team,
      kickoff_date,
      accounting_contact_name: acName,
      primary_contact_name: pcName,
      rep_name: repName,
      product,
    };

    const template = EMAIL_TEMPLATES[templateId];

    const agreementAttachments = fr[FUNDRAISER_FIELDS.fundraiser_agreement] || [];
    const hasAgreement = agreementAttachments.length > 0;
    const agreementUrl = hasAgreement ? agreementAttachments[0].url : null;
    const agreementFilename = hasAgreement ? agreementAttachments[0].filename : null;

    res.json({
      to: acEmail,
      toName: acName,
      subject: template.subject(mergeData),
      body: template.body(mergeData),
      templateId,
      fundraiserId: fundraiserIds[0],
      taskId,
      mergeData,
      hasAgreement,
      agreementUrl,
      agreementFilename,
      signature: KRISTA_SIGNATURE,
    });
  } catch (err) {
    console.error('Email preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate email preview' });
  }
});

// POST /api/email/send
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, taskId, agreementUrl, agreementFilename } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    // Build the full HTML body with signature
    const fullHtml = body + KRISTA_SIGNATURE;

    // Build attachments if present
    const attachments = [];
    if (agreementUrl) {
      try {
        const fileResponse = await fetch(agreementUrl);
        if (fileResponse.ok) {
          const buffer = Buffer.from(await fileResponse.arrayBuffer());
          attachments.push({
            filename: agreementFilename || 'Fundraiser-Agreement.pdf',
            content: buffer,
          });
        } else {
          console.warn('Could not download agreement file:', fileResponse.status);
        }
      } catch (err) {
        console.warn('Error downloading agreement for attachment:', err.message);
      }
    }

    // Send via Gmail API
    await sendEmail({
      to,
      subject,
      html: fullHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (taskId) {
      await airtableUpdate('tasks', taskId, {
        [TASK_FIELDS.status]: 'Done',
        [TASK_FIELDS.completed_at]: new Date().toISOString().split('T')[0],
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

export default router;

import { Router } from 'express';
import nodemailer from 'nodemailer';
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

const router = Router();

const EMAIL_TEMPLATES = {
  'asb-onboarding': {
    subject: (data) => `SMASH Fundraising — ASB Onboarding for ${data.organization} ${data.team}`,
    body: (data) => `<p>Hi ${data.accounting_contact_name},</p>

<p>My name is Krista and I'm the billing coordinator at SMASH Fundraising. I'll be your point of contact for the upcoming <strong>${data.organization} ${data.team}</strong> fundraiser${data.kickoff_date ? ` kicking off on <strong>${new Date(data.kickoff_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>` : ''}.</p>

<p>[PLACEHOLDER — Write the actual ASB onboarding email content here. This should explain the daily e-check process, what the accounting contact needs to know, and any setup steps required.]</p>

<p>Please don't hesitate to reach out if you have any questions!</p>

<p>Best,<br/>Krista<br/>SMASH Fundraising<br/>krista@smashfundraising.com</p>`,
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

    res.json({
      to: acEmail,
      toName: acName,
      subject: template.subject(mergeData),
      body: template.body(mergeData),
      templateId,
      fundraiserId: fundraiserIds[0],
      taskId,
      mergeData,
    });
  } catch (err) {
    console.error('Email preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate email preview' });
  }
});

// POST /api/email/send
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, taskId } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Krista — SMASH Fundraising" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: body,
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

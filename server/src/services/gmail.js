// Gmail send service — sends email via Krista's Gmail account using the Gmail API

import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

/**
 * Send an email via Gmail API.
 * @param {object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject - email subject
 * @param {string} opts.html - HTML body
 * @param {Array<{filename: string, content: string|Buffer}>} [opts.attachments] - content as base64 string or Buffer
 * @returns {Promise<{success: true, id: string}>}
 */
export async function sendEmail({ to, subject, html, attachments }) {
  const required = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_GMAIL_REFRESH_TOKEN: process.env.GOOGLE_GMAIL_REFRESH_TOKEN,
    GMAIL_SEND_AS: process.env.GMAIL_SEND_AS,
  };
  for (const [name, val] of Object.entries(required)) {
    if (!val) throw new Error(`Gmail config missing: ${name}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    required.GOOGLE_CLIENT_ID,
    required.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: required.GOOGLE_GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const from = required.GMAIL_SEND_AS;

  const mailOptions = { from, to, subject, html };

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content
        : Buffer.from(att.content, 'base64'),
    }));
  }

  const mail = new MailComposer(mailOptions);
  const message = await mail.compile().build();
  const raw = message
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return { success: true, id: res.data.id };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Gmail send failed: ${msg}`);
  }
}

// Login logging and alerting — modeled on payoutHealth.js ("detect, throttle,
// email via the Gmail send path").
//
// Every attempt is logged to the console with timestamp, outcome, and source
// IP. The submitted password is never logged, not even truncated.
//
// Two email alerts, both to ALERT_RECIPIENTS:
//   1. "new login" on success — throttled to one per 12 hours, EXCEPT that a
//      login from an IP not seen in the last 30 days always sends.
//   2. "repeated failed logins" — sent immediately when an IP reaches five
//      consecutive failures (the lockout trigger). Never throttled.
//
// All tracking is in memory. A restart forgets everything, so the first login
// after a deploy re-alerts once. That is acceptable.

import { sendEmail } from './gmail.js';
import { ALERT_RECIPIENTS } from './payoutHealth.js';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const FAILURE_ALERT_THRESHOLD = 5;

export const NEW_LOGIN_SUBJECT = 'SMASH Manager Portal — new login';
export const FAILED_LOGINS_SUBJECT = '⚠️ SMASH Manager Portal — repeated failed logins';

function pacificTimestamp(date) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'long',
  });
}

// Factory so tests can inject a fake sender/clock. The app uses the default
// instance exported at the bottom.
export function createLoginAudit({ send = sendEmail, now = () => Date.now(), recipients = ALERT_RECIPIENTS } = {}) {
  let lastNewLoginEmailAt = 0;
  const lastSeenByIp = new Map();          // ip -> ms timestamp of last successful login
  const consecutiveFailuresByIp = new Map(); // ip -> count since last success

  function log(outcome, ip) {
    const line = `[auth] ${new Date(now()).toISOString()} login ${outcome} ip=${ip}`;
    if (outcome === 'success') console.log(line);
    else console.warn(line);
  }

  async function safeSend(opts, label) {
    try {
      await send({ to: recipients, ...opts });
      console.log(`[loginAudit] ${label} email sent.`);
      return true;
    } catch (err) {
      console.error(`[loginAudit] Failed to send ${label} email:`, err.message);
      return false;
    }
  }

  async function recordSuccess(ip) {
    log('success', ip);
    consecutiveFailuresByIp.delete(ip);

    const t = now();
    const lastSeen = lastSeenByIp.get(ip);
    const isNewIp = lastSeen === undefined || t - lastSeen > THIRTY_DAYS_MS;
    lastSeenByIp.set(ip, t);

    const throttled = t - lastNewLoginEmailAt < TWELVE_HOURS_MS;
    if (throttled && !isNewIp) {
      return { emailed: false, reason: 'throttled' };
    }
    lastNewLoginEmailAt = t;

    const sent = await safeSend({
      subject: NEW_LOGIN_SUBJECT,
      html: `<p>Someone logged in to the SMASH Manager Portal.</p>
<p><strong>When:</strong> ${pacificTimestamp(new Date(t))} (Pacific)<br/>
<strong>From IP address:</strong> ${ip}${isNewIp ? ' <em>(not seen in the last 30 days)</em>' : ''}</p>
<p><strong>If this wasn't you or Krista, change PORTAL_PASSWORD_HASH and SESSION_SECRET in Railway immediately.</strong></p>
<p style="color:#64748b;font-size:12px;">See SECURITY.md in the manager-portal repo for the steps.</p>`,
    }, 'new-login');
    return { emailed: sent, reason: isNewIp ? 'new_ip' : 'first_in_window' };
  }

  async function recordFailure(ip) {
    log('bad password', ip);
    const count = (consecutiveFailuresByIp.get(ip) || 0) + 1;
    consecutiveFailuresByIp.set(ip, count);

    if (count !== FAILURE_ALERT_THRESHOLD) {
      return { emailed: false, count };
    }

    const sent = await safeSend({
      subject: FAILED_LOGINS_SUBJECT,
      html: `<p>There have been <strong>${count} failed login attempts in a row</strong> on the SMASH Manager Portal from one address, and further attempts from it are now blocked for 15 minutes.</p>
<p><strong>When:</strong> ${pacificTimestamp(new Date(now()))} (Pacific)<br/>
<strong>From IP address:</strong> ${ip}</p>
<p>If this was Krista mistyping, nothing needs to happen. If not, someone is guessing the password: change PORTAL_PASSWORD_HASH and SESSION_SECRET in Railway (see SECURITY.md).</p>`,
    }, 'repeated-failure');
    return { emailed: sent, count };
  }

  function recordRateLimited(ip) {
    log('rate limited', ip);
  }

  function recordRejected(ip) {
    log('rejected (missing or malformed password)', ip);
  }

  return { recordSuccess, recordFailure, recordRateLimited, recordRejected };
}

export const loginAudit = createLoginAudit();

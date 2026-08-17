// Failed daily-payout alerting — modeled on modelHealth.js ("detect a problem,
// throttle, email an alert" via the Gmail send path).

import { sendEmail } from './gmail.js';
import { DAILY_PAYOUT_FIELDS, airtableFetch } from './airtable.js';

export const ALERT_RECIPIENTS = ['krista@smashfundraising.com', 'tahni@smashfundraising.com'];

let lastNotifiedAt = 0;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Payout record IDs we've already emailed about. In-memory only — this resets on
// server restart, so a restart can re-report a failure once; the 6-hour throttle
// above limits how often that repeat can happen.
const alertedPayoutIds = new Set();

function toPacificDateStr(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function pacificWeekday() {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' });
}

function resolveLookup(val) {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

function formatAmount(raw) {
  const num = typeof raw === 'string' ? parseFloat(raw) || 0 : raw || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Check today's (Pacific) daily payouts for failures and email an alert if any are
// found. Pass { force: true } (test hook only) to bypass the weekend skip, the
// 6-hour throttle, and the already-alerted dedupe.
export async function checkFailedPayouts({ force = false } = {}) {
  const day = pacificWeekday();
  if (!force && (day === 'Saturday' || day === 'Sunday')) {
    return { skipped: 'weekend' };
  }

  const today = toPacificDateStr(new Date());

  // Fetch a 3-day window then filter to today's Pacific date in code — the same
  // timezone-edge-case handling as routes/payouts.js.
  const nowPacific = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const fetchStart = new Date(nowPacific);
  fetchStart.setDate(fetchStart.getDate() - 3);
  const fetchStartStr = `${fetchStart.getFullYear()}-${String(fetchStart.getMonth() + 1).padStart(2, '0')}-${String(fetchStart.getDate()).padStart(2, '0')}`;

  const records = await airtableFetch('daily_payouts', {
    filterByFormula: `IS_AFTER({${DAILY_PAYOUT_FIELDS.run_date}}, DATETIME_PARSE('${fetchStartStr}'))`,
  });

  const failedToday = records.filter(r => {
    const dp = r.fields;
    return (dp[DAILY_PAYOUT_FIELDS.status] || '') === 'failed'
      && toPacificDateStr(dp[DAILY_PAYOUT_FIELDS.run_date]) === today;
  });

  if (failedToday.length === 0) {
    return { failedToday: 0, emailed: false };
  }

  const fresh = force ? failedToday : failedToday.filter(r => !alertedPayoutIds.has(r.id));
  if (fresh.length === 0) {
    return { failedToday: failedToday.length, emailed: false, reason: 'already_alerted' };
  }

  const now = Date.now();
  if (!force && now - lastNotifiedAt < SIX_HOURS_MS) {
    return { failedToday: failedToday.length, emailed: false, reason: 'throttled' };
  }
  lastNotifiedAt = now;
  failedToday.forEach(r => alertedPayoutIds.add(r.id));

  const rows = failedToday.map(r => {
    const dp = r.fields;
    const org = resolveLookup(dp[DAILY_PAYOUT_FIELDS.organization]);
    const team = resolveLookup(dp[DAILY_PAYOUT_FIELDS.team]);
    const payee = dp[DAILY_PAYOUT_FIELDS.accounting_contact_name] || '—';
    const amount = formatAmount(dp[DAILY_PAYOUT_FIELDS.payout_amount]);
    const errMsg = dp[DAILY_PAYOUT_FIELDS.error_message] || '(no error message recorded)';
    return `<li style="margin-bottom: 10px;"><strong>${org} — ${team}</strong><br/>Payee: ${payee} · Amount: ${amount}<br/>Error: ${errMsg}</li>`;
  }).join('');

  try {
    await sendEmail({
      to: ALERT_RECIPIENTS,
      subject: `⚠️ SMASH — ${failedToday.length} daily e-check payout(s) failed today`,
      html: `<p>The following daily e-check payout(s) failed today:</p>
<ul>${rows}</ul>
<p>Open the Manager Portal's Active page to review. These payments did not go through and need to be resent or resolved manually.</p>`,
    });
    console.log(`[payoutHealth] Alert email sent for ${failedToday.length} failed payout(s).`);
    return { failedToday: failedToday.length, emailed: true };
  } catch (err) {
    console.error('[payoutHealth] Failed to send payout-failure alert email:', err.message);
    return { failedToday: failedToday.length, emailed: false, reason: 'email_failed', error: err.message };
  }
}

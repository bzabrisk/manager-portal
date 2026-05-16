import { airtableGet, FUNDRAISER_FIELDS, checkNeedsManualProductSplit } from '../airtable.js';
import { generateFprForFundraiser, generateRcrForFundraiser } from '../../routes/reports.js';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 900_000;
const INITIAL_DELAY_MS = 5000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function scheduleAutoGenerate(recordId) {
  await sleep(INITIAL_DELAY_MS);

  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const record = await airtableGet('fundraisers', recordId);
    const fields = record.fields || {};

    const grossReady = !!fields[FUNDRAISER_FIELDS.gross_sales_md];
    const profitReady = !!fields[FUNDRAISER_FIELDS.final_team_profit];
    const repReady = !!fields[FUNDRAISER_FIELDS.rep_commission];

    const fprStillEmpty = !(fields[FUNDRAISER_FIELDS.fundraiser_profit_report] || []).length;
    const rcrStillEmpty = !(fields[FUNDRAISER_FIELDS.rep_commission_report] || []).length;
    if (!fprStillEmpty && !rcrStillEmpty) return;

    if (grossReady && profitReady && repReady) {
      if (await checkNeedsManualProductSplit(recordId)) {
        console.log('[autoGenerate] Skipping auto-gen for', recordId, '— manual product split required.');
        return;
      }
      if (fprStillEmpty) {
        await generateFprForFundraiser(recordId);
        console.log('Auto-generated FPR for', recordId);
      }
      if (rcrStillEmpty) {
        await generateRcrForFundraiser(recordId);
        console.log('Auto-generated RCR for', recordId);
      }
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  console.warn('Auto-generate timed out for', recordId, '— data not ready within 15 minutes.');
}

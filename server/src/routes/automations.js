import { Router } from 'express';
import express from 'express';
import { airtableFetch, FUNDRAISER_FIELDS } from '../services/airtable.js';
import { checkFailedPayouts, ALERT_RECIPIENTS } from '../services/payoutHealth.js';
import { sendEmail } from '../services/gmail.js';

const router = Router();

// Allow large JSON bodies (base64 PDFs) on this router only
router.use(express.json({ limit: '10mb' }));

// Shared-secret auth for automation endpoints
function automationAuth(req, res, next) {
  const secret = process.env.MD_PAYOUT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[automations] MD_PAYOUT_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook secret not configured on server.' });
  }
  const provided = req.headers['x-automation-secret'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Invalid or missing automation secret.' });
  }
  next();
}

router.use(automationAuth);

// POST /api/automations/check-failed-payouts
// TEMPORARY test hook: manually run the failed-payout check without waiting for the
// 30-minute interval. Protected by the same x-automation-secret header as every
// route on this router. Add ?force=true to bypass the weekend skip, the 6-hour
// throttle, and the already-alerted dedupe so the email can be re-tested repeatedly.
router.post('/check-failed-payouts', async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await checkFailedPayouts({ force });
    return res.json({ ok: true, force, result });
  } catch (err) {
    console.error('[automations/check-failed-payouts] Error:', err);
    return res.status(500).json({ error: err.message || 'Check failed.' });
  }
});

// POST /api/automations/md-payout-report
router.post('/md-payout-report', async (req, res) => {
  try {
    const { campaignId, filename, fileBase64 } = req.body;

    // 1. Validate inputs
    if (!campaignId || !filename || !fileBase64) {
      return res.status(400).json({
        error: 'Missing required fields: campaignId, filename, and fileBase64 are all required.',
      });
    }

    console.log(`[automations/md-payout] Request received — campaignId=${campaignId}, filename=${filename}`);

    // 2. Find the fundraiser by MD Campaign ID
    const records = await airtableFetch('fundraisers', {
      filterByFormula: `{MD Campaign ID}="${String(campaignId)}"`,
    });

    if (records.length === 0) {
      console.log(`[automations/md-payout] No fundraiser found for campaignId=${campaignId}`);
      return res.status(404).json({
        matched: false,
        reason: 'no_fundraiser_for_campaign_id',
        campaignId,
      });
    }

    if (records.length > 1) {
      console.log(`[automations/md-payout] Multiple fundraisers (${records.length}) found for campaignId=${campaignId}`);
      return res.status(409).json({
        matched: false,
        reason: 'multiple_matches',
        campaignId,
      });
    }

    const record = records[0];
    const recordId = record.id;
    const fundraiserName = `${record.fields[FUNDRAISER_FIELDS.organization] || ''} — ${record.fields[FUNDRAISER_FIELDS.team] || ''}`;

    console.log(`[automations/md-payout] Matched record ${recordId} (${fundraiserName})`);

    // 3. Decode PDF and run extraction
    const pdfBuffer = Buffer.from(fileBase64, 'base64');

    const { extractMdPayoutData, saveMdPayoutData } = await import('../services/mdPayoutExtractor.js');

    console.log(`[automations/md-payout] Extracting data from PDF...`);
    const extractResult = await extractMdPayoutData(pdfBuffer);

    if (!extractResult.success) {
      console.error(`[automations/md-payout] Extraction failed for campaignId=${campaignId}:`, extractResult.warnings);
      return res.status(422).json({
        matched: true,
        recordId,
        fundraiserName,
        campaignId,
        error: 'Extraction failed',
        extraction: extractResult,
      });
    }

    // 4. Save values + attach PDF + generate reports
    console.log(`[automations/md-payout] Saving extracted data and attaching PDF...`);
    const saveResult = await saveMdPayoutData(recordId, pdfBuffer, filename, 'application/pdf', extractResult.values);

    console.log(`[automations/md-payout] Complete for ${recordId} — FPR: ${saveResult.reports.fpr}, RCR: ${saveResult.reports.rcr}`);

    // 5. No human is present on this path — email any sanity-check warnings so
    // mismatched numbers don't get filed silently. Best-effort; never fails the request.
    // Deliberately unthrottled: these are rare and each one needs eyes on it.
    const reviewWarnings = [
      ...(extractResult.warnings || []),
      ...(saveResult?.reports?.fprBalanceWarning ? [saveResult.reports.fprBalanceWarning] : []),
    ];
    if (reviewWarnings.length > 0) {
      const org = record.fields[FUNDRAISER_FIELDS.organization] || '';
      const team = record.fields[FUNDRAISER_FIELDS.team] || '';
      try {
        await sendEmail({
          to: ALERT_RECIPIENTS,
          subject: `⚠️ SMASH — Payout report numbers need review: ${org} ${team}`,
          html: `<p>The MoneyDolly payout report for <strong>${fundraiserName}</strong> was processed automatically, but these numbers didn't check out:</p>
<ul>${reviewWarnings.map(w => `<li style="margin-bottom: 8px;">${w}</li>`).join('')}</ul>
<p>The report was still filed and the documents generated. Open the fundraiser in the Manager Portal and check these numbers against the MD payout report PDF before sending anything to the school.</p>`,
        });
        console.log(`[automations/md-payout] Review-warning email sent for ${recordId} (${reviewWarnings.length} warning(s)).`);
      } catch (emailErr) {
        console.error('[automations/md-payout] Failed to send review-warning email:', emailErr.message);
      }
    }

    // 6. Respond success
    return res.json({
      matched: true,
      recordId,
      fundraiserName,
      campaignId,
      extraction: {
        success: extractResult.success,
        validation: extractResult.validation,
        warnings: extractResult.warnings,
        notes: extractResult.notes,
      },
      save: saveResult,
    });
  } catch (err) {
    console.error('[automations/md-payout] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

export default router;

/**
 * MD Payout Report data extractor — uses Claude API to read a PDF
 * and return structured financial data.
 */

import {
  FUNDRAISER_FIELDS,
  airtableUpdate,
  uploadAttachmentReplacing,
} from './airtable.js';

const EXTRACTION_PROMPT = `You are extracting financial data from a MoneyDolly Pro Payout Report PDF. Read the document carefully and return ONLY a JSON object — no preamble, no explanation, no markdown code fences.

Extract these fields. All money values must be plain numbers with no dollar sign and no commas (e.g. 7194.50).

- gross_sales_md: the dollar amount on the "Supporter Contribution Total" line.
- pp_gross_automated: the dollar amount on the "From Product" line. If there is NO "From Product" line in the document, return 0.
- mddonations_gross_automated: the dollar amount on the "From Donation" line. If absent, return 0.
- md_pro_platform_fee: the line item labeled "Platform Fee" or "Pro Platform Fee" in the Pro Payout Summary table. Return as a POSITIVE number (its absolute value).
- md_product_fee: the line item labeled "Product Fee". Return as a POSITIVE number. If absent, return 0.
- total_md_prize_fee: the line item labeled "Prize Shop Fee". Return as a POSITIVE number. If absent, return 0.
- md_product_api_admin_fee: the line item labeled "Product API Admin Fee". Return as a POSITIVE number. If absent, return 0.
- md_saas_tax: the line item labeled "SaaS Tax", REGARDLESS of the percentage shown in parentheses (it may be "SaaS Tax (6.5%)", "SaaS Tax (8.90%)", or any other rate). Return as a POSITIVE number. If absent, return 0.
- md_payout: the dollar amount on the "Pro Payout Total" line (the highlighted total row). Return as a POSITIVE number.
- md_payout_date: the date on the "This will be paid out on:" line. Convert it to YYYY-MM-DD format (e.g. "December 23, 2025" becomes "2025-12-23").

Fees in the Pro Payout Summary table are shown in parentheses like ($240.09), which indicates a deduction. Always return fees as positive numbers (240.09, not -240.09).

Return this exact JSON shape:
{
  "readable": true,
  "values": {
    "gross_sales_md": <number>,
    "pp_gross_automated": <number>,
    "mddonations_gross_automated": <number>,
    "md_pro_platform_fee": <number>,
    "md_product_fee": <number>,
    "total_md_prize_fee": <number>,
    "md_product_api_admin_fee": <number>,
    "md_saas_tax": <number>,
    "md_payout": <number>,
    "md_payout_date": "YYYY-MM-DD"
  },
  "notes": "<one short sentence about anything unusual, ambiguous, or worth flagging; empty string if all clean>"
}

If this document is NOT a MoneyDolly payout report, or if the numbers are unreadable (scanned, blurry, cut off), return:
{ "readable": false, "values": {}, "notes": "<explain briefly why you could not extract>" }`;

const NUMERIC_FIELDS = [
  'gross_sales_md',
  'pp_gross_automated',
  'mddonations_gross_automated',
  'md_pro_platform_fee',
  'md_product_fee',
  'total_md_prize_fee',
  'md_product_api_admin_fee',
  'md_saas_tax',
  'md_payout',
];

const SKIPPED_VALIDATION = {
  supporterContributionCheck: 'skipped',
  payoutTotalCheck: 'skipped',
};

function makeErrorResult(message) {
  return {
    success: false,
    readable: false,
    values: {},
    missingFields: [],
    validation: { ...SKIPPED_VALIDATION },
    warnings: [message],
    notes: '',
  };
}

export async function extractMdPayoutData(pdfBuffer) {
  console.log('[mdPayoutExtractor] Starting extraction...');

  try {
    const base64 = pdfBuffer.toString('base64');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Failed to parse Claude response as JSON: ${parseErr.message}. Raw: ${cleaned.slice(0, 200)}`);
    }

    // Handle unreadable document
    if (parsed.readable === false) {
      console.log('[mdPayoutExtractor] Document not readable:', parsed.notes);
      return {
        success: false,
        readable: false,
        values: {},
        missingFields: [],
        validation: { ...SKIPPED_VALIDATION },
        warnings: [],
        notes: parsed.notes || '',
      };
    }

    // Validate extracted values
    const values = parsed.values || {};
    const missingFields = [];

    for (const key of NUMERIC_FIELDS) {
      const val = values[key];
      if (val == null || typeof val !== 'number' || !isFinite(val)) {
        missingFields.push(key);
      }
    }

    // Validate date field
    if (!values.md_payout_date || !/^\d{4}-\d{2}-\d{2}$/.test(values.md_payout_date)) {
      missingFields.push('md_payout_date');
    }

    // Cross-checks
    const warnings = [];
    let supporterContributionCheck = 'skipped';
    let payoutTotalCheck = 'skipped';

    const hasAllContribution = !missingFields.includes('pp_gross_automated')
      && !missingFields.includes('mddonations_gross_automated')
      && !missingFields.includes('gross_sales_md');

    if (hasAllContribution) {
      const sum = values.pp_gross_automated + values.mddonations_gross_automated;
      const diff = Math.abs(sum - values.gross_sales_md);
      if (diff <= 1.0) {
        supporterContributionCheck = 'pass';
      } else {
        supporterContributionCheck = 'fail';
        warnings.push(
          `From Product ($${values.pp_gross_automated}) + From Donation ($${values.mddonations_gross_automated}) = $${sum.toFixed(2)}, ` +
          `but Supporter Contribution Total reads $${values.gross_sales_md} — these don't match. Please verify against the PDF.`
        );
      }
    }

    const feeKeys = ['md_pro_platform_fee', 'md_product_fee', 'total_md_prize_fee', 'md_product_api_admin_fee', 'md_saas_tax'];
    const hasAllPayout = !missingFields.includes('gross_sales_md')
      && !missingFields.includes('md_payout')
      && feeKeys.every(k => !missingFields.includes(k));

    if (hasAllPayout) {
      const totalFees = feeKeys.reduce((sum, k) => sum + values[k], 0);
      const computed = values.gross_sales_md - totalFees;
      const diff = Math.abs(computed - values.md_payout);
      if (diff <= 1.0) {
        payoutTotalCheck = 'pass';
      } else {
        payoutTotalCheck = 'fail';
        warnings.push(
          `Gross ($${values.gross_sales_md}) - fees ($${totalFees.toFixed(2)}) = $${computed.toFixed(2)}, ` +
          `but Pro Payout Total reads $${values.md_payout} — these don't match. Please verify against the PDF.`
        );
      }
    }

    const success = missingFields.length === 0;

    console.log('[mdPayoutExtractor] Extraction complete.', {
      success,
      missingFields,
      supporterContributionCheck,
      payoutTotalCheck,
      warningCount: warnings.length,
    });

    return {
      success,
      readable: true,
      values,
      missingFields,
      validation: { supporterContributionCheck, payoutTotalCheck },
      warnings,
      notes: parsed.notes || '',
    };
  } catch (err) {
    console.error('[mdPayoutExtractor] Error:', err.message);
    return makeErrorResult('The AI extractor could not process this file: ' + err.message);
  }
}

// Maps extracted value keys to FUNDRAISER_FIELDS keys for the Airtable PATCH
const VALUE_TO_FIELD = {
  gross_sales_md: 'gross_sales_md',
  md_payout: 'md_payout',
  pp_gross_automated: 'pp_gross_automated',
  mddonations_gross_automated: 'mddonations_gross_automated',
  md_pro_platform_fee: 'md_pro_platform_fee',
  md_product_fee: 'md_product_fee',
  total_md_prize_fee: 'total_md_prize_fee',
  md_product_api_admin_fee: 'md_product_api_admin_fee',
  md_saas_tax: 'md_saas_tax',
  md_payout_date: 'md_payout_date',
};

export async function saveMdPayoutData(recordId, pdfBuffer, filename, mimetype, values) {
  console.log('[mdPayoutExtractor] Saving extracted data for', recordId);

  // Step 1: Write extracted values to Airtable
  const fields = {};
  for (const [valueKey, fieldKey] of Object.entries(VALUE_TO_FIELD)) {
    if (values[valueKey] != null) {
      // md_payout_date is a date-only field — write bare YYYY-MM-DD string
      fields[FUNDRAISER_FIELDS[fieldKey]] = values[valueKey];
    }
  }

  console.log('[mdPayoutExtractor] Writing', Object.keys(fields).length, 'fields to Airtable...');
  await airtableUpdate('fundraisers', recordId, fields);
  console.log('[mdPayoutExtractor] Fields written successfully.');

  // Step 2: Attach the PDF to the MD Payout Report slot
  console.log('[mdPayoutExtractor] Attaching PDF...');
  await uploadAttachmentReplacing(recordId, FUNDRAISER_FIELDS.md_payout_report, pdfBuffer, filename, mimetype);
  console.log('[mdPayoutExtractor] PDF attached successfully.');

  // Step 3: Generate reports (best-effort, each independent)
  const reports = { fpr: 'failed', rcr: 'failed', errors: {} };

  // Lazy import to avoid circular dependency
  const { generateFprForFundraiser, generateRcrForFundraiser } = await import('../routes/reports.js');

  try {
    console.log('[mdPayoutExtractor] Generating FPR...');
    await generateFprForFundraiser(recordId);
    reports.fpr = 'generated';
    console.log('[mdPayoutExtractor] FPR generated.');
  } catch (err) {
    reports.errors.fpr = err.message;
    console.error('[mdPayoutExtractor] FPR generation failed:', err.message);
  }

  try {
    console.log('[mdPayoutExtractor] Generating RCR...');
    await generateRcrForFundraiser(recordId);
    reports.rcr = 'generated';
    console.log('[mdPayoutExtractor] RCR generated.');
  } catch (err) {
    reports.errors.rcr = err.message;
    console.error('[mdPayoutExtractor] RCR generation failed:', err.message);
  }

  console.log('[mdPayoutExtractor] Save complete for', recordId, { reports });

  return {
    success: true,
    valuesSaved: true,
    pdfAttached: true,
    reports,
  };
}

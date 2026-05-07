import { Router } from 'express';
import {
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  airtableGet,
  airtableFetchByIds,
  uploadAttachmentReplacing,
} from '../services/airtable.js';
import { renderFpr, renderRcr } from '../services/pdf/render.js';

const router = Router();

// Resolve a lookup field value (may be array, string, or number)
function resolveLookup(val) {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

export async function fetchFundraiserDataForReports(recordId) {
  const record = await airtableGet('fundraisers', recordId);
  const f = record.fields;
  const F = FUNDRAISER_FIELDS;

  // Resolve rep name
  const repIds = f[F.rep] || [];
  let repName = '';
  if (repIds.length > 0) {
    const reps = await airtableFetchByIds('reps', repIds);
    repName = reps[0]?.fields?.[REP_FIELDS.name] || '';
  }

  // Resolve product secondary name
  const secIds = f[F.product_secondary] || [];
  let productSecondaryName = '';
  if (secIds.length > 0) {
    const prods = await airtableFetchByIds('products', secIds);
    productSecondaryName = prods[0]?.fields?.['fldUgmP61xsxj5tie'] || '';
  }

  return {
    id: recordId,
    organization: f[F.organization] || '',
    team: f[F.team] || '',
    season: resolveLookup(f[F.season]) || '',
    rep_name: repName,
    product_primary_string: resolveLookup(f[F.product_primary_string]) || '',
    product_secondary_name: productSecondaryName,
    asb_boosters: f[F.asb_boosters] || '',
    // Financials
    gross_sales_md: f[F.gross_sales_md] ?? null,
    final_team_profit: f[F.final_team_profit] ?? null,
    final_invoice_amount: f[F.final_invoice_amount] ?? null,
    rep_commission: f[F.rep_commission] ?? null,
    // Primary product line items
    pp_gross: f[F.pp_gross] ?? null,
    pp_team_profit: f[F.pp_team_profit] ?? null,
    pp_rep_comm: f[F.pp_rep_comm] ?? null,
    pp_invoice_amount: f[F.pp_invoice_amount] ?? null,
    pp_actual_team_rate: resolveLookup(f[F.pp_actual_team_rate]),
    pp_actual_comm_rate: resolveLookup(f[F.pp_actual_comm_rate]),
    pp_invoice_rate: f[F.pp_invoice_rate] ?? null,
    cards_sold: f[F.cards_sold] ?? null,
    // Secondary product
    sp_gross: f[F.sp_gross] ?? null,
    sp_team_profit: f[F.sp_team_profit] ?? null,
    sp_rep_comm: f[F.sp_rep_comm] ?? null,
    sp_invoice_amount: f[F.sp_invoice_amount] ?? null,
    sp_invoice_rate: f[F.sp_invoice_rate] ?? null,
    // MD Donations
    mddonations_gross: f[F.mddonations_gross] ?? null,
    mddonations_team_profit: f[F.mddonations_team_profit] ?? null,
    mddonations_rep_comm: f[F.mddonations_rep_comm] ?? null,
    mddonations_invoice_amount: f[F.mddonations_invoice_amount] ?? null,
    mddonations_invoice_rate: f[F.mddonations_invoice_rate] ?? null,
    mddonations_actual_comm_rate: f[F.mddonations_actual_comm_rate] ?? null,
    // FPR adjustments
    fpr_adj_md_prize_share: f[F.fpr_adj_md_prize_share] ?? null,
    fpr_adj_team_to_rep: f[F.fpr_adj_team_to_rep] ?? null,
    fpr_adj_asbfee: f[F.fpr_adj_asbfee] ?? null,
    fpr_comments: resolveLookup(f[F.fpr_comments]) || '',
    // RCR adjustments
    rcr_adj_team_to_rep: f[F.rcr_adj_team_to_rep] ?? null,
    rcr_adj_asbfee: f[F.rcr_adj_asbfee] ?? null,
    rcr_adj_half_md_prize_fee: f[F.rcr_adj_half_md_prize_fee] ?? null,
    rcr_adj_smallfradj: f[F.rcr_adj_smallfradj] ?? null,
    rcr_adj_excessprint: f[F.rcr_adj_excessprint] ?? null,
    rcr_adj_extra_cd_boxes: f[F.rcr_adj_extra_cd_boxes] ?? null,
    rcr_adj_misc: f[F.rcr_adj_misc] ?? null,
    rcr_comment: f[F.rcr_comment] || '',
    extra_cd_boxes_ordered: f[F.extra_cd_boxes_ordered] ?? null,
    // MD Payout source tracking
    md_payout_attachment_id: (f[F.md_payout_report] || [])[0]?.id || null,
  };
}

export async function generateFprForFundraiser(recordId) {
  const data = await fetchFundraiserDataForReports(recordId);
  const buffer = await renderFpr(data);
  const filename = `FPR - ${data.organization} - ${data.team}.pdf`;
  const result = await uploadAttachmentReplacing(
    recordId,
    FUNDRAISER_FIELDS.fundraiser_profit_report,
    buffer,
    filename,
    'application/pdf',
  );
  await airtableUpdate('fundraisers', recordId, {
    [FUNDRAISER_FIELDS.fpr_md_payout_source_id]: data.md_payout_attachment_id || '',
  });
  return result;
}

export async function generateRcrForFundraiser(recordId) {
  const data = await fetchFundraiserDataForReports(recordId);
  const buffer = await renderRcr(data);
  const filename = `RCR - ${data.organization} - ${data.team}.pdf`;
  const result = await uploadAttachmentReplacing(
    recordId,
    FUNDRAISER_FIELDS.rep_commission_report,
    buffer,
    filename,
    'application/pdf',
  );
  await airtableUpdate('fundraisers', recordId, {
    [FUNDRAISER_FIELDS.rcr_md_payout_source_id]: data.md_payout_attachment_id || '',
  });
  return result;
}

router.post('/fpr/:fundraiserId', async (req, res) => {
  try {
    const result = await generateFprForFundraiser(req.params.fundraiserId);
    res.json({ success: true, attachment: result });
  } catch (err) {
    console.error('Error generating FPR:', err);
    res.status(500).json({ error: err.message || 'Failed to generate FPR.' });
  }
});

router.post('/rcr/:fundraiserId', async (req, res) => {
  try {
    const result = await generateRcrForFundraiser(req.params.fundraiserId);
    res.json({ success: true, attachment: result });
  } catch (err) {
    console.error('Error generating RCR:', err);
    res.status(500).json({ error: err.message || 'Failed to generate RCR.' });
  }
});

export default router;

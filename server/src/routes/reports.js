import { Router } from 'express';
import {
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  PRODUCT_FIELDS,
  airtableGet,
  airtableUpdate,
  airtableFetchByIds,
  uploadAttachmentReplacing,
  checkNeedsManualProductSplit,
} from '../services/airtable.js';
import { renderFpr, renderRcr, renderAgreement } from '../services/pdf/render.js';
import { getTierNotes } from '../constants/tieredProducts.js';

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
    fpr_adj_discount_on_lost_cards: f[F.fpr_adj_discount_on_lost_cards] ?? null,
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
    // Linked-record presence flags
    has_secondary: ((f[F.product_secondary] || []).length > 0),
    has_tp_donations: ((f[F.tp_mddonations] || []).length > 0),
    // MD Payout source tracking
    md_payout_attachment_id: (f[F.md_payout_report] || [])[0]?.id || null,
  };
}

export async function generateFprForFundraiser(recordId) {
  const data = await fetchFundraiserDataForReports(recordId);

  // Sanity check: profit + invoice should equal gross (for variants with an invoice section)
  const isTradNoRisk = data.product_primary_string === 'Team Cards - Traditional No-Risk';
  const isTradUpfront = data.product_primary_string === 'Team Cards - Traditional Upfront Purchase';
  const showInvoice = data.asb_boosters === 'WA State ASB' || isTradNoRisk || isTradUpfront;
  if (showInvoice && data.gross_sales_md && data.final_team_profit != null && data.final_invoice_amount != null) {
    const sum = Number(data.final_team_profit) + Number(data.final_invoice_amount);
    const gross = Number(data.gross_sales_md);
    const diff = Math.abs(sum - gross);
    if (diff > 0.05) {
      console.warn(
        `[FPR] Balance check failed for ${recordId}: ` +
        `profit ($${data.final_team_profit}) + invoice ($${data.final_invoice_amount}) ` +
        `= $${sum.toFixed(2)} but gross is $${gross.toFixed(2)}. ` +
        `Difference: $${diff.toFixed(2)}. Report will still render.`
      );
    }
  }

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
    if (await checkNeedsManualProductSplit(req.params.fundraiserId)) {
      return res.status(400).json({
        error: 'Manual product split required before generating reports for this two-product fundraiser.',
        code: 'MANUAL_SPLIT_REQUIRED',
      });
    }
    const result = await generateFprForFundraiser(req.params.fundraiserId);
    res.json({ success: true, attachment: result });
  } catch (err) {
    console.error('Error generating FPR:', err);
    res.status(500).json({ error: err.message || 'Failed to generate FPR.' });
  }
});

router.post('/rcr/:fundraiserId', async (req, res) => {
  try {
    if (await checkNeedsManualProductSplit(req.params.fundraiserId)) {
      return res.status(400).json({
        error: 'Manual product split required before generating reports for this two-product fundraiser.',
        code: 'MANUAL_SPLIT_REQUIRED',
      });
    }
    const result = await generateRcrForFundraiser(req.params.fundraiserId);
    res.json({ success: true, attachment: result });
  } catch (err) {
    console.error('Error generating RCR:', err);
    res.status(500).json({ error: err.message || 'Failed to generate RCR.' });
  }
});

// --- Fundraiser Agreement ---

function buildAgreementNotes({ agreement_notes_manual, primary_product_name }) {
  const tierText = getTierNotes(primary_product_name);
  const manual = (agreement_notes_manual || '').trim();
  if (tierText && manual) return `${tierText}\n\n${manual}`;
  if (tierText) return tierText;
  if (manual) return manual;
  return '';
}

const PRODUCT_PROFIT_PCT_FIELD = 'fldgThkrxMzkurPK7';

export async function fetchFundraiserDataForAgreement(recordId) {
  const record = await airtableGet('fundraisers', recordId);
  const f = record.fields;
  const F = FUNDRAISER_FIELDS;

  const productPrimaryString = resolveLookup(f[F.product_primary_string]) || '';

  // Collect all linked record IDs
  const repIds = f[F.rep] || [];
  const primaryContactIds = f[F.primary_contact] || [];
  const accountingContactIds = f[F.accounting_contact] || [];
  const primaryProductIds = f[F.product_primary] || [];
  const secondaryProductIds = f[F.product_secondary] || [];
  const donationsProductIds = f[F.tp_mddonations] || [];

  const allProductIds = [...new Set([...primaryProductIds, ...secondaryProductIds, ...donationsProductIds])];

  // Fetch linked records in parallel
  const [reps, primaryContacts, accountingContacts, products] = await Promise.all([
    repIds.length > 0 ? airtableFetchByIds('reps', repIds) : [],
    primaryContactIds.length > 0 ? airtableFetchByIds('client_book', primaryContactIds) : [],
    accountingContactIds.length > 0 ? airtableFetchByIds('accounting_contact', accountingContactIds) : [],
    allProductIds.length > 0 ? airtableFetchByIds('products', allProductIds) : [],
  ]);

  const productMap = {};
  for (const p of products) {
    productMap[p.id] = {
      name: p.fields[PRODUCT_FIELDS.name] || '',
      profitPct: p.fields[PRODUCT_PROFIT_PCT_FIELD] ?? null,
    };
  }

  const repName = reps[0]?.fields?.[REP_FIELDS.name] || '';
  const pcName = primaryContacts[0]?.fields?.[CLIENT_BOOK_FIELDS.name] || '';
  const pcEmail = primaryContacts[0]?.fields?.[CLIENT_BOOK_FIELDS.email] || '';
  const acName = accountingContacts[0]?.fields?.[ACCOUNTING_CONTACT_FIELDS.name] || '';
  const acEmail = accountingContacts[0]?.fields?.[ACCOUNTING_CONTACT_FIELDS.email] || '';

  const primaryProduct = primaryProductIds[0] ? productMap[primaryProductIds[0]] : null;
  const secondaryProduct = secondaryProductIds[0] ? productMap[secondaryProductIds[0]] : null;
  const donationsProduct = donationsProductIds[0] ? productMap[donationsProductIds[0]] : null;
  const hasTpDonations = donationsProductIds.length > 0;

  const additionalNotes = buildAgreementNotes({
    agreement_notes_manual: f[F.agreement_notes] || '',
    primary_product_name: primaryProduct?.name || '',
  });

  return {
    id: recordId,
    organization: f[F.organization] || '',
    team: f[F.team] || '',
    kickoff_date: f[F.kickoff_date] || '',
    end_date: f[F.end_date] || '',
    asb_boosters: f[F.asb_boosters] || '',
    rep_pays_asb_fee: f[F.rep_pays_asb_fee] || false,
    fundraiser_id: f[F.fundraiser_id] || '',
    product_primary_string: productPrimaryString,
    rep_name: repName,
    primary_contact_name: pcName,
    primary_contact_email: pcEmail,
    accounting_contact_name: acName,
    accounting_contact_email: acEmail,
    primary_product_name: primaryProduct?.name || '',
    primary_product_profit_pct: primaryProduct?.profitPct ?? null,
    secondary_product_name: secondaryProduct?.name || '',
    secondary_product_profit_pct: secondaryProduct?.profitPct ?? null,
    has_tp_donations: hasTpDonations,
    donations_product_name: donationsProduct?.name || '',
    donations_product_profit_pct: donationsProduct?.profitPct ?? null,
    season: resolveLookup(f[F.season]) || '',
    additional_notes: additionalNotes,
  };
}

export async function generateAgreementForFundraiser(recordId) {
  const data = await fetchFundraiserDataForAgreement(recordId);
  const buffer = await renderAgreement(data);
  const filename = `FA - ${data.organization} ${data.team} - ${data.season}.pdf`;
  const result = await uploadAttachmentReplacing(
    recordId,
    FUNDRAISER_FIELDS.fundraiser_agreement_unsigned,
    buffer,
    filename,
    'application/pdf',
  );
  return result;
}

router.post('/agreement/:fundraiserId', async (req, res) => {
  try {
    const result = await generateAgreementForFundraiser(req.params.fundraiserId);
    res.json({ success: true, attachment: result });
  } catch (err) {
    console.error('Error generating Fundraiser Agreement:', err);
    res.status(500).json({ error: err.message || 'Failed to generate Fundraiser Agreement.' });
  }
});

export default router;

// Label for the ASB fee row on the FPR and RCR. The amount always comes from the
// Airtable fee formulas; this only decides how the row is described:
//   override set            -> "[base]: {override label}"
//   no override, cap hit    -> "[base] (2%, max $325)"
//   otherwise               -> "[base] (2%)"
// `base` keeps each report's existing wording ("ASB Fee" / "WA State ASB Fee").

// Whole dollars when the cap is a round number ($325), cents otherwise.
export function formatCap(cap) {
  const n = Number(cap);
  if (!Number.isFinite(n)) return '';
  const opts = Number.isInteger(n)
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `$${n.toLocaleString('en-US', opts)}`;
}

export function buildAsbFeeLabel(base, data) {
  if (data.asb_fee_override != null) {
    const label = String(data.asb_fee_override_label || '').trim();
    return label ? `${base}: ${label}` : base;
  }
  const cap = data.asb_fee_cap;
  const fee = data.asb_fee_default;
  const capHit = cap != null && fee != null && Math.abs(Number(fee) - Number(cap)) < 0.005;
  if (capHit) return `${base} (2%, max ${formatCap(cap)})`;
  return `${base} (2%)`;
}

// A waived fee ($0 override) must print as $0.00 instead of being hidden like
// every other zero adjustment.
export function asbFeeWaived(data) {
  return data.asb_fee_override === 0;
}

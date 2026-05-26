const BASE_ID = 'appxDlniu6IPMVIVp';
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const TABLES = {
  tasks: 'tblA1Rndmnrey0e6L',
  fundraisers: 'tbl7aH2mtkAGC9jk9',
  reps: 'tbljkTGJ7y1WmkXw0',
  daily_payouts: 'tblxoqfVPg322jNqA',
  fundraiser_payouts: 'tbl2o1R97fQNWcqaj',
  client_book: 'tblq3raxwvAZlh4Im',
  accounting_contact: 'tblw4wHSfztIJDBj8',
  products: 'tblkppUiIEMjxIjmB',
};

// Task field IDs
const TASK_FIELDS = {
  name: 'fldiQjD8PPe18QThz',
  description: 'fldFN6LItax00X18m',
  status: 'fldibO3tFh4ms0it7',
  assignee: 'fldJpqDYWaWtQdDXu',
  deadline: 'fldMXHF3x37QyGdRV',
  show_date: 'fld9aBg9X1jcTcnOW',
  action_url: 'fldn2QY5fufxJ03my',
  completed_at: 'fldOo5oTh4pXsgZfs',
  creation_method: 'fldtOO8JlwZu1Uhui',
  fundraisers: 'flddkpCSJb2MUIMLU',
  created_at: 'fldxWDRScYq2gkogl',
  button_words: 'fldMypJRWWAdu9hzD',
};

// Rep field IDs
const REP_FIELDS = {
  name: 'fldwSbzcCBtvI4Rdp',
  email: 'fldxoGbTwhQmMfIWj',
  photo: 'fldSqcSDTP1FcggK6',
  business_name: 'fldR3QP3GQCFvgqu7',
};

// Known rep record IDs
const REP_IDS = {
  'Office Manager': 'recAva9jBaIR63MXl',
  'Cash': 'recg1tf2UwurrEcnW',
};

// Fundraiser field IDs
const FUNDRAISER_FIELDS = {
  organization: 'fldxsdVs28DhSdbuw',
  team: 'fldx47Bwh7kPFlbYD',
  status_rendered: 'fldnx3K4heNUqs96t',
  kickoff_date: 'fldbfZFcJj52SnB5C',
  end_date: 'fldEFQYQLPlh26i6O',
  rep_photo: 'fldiVemmCDr4fKTTa',
  asb_boosters: 'fldMCr5g20kATvA2s',
  primary_contact: 'fldU9j8KNl0prGM0t',
  accounting_contact: 'fld6tNYzxnpV9EPX3',
  product_primary: 'fldwq9D0y9YCU2dX4',
  product_primary_string: 'fldnUTGmOMplUQYEm',
  md_portal_url: 'fldrZzkK8XNNDqqOQ',
  open_manager_tasks_count: 'fld2mjwRGGCKSRPBI',
  tasks: 'fldKhDyGO2IHj7Ru8',
  rep: 'fldKVtinL60lTrFzl',
  gross_sales_md: 'fldBUUIBsDws9RgLV',
  final_team_profit: 'fldWu3s6so1xByWwr',
  final_invoice_amount: 'fldD1KsRcsfc0lbcZ',
  rep_commission: 'fldLSmaj4JksmsNUh',
  smash_profit: 'fld2ZsDnr8ZIKzsL5',
  md_payout: 'fldjYCVPq9QFAbAOt',
  md_payout_received: 'fldKflCSEtVXCkj9I',
  invoice_payment_received: 'fld1cS6i7BrZfqxuf',
  check_invoice_sent: 'fld6HUrMft9MsDfIL',
  rep_paid: 'fld11dZXfenyqzQbe',
  organization_name_needs_follow_up: 'fldRT8zcP6WrSacBM',
  cards_ordered: 'fldzkXsedFeBVLAfK',
  cards_sold_manual: 'fldqhwtTuxnNHfsCp',
  cards_sold: 'fldfqPmHKccZr6QEb',
  cards_lost: 'fldWpLdiGIKxPQwCa',
  team_size: 'fldbQKlx5bpBBHCiL',
  admin_notes: 'fldyB1gmXNXtM2ymV',
  rep_notes: 'fldbcDRWd7AHtdkh9',
  product_secondary: 'fldtIIUJvUtMyXusQ',
  tp_mddonations: 'fldzPQE0hWEdtTQoM',
  manual_status_override: 'fldFHxyf9DHd1qscd',
  fundraiser_agreement_unsigned: 'fld3EdTDzU7YDRK4T',
  fundraiser_agreement_final: 'fldDZerdCLGXpBO11',
  fundraiser_id: 'fldCwB0zIPLnpintS',
  rep_pays_asb_fee: 'fldDKKa5DBBiTBhS1',
  agreement_notes: 'fldjlBySsJUZb7uvc',
  fundraiser_profit_report: 'fldDX1jRdrNc1zepO',
  rep_commission_report: 'fld4hTL0dMQTCnoPG',
  invoice_attachment: 'fldX31hTUnVFuafhN',
  md_payout_report: 'fldYcxmoXJ16uuAE6',
  daily_payouts: 'fldZOe15DJT4G61Bh',
  primary_contact_email: 'fldpNuvbEbmZrYuGb',
  accounting_contact_email: 'fldH17UIgXDn67jc1',
  include_md_donations: 'fldZ7EFPBXeADzc6T',
  // Rep Commission breakdown
  rep_comm_before_adj: 'fldOYLS7mmlG9Y7wK',
  rcr_adj_team_to_rep: 'fldxnsA49jqZkpW9U',
  rcr_adj_asbfee: 'fldEr4FykTP6NaSmJ',
  rcr_adj_half_md_prize_fee: 'fldwUJQRk533BLCAr',
  rcr_adj_smallfradj: 'fldJV8EyeWqDPMRaH',
  rcr_adj_excessprint: 'fld7B8JddfcjhJs3A',
  rcr_adj_extra_cd_boxes: 'fldEQfYpJBlx84etr',
  rcr_adj_misc: 'fld0iQuhUQDk5L5IY',
  rcr_comment: 'fld3vDtAwws1m9EUq',
  extra_cd_boxes_ordered: 'fldobBrd984o4OLhe',
  // Team Profit breakdown
  team_profit_before_adj: 'fldElrfu61nJ9zrUs',
  fpr_adj_md_prize_share: 'fld9o19YSMa8cX39M',
  fpr_adj_team_to_rep: 'fldZBFkZCxhmxwNOj',
  fpr_adj_team_to_rep_label: 'fld1jNPQUhrowvwK8',
  fpr_adj_asbfee: 'fldiUPom1EC2MkI7j',
  fpr_adj_discount_on_lost_cards: 'fldUTmqmr2bJKiFdF',
  cost_product: 'fldkYOO4LKa0dpDUV',
  // SMASH Profit breakdown
  gross_sales_calc: 'fldmj5wdfPK52CK13',
  md_cut: 'fldIR7omnYF6fRZNb',
  // Per-line-item: primary product
  pp_gross: 'fldUEWqqQrxgGBWhW',
  pp_gross_manual: 'fldWSgjOoFLij0LHJ',
  pp_gross_automd: 'fldPA0s3g4bfSrHYR',
  pp_team_profit: 'fldArYeUCDT4izAtR',
  pp_rep_comm: 'fldqf0jVqSi6n1Qh2',
  pp_invoice_amount: 'fld7oKFJSITyUeoSu',
  pp_actual_team_rate: 'fld5U55dsqyGwhpPB',
  pp_actual_comm_rate: 'fldyGBitTIRWopsZB',
  pp_invoice_rate: 'fldNNB78NvnMliKHJ',
  // Per-line-item: secondary product
  sp_gross: 'fldJF31WTo9Cw88Ws',
  sp_team_profit: 'fldLmM7CWocxbJiXj',
  sp_rep_comm: 'fldd12zkSK98IyqHW',
  sp_invoice_amount: 'fldt9OyyP28gmyLgk',
  sp_invoice_rate: 'fldK3Sim6uNwZ5S2D',
  // Per-line-item: MD donations
  mddonations_gross: 'fldkbVwfY7f3POWcR',
  mddonations_team_profit: 'fldCi5RL34PaT7VCx',
  mddonations_rep_comm: 'fldEivSp2cB8VnS3I',
  mddonations_invoice_amount: 'fldoL8Ldg4fDLEP30',
  mddonations_invoice_rate: 'fldwHLO7gtX7GRKRx',
  mddonations_actual_comm_rate: 'fldTtZ6fUKvViglVn',
  // Report metadata
  season: 'fldjqsFC64Ktl0eiF',
  fpr_md_payout_source_id: 'fldbs1SmxMPuGrlM6',
  rcr_md_payout_source_id: 'fld5heECP4bVaPKE8',
  fpr_comments: 'fldYbGDGqQ2G7xc4J',
  // MD Payout raw extraction targets (AI-extracted)
  pp_gross_automated: 'fldPA0s3g4bfSrHYR',          // same field as pp_gross_automd
  mddonations_gross_automated: 'fldkbVwfY7f3POWcR',  // same field as mddonations_gross
  md_pro_platform_fee: 'flddukN9cEZHauvrg',
  md_product_fee: 'fldCHmAuUiSR1ycMA',
  total_md_prize_fee: 'fldaTxoSLQDkfw86F',
  md_product_api_admin_fee: 'fldXGtz1NAThbKwnZ',
  md_saas_tax: 'fldIip9vNpcZOjMBs',
  md_payout_date: 'fldWgHa5p9t8qzwF0',
  // Report staleness fingerprints
  fpr_source_fingerprint: 'fldrFTjfaCC5SVK1H',
  rcr_source_fingerprint: 'fld1yLk2UEPDT5yKB',
};

// Client book (primary contact) field IDs
const CLIENT_BOOK_FIELDS = {
  name: 'fld6KdKRJIcsZkkFw',
  email: 'fldg85yD1LlFetaCr',
  phone: 'fldUheyvb402LFIW1',
};

// Accounting contact field IDs
const ACCOUNTING_CONTACT_FIELDS = {
  name: 'fld1R6r9N9ZujMo3i',
  email: 'fldhRKFgMo43Dlu6p',
  payment_method: 'fldY6ZQ7Vj7mPvCGN',
  status: 'fldEfiwZg7hZW57BP',
};

// Daily payout field IDs
const DAILY_PAYOUT_FIELDS = {
  payout_id: 'fldWDuLeQbiscnP0J',
  fundraiser: 'fldrpEVdAfBhpSB32',
  accounting_contact: 'fldGM5JgFiXU7rFMb',
  accounting_contact_name: 'fldwjOR1VrcFaPcTL',
  run_date: 'fld1sArgKrWLemvTx',
  gross_sales_today: 'fldSUT1FxxucUb65Q',
  payout_amount: 'fld6EieozqJRIcjeu',
  status: 'fldSFFGZe6WsyGluk',
  reference_number: 'fldOsL9CZyodprYzK',
  error_message: 'fldQgdZBqUonHMFMO',
  organization: 'fldCeq63Ak9faXCdo',
  team: 'fldPl4uWY8ugNeAqf',
  check_number: 'fldOjxdPJc10D57lW',
};

// Fundraiser payout field IDs
const FUNDRAISER_PAYOUT_FIELDS = {
  payout_id: 'fldrD5ns8a5d6gsKs',
  payout_purpose: 'fldILnAsKxqmETucM',
  fundraiser: 'fldWpfxrSeo2jLeNL',
  organization: 'fld7e1IhSjW04QfX7',
  team: 'fldklF6ag7h1H7daY',
  payout_amount: 'fldBETQCRpwCC5WYd',
  memo: 'fldS42L5aYr2bOMlP',
  status: 'fldnFgidw5JdszYe3',
  reference_number: 'fldjsmLQhxbYjkBjt',
  check_number: 'fldjj8P31bOLxYK5F',
  notes: 'fldjE641kk95xHRly',
  error_message: 'fldlgOBPITb8BFiwx',
  idempotency_key: 'fldN5A157xSdOYy2X',
  sent_at: 'fldq0EltjtNvpqBME',
};

// Product field IDs
const PRODUCT_FIELDS = {
  name: 'fldUgmP61xsxj5tie',
};

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(tableName, params = {}) {
  const tableId = TABLES[tableName] || tableName;
  const url = new URL(`${API_URL}/${tableId}`);
  url.searchParams.set('returnFieldsByFieldId', 'true');
  for (const [key, value] of Object.entries(params)) {
    if (key === 'filterByFormula' || key === 'sort' || key === 'maxRecords' || key === 'pageSize' || key === 'view') {
      if (key === 'sort') {
        // sort is an array of objects
        value.forEach((s, i) => {
          url.searchParams.set(`sort[${i}][field]`, s.field);
          url.searchParams.set(`sort[${i}][direction]`, s.direction || 'asc');
        });
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const allRecords = [];
  let offset = null;

  do {
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable API error (${res.status}): ${err}`);
    }
    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function airtableGet(tableName, recordId) {
  const tableId = TABLES[tableName] || tableName;
  const url = `${API_URL}/${tableId}/${recordId}?returnFieldsByFieldId=true`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function airtableUpdate(tableName, recordId, fields) {
  const tableId = TABLES[tableName] || tableName;
  const url = `${API_URL}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function airtableCreate(tableName, fields) {
  const tableId = TABLES[tableName] || tableName;
  const url = `${API_URL}/${tableId}?returnFieldsByFieldId=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function airtableFetchByIds(tableName, recordIds) {
  if (recordIds.length === 0) return [];
  const conditions = recordIds.map(id => `RECORD_ID()='${id}'`);
  const formula = conditions.length === 1 ? conditions[0] : `OR(${conditions.join(',')})`;
  return airtableFetch(tableName, { filterByFormula: formula });
}

// Cache for fundraisers list and rep IDs
let fundraiserCache = { data: null, timestamp: 0 };
let repCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFundraisersList() {
  if (fundraiserCache.data && Date.now() - fundraiserCache.timestamp < CACHE_TTL) {
    return fundraiserCache.data;
  }
  const records = await airtableFetch('fundraisers');
  const mapped = records.map(r => {
    // Extract rep_photo URL (prefer large thumbnail)
    const photoAttachments = r.fields[FUNDRAISER_FIELDS.rep_photo] || [];
    let rep_photo = null;
    if (photoAttachments.length > 0) {
      const att = photoAttachments[0];
      rep_photo = att.thumbnails?.large?.url || att.url || null;
    }

    return {
      id: r.id,
      organization: r.fields[FUNDRAISER_FIELDS.organization] || '',
      team: r.fields[FUNDRAISER_FIELDS.team] || '',
      status: r.fields[FUNDRAISER_FIELDS.status_rendered] || '',
      kickoff_date: r.fields[FUNDRAISER_FIELDS.kickoff_date] || null,
      end_date: r.fields[FUNDRAISER_FIELDS.end_date] || null,
      asb_boosters: r.fields[FUNDRAISER_FIELDS.asb_boosters] || null,
      rep_photo,
    };
  });
  fundraiserCache = { data: mapped, timestamp: Date.now() };
  return mapped;
}

async function getRepIds() {
  if (repCache.data && Date.now() - repCache.timestamp < CACHE_TTL) {
    return repCache.data;
  }
  const records = await airtableFetch('reps');
  const map = {};
  for (const r of records) {
    const name = r.fields[REP_FIELDS.name] || '';
    map[name] = r.id;
  }
  repCache = { data: map, timestamp: Date.now() };
  return map;
}

async function airtableDelete(tableName, recordIds) {
  const tableId = TABLES[tableName] || tableName;
  const params = recordIds.map(id => `records[]=${id}`).join('&');
  const url = `${API_URL}/${tableId}?${params}`;
  const res = await fetch(url, { method: 'DELETE', headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function uploadAttachmentReplacing(recordId, fieldId, buffer, filename, mimetype) {
  // 1. Capture existing attachment IDs
  const existing = await airtableGet('fundraisers', recordId);
  const existingAttachments = (existing.fields && existing.fields[fieldId]) || [];
  const existingIds = new Set(existingAttachments.map(a => a.id));

  // 2. Upload via Airtable content endpoint (appends)
  const base64 = buffer.toString('base64');
  const uploadRes = await fetch(
    `https://content.airtable.com/v0/${BASE_ID}/${recordId}/${fieldId}/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentType: mimetype, filename, file: base64 }),
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Airtable uploadAttachment error (${uploadRes.status}): ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const allAttachments = (uploadData.fields && uploadData.fields[fieldId]) || [];
  const newAttachment = allAttachments.find(a => !existingIds.has(a.id));
  if (!newAttachment) throw new Error('Could not identify newly uploaded file.');

  // 3. PATCH to keep ONLY the new attachment (replace semantics)
  await airtableUpdate('fundraisers', recordId, {
    [fieldId]: [{ id: newAttachment.id }],
  });

  return { id: newAttachment.id, url: newAttachment.url, filename: newAttachment.filename };
}

async function checkNeedsManualProductSplit(recordId) {
  const record = await airtableGet('fundraisers', recordId);
  const f = record.fields || {};
  const F = FUNDRAISER_FIELDS;
  const productPrimaryStr = f[F.product_primary_string] || '';
  const isMd = productPrimaryStr.toLowerCase().includes('md');
  if (!isMd) return false;
  const hasSecondary = ((f[F.product_secondary] || []).length > 0);
  if (!hasSecondary) return false;
  const ppManual = f[F.pp_gross_manual];
  const spGross = f[F.sp_gross];
  return (ppManual == null || ppManual === 0) || (spGross == null || spGross === 0);
}

function computeReportFingerprint(fields) {
  const F = FUNDRAISER_FIELDS;
  const mdPayoutId = (fields[F.md_payout_report] || [])[0]?.id || '';
  const parts = [
    mdPayoutId,
    fields[F.pp_gross_manual] ?? '',
    fields[F.sp_gross] ?? '',
    fields[F.gross_sales_md] ?? '',
    fields[F.final_team_profit] ?? '',
    fields[F.final_invoice_amount] ?? '',
    fields[F.rep_commission] ?? '',
  ];
  return parts.join('|');
}

export {
  BASE_ID,
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  REP_IDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  DAILY_PAYOUT_FIELDS,
  FUNDRAISER_PAYOUT_FIELDS,
  PRODUCT_FIELDS,
  airtableFetch,
  airtableFetchByIds,
  airtableGet,
  airtableUpdate,
  airtableCreate,
  airtableDelete,
  getFundraisersList,
  getRepIds,
  uploadAttachmentReplacing,
  checkNeedsManualProductSplit,
  computeReportFingerprint,
};

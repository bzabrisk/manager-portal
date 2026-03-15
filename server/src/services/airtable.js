const BASE_ID = 'appxDlniu6IPMVIVp';
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const TABLES = {
  tasks: 'tblA1Rndmnrey0e6L',
  fundraisers: 'tbl7aH2mtkAGC9jk9',
  reps: 'tbljkTGJ7y1WmkXw0',
  daily_payouts: 'tblxoqfVPg322jNqA',
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
  manual_status_override: 'fldFHxyf9DHd1qscd',
  fundraiser_agreement: 'fld3EdTDzU7YDRK4T',
  fundraiser_profit_report: 'fldDX1jRdrNc1zepO',
  rep_commission_report: 'fld4hTL0dMQTCnoPG',
  invoice_attachment: 'fldX31hTUnVFuafhN',
  md_payout_report: 'fldYcxmoXJ16uuAE6',
  daily_payouts: 'fldZOe15DJT4G61Bh',
  primary_contact_email: 'fldpNuvbEbmZrYuGb',
  accounting_contact_email: 'fldH17UIgXDn67jc1',
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
  run_date: 'fld1sArgKrWLemvTx',
  gross_sales_today: 'fldSUT1FxxucUb65Q',
  payout_amount: 'fld6EieozqJRIcjeu',
  status: 'fldSFFGZe6WsyGluk',
  reference_number: 'fldOsL9CZyodprYzK',
  error_message: 'fldQgdZBqUonHMFMO',
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
    if (key === 'filterByFormula' || key === 'sort' || key === 'maxRecords' || key === 'pageSize') {
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

export {
  TABLES,
  TASK_FIELDS,
  FUNDRAISER_FIELDS,
  REP_FIELDS,
  REP_IDS,
  CLIENT_BOOK_FIELDS,
  ACCOUNTING_CONTACT_FIELDS,
  DAILY_PAYOUT_FIELDS,
  PRODUCT_FIELDS,
  airtableFetch,
  airtableFetchByIds,
  airtableGet,
  airtableUpdate,
  airtableCreate,
  getFundraisersList,
  getRepIds,
};

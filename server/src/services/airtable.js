const BASE_ID = 'appxDlniu6IPMVIVp';
const API_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const TABLES = {
  tasks: 'tblA1Rndmnrey0e6L',
  fundraisers: 'tbl7aH2mtkAGC9jk9',
  reps: 'tbljkTGJ7y1WmkXw0',
  daily_payouts: 'tblxoqfVPg322jNqA',
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
  airtableFetch,
  airtableGet,
  airtableUpdate,
  airtableCreate,
  getFundraisersList,
  getRepIds,
};

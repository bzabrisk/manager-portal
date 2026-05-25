import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const BASE_ID = 'appxDlniu6IPMVIVp';
const TABLE_ID = 'tbl7aH2mtkAGC9jk9';
const TARGET_FIELDS = [
  'pp_gross_automd',
  'mddonations_gross_automd',
  'md_pro_platform_fee',
  'md_product_fee',
  'total_md_prize_fee',
  'md_product_api_admin_fee',
  'md_saas_tax_8.90%',
  'MD_payout_date',
];

async function main() {
  const token = process.env.AIRTABLE_API_TOKEN;
  if (!token) {
    console.error('AIRTABLE_API_TOKEN not set in .env');
    process.exit(1);
  }

  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403 || res.status === 401) {
    console.error(
      'META API FAILED — the Airtable token is missing the \'schema.bases:read\' scope. ' +
      'Add it at https://airtable.com/create/tokens, then re-run.'
    );
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`Airtable metadata API error (${res.status}): ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const table = data.tables.find(t => t.id === TABLE_ID);
  if (!table) {
    console.error(`Table ${TABLE_ID} not found in base ${BASE_ID}`);
    process.exit(1);
  }

  const fieldMap = {};
  for (const f of table.fields) {
    fieldMap[f.name] = f.id;
  }

  console.log('\n=== Fundraiser field IDs ===\n');
  for (const name of TARGET_FIELDS) {
    const id = fieldMap[name];
    if (id) {
      console.log(`${name}: ${id}`);
    } else {
      console.log(`${name}: *** NOT FOUND ***`);
    }
  }
  console.log('');
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});

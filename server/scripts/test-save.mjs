import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { extractMdPayoutData, saveMdPayoutData } from '../src/services/mdPayoutExtractor.js';

const pdfPath = process.argv[2];
const recordId = process.argv[3];

if (!pdfPath || !recordId) {
  console.log('Usage: npx tsx server/scripts/test-save.mjs <path-to-pdf> <fundraiser-record-id>');
  process.exit(1);
}

const buffer = readFileSync(pdfPath);
console.log(`Reading ${pdfPath} (${buffer.length} bytes)...\n`);

// Step 1: Extract
console.log('=== EXTRACTION ===\n');
const result = await extractMdPayoutData(buffer);
console.log(JSON.stringify(result, null, 2));

if (!result.success) {
  console.error('\nExtraction failed — not saving.');
  process.exit(1);
}

// Step 2: Save
console.log('\n--- About to WRITE these values to record', recordId, 'and regenerate its reports ---');
console.log(JSON.stringify(result.values, null, 2));
console.log('');

const saveResult = await saveMdPayoutData(recordId, buffer, 'test-payout.pdf', 'application/pdf', result.values);
console.log('\n=== SAVE RESULT ===\n');
console.log(JSON.stringify(saveResult, null, 2));

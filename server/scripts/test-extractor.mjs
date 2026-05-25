import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { extractMdPayoutData } from '../src/services/mdPayoutExtractor.js';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: npx tsx server/scripts/test-extractor.mjs <path-to-pdf>');
  process.exit(1);
}

const buffer = readFileSync(pdfPath);
console.log(`Reading ${pdfPath} (${buffer.length} bytes)...\n`);

const result = await extractMdPayoutData(buffer);
console.log(JSON.stringify(result, null, 2));

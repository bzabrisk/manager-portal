// Uniform 500 responses. In production the client gets a generic message plus
// a short reference ID; the full error (including any third-party text from
// Airtable, Anthropic, Google, or Checkbook) is logged server-side under that
// same ID so it can be found in Railway logs. Outside production the detail
// is included in the response for local debugging.
//
// Exception: Checkbook's own error text is operationally important to Krista
// in the payment modals (e.g. "insufficient funds", "invalid recipient"), so
// payment routes opt in to passing a CheckbookError's message through.

import { randomBytes } from 'node:crypto';

export class CheckbookError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CheckbookError';
    this.checkbookStatus = status;
  }
}

export function sendServerError(res, err, { context, fallback, passThroughCheckbook = false, extra = {} }) {
  const ref = randomBytes(4).toString('hex');
  console.error(`[${context}] ref=${ref}`, err);

  if (passThroughCheckbook && err instanceof CheckbookError) {
    return res.status(500).json({ ...extra, error: err.message, ref });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction
    ? `${fallback} (ref ${ref})`
    : `${fallback}: ${err?.message || err} (ref ${ref})`;
  return res.status(500).json({ ...extra, error: message, ref });
}

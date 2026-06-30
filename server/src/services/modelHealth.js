import { sendEmail } from './gmail.js';

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

let lastNotifiedAt = 0;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function isModelNotFoundError(status, bodyText) {
  return status === 404 && (bodyText.includes('not_found_error') || bodyText.includes('model:'));
}

export async function notifyModelRetired({ source }) {
  const now = Date.now();
  if (now - lastNotifiedAt < SIX_HOURS_MS) return;
  lastNotifiedAt = now;

  try {
    await sendEmail({
      to: 'tahni@smashfundraising.com',
      subject: '\u26a0\ufe0f SMASH Manager Portal \u2014 Claude AI model retired, needs a code update',
      html: `<p>The AI model <code>${ANTHROPIC_MODEL}</code> has been retired by Anthropic.</p>
<p>The feature that failed: <strong>${source}</strong></p>
<p>To fix, paste this prompt into Claude Code:</p>
<blockquote>Open the file server/src/services/modelHealth.js and change the ANTHROPIC_MODEL constant from its current value to the new current Claude model name (find it at https://docs.claude.com/en/docs/about-claude/models/overview), then save. That single change fixes both the extractor and the chatbot.</blockquote>`,
    });
  } catch (err) {
    console.error('[modelHealth] Failed to send model-retired alert email:', err.message);
  }
}

import { isUpfrontCards, isCanadaCards } from './products.js';

// Upfront purchase agreement notes are matched via isUpfrontCards/isCanadaCards
// (not exact name) so a product rename doesn't silently drop them.
const UPFRONT_NOTES_US = 'Upfront purchase pricing per card, based on total cards ordered: 500–799 cards $8 · 800–999 $7 · 1,000–1,499 $6 · 1,500+ $5. Minimum order 500 cards. The team keeps 100% of card sales ($25 retail). SMASH invoices the team for the cards at the tier price; payment is due within 30 days of delivery.';

const UPFRONT_NOTES_CANADA = 'Upfront purchase pricing per card, based on total cards ordered: 500–799 cards $10 · 800–999 $9 · 1,000–1,499 $8 · 1,500–1,999 $7 · 2,000+ $6. Minimum order 500 cards. The team keeps 100% of card sales ($30 retail). SMASH invoices the team for the cards at the tier price; payment is due within 30 days of delivery. All amounts are in US dollars.';

const TIER_NOTES = {
  'Team Cards - Traditional No-Risk': [
    '*Tiered pricing based on cards sold:',
    '  • 1000+ cards: 64%',
    '  • 500–999 cards: 60%',
    '  • Under 500 cards: 56%',
  ].join('\n'),
  'Team Cards - MD Digital': [
    '*Tiered pricing based on cards sold:',
    '  • 1000+ cards: 64%',
    '  • 500–999 cards: 60%',
    '  • Under 500 cards: 56%',
  ].join('\n'),
};

export function isTiered(productName) {
  return isUpfrontCards(productName) || productName in TIER_NOTES;
}

export function getTierNotes(productName) {
  if (isUpfrontCards(productName)) {
    return isCanadaCards(productName) ? UPFRONT_NOTES_CANADA : UPFRONT_NOTES_US;
  }
  return TIER_NOTES[productName] || '';
}

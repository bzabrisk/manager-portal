const TIER_NOTES = {
  'Team Cards - Traditional Upfront Purchase': [
    '*Tiered pricing based on cards sold:',
    '  \u2022 1500+ cards: 80%',
    '  \u2022 1000\u20131499 cards: 76%',
    '  \u2022 800\u2013999 cards: 72%',
    '  \u2022 Under 800 cards: 68%',
  ].join('\n'),
  'Team Cards - Traditional No-Risk': [
    '*Tiered pricing based on cards sold:',
    '  \u2022 1000+ cards: 64%',
    '  \u2022 500\u2013999 cards: 60%',
    '  \u2022 Under 500 cards: 56%',
  ].join('\n'),
  'Team Cards - MD Digital': [
    '*Tiered pricing based on cards sold:',
    '  \u2022 1000+ cards: 64%',
    '  \u2022 500\u2013999 cards: 60%',
    '  \u2022 Under 500 cards: 56%',
  ].join('\n'),
};

export function isTiered(productName) {
  return productName in TIER_NOTES;
}

export function getTierNotes(productName) {
  return TIER_NOTES[productName] || '';
}

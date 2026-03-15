const ASB_TYPES = {
  'wa state asb': { display: 'WA State ASB', color: 'bg-blue-100 text-blue-700' },
  'school - other than wa state asb': { display: 'School - other than WA State ASB', color: 'bg-green-100 text-green-700' },
  'booster club': { display: 'Booster Club', color: 'bg-purple-100 text-purple-700' },
};

export function formatAsbType(value) {
  if (!value) return null;
  const entry = ASB_TYPES[value.toLowerCase()];
  return entry ? entry.display : value;
}

export function getAsbColor(value) {
  if (!value) return null;
  const entry = ASB_TYPES[value.toLowerCase()];
  return entry ? entry.color : null;
}

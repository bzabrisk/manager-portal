// Product-name detection helpers. product_primary_string is a lookup field —
// resolve arrays with [0] before calling these.

export function isUpfrontCards(productPrimaryString) {
  return (productPrimaryString || '').toLowerCase().includes('traditional upfront');
}

export function isCanadaCards(productPrimaryString) {
  return (productPrimaryString || '').toLowerCase().includes('canada');
}

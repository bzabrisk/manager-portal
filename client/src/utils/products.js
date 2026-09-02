// Product-name detection helpers. Keep in sync with server/src/constants/products.js.

export function isUpfrontCards(productPrimaryString) {
  return (productPrimaryString || '').toLowerCase().includes('traditional upfront');
}

export function isCanadaCards(productPrimaryString) {
  return (productPrimaryString || '').toLowerCase().includes('canada');
}

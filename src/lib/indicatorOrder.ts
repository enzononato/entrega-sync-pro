/**
 * Canonical display order for indicators.
 * Indicators not listed here will appear at the end, sorted alphabetically.
 */
const ORDER: string[] = [
  'TML',
  'TR',
  'TI',
  'JL',
  'TX_DEVOLUCAO',
  'TX_DEV',
  'DISP_TEMPO',
  'RATING',
  'TX_REPOSICAO',
  'DEV_PDV',
  'PDV_CRITICO',
];

const orderMap = new Map(ORDER.map((code, i) => [code, i]));

/**
 * Returns a numeric sort key for an indicator code.
 * Lower = earlier in display order.
 */
export function indicatorSortKey(code: string | null | undefined): number {
  if (!code) return 9999;
  const idx = orderMap.get(code.toUpperCase());
  return idx !== undefined ? idx : 1000 + code.charCodeAt(0);
}

/**
 * Sort comparator for objects that have an indicator code.
 * Usage: array.sort(compareIndicators(item => item.indicators?.codigo))
 */
export function compareIndicators<T>(getCode: (item: T) => string | null | undefined) {
  return (a: T, b: T) => indicatorSortKey(getCode(a)) - indicatorSortKey(getCode(b));
}

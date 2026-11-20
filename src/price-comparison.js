export function validComparisonPrice(value) {
  return typeof value === 'string' && (value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 999999999999));
}
export function comparisonTotals(rows) {
  let added = 0, subtracted = 0;
  for (const row of rows) {
    const price = validComparisonPrice(row.price) ? Number(row.price || 0) : 0;
    if (row.operation === '-') subtracted += price;
    else added += price;
  }
  return {added, subtracted, total: added - subtracted};
}

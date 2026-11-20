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

export const validComparisonRows = rows => Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && validComparisonPrice(row.price) && ['+','-'].includes(row.operation));
export const validComparisonGroup = group => group && typeof group.id === 'string' && typeof group.name === 'string' && validComparisonPrice(group.shipping) && validComparisonRows(group.rows);
export const validComparisonGroups = groups => Array.isArray(groups) && groups.every(validComparisonGroup);
export const comparisonGroupUsed = group => group.shipping !== '' || group.rows.some(row => row.name.trim() || row.price !== '');
export function comparisonGroupTotals(group) {
  const values = comparisonTotals(group.rows);
  const shipping = validComparisonPrice(group.shipping) ? Number(group.shipping || 0) : 0;
  return {...values, subtotal: values.total, shipping, total: values.total + shipping};
}
export const comparisonGroupReady = group => validComparisonGroup(group)
  && (group.shipping !== '' || group.rows.some(row => row.price !== ''))
  && group.rows.every(row => !row.name.trim() || row.price !== '');
export function comparisonRanking(groups) {
  const candidates = groups.filter(comparisonGroupReady);
  return {count: candidates.length, lowest: candidates.length ? Math.min(...candidates.map(group => comparisonGroupTotals(group).total)) : null};
}
export function migrateComparisonRows(rows, createId) {
  return [{id: createId(), name: '묶음 1', shipping: '', rows: structuredClone(rows)}];
}

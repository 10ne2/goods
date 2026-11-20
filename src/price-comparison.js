export function validComparisonPrice(value) {
  return typeof value === 'string' && (value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 999999999999));
}
export function validComparisonItemPrice(value) {
  return typeof value === 'string' && (value === '' || (/^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Math.abs(Number(value)) <= 999999999999));
}
export const validComparisonQuantity = value => typeof value === 'string' && (value === '' || (/^\d+$/.test(value) && Number(value) <= 999999));
function lineAmount(row) {
  const quantity = row.quantity ?? '1';
  if (!validComparisonItemPrice(row.price) || !validComparisonQuantity(quantity)) return null;
  const result = Number(row.price || 0) * Number(quantity || 0) * (row.operation === '-' ? -1 : 1);
  return Number.isSafeInteger(result) ? result : null;
}
export function comparisonTotals(rows) {
  let added = 0, subtracted = 0;
  for (const row of rows) {
    const amount = lineAmount(row) ?? 0;
    if (amount < 0) subtracted -= amount;
    else added += amount;
  }
  return {added, subtracted, total: added - subtracted};
}

export const validComparisonRows = rows => Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && validComparisonItemPrice(row.price) && validComparisonQuantity(row.quantity ?? '1') && (row.operation === undefined || ['+','-'].includes(row.operation)) && lineAmount(row) !== null);
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
  && group.rows.every(row => (!row.name.trim() || row.price !== '') && (row.quantity ?? '1') !== '');
export function comparisonRanking(groups) {
  const candidates = groups.filter(comparisonGroupReady);
  return {count: candidates.length, lowest: candidates.length ? Math.min(...candidates.map(group => comparisonGroupTotals(group).total)) : null};
}
export function migrateComparisonRows(rows, createId) {
  return [{id: createId(), name: '묶음 1', shipping: '', rows: structuredClone(rows)}];
}

export function normalizeComparisonGroups(groups) {
  return groups.map(group => ({...group, rows: group.rows.map(row => {
    const {operation, ...retained} = row;
    return {...retained, price: operation === '-' && row.price !== '' ? String(-Number(row.price)) : row.price, quantity: row.quantity ?? '1'};
  })}));
}

const names = new Intl.Collator('ko', {numeric: true, sensitivity: 'base'});
const compareNames = (a, b) => {
  const left = a.name.trim(), right = b.name.trim();
  return left && right ? names.compare(left, right) : left ? -1 : right ? 1 : 0;
};
export function bundles(rows) {
  const result = [], byId = new Map();
  for (const row of rows) {
    if (!row.bundleId) { result.push([row]); continue; }
    const key = JSON.stringify([row.bundleId, row.month]);
    let group = byId.get(key);
    if (!group) { group = []; byId.set(key, group); result.push(group); }
    group.push(row);
  }
  return result;
}
export function orderedBundles(rows, side) {
  const completed = row => side === 'sales' && row.status === '판매완료';
  const groups = bundles(rows).map(group => [...group].sort((a, b) => Number(completed(b)) - Number(completed(a)) || compareNames(a, b)));
  return groups.sort((a, b) => Number(b.every(completed)) - Number(a.every(completed)) || compareNames([...a].sort(compareNames)[0], [...b].sort(compareNames)[0]));
}
export function mergeRows(rows, selected, side, id) {
  const chosen = rows.filter(row => selected.has(row.id));
  const existing = new Set(chosen.map(row => row.bundleId).filter(Boolean));
  const months = new Set(chosen.map(row => row.month));
  const members = rows.filter(row => selected.has(row.id) || (row.bundleId && existing.has(row.bundleId) && months.has(row.month)));
  if (members.length < 2) return rows;
  const leader = members[0];
  const shipping = members.reduce((sum, row) => sum + Number(row.shipping || 0), 0);
  const ids = new Set(members.map(row => row.id));
  const merged = members.map((row, index) => ({...row, bundleId: id, shipping: index === 0 ? String(shipping) : '',
    ...(side === 'purchases' ? {status: leader.status, month: leader.month} : {})}));
  const result = [];
  for (const row of rows) {
    if (row.id === leader.id) result.push(...merged);
    else if (!ids.has(row.id)) result.push(row);
  }
  return result;
}

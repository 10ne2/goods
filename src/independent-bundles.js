export function bundles(rows) {
  const result = [], byId = new Map();
  for (const row of rows) {
    if (!row.bundleId) { result.push([row]); continue; }
    let group = byId.get(row.bundleId);
    if (!group) { group = []; byId.set(row.bundleId, group); result.push(group); }
    group.push(row);
  }
  return result;
}
export function mergeRows(rows, selected, side, id) {
  const chosen = rows.filter(row => selected.has(row.id));
  const existing = new Set(chosen.map(row => row.bundleId).filter(Boolean));
  const members = rows.filter(row => selected.has(row.id) || (row.bundleId && existing.has(row.bundleId)));
  if (members.length < 2) return rows;
  const leader = members[0], memberIds = new Set(members.map(row => row.id));
  const shipping = members.reduce((sum, row) => sum + Number(row.shipping || 0), 0);
  const merged = members.map((row, index) => ({...row, bundleId: id,
    ...(side === 'purchases' ? {shipping: index === 0 ? String(shipping) : '', status: leader.status, month: leader.month} : {})}));
  const result = [];
  for (const row of rows) {
    if (row.id === leader.id) result.push(...merged);
    else if (!memberIds.has(row.id)) result.push(row);
  }
  return result;
}

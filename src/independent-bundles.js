export function bundles(rows) {
  const result = [];
  for (const row of rows) {
    const previous = result.at(-1);
    if (row.bundleId && previous?.[0].bundleId === row.bundleId) previous.push(row);
    else result.push([row]);
  }
  return result;
}
export function mergeRows(rows, selected, side, id) {
  const chosen = rows.filter(row => selected.has(row.id));
  const existing = new Set(chosen.map(row => row.bundleId).filter(Boolean));
  const members = rows.filter(row => selected.has(row.id) || (row.bundleId && existing.has(row.bundleId)));
  if (members.length < 2) return rows;
  const leader = members[0];
  const shipping = members.reduce((sum, row) => sum + Number(row.shipping || 0), 0);
  let index = 0;
  const ids = new Set(members.map(row => row.id));
  const merged = members.map(row => {
    return {...row, bundleId: id,
      ...(side === 'purchases' ? {shipping: index++ === 0 ? String(shipping) : '', status: leader.status, month: leader.month} : {})};
  });
  return [...merged, ...rows.filter(row => !ids.has(row.id))];
}

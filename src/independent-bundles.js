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
  const first = rows.indexOf(members[0]), last = rows.indexOf(members.at(-1));
  if (last - first + 1 !== members.length) throw Error('상품 순서를 유지하려면 연속된 상품을 선택해주세요. Shift로 범위를 선택할 수 있어요.');
  const leader = members[0];
  const shipping = members.reduce((sum, row) => sum + Number(row.shipping || 0), 0);
  let index = 0;
  const ids = new Set(members.map(row => row.id));
  return rows.map(row => {
    if (!ids.has(row.id)) return row;
    return {...row, bundleId: id,
      ...(side === 'purchases' ? {shipping: index++ === 0 ? String(shipping) : '', status: leader.status, month: leader.month} : {})};
  });
}

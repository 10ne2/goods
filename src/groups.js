export const amount = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
export function totals(group) {
  const cost = group.purchases.reduce((sum, row) => sum + amount(row.price), 0) + amount(group.shipping) + amount(group.extra);
  const completed = group.sales.filter(row => row.status === '판매완료');
  const current = completed.reduce((sum, row) => sum + amount(row.price), 0);
  const expected = group.sales.reduce((sum, row) => sum + amount(row.price), 0);
  const fees = rows => rows.reduce((sum, row) => sum + amount(row.shipping) + amount(row.fee), 0);
  return {cost, current, expected, currentDifference: cost - current + fees(completed), expectedDifference: cost - expected + fees(group.sales)};
}
export function migrate(items) {
  return items.map(item => ({
    id: item.id, name: '', shipping: String(item.shipping), extra: String(item.extra),
    purchases: [{id: `${item.id}-purchase`, name: item.name, price: String(item.price), status: '수령완료', date: item.date}],
    sales: item.sale ? [{id: `${item.id}-sale`, name: item.name, price: String(item.sale.price), status: '판매완료', shipping: String(item.sale.shipping), fee: String(item.sale.fee), date: item.sale.date}] : []
  }));
}

export const purchaseColor = status => ({배송중: '#FAEDE6', 수령완료: '#F7DFD0'}[status] || '#ffffff');
export const saleColor = status => ({판매중: '#F2F8FA', 배송중: '#D2E6EF', 판매완료: '#A9CCDC'}[status] || '#ffffff');
export function saleBands(rows) {
  if (!rows.length) return 'none';
  return `linear-gradient(to bottom, ${rows.map((row, index) => `${saleColor(row.status)} ${index / rows.length * 100}% ${(index + 1) / rows.length * 100}%`).join(', ')})`;
}

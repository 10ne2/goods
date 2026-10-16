export const purchaseColor = status => ({배송중: '#ffe5cc', 수령완료: '#f8cbad'}[status] || '#ffffff');
export const saleColor = status => ({판매중: '#c0e6f5', 배송중: '#a0d7ee', 판매완료: '#80c8e7'}[status] || '#ffffff');
export function saleBands(rows) {
  if (!rows.length) return 'none';
  return `linear-gradient(to bottom, ${rows.map((row, index) => `${saleColor(row.status)} ${index / rows.length * 100}% ${(index + 1) / rows.length * 100}%`).join(', ')})`;
}

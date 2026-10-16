export const purchaseColor = status => ({배송중: '#f7ddc4', 수령완료: '#f0c3a5'}[status] || '#ffffff');
export const saleColor = status => ({판매중: '#b8deed', 배송중: '#98cfe6', 판매완료: '#78c0df'}[status] || '#ffffff');
export function saleBands(rows) {
  if (!rows.length) return 'none';
  return `linear-gradient(to bottom, ${rows.map((row, index) => `${saleColor(row.status)} ${index / rows.length * 100}% ${(index + 1) / rows.length * 100}%`).join(', ')})`;
}

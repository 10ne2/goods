export const purchaseColor = status => ({배송중: '#FAEDE6', 수령완료: '#F7DFD0'}[status] || '#ffffff');
export const saleColor = status => ({판매중: '#E3F0F5', 배송중: '#C8E0EB', 판매완료: '#B5D3E0'}[status] || '#ffffff');
export function saleBands(rows) {
  if (!rows.length) return 'none';
  return `linear-gradient(to bottom, ${rows.map((row, index) => `${saleColor(row.status)} ${index / rows.length * 100}% ${(index + 1) / rows.length * 100}%`).join(', ')})`;
}

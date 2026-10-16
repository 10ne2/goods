export const purchaseColor = status => ({배송중: '#ffeddc', 수령완료: '#fbdccc'}[status] || '#ffffff');
export const saleColor = status => ({판매중: '#d6eff8', 배송중: '#bfe4f3', 판매완료: '#a8dbee'}[status] || '#ffffff');
export function saleBands(rows) {
  if (!rows.length) return 'none';
  return `linear-gradient(to bottom, ${rows.map((row, index) => `${saleColor(row.status)} ${index / rows.length * 100}% ${(index + 1) / rows.length * 100}%`).join(', ')})`;
}

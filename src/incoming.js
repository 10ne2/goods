import {amount} from './groups.js';
export function shippingTotal(rows) {
  return rows.filter(row => row.status === '배송중').reduce((sum, row) => sum + amount(row.price), 0);
}

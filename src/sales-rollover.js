import {bundles} from './independent-bundles.js';
import {monthOf} from './months.js';

export function salesPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit'}).formatToParts(date);
  return parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value;
}
const periodIndex = period => {
  if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const [year, month] = period.split('-').map(Number);
  return year * 12 + month - 1;
};
export function rolloverSales(data, date = new Date()) {
  const period = salesPeriod(date), current = periodIndex(period), previous = periodIndex(data.salesRolloverPeriod);
  if (previous !== null && previous >= current) return data;
  // The first upgrade carries earlier months of this year, leaving future months alone.
  const start = previous ?? Math.floor(current / 12) * 12;
  const past = new Set();
  for (let offset = start; offset < current && past.size < 12; offset++) past.add(String(offset % 12 + 1));
  const month = String(current % 12 + 1);
  const canCarry = row => {
    const populated = row.name?.trim() || String(row.price ?? '').trim() || String(row.shipping ?? '').trim();
    return row.status !== '판매완료' && populated && past.has(monthOf(row));
  };
  const shipping = new Map();
  for (const group of bundles(data.sales)) {
    const completed = group.find(row => row.status === '판매완료');
    if (!completed || !group.some(canCarry)) continue;
    const total = group.reduce((sum, row) => sum + Number(row.shipping || 0), 0);
    if (total) group.forEach(row => shipping.set(row.id, row.id === completed.id ? String(total) : ''));
  }
  // A split legacy bundle keeps already-deducted shipping with the completed
  // records, so carrying its remaining items cannot change past settlements.
  return {...data, salesRolloverPeriod: period, sales: data.sales.map(row => {
    const retained = shipping.has(row.id) ? {...row, shipping: shipping.get(row.id)} : row;
    return canCarry(row) ? {...retained, month} : retained;
  })};
}

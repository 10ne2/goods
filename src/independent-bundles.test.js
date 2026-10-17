import test from 'node:test';
import assert from 'node:assert/strict';
import {bundles, mergeRows} from './independent-bundles.js';
const rows = [
  {id:'a', name:'A', price:'1000', shipping:'300', month:'9', status:'배송중'},
  {id:'b', name:'B', price:'2000', shipping:'400', month:'9', status:'주문완료'},
  {id:'c', name:'C', price:'3000', shipping:'', month:'9', status:'수령완료'}
];
test('purchase bundling preserves all prices and total shipping with shared status and month', () => {
  const result = mergeRows(rows, new Set(['a','b']), 'purchases', 'bundle');
  assert.deepEqual(result.map(row => row.price), ['1000','2000','3000']);
  assert.deepEqual(result.map(row => row.shipping), ['700','','']);
  assert.equal(result[1].status, '배송중');
  assert.deepEqual(bundles(result).map(group => group.length), [2,1]);
  assert.equal(rows[1].shipping, '400');
});
test('sales bundling preserves individual statuses, amounts and shipping', () => {
  const result = mergeRows(rows, new Set(['a','b']), 'sales', 'sale');
  assert.deepEqual(result.map(row => row.id), ['a','b','c']);
  assert.equal(result[1].status, '주문완료');
  assert.equal(result[0].shipping, '300');
});
test('merging an existing bundle includes all members without duplicating shipping', () => {
  const first = mergeRows(rows, new Set(['a','b']), 'purchases', 'first');
  const result = mergeRows(first, new Set(['b','c']), 'purchases', 'second');
  assert.equal(bundles(result).length, 1);
  assert.equal(result.reduce((sum,row) => sum + Number(row.shipping),0), 700);
  assert.equal(result.length, 3);
});

test('nonadjacent selections cannot reorder products', () => {
  assert.throws(() => mergeRows(rows, new Set(['a','c']), 'sales', 'sale'), /연속된 상품/);
  assert.deepEqual(rows.map(row => row.id), ['a','b','c']);
});
test('display groups never reorder disconnected records', () => {
  const input = [{id:'a',bundleId:'g'},{id:'b'},{id:'c',bundleId:'g'}];
  assert.deepEqual(bundles(input).flat().map(row => row.id), ['a','b','c']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {bundles, orderedBundles, mergeRows} from './independent-bundles.js';
const rows = [
  {id:'a', name:'가 상품', price:'1000', shipping:'300', month:'9', status:'배송중'},
  {id:'b', name:'나 상품', price:'2000', shipping:'400', month:'9', status:'주문완료'},
  {id:'c', name:'다 상품', price:'3000', shipping:'500', month:'9', status:'수령완료'}
];
test('purchase bundling combines shipping once and shares status/month', () => {
  const result=mergeRows(rows,new Set(['a','c']),'purchases','group');
  assert.deepEqual(result.map(row=>row.id),['a','c','b']);
  assert.deepEqual(result.map(row=>row.shipping),['800','','400']);
  assert.equal(result[1].status,'배송중');
  assert.equal(rows[2].shipping,'500');
});
test('sales bundling combines shipping without changing individual statuses',()=>{
  const result=mergeRows(rows,new Set(['b','c']),'sales','group');
  assert.deepEqual(result.map(row=>row.id),['a','b','c']);
  assert.deepEqual(result.map(row=>row.shipping),['300','900','']);
  assert.equal(result[2].status,'수령완료');
});
test('rebundling preserves total shipping and does not force the group to the top',()=>{
  const initial=mergeRows(rows,new Set(['b','c']),'sales','first');
  const result=mergeRows(initial,new Set(['c','b']),'sales','next');
  assert.equal(result[0].id,'a');
  assert.equal(result.reduce((sum,row)=>sum+Number(row.shipping),0),1200);
});
test('purchase groups follow Korean product name order with blank names last',()=>{
  const input=[rows[2],{id:'empty',name:'',price:'',shipping:''},rows[0],rows[1]];
  assert.deepEqual(orderedBundles(input,'purchases').flat().map(row=>row.id),['a','b','c','empty']);
});
test('completed sales come first, then names sort naturally within each status',()=>{
  const input=[{...rows[1],status:'판매완료'},{...rows[0],status:'판매중'},{...rows[2],status:'판매완료'}];
  assert.deepEqual(orderedBundles(input,'sales').flat().map(row=>row.id),['b','c','a']);
});
test('bundles stay together, complete bundles come first, mixed members sort completed first',()=>{
  const input=[{...rows[0],status:'판매중',bundleId:'mixed'},{...rows[2],status:'판매완료',bundleId:'mixed'},{...rows[1],status:'판매완료'}];
  assert.deepEqual(orderedBundles(input,'sales').map(group=>group.map(row=>row.id)),[['b'],['c','a']]);
});
test('disconnected members reunite for display without changing the input',()=>{
  const input=[{...rows[0],bundleId:'g'},rows[1],{...rows[2],bundleId:'g'}];
  assert.deepEqual(bundles(input).map(group=>group.map(row=>row.id)),[['a','c'],['b']]);
  assert.deepEqual(input.map(row=>row.id),['a','b','c']);
});

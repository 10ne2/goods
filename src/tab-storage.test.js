import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeChanges} from './tab-storage.js';
const base = [{id:'a',name:'A',price:'1000'},{id:'b',name:'B',price:'2000'}];
test('unchanged tabs follow remote additions and deletions instead of restoring stale records', () => {
  const remote = [{...base[0],price:'3000'},{id:'c',name:'C',price:'4000'}];
  assert.deepEqual(mergeChanges(base,structuredClone(base),remote),remote);
});
test('different row edits from two tabs are preserved', () => {
  const local = [base[0],{...base[1],price:'2500'}];
  const remote = [{...base[0],name:'New A'},base[1],{id:'c',name:'C',price:'3000'}];
  assert.deepEqual(mergeChanges(base,local,remote),[{...base[0],name:'New A'},{...base[1],price:'2500'},remote[2]]);
});
test('different fields on the same row merge and the last local edit wins a same-field conflict', () => {
  assert.deepEqual(mergeChanges(base,[{...base[0],price:'1500'},base[1]],[{...base[0],name:'New A',price:'1200'},base[1]]),[{...base[0],name:'New A',price:'1500'},base[1]]);
});
test('middle insertions keep product order while preserving remote records', () => {
  const inserted={id:'new',name:'New',price:''};
  assert.deepEqual(mergeChanges(base,[base[0],inserted,base[1]],[base[0],{...base[1],price:'2500'}]).map(row=>row.id),['a','new','b']);
});
test('nested grouped records merge independent purchase and sales edits', () => {
  const original=[{id:'g',purchases:[base[0]],sales:[base[1]]}];
  const local=structuredClone(original),remote=structuredClone(original);
  local[0].purchases[0].price='1500';remote[0].sales[0].name='Sold B';
  const merged=mergeChanges(original,local,remote);
  assert.equal(merged[0].purchases[0].price,'1500');assert.equal(merged[0].sales[0].name,'Sold B');
});
test('local deletion stays deleted and unsaved edits survive a remote deletion', () => {
  assert.deepEqual(mergeChanges(base,[base[0]],[base[0],{...base[1],price:'2500'}]),[base[0]]);
  assert.deepEqual(mergeChanges(base,[base[0],{...base[1],name:'Draft'}],[base[0]]),[base[0],{...base[1],name:'Draft'}]);
});

test('local product moves stay ordered while preserving remote field edits', () => {
  const original=[...base,{id:'c',name:'C',price:'3000'}];
  const local=[original[1],original[2],original[0]];
  const remote=[{...original[0],price:'1500'},original[1],original[2]];
  const result=mergeChanges(original,local,remote);
  assert.deepEqual(result.map(row=>row.id),['b','c','a']);
  assert.equal(result[2].price,'1500');
});
test('remote product moves remain when local changes only a price', () => {
  const original=[...base,{id:'c',name:'C',price:'3000'}];
  const local=[{...original[0],price:'1500'},original[1],original[2]];
  const remote=[original[2],original[0],original[1]];
  const result=mergeChanges(original,local,remote);
  assert.deepEqual(result.map(row=>row.id),['c','a','b']);
  assert.equal(result[1].price,'1500');
});

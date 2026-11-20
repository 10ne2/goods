import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonTotals, validComparisonPrice, comparisonGroupTotals, comparisonRanking, migrateComparisonRows} from './price-comparison.js';
test('comparison adds and subtracts named purchase candidates',()=>assert.deepEqual(comparisonTotals([{name:'상품',price:'12000',operation:'+'},{name:'배송비',price:'3000',operation:'+'},{name:'할인',price:'2000',operation:'-'}]),{added:15000,subtracted:2000,total:13000}));
test('comparison supports empty amounts and negative final balances',()=>assert.deepEqual(comparisonTotals([{price:'',operation:'+'},{price:'1000',operation:'-'}]),{added:0,subtracted:1000,total:-1000}));
test('invalid comparison prices cannot affect results or be persisted',()=>{
  for(const value of ['-1','1.5','abc','1000000000000'])assert.equal(validComparisonPrice(value),false);
  assert.deepEqual(comparisonTotals([{price:'abc',operation:'+'},{price:'500',operation:'+'}]),{added:500,subtracted:0,total:500});
});

test('bundle shipping is added once after row additions and deductions',()=>{
  assert.deepEqual(comparisonGroupTotals({shipping:'2500',rows:[{price:'10000',operation:'+'},{price:'3000',operation:'+'},{price:'2000',operation:'-'}]}),{added:13000,subtracted:2000,subtotal:11000,shipping:2500,total:13500});
});
test('comparison ranks populated valid groups without treating blank options as free',()=>{
  const group=(id,price,shipping='')=>({id,name:id,shipping,rows:[{id:id+'row',name:'',price,operation:'+'}]});
  assert.deepEqual(comparisonRanking([group('a','10000','2000'),group('b','13000'),group('blank',''),group('invalid','abc')]),{count:2,lowest:12000});
});
test('legacy calculation rows migrate with their names prices and minus signs intact',()=>{
  const rows=[{id:'old',name:'할인',price:'3000',operation:'-'}];
  const groups=migrateComparisonRows(rows,()=> 'group');
  assert.deepEqual(groups,[{id:'group',name:'묶음 1',shipping:'',rows}]);
  groups[0].rows[0].name='changed';assert.equal(rows[0].name,'할인');
});

test('a named product without a price is not a cheapest-price candidate',()=>{
  const group={id:'pending',name:'대기',shipping:'',rows:[{id:'row',name:'가격 미입력 상품',price:'',operation:'+'}]};
  assert.deepEqual(comparisonRanking([group]),{count:0,lowest:null});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonTotals, validComparisonPrice} from './price-comparison.js';
test('comparison adds and subtracts named purchase candidates',()=>assert.deepEqual(comparisonTotals([{name:'상품',price:'12000',operation:'+'},{name:'배송비',price:'3000',operation:'+'},{name:'할인',price:'2000',operation:'-'}]),{added:15000,subtracted:2000,total:13000}));
test('comparison supports empty amounts and negative final balances',()=>assert.deepEqual(comparisonTotals([{price:'',operation:'+'},{price:'1000',operation:'-'}]),{added:0,subtracted:1000,total:-1000}));
test('invalid comparison prices cannot affect results or be persisted',()=>{
  for(const value of ['-1','1.5','abc','1000000000000'])assert.equal(validComparisonPrice(value),false);
  assert.deepEqual(comparisonTotals([{price:'abc',operation:'+'},{price:'500',operation:'+'}]),{added:500,subtracted:0,total:500});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {totalCost,profit,summarize} from './ledger.js';
const item={price:10000,shipping:3000,extra:500};
test('구매 비용에 배송비와 기타 비용을 포함한다',()=>assert.equal(totalCost(item),13500));
test('판매 배송비와 수수료까지 차감한다',()=>assert.equal(profit({...item,sale:{price:18000,shipping:2000,fee:500}}),2000));
test('미판매 상품은 실현 손익에 포함하지 않는다',()=>{assert.equal(profit(item),null);assert.deepEqual(summarize([item,{...item,sale:{price:10000,shipping:1000,fee:500}}]),{cost:27000,revenue:10000,profit:-5000,stock:1});});

import test from 'node:test';
import assert from 'node:assert/strict';
import {independentTotals,rowTotal} from './independent.js';
test('개별 구매 배송비와 개별 판매 부담 배송비의 부호가 다르다',()=>{assert.equal(rowTotal('purchases',{price:'10000',shipping:'3000'}),13000);assert.equal(rowTotal('sales',{price:'18000',shipping:'2000'}),16000);});
test('개별 판매의 현재총합과 예상총합은 배송비를 빼지 않은 상품 가격을 합산한다',()=>assert.deepEqual(independentTotals({purchases:[{price:'10000',shipping:'3000'}],sales:[{price:'18000',shipping:'2000',status:'판매완료'},{price:'15000',shipping:'1000',status:'판매중'}]}),{purchases:13000,completed:18000,expected:33000}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {independentTotals,rowTotal} from './independent.js';
test('개별 구매 배송비와 개별 판매 부담 배송비의 부호가 다르다',()=>{assert.equal(rowTotal('purchases',{price:'10000',shipping:'3000'}),13000);assert.equal(rowTotal('sales',{price:'18000',shipping:'2000'}),16000);});
test('개별 판매의 현재총합과 예상총합은 상품 가격에서 배송비를 차감해 합산한다',()=>assert.deepEqual(independentTotals({purchases:[{price:'10000',shipping:'3000'}],sales:[{price:'18000',shipping:'2000',status:'판매완료'},{price:'15000',shipping:'1000',status:'판매중'}]}),{purchases:13000,completed:16000,expected:30000}));

test('판매 총합은 빈 배송비를 0으로 보고 배송비가 가격보다 커도 차액을 보존한다',()=>assert.deepEqual(independentTotals({purchases:[],sales:[{price:'1000',shipping:'2000',status:'판매완료'},{price:'5000',shipping:'',status:'배송중'}]}),{purchases:0,completed:-1000,expected:4000}));
test('판매 묶음의 공통 배송비는 현재총합과 예상총합에서 한 번만 차감한다',()=>assert.deepEqual(independentTotals({purchases:[],sales:[{id:'a',bundleId:'g',month:'9',price:'10000',shipping:'3000',status:'판매중'},{id:'b',bundleId:'g',month:'9',price:'5000',shipping:'',status:'판매완료'}]}),{purchases:0,completed:2000,expected:12000}));

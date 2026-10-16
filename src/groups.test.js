import test from 'node:test';
import assert from 'node:assert/strict';
import {totals,migrate} from './groups.js';
const sample={shipping:'23400',extra:'',purchases:[32900,3400,7500,31000,32000,32000].map(price=>({price:String(price)})),sales:[{price:'14000',status:'판매완료'},{price:'16000',status:'판매완료'},{price:'43000',status:'판매중'}]};
test('예시 이미지의 구매 총합과 현재·예상 판매액 및 차액을 계산한다',()=>assert.deepEqual(totals(sample),{cost:162200,current:30000,expected:73000,currentDifference:132200,expectedDifference:89200}));
test('판매완료 상태와 판매 비용을 구분한다',()=>{const g=structuredClone(sample);g.sales[2].status='판매완료';g.sales[2].shipping='3000';g.sales[2].fee='1000';assert.deepEqual(totals(g),{cost:162200,current:73000,expected:73000,currentDifference:92200,expectedDifference:92200});});
test('기존 기록의 배송비·기타 비용·날짜·판매 비용을 보존한다',()=>{const [g]=migrate([{id:'old',name:'머그컵',date:'2026-10-16',price:10000,shipping:3000,extra:500,sale:{date:'2026-10-17',price:18000,shipping:2000,fee:500}}]);assert.equal(g.purchases[0].date,'2026-10-16');assert.equal(g.sales[0].date,'2026-10-17');assert.equal(totals(g).currentDifference,-2500);});

test("기존 수수료는 새 차액 계산에 포함하지 않는다",()=>{const g=structuredClone(sample);g.sales[0].fee="1000";assert.equal(totals(g).currentDifference,132200);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {shippingTotal} from './incoming.js';
test('incoming money includes only shipping sales prices, without deducting shipping costs', () => {
  assert.equal(shippingTotal([
    {status:'배송중',price:'12000',shipping:'3000'},
    {status:'배송중',price:'8000',shipping:''},
    {status:'배송중',price:''},
    ...['판매전','판매중','예약중','판매완료'].map(status=>({status,price:'90000'}))
  ]),20000);
});

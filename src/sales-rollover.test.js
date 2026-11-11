import test from 'node:test';
import assert from 'node:assert/strict';
import {independentTotals} from './independent.js';
import {rolloverSales, salesPeriod} from './sales-rollover.js';
const row = (id, month, status = '판매중') => ({id,month,status,name:id,price:'1000',shipping:'300',bundleId:'g'});
test('first upgrade carries earlier unfinished sales while keeping completed and future records',()=>{
  const data={purchases:[row('purchase','9')],sales:[row('old','9'),row('shipping','10','배송중'),row('done','10','판매완료'),row('future','12'),{...row('blank','9'),name:'',price:'',shipping:''}]};
  const result=rolloverSales(data,new Date('2026-11-11T03:00:00Z'));
  assert.deepEqual(result.sales.map(item=>item.month),['11','11','10','12','9']);
  assert.equal(result.salesRolloverPeriod,'2026-11');
  assert.deepEqual(result.purchases,data.purchases);
  assert.equal(data.sales[0].month,'9');
});
test('all unfinished statuses carry once and preserve price, shipping, ids and bundle membership',()=>{
  const data={salesRolloverPeriod:'2026-10',purchases:[],sales:['판매전','판매중','배송중','예약중'].map(status=>row(status,'10',status))};
  const result=rolloverSales(data,new Date('2026-11-01T00:00:00Z'));
  assert.deepEqual(result.sales,data.sales.map(item=>({...item,month:'11'})));
  assert.equal(rolloverSales(result,new Date('2026-11-20T00:00:00Z')),result);
});
test('rollover follows Korean midnight and supports December to January',()=>{
  assert.equal(salesPeriod(new Date('2026-12-31T15:00:00Z')),'2027-01');
  const result=rolloverSales({salesRolloverPeriod:'2026-12',purchases:[],sales:[row('pending','12'),row('done','12','판매완료')]},new Date('2026-12-31T15:00:00Z'));
  assert.deepEqual(result.sales.map(item=>item.month),['1','12']);
});
test('skipped months carry to the actual current month without duplicating records',()=>{
  const result=rolloverSales({salesRolloverPeriod:'2026-09',purchases:[],sales:[row('september','9'),row('october','10')]},new Date('2026-11-11T00:00:00Z'));
  assert.deepEqual(result.sales.map(item=>item.month),['11','11']);
  assert.equal(new Set(result.sales.map(item=>item.id)).size,2);
});
test('viewing other months or a clock moving backwards never triggers another rollover',()=>{
  const data={salesRolloverPeriod:'2026-11',purchases:[],sales:[row('manual-old-month','9')]};
  assert.equal(rolloverSales(data,new Date('2026-11-11T00:00:00Z')),data);
  assert.equal(rolloverSales(data,new Date('2026-10-01T00:00:00Z')),data);
});

test('splitting a legacy mixed bundle preserves total settlements and deducts shipping only once',()=>{
  const data={salesRolloverPeriod:'2026-10',purchases:[],sales:[{...row('done','10','판매완료'),price:'1000',shipping:''},{...row('pending','10'),price:'3000',shipping:'400'}]};
  const result=rolloverSales(data,new Date('2026-11-01T00:00:00Z'));
  assert.deepEqual(independentTotals(result),independentTotals(data));
  assert.equal(result.sales[0].month,'10');
  assert.equal(result.sales[0].shipping,'400');
  assert.equal(result.sales[1].month,'11');
  assert.equal(result.sales[1].shipping,'');
});

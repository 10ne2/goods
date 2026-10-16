import test from 'node:test';
import assert from 'node:assert/strict';
import {monthOf,validMonth,monthOptions} from './months.js';
test('월이 없는 기존 기록을 9월로 분류한다',()=>{assert.equal(monthOf({name:'기존 상품'}),'9');assert.equal(monthOf({month:'10'}),'10');});
test('1~12월만 허용하고 선택 상태를 표시한다',()=>{for(let i=1;i<=12;i++)assert.ok(validMonth(String(i)));for(const month of ['0','13','09',9,null])assert.equal(validMonth(month),false);assert.match(monthOptions('9'),/<option value="9" selected>9월/);});

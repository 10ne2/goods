import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney} from './sheet-utils.js';
test('금액은 쉼표로 표시하되 빈 값과 유효하지 않은 입력을 보존한다',()=>{assert.equal(formatMoney('1234567'),'1,234,567');assert.equal(formatMoney('1,234,567'),'1,234,567');assert.equal(formatMoney('0'),'0');assert.equal(formatMoney(''),'');assert.equal(formatMoney('-1000'),'-1000');assert.equal(formatMoney('1.5'),'1.5');});

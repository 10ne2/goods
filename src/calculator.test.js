import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from './calculator.js';

test('calculator handles money, precedence, parentheses, percentages and decimals', () => {
  assert.equal(calculate('32,900 + 3,400 × 2'), 39700);
  assert.equal(calculate('(32900 + 23400) ÷ 2'), 28150);
  assert.equal(calculate('10000 × 10%'), 1000);
  assert.equal(calculate('0.1 + 0.2'), .3);
  assert.equal(calculate('−100 + 25'), -75);
});
test('calculator rejects invalid expressions and division by zero', () => {
  for (const expression of ['', '1/0', '(1+2', '2+', 'alert(1)', '1 2+']) {
    assert.throws(() => calculate(expression));
  }
});

import 'pretendard/dist/web/variable/pretendardvariable.css';
import './style.css';
import {formatMoney, readMoneyInput, enableCellEditing} from './sheet-utils.js';
import {createTabStorage, preserveEditor} from './tab-storage.js';
import {comparisonTotals, validComparisonPrice} from './price-comparison.js';

const key = 'goods-price-comparison-v1';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blank = () => ({id: crypto.randomUUID(), name: '', price: '', operation: '+'});
const valid = value => Array.isArray(value) && value.every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && validComparisonPrice(row.price) && ['+','-'].includes(row.operation));
let rows = [], initialBase = [], blocked = false, storage, timer;
try {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    const value = JSON.parse(raw);
    if (!valid(value)) throw Error();
    rows = value; initialBase = structuredClone(value);
  }
} catch { blocked = true; }
if (!rows.length) rows.push(blank());

document.querySelector('#app').innerHTML = `<header><a class="brand" href="./">모니굿즈</a><span class="comparison-page-label">계산페이지</span><a class="header-page-link comparison-back" href="./">장부로 돌아가기</a></header><main class="comparison-page"><div class="comparison-heading"><h1>구매 가격 비교</h1><button type="button" id="comparison-add">＋ 행 추가</button></div><p class="comparison-guide">상품명과 가격을 입력하고 ＋ 또는 −를 선택하세요. Enter로 아래 칸에 입력할 수 있습니다.</p><div id="comparison-notice" role="status" aria-live="polite"></div><table class="comparison-sheet" aria-label="구매 가격 비교 계산표"><colgroup><col class="comparison-number"><col><col class="comparison-price"><col class="comparison-operation"><col class="comparison-delete"></colgroup><thead><tr><th scope="col">번호</th><th scope="col">상품명</th><th scope="col">가격</th><th scope="col">계산</th><th scope="col" aria-label="행 삭제"></th></tr></thead><tbody></tbody><tfoot><tr><td colspan="5"><button type="button" id="comparison-add-bottom" aria-label="계산표 행 추가">＋</button></td></tr></tfoot></table><section class="comparison-summary" aria-label="계산 결과"><div><span>더한 금액</span><strong data-result="added">0원</strong></div><div><span>뺀 금액</span><strong data-result="subtracted">0원</strong></div><div class="comparison-final"><span>최종 합계</span><strong data-result="total" aria-live="polite">0원</strong></div></section></main>`;
const table = document.querySelector('.comparison-sheet');
const message = text => { document.querySelector('#comparison-notice').textContent = text; };
function updateTotals() {
  for (const [name, amount] of Object.entries(comparisonTotals(rows))) document.querySelector(`[data-result="${name}"]`).textContent = new Intl.NumberFormat('ko-KR').format(amount) + '원';
}
function renderRows() {
  table.querySelector('tbody').innerHTML = rows.map((row, index) => `<tr data-compare-id="${row.id}"><th scope="row">${index+1}</th><td><input type="text" data-id="${row.id}" data-field="name" value="${esc(row.name)}" aria-label="${index+1}행 상품명" maxlength="160" placeholder="상품명 입력" autocomplete="off"></td><td><input type="text" data-id="${row.id}" data-field="price" data-money inputmode="text" lang="ko" value="${esc(formatMoney(row.price))}" aria-label="${index+1}행 가격" maxlength="20" autocomplete="off" aria-invalid="${!validComparisonPrice(row.price)}"></td><td class="comparison-operators"><button type="button" data-operation="+" data-row="${row.id}" aria-label="${index+1}행 더하기" aria-pressed="${row.operation==='+'}">＋</button><button type="button" data-operation="-" data-row="${row.id}" aria-label="${index+1}행 빼기" aria-pressed="${row.operation==='-'}">−</button></td><td><button type="button" class="comparison-delete-button" data-delete="${row.id}" aria-label="${index+1}행 삭제">×</button></td></tr>`).join('');
  updateTotals();
}
function save() {
  clearTimeout(timer);
  if (blocked) { message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.'); return; }
  if (!valid(rows)) { message('가격은 0 이상의 정수로 입력해주세요.'); return; }
  try { storage.save(rows).then(() => message('')).catch(() => message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.')); }
  catch { message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.'); }
}
function addRow() {
  const row = blank(); rows.push(row); renderRows(); save();
  table.querySelector(`[data-id="${row.id}"][data-field="name"]`).focus();
}
renderRows();
if (!blocked) {
  storage = createTabStorage({key, empty: [], initialBase, valid, getValue: () => rows,
    onValue: value => { rows = value; preserveEditor(table, renderRows); },
    onError: error => message(error.message), onFlush: save});
  storage.initialize().catch(error => message(error.message));
} else message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.');
enableCellEditing(table);
function edit(event) {
  const input = event.target;
  if (!input.matches('input[data-field]')) return;
  const row = rows.find(row => row.id === input.dataset.id);
  row[input.dataset.field] = input.hasAttribute('data-money') ? readMoneyInput(input, event.isComposing) : input.value;
  input.setAttribute('aria-invalid', String(input.dataset.field === 'price' && !validComparisonPrice(row.price)));
  updateTotals(); clearTimeout(timer); timer = setTimeout(save, 350);
}
table.addEventListener('input', edit);
table.addEventListener('compositionend', edit);
table.addEventListener('focusout', event => { if (event.target.matches('input[data-field]')) save(); });
table.addEventListener('click', event => {
  const button = event.target.closest('[data-operation],[data-delete]');
  if (!button) return;
  if (button.dataset.operation) {
    const row = rows.find(row => row.id === button.dataset.row); row.operation = button.dataset.operation;
    button.closest('td').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.operation === row.operation)));
    updateTotals(); save();
  } else {
    rows = rows.filter(row => row.id !== button.dataset.delete);
    if (!rows.length) rows.push(blank());
    renderRows(); save();
  }
});
table.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || !event.target.matches('input[data-field]')) return;
  event.preventDefault();
  const index = rows.findIndex(row => row.id === event.target.dataset.id), field = event.target.dataset.field;
  if (index === rows.length - 1) { rows.push(blank()); renderRows(); save(); }
  table.querySelector(`[data-id="${rows[index+1].id}"][data-field="${field}"]`).focus();
});
document.querySelector('#comparison-add').onclick = addRow;
document.querySelector('#comparison-add-bottom').onclick = addRow;
window.addEventListener('pagehide', save);

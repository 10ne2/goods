import {formatMoney, readMoneyInput, enableWheelScroll} from './sheet-utils.js';
import {amount} from './groups.js';

const key = 'goods-ledger-independent-v1';
const states = {purchases: ['주문완료', '배송중', '수령완료'], sales: ['판매전', '판매중', '예약중', '판매완료']};
const sides = ['purchases', 'sales'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('ko-KR').format(value);
const blank = side => ({id: crypto.randomUUID(), name: '', price: '', shipping: '', status: states[side][0]});
const used = row => row.name || row.price !== '' || row.shipping !== '';
const validMoney = value => typeof value === 'string' && (value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 999999999999));
export const rowTotal = (side, row) => side === 'purchases' ? amount(row.price) + amount(row.shipping) : amount(row.price) - amount(row.shipping);
export function independentTotals(data) {
  return {
    purchases: data.purchases.reduce((sum, row) => sum + rowTotal('purchases', row), 0),
    completed: data.sales.filter(row => row.status === '판매완료').reduce((sum, row) => sum + rowTotal('sales', row), 0),
    expected: data.sales.reduce((sum, row) => sum + rowTotal('sales', row), 0)
  };
}
function valid(data) {
  return data && sides.every(side => Array.isArray(data[side]) && data[side].every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && validMoney(row.price) && validMoney(row.shipping) && states[side].includes(row.status)));
}
let data = {purchases: [], sales: []}, blocked = false, timer, mounted = false;
function message(text, error = false) {
  const node = document.querySelector('#independent-notice');
  if (node) {node.textContent = error ? text : ''; node.classList.toggle('error', error);}
}
export function flushIndependent() {
  clearTimeout(timer);
  if (!mounted) return false;
  if (blocked) {message('개별 기록을 읽지 못해 자동 저장을 중지했습니다.', true); return false;}
  if (!valid(data)) {message('저장 대기 · 금액은 0 이상의 정수로 입력해주세요.', true); return false;}
  try {localStorage.setItem(key, JSON.stringify(data)); message('✓ 개별 기록 자동 저장 완료'); return true;}
  catch {message('저장 실패 · 입력값은 화면에 유지됩니다. 저장 공간을 확인해주세요.', true); return false;}
}
function input(side, row, index, field, label, type = 'text') {
  return `<input data-independent-field="${field}" aria-label="개별 ${side === 'purchases' ? '구매' : '판매'} ${index + 1}행 ${label}" type="text" value="${esc(type === 'number' ? formatMoney(row[field]) : row[field])}" ${type === 'number' ? 'data-money inputmode="numeric" maxlength="20"' : 'maxlength="160"'} autocomplete="off">`;
}
function rowHTML(side, row, index) {
  return `<tr data-independent-id="${esc(row.id)}"><td class="product"><div class="product-cell">${input(side, row, index, 'name', '상품명')}<button class="delete-line" data-independent-delete="${esc(row.id)}" aria-label="개별 ${side === 'purchases' ? '구매' : '판매'} ${index + 1}행 삭제" title="행 삭제">×</button></div></td><td class="price">${input(side, row, index, 'price', '가격', 'number')}</td><td class="price">${input(side, row, index, 'shipping', '배송비', 'number')}</td><td class="total" data-independent-total>${used(row) ? fmt(rowTotal(side, row)) : '—'}</td><td class="state"><select data-independent-field="status" aria-label="개별 ${side === 'purchases' ? '구매' : '판매'} ${index + 1}행 상황">${states[side].map(state => `<option ${state === row.status ? 'selected' : ''}>${state}</option>`).join('')}</select></td></tr>`;
}
function tableHTML(side) {
  const buy = side === 'purchases';
  return `<section class="independent-panel" aria-label="개별 ${buy ? '구매' : '판매'} 장부"><h2 class="individual-title">개별 ${buy ? '구매' : '판매'} 테이블</h2><table class="independent-sheet" data-independent-side="${side}"><thead><tr class="bands"><th colspan="5" class="${buy ? 'purchase' : 'sale'}"><div><span>개별 ${buy ? '구매' : '판매'} 내역</span><button data-independent-add="${side}" aria-label="개별 ${buy ? '구매' : '판매'} 행 추가">＋</button></div></th></tr><tr>${['상품명', '가격', '배송비', buy ? '총 구매 비용' : '정산액', buy ? '구매상황' : '판매상황'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${data[side].map((row, index) => rowHTML(side, row, index)).join('')}</tbody></table><div class="independent-total" data-independent-summary="${side}"></div></section>`;
}
function refreshTotals() {
  const totals = independentTotals(data);
  document.querySelector('[data-independent-summary=purchases]').textContent = `총 구매 비용 ${fmt(totals.purchases)}원`;
  document.querySelector('[data-independent-summary=sales]').textContent = `판매완료 정산액 ${fmt(totals.completed)}원 · 예상 정산액 ${fmt(totals.expected)}원`;
}
function renderTables() {
  document.querySelector('.independent-grid').innerHTML = sides.map(tableHTML).join('');
  refreshTotals();
}
export function independentCSVRows() {
  return sides.flatMap(side => data[side].filter(used).map(row => ['', side === 'purchases' ? '개별 구매' : '개별 판매', row.name, row.price, row.status, side === 'purchases' ? row.shipping : '', '', side === 'sales' ? row.shipping : '', side === 'purchases' ? rowTotal(side, row) : '', side === 'sales' && row.status === '판매완료' ? amount(row.price) : '', side === 'sales' ? amount(row.price) : '', '', '', '']));
}
export function mountIndependent() {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {const parsed = JSON.parse(raw); if (!valid(parsed)) throw Error(); data = parsed;}
  } catch {blocked = true;}
  for (const side of sides) if (!data[side].length) data[side].push(blank(side));
  mounted = true;
  const section = document.querySelector('#independent');
  section.innerHTML = `<div class="independent-heading"><span id="independent-notice" role="status" aria-live="polite"></span></div><div class="independent-scroll"><div class="independent-grid"></div></div>`;
  renderTables();
  if (blocked) message('개별 기록을 읽지 못해 자동 저장을 중지했습니다.', true);
  function edit(event) {
    const element = event.target;
    if (!element.matches('[data-independent-field]')) return;
    const side = element.closest('table').dataset.independentSide;
    const row = data[side].find(row => row.id === element.closest('tr').dataset.independentId);
    row[element.dataset.independentField] = element.hasAttribute('data-money') ? readMoneyInput(element, event.isComposing) : element.value;
    element.setAttribute('aria-invalid', String(element.hasAttribute('data-money') && !validMoney(row[element.dataset.independentField])));
    element.closest('tr').querySelector('[data-independent-total]').textContent = used(row) ? fmt(rowTotal(side, row)) : '—';
    refreshTotals(); message('개별 기록 저장 중…'); clearTimeout(timer); timer = setTimeout(flushIndependent, 350);
  }
  section.addEventListener('input', edit);
  section.addEventListener('compositionend', edit);
  enableWheelScroll(document.querySelector('.independent-scroll'));
  section.addEventListener('change', event => {if (event.target.tagName === 'SELECT') {edit(event); flushIndependent();}});
  section.addEventListener('focusout', event => {if (event.target.matches('[data-independent-field]')) flushIndependent();});
  section.addEventListener('keydown', event => {
    const element = event.target;
    if (event.isComposing || !element.matches('[data-independent-field]') || !['Tab', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const table = element.closest('table'); let next;
    if (event.key === 'Tab') {const fields = [...table.querySelectorAll('input,select')]; next = fields[fields.indexOf(element) + (event.shiftKey ? -1 : 1)];}
    else if (element.tagName !== 'SELECT') {const row = element.closest('tr'); const adjacent = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey) ? row.previousElementSibling : row.nextElementSibling; next = adjacent?.querySelector(`[data-independent-field="${element.dataset.independentField}"]`);}
    if (next) {event.preventDefault(); next.focus(); if (next.type === 'text') next.select();}
  });
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-independent-add],[data-independent-delete]');
    if (!button) return;
    const side = button.dataset.independentAdd || button.closest('table').dataset.independentSide;
    const previous = structuredClone(data);
    if (button.dataset.independentAdd) data[side].push(blank(side));
    else {const row = data[side].find(row => row.id === button.dataset.independentDelete); if (used(row) && !confirm('이 개별 기록을 삭제할까요?')) return; data[side] = data[side].filter(row => row.id !== button.dataset.independentDelete); if (!data[side].length) data[side].push(blank(side));}
    const saved = flushIndependent(); if (!saved) data = previous;
    renderTables();
    if (saved && button.dataset.independentAdd) document.querySelector(`[data-independent-side="${side}"] tbody tr:last-child input`)?.focus();
  });
  window.addEventListener('pagehide', flushIndependent);
}

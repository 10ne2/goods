import {bundles, mergeRows} from './independent-bundles.js';
import {DEFAULT_MONTH, validMonth, monthOf, monthOptions} from './months.js';
import {purchaseColor, saleColor} from './status-colors.js';
import {formatMoney, readMoneyInput, enableCellEditing} from './sheet-utils.js';
import {amount} from './groups.js';

const key = 'goods-ledger-independent-v1';
let currentMonth = DEFAULT_MONTH;
const selected = {purchases: new Set(), sales: new Set()};
const states = {purchases: ['주문완료', '배송중', '수령완료'], sales: ['판매전', '판매중', '배송중', '예약중', '판매완료']};
const sides = ['purchases', 'sales'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('ko-KR').format(value);
const blank = side => ({id: crypto.randomUUID(), month: currentMonth, name: '', price: '', shipping: '', status: states[side][0]});
const used = row => row.name.trim() || row.price !== '' || row.shipping !== '';
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
  return data && sides.every(side => Array.isArray(data[side]) && data[side].every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && (row.bundleId === undefined || typeof row.bundleId === 'string') && (row.month === undefined || validMonth(row.month)) && validMoney(row.price) && validMoney(row.shipping) && states[side].includes(row.status)));
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
  return `<input data-independent-field="${field}" aria-label="개별 ${side === 'purchases' ? '구매' : '판매'} ${index + 1}행 ${label}" type="text" value="${esc(type === 'number' ? formatMoney(row[field]) : row[field])}" ${type === 'number' ? 'data-money inputmode="text" lang="ko" maxlength="20"' : 'maxlength="160"'} placeholder="${field === 'name' ? '상품명 입력' : ''}" autocomplete="off">`;
}
function rowHTML(side, row, index, members, position) {
  const buy = side === 'purchases', first = position === 0, span = members.length;
  const status = `<td class="state" ${buy ? `rowspan="${span}"` : ''}><select data-independent-field="status" aria-label="개별 ${buy ? '구매' : '판매'} ${index + 1}행 상황">${states[side].map(state => `<option ${state === row.status ? 'selected' : ''}>${state}</option>`).join('')}</select></td>`;
  const month = `<td class="month-cell" ${buy ? `rowspan="${span}"` : ''}><select data-independent-field="month" aria-label="개별 ${buy ? '구매' : '판매'} ${index+1}행 월">${monthOptions(row.month)}</select></td>`;
  const total = first ? `<td class="total" rowspan="${span}" data-independent-total>${members.some(used) ? fmt(members.reduce((sum, item) => sum + rowTotal(side, item), 0)) : '—'}</td>` : '';
  return `<tr data-independent-id="${esc(row.id)}" class="${row.bundleId ? 'independent-bundled' : ''} ${first && row.bundleId ? 'bundle-start' : ''}" style="--row-fill:${buy ? purchaseColor(row.status) : saleColor(row.status)}"><td class="product"><div class="product-cell"><input type="checkbox" data-select-row="${esc(row.id)}" aria-label="개별 ${buy ? '구매' : '판매'} ${index+1}행 선택" ${selected[side].has(row.id) ? 'checked' : ''}>${input(side, row, index, 'name', '상품명')}<button class="delete-line" data-independent-delete="${esc(row.id)}" aria-label="개별 ${buy ? '구매' : '판매'} ${index + 1}행 삭제" title="행 삭제">×</button></div></td><td class="price">${input(side, row, index, 'price', '가격', 'number')}</td>${buy && first ? `<td class="price" rowspan="${span}">${input(side, row, index, 'shipping', '배송비', 'number')}</td>` : ''}${total}${!buy || first ? status + month : ''}</tr>`;
}
function tableHTML(side) {
  const buy = side === 'purchases';
  return `<section class="independent-panel" aria-label="개별 ${buy ? '구매' : '판매'} 장부"><div class="individual-title-row"><h2 class="individual-title">개별 ${buy ? '구매' : '판매'} 테이블</h2><button data-independent-add="${side}" aria-label="개별 ${buy ? '구매' : '판매'} 행 추가">＋</button><button class="bundle-action" data-bundle-side="${side}" disabled>선택 묶기</button><button class="bundle-action" data-unbundle-side="${side}" disabled>묶음 해제</button></div><table class="independent-sheet" data-independent-side="${side}"><colgroup><col class="product-column"><col class="money-column">${buy ? '<col class="money-column">' : ''}<col class="money-column"><col class="detail-column"><col class="detail-column"></colgroup><thead><tr class="bands"><th colspan="${buy ? 6 : 5}" class="${buy ? 'purchase' : 'sale'}"><div><span>개별 ${buy ? '구매' : '판매'} 내역</span></div></th></tr><tr>${['상품명', '가격', ...(buy ? ['배송비'] : []), buy ? '총 구매 비용' : '정산액', buy ? '구매상황' : '판매상황', '월'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${bundles(data[side].filter(row => row.month === currentMonth)).map(members => members.map((row, position) => rowHTML(side, row, data[side].indexOf(row), members, position)).join('')).join('')}</tbody></table><div class="independent-total" data-independent-summary="${side}"></div></section>`;
}
function updateSelection() {
  for (const side of sides) {
    const rows = data[side].filter(row => row.month === currentMonth && selected[side].has(row.id));
    document.querySelector(`[data-bundle-side="${side}"]`).disabled = rows.length < 2;
    document.querySelector(`[data-unbundle-side="${side}"]`).disabled = !rows.some(row => row.bundleId);
  }
}
function refreshRows(side) {
  for (const members of bundles(data[side].filter(row => row.month === currentMonth))) {
    for (const row of members) {
      const tr = document.querySelector(`[data-independent-id="${CSS.escape(row.id)}"]`);
      tr?.style.setProperty('--row-fill', side === 'purchases' ? purchaseColor(row.status) : saleColor(row.status));
      const total = tr?.querySelector('[data-independent-total]');
      if (total) total.textContent = members.some(used) ? fmt(members.reduce((sum, item) => sum + rowTotal(side, item), 0)) : '—';
    }
  }
}
function refreshTotals() {
  const totals = independentTotals(Object.fromEntries(sides.map(side => [side, data[side].filter(row => row.month === currentMonth)])));
  document.querySelector('[data-independent-summary=purchases]').textContent = `총 구매 비용 ${fmt(totals.purchases)}원`;
  document.querySelector('[data-independent-summary=sales]').textContent = `판매완료 정산액 ${fmt(totals.completed)}원 · 예상 정산액 ${fmt(totals.expected)}원`;
}
export function sizeIndependentColumns() {
  const detailRatio = .75;
  document.querySelectorAll('.independent-sheet').forEach(table => {
    // Preserve fractional grid widths and reserve border/subpixel rounding space.
    const tableWidth = Math.max(0, table.parentElement.getBoundingClientRect().width - 1.25);
    const productWidth = 266 * Math.min(1, tableWidth / 619);
    const moneyCount = table.dataset.independentSide === 'purchases' ? 3 : 2;
    const moneyWidth = (tableWidth - productWidth) / (moneyCount + detailRatio * 2);
    [...table.querySelectorAll('col')].forEach((col, index) => {
      col.style.width = (index === 0 ? productWidth : index <= moneyCount ? moneyWidth : moneyWidth * detailRatio) + 'px';
    });
  });
}
function renderTables() {
  document.querySelector('.independent-grid').innerHTML = sides.map(tableHTML).join('');
  sizeIndependentColumns();
  refreshTotals();
  updateSelection();
}
export function independentCSVRows() {
  return sides.flatMap(side => data[side].filter(used).map(row => ['', side === 'purchases' ? '개별 구매' : '개별 판매', row.name, row.price, row.status, side === 'purchases' ? row.shipping : '', '', side === 'sales' ? row.shipping : '', side === 'purchases' ? rowTotal(side, row) : '', side === 'sales' && row.status === '판매완료' ? amount(row.price) : '', side === 'sales' ? amount(row.price) : '', '', '', '', row.month, '', '']));
}
export function mountIndependent(initialMonth = DEFAULT_MONTH) {
  currentMonth = initialMonth;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {const parsed = JSON.parse(raw); if (!valid(parsed)) throw Error(); data = parsed;}
  } catch {blocked = true;}
  for (const side of sides) {for (const row of data[side]) row.month = monthOf(row); if (!data[side].some(row => row.month === currentMonth)) data[side].push(blank(side));}
  mounted = true;
  const section = document.querySelector('#independent');
  section.innerHTML = `<div class="independent-heading"><span id="independent-notice" role="status" aria-live="polite"></span></div><div class="independent-scroll"><div class="independent-grid"></div></div>`;
  renderTables();
  enableCellEditing(section);
  if (blocked) message('개별 기록을 읽지 못해 자동 저장을 중지했습니다.', true);
  function edit(event) {
    const element = event.target;
    if (!element.matches('[data-independent-field]') || element.dataset.independentField === 'month') return;
    const side = element.closest('table').dataset.independentSide;
    const row = data[side].find(row => row.id === element.closest('tr').dataset.independentId);
    row[element.dataset.independentField] = element.hasAttribute('data-money') ? readMoneyInput(element, event.isComposing) : element.value;
    element.setAttribute('aria-invalid', String(element.hasAttribute('data-money') && !validMoney(row[element.dataset.independentField])));
    if (side === 'purchases' && row.bundleId && element.dataset.independentField === 'status') {
      data[side].filter(item => item.bundleId === row.bundleId).forEach(item => item.status = row.status);
    }
    refreshRows(side);
    refreshTotals(); message('개별 기록 저장 중…'); clearTimeout(timer); timer = setTimeout(flushIndependent, 350);
  }
  section.addEventListener('input', edit);
  section.addEventListener('compositionend', edit);
  section.addEventListener('change', event => {
    if (event.target.matches('[data-select-row]')) {
      const side = event.target.closest('table').dataset.independentSide, id = event.target.dataset.selectRow;
      if (event.target.checked) selected[side].add(id); else selected[side].delete(id);
      updateSelection(); return;
    }
    if (event.target.tagName !== 'SELECT') return;
    if (event.target.dataset.independentField === 'month') {
      const side = event.target.closest('table').dataset.independentSide;
      const row = data[side].find(row => row.id === event.target.closest('tr').dataset.independentId);
      const previous = structuredClone(data);
      const members = side === 'purchases' && row.bundleId ? data[side].filter(item => item.bundleId === row.bundleId) : [row];
      members.forEach(item => item.month = event.target.value);
      if (!flushIndependent()) data = previous;
      for (const kind of sides) if (!data[kind].some(item => item.month === currentMonth)) data[kind].push(blank(kind));
      renderTables();
    } else {edit(event); flushIndependent();}
  });
  section.addEventListener('focusout', event => {if (event.target.matches('[data-independent-field]')) flushIndependent();});
  section.addEventListener('keydown', event => {
    const element = event.target;
    if (event.isComposing || !element.matches('[data-independent-field]') || !['Tab', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const table = element.closest('table'); let next;
    if (event.key === 'Tab') {const fields = [...table.querySelectorAll('[data-independent-field]')]; next = fields[fields.indexOf(element) + (event.shiftKey ? -1 : 1)];}
    else if (element.tagName !== 'SELECT') {const row = element.closest('tr'); const adjacent = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey) ? row.previousElementSibling : row.nextElementSibling; next = adjacent?.querySelector(`[data-independent-field="${element.dataset.independentField}"]`);}
    if (next) {event.preventDefault(); next.focus(); if (next.type === 'text') next.select();}
  });
  section.addEventListener('click', event => {
    const action = event.target.closest('[data-bundle-side],[data-unbundle-side]');
    if (action) {
      const side = action.dataset.bundleSide || action.dataset.unbundleSide;
      const previous = structuredClone(data);
      if (action.dataset.bundleSide) {
        if (!valid(data)) { message('금액 입력을 확인한 후 묶어주세요.', true); return; }
        data[side] = mergeRows(data[side], selected[side], side, crypto.randomUUID());
      } else {
        const ids = new Set(data[side].filter(row => selected[side].has(row.id)).map(row => row.bundleId).filter(Boolean));
        data[side].filter(row => ids.has(row.bundleId)).forEach(row => delete row.bundleId);
      }
      if (!flushIndependent()) data = previous;
      selected[side].clear(); renderTables(); return;
    }
    const button = event.target.closest('[data-independent-add],[data-independent-delete]');
    if (!button) return;
    const side = button.dataset.independentAdd || button.closest('table').dataset.independentSide;
    const previous = structuredClone(data);
    if (button.dataset.independentAdd) data[side].push(blank(side));
    else {const row = data[side].find(row => row.id === button.dataset.independentDelete); if (used(row) && !confirm('이 개별 기록을 삭제할까요?')) return; const remaining = data[side].filter(item => item.id !== row.id && row.bundleId && item.bundleId === row.bundleId); if (side === 'purchases' && remaining.length && row.shipping) remaining[0].shipping = String(amount(remaining[0].shipping) + amount(row.shipping)); data[side] = data[side].filter(row => row.id !== button.dataset.independentDelete); if (!data[side].some(row => row.month === currentMonth)) data[side].push(blank(side));}
    const saved = flushIndependent(); if (!saved) data = previous;
    renderTables();
    if (saved && button.dataset.independentAdd) document.querySelector(`[data-independent-side="${side}"] tbody tr:last-child input`)?.focus();
  });
  window.addEventListener('pagehide', flushIndependent);
}

export function setIndependentMonth(month) {
  currentMonth = month;
  sides.forEach(side => selected[side].clear());
  for (const side of sides) if (!data[side].some(row => row.month === month)) data[side].push(blank(side));
  renderTables();
}

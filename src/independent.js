import {rolloverSales, salesPeriod} from './sales-rollover.js';
import {createTabStorage, preserveEditor} from './tab-storage.js';
import {shippingTotal} from './incoming.js';
import {bundles, orderedBundles, mergeRows, distributePrice} from './independent-bundles.js';
import {DEFAULT_MONTH, validMonth, monthOf, monthOptions} from './months.js';
import {purchaseColor, saleColor} from './status-colors.js';
import {formatMoney, readMoneyInput, enableCellEditing} from './sheet-utils.js';
import {amount} from './groups.js';

const key = 'goods-ledger-independent-v1';
let currentMonth = DEFAULT_MONTH;
const selected = {purchases: new Set(), sales: new Set()};
const selectionAnchor = {purchases: null, sales: null};
const states = {purchases: ['주문완료', '배송중', '수령완료'], sales: ['판매전', '판매중', '배송중', '예약중', '판매완료']};
const sides = ['purchases', 'sales'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('ko-KR').format(value);
const blank = side => ({id: crypto.randomUUID(), month: currentMonth, name: '', price: '', shipping: '', status: states[side][0]});
const used = row => row.name.trim() || row.price !== '' || row.shipping !== '';
const validMoney = value => typeof value === 'string' && (value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 999999999999));
export const rowTotal = (side, row) => side === 'purchases' ? amount(row.price) + amount(row.shipping) : amount(row.price) - amount(row.shipping);
export function salesTotals(rows) {
  return bundles(rows).reduce((sum, members) => {
    const shipping = members.reduce((value, row) => value + amount(row.shipping), 0);
    const completed = members.filter(row => row.status === '판매완료');
    sum.expected += members.reduce((value, row) => value + amount(row.price), 0) - shipping;
    if (completed.length) sum.completed += completed.reduce((value, row) => value + amount(row.price), 0) - shipping;
    return sum;
  }, {completed: 0, expected: 0});
}
export function independentTotals(data) {
  return {purchases: data.purchases.reduce((sum, row) => sum + rowTotal('purchases', row), 0), ...salesTotals(data.sales)};
}
function valid(data) {
  return data && sides.every(side => Array.isArray(data[side]) && data[side].every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && (row.bundleId === undefined || typeof row.bundleId === 'string') && (row.month === undefined || validMonth(row.month)) && validMoney(row.price) && validMoney(row.shipping) && states[side].includes(row.status)));
}
let data = {purchases: [], sales: []}, blocked = false, timer, mounted = false, tabStorage;
function message(text, error = false) {
  const node = document.querySelector('#independent-notice');
  if (node) {node.textContent = error ? text : ''; node.classList.toggle('error', error);}
}
export function flushIndependent() {
  clearTimeout(timer);
  if (!mounted) return false;
  if (blocked) {message('개별 기록을 읽지 못해 자동 저장을 중지했습니다.', true); return false;}
  if (!valid(data)) {message('저장 대기 · 금액은 0 이상의 정수로 입력해주세요.', true); return false;}
  try {
    if (tabStorage) tabStorage.save(data).then(() => message('✓ 개별 기록 자동 저장 완료')).catch(() => message('저장 실패 · 입력값은 화면에 유지됩니다. 저장 공간을 확인해주세요.', true));
    else { localStorage.setItem(key, JSON.stringify(data)); message('✓ 개별 기록 자동 저장 완료'); }
    return true;
  }
  catch {message('저장 실패 · 입력값은 화면에 유지됩니다. 저장 공간을 확인해주세요.', true); return false;}
}
function input(side, row, index, field, label, type = 'text') {
  return `<input data-independent-field="${field}" aria-label="개별 ${side === 'purchases' ? '구매' : '판매'} ${index + 1}행 ${label}" type="text" value="${esc(type === 'number' ? formatMoney(row[field]) : row[field])}" ${type === 'number' ? 'data-money inputmode="text" lang="ko" maxlength="20"' : 'maxlength="160"'} placeholder="${field === 'name' ? '상품명 입력' : ''}" autocomplete="off">`;
}
function rowHTML(side, row, index, members, position) {
  const buy = side === 'purchases', first = position === 0, span = members.length;
  const commonStatus = members.every(item => item.status === row.status) ? row.status : '';
  const sharedPrice = members.reduce((sum, item) => sum + amount(item.price), 0);
  const status = `<td class="state ${buy ? '' : 'shared-sale-cell'}" rowspan="${span}"><select data-independent-field="status" aria-label="개별 ${buy ? '구매' : '판매'} ${index + 1}행 상황">${!buy && !commonStatus ? '<option value="" selected disabled>혼합</option>' : ''}${states[side].map(state => `<option ${state === (buy ? row.status : commonStatus) ? 'selected' : ''}>${state}</option>`).join('')}</select></td>`;
  const month = `<td class="month-cell ${buy ? '' : 'shared-sale-cell'}" rowspan="${span}"><select data-independent-field="month" aria-label="개별 ${buy ? '구매' : '판매'} ${index+1}행 월">${monthOptions(row.month)}</select></td>`;
  const settlement = salesTotals(members);
  const sharedShipping = members.reduce((sum, item) => sum + amount(item.shipping), 0);
  const total = first ? (buy ? `<td class="total" rowspan="${span}" data-independent-total>${members.some(used) ? fmt(members.reduce((sum, item) => sum + rowTotal(side, item), 0)) : '—'}</td>` : `<td class="total sales-total" rowspan="${span}" data-independent-current>${members.some(used) ? fmt(settlement.completed) : '—'}</td><td class="total sales-total" rowspan="${span}" data-independent-total>${members.some(used) ? fmt(settlement.expected) : '—'}</td>`) : '';
  const checked = members.every(item => selected[side].has(item.id));
  const selection = first ? `<td class="selection-cell" rowspan="${span}"><button type="button" role="checkbox" aria-checked="${checked}" data-select-row="${esc(row.id)}" data-select-ids="${esc(JSON.stringify(members.map(item => item.id)))}" aria-label="개별 ${buy ? '구매' : '판매'} ${index+1}행 선택">${checked ? '✓' : ''}</button></td>` : '';

  return `<tr data-independent-id="${esc(row.id)}" class="${row.bundleId ? 'independent-bundled' : ''} ${first && row.bundleId ? 'bundle-start' : ''}" style="--row-fill:${buy ? purchaseColor(row.status) : saleColor(row.status)};--shared-sale-fill:${saleColor(commonStatus)}">${selection}<td class="product"><div class="product-cell">${input(side, row, index, 'name', '상품명')}<button class="delete-line" data-independent-delete="${esc(row.id)}" aria-label="개별 ${buy ? '구매' : '판매'} ${index + 1}행 삭제" title="행 삭제">×</button></div></td>${buy || first ? `<td class="price ${buy ? '' : 'shared-sale-cell'}" ${buy ? '' : `rowspan="${span}"`}>${input(side, buy ? row : {...row, price: members.some(item => item.price !== '') ? String(sharedPrice) : ''}, index, 'price', '가격', 'number')}</td>` : ''}${first ? `<td class="price shipping-cell" rowspan="${span}">${input(side, {...row, shipping: sharedShipping ? String(sharedShipping) : ''}, index, 'shipping', '배송비', 'number')}</td>` : ''}${total}${first ? status + month : ''}</tr>`;
}
function tableHTML(side) {
  const buy = side === 'purchases';
  return `<section class="independent-panel" aria-label="개별 ${buy ? '구매' : '판매'} 장부"><div class="individual-title-row"><h2 class="individual-title">개별 ${buy ? '구매' : '판매'} 테이블</h2><button data-independent-add="${side}" aria-label="개별 ${buy ? '구매' : '판매'} 행 추가">＋</button><div class="bundle-actions"><button class="bundle-action" data-bundle-side="${side}" disabled>선택 묶기</button><button class="bundle-action" data-unbundle-side="${side}" disabled>묶음 해제</button></div></div><table class="independent-sheet" data-independent-side="${side}" style="--completed-sale-fill:${saleColor('판매완료')}"><colgroup><col class="selection-column"><col class="product-column"><col class="money-column"><col class="money-column"><col class="money-column">${buy ? '' : '<col class="money-column">'}<col class="detail-column"><col class="detail-column"></colgroup><thead><tr class="bands"><th colspan="${buy ? 7 : 8}" class="${buy ? 'purchase' : 'sale'}"><div><span>개별 ${buy ? '구매' : '판매'} 내역</span></div></th></tr><tr>${['', '상품명', '가격', ...(buy ? ['배송비', '총 구매 비용'] : ['배송비', '현재총합', '예상총합']), buy ? '구매상황' : '판매상황', '월'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${orderedBundles(data[side].filter(row => row.month === currentMonth), side).map(members => members.map((row, position) => rowHTML(side, row, data[side].indexOf(row), members, position)).join('')).join('')}</tbody></table><div class="independent-total" data-independent-summary="${side}"></div></section>`;
}
function updateSelection() {
  for (const side of sides) {
    const rows = data[side].filter(row => row.month === currentMonth && selected[side].has(row.id));
    document.querySelector(`[data-bundle-side="${side}"]`).disabled = rows.length < 2;
    document.querySelector(`[data-unbundle-side="${side}"]`).disabled = !rows.some(row => row.bundleId);
  }
}
function refreshRows(side) {
  for (const members of orderedBundles(data[side].filter(row => row.month === currentMonth), side)) {
    const {expected, completed} = salesTotals(members);
    const equal = members.some(used) && completed === expected;
    const allCompleted = side === 'sales' && members.every(item => item.status === '판매완료');
    for (const row of members) {
      const tr = document.querySelector(`[data-independent-id="${CSS.escape(row.id)}"]`);
      tr?.style.setProperty('--row-fill', side === 'purchases' ? purchaseColor(row.status) : saleColor(row.status));
      tr?.classList.toggle('completed-sale', side === 'sales' && row.status === '판매완료');
      tr?.style.setProperty('--shared-sale-fill', saleColor(members.every(item => item.status === members[0].status) ? members[0].status : ''));
      tr?.querySelectorAll('.shared-sale-cell,.shipping-cell').forEach(cell => cell.classList.toggle('completed-sales-shared', allCompleted));
      tr?.querySelector('.selection-cell')?.classList.toggle('completed-sales-shared', allCompleted);
      tr?.querySelectorAll('.sales-total').forEach(cell => {
        cell.classList.toggle('equal-sales-total', equal);
        cell.classList.toggle('completed-sales-shared', allCompleted);
      });
      const total = tr?.querySelector('[data-independent-total]');
      if (total) total.textContent = members.some(used) ? fmt(side === 'purchases' ? members.reduce((sum, item) => sum + rowTotal(side, item), 0) : expected) : '—';
      const current = tr?.querySelector('[data-independent-current]');
      if (current) current.textContent = members.some(used) ? fmt(completed) : '—';
    }
  }
}
export function independentDashboardTotals(month) {
  return independentTotals(Object.fromEntries(sides.map(side => [side, data[side].filter(row => month === undefined || row.month === month)])));
}
export function independentIncoming(month) {
  return shippingTotal(data.sales.filter(row => row.month === month));
}
function refreshTotals() {
  const totals = independentTotals(Object.fromEntries(sides.map(side => [side, data[side].filter(row => row.month === currentMonth)])));
  document.querySelector('[data-independent-summary=purchases]').textContent = `총 구매 비용 ${fmt(totals.purchases)}원`;
  document.querySelector('[data-independent-summary=sales]').textContent = `현재총합 ${fmt(totals.completed)}원 · 예상총합 ${fmt(totals.expected)}원`;
  document.dispatchEvent(new Event('independent-totals-change'));
}
export function sizeIndependentColumns() {
  const detailRatio = .75;
  document.querySelectorAll('.independent-sheet').forEach(table => {
    // Preserve fractional grid widths and reserve border/subpixel rounding space.
    const tableWidth = Math.max(0, table.parentElement.getBoundingClientRect().width - 1.25);
    const productWidth = 266 * Math.min(1, tableWidth / 619);
    const moneyCount = table.dataset.independentSide === 'purchases' ? 3 : 4;
    const selectionWidth = 26 * Math.min(1, tableWidth / 619);
    const remaining = tableWidth - productWidth - selectionWidth;
    const detailWidth = Math.max(remaining / (moneyCount + detailRatio * 2) * detailRatio, 66 * Math.min(1, tableWidth / 619));
    const moneyWidth = (remaining - detailWidth * 2) / moneyCount;
    [...table.querySelectorAll('col')].forEach((col, index) => {
      col.style.width = (index === 0 ? selectionWidth : index === 1 ? productWidth : index <= moneyCount + 1 ? moneyWidth : detailWidth) + 'px';
    });
  });
}
function renderTables() {
  document.querySelector('.independent-grid').innerHTML = sides.map(tableHTML).join('');
  sizeIndependentColumns();
  refreshRows('sales');
  refreshTotals();
  updateSelection();
}
export function independentCSVRows() {
  return sides.flatMap(side => {
    const rows = data[side].filter(used), charges = new Map();
    if (side === 'sales') for (const members of bundles(rows)) {
      const owner = members.find(row => row.status === '판매완료') || members[0];
      const shipping = members.reduce((sum, row) => sum + amount(row.shipping), 0);
      members.forEach(row => charges.set(row.id, row.id === owner.id ? shipping : 0));
    }
    return rows.map(row => {
      const saleShipping = String(charges.get(row.id) || 0);
      const settlement = amount(row.price) - Number(saleShipping);
      return ['', side === 'purchases' ? '개별 구매' : '개별 판매', row.name, row.price, row.status, side === 'purchases' ? row.shipping : '', '', side === 'sales' ? saleShipping : '', side === 'purchases' ? rowTotal(side, row) : '', side === 'sales' && row.status === '판매완료' ? settlement : '', side === 'sales' ? settlement : '', '', '', '', row.month, '', ''];
    });
  });
}
export function mountIndependent(initialMonth = DEFAULT_MONTH) {
  currentMonth = initialMonth;
  let initialSavedData = {purchases: [], sales: []};
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {const parsed = JSON.parse(raw); if (!valid(parsed)) throw Error(); data = parsed; initialSavedData = structuredClone(parsed);}
  } catch {blocked = true;}
  for (const side of sides) {for (const row of data[side]) row.month = monthOf(row); if (!data[side].some(row => row.month === currentMonth)) data[side].push(blank(side));}
  mounted = true;
  const section = document.querySelector('#independent');
  section.innerHTML = `<div class="independent-heading"><span id="independent-notice" role="status" aria-live="polite"></span></div><div class="independent-scroll"><div class="independent-grid"></div></div>`;
  renderTables();
  const updateToolbarTop = () => {
    const header = document.querySelector('header').getBoundingClientRect().height;
    const controls = document.querySelector('.dashboard-fixed').getBoundingClientRect().height;
    section.style.setProperty('--independent-toolbar-top', (header + controls) + 'px');
  };
  const toolbarObserver = new ResizeObserver(updateToolbarTop);
  toolbarObserver.observe(document.querySelector('header'));
  toolbarObserver.observe(document.querySelector('.dashboard-fixed'));
  updateToolbarTop();
  enableCellEditing(section);
  if (blocked) message('개별 기록을 읽지 못해 자동 저장을 중지했습니다.', true);
  const priceBasis = new WeakMap();
  section.addEventListener('focusin', event => {
    const element = event.target;
    if (!element.matches('[data-independent-field="price"]') || element.closest('table').dataset.independentSide !== 'sales') return;
    const row = data.sales.find(item => item.id === element.closest('tr').dataset.independentId);
    if (row?.bundleId) priceBasis.set(element, structuredClone(data.sales.filter(item => item.bundleId === row.bundleId && item.month === row.month)));
  });
  function edit(event) {
    const element = event.target;
    if (!element.matches('[data-independent-field]') || element.dataset.independentField === 'month') return;
    const side = element.closest('table').dataset.independentSide;
    const row = data[side].find(row => row.id === element.closest('tr').dataset.independentId);
    const field = element.dataset.independentField;
    const value = element.hasAttribute('data-money') ? readMoneyInput(element, event.isComposing) : element.value;
    if (side === 'sales' && row.bundleId && field === 'price' && validMoney(value)) {
      const members = data[side].filter(item => item.bundleId === row.bundleId && item.month === row.month);
      const updated = new Map(distributePrice(priceBasis.get(element) || members, value).map(item => [item.id, item.price]));
      members.forEach(item => item.price = updated.get(item.id));
    } else row[field] = value;
    element.setAttribute('aria-invalid', String(element.hasAttribute('data-money') && !validMoney(row[element.dataset.independentField])));
    if (row.bundleId && element.dataset.independentField === 'shipping') {
      data[side].filter(item => item.bundleId === row.bundleId && item.month === row.month && item.id !== row.id).forEach(item => item.shipping = '');
    }
    if (row.bundleId && element.dataset.independentField === 'status') {
      data[side].filter(item => item.bundleId === row.bundleId && item.month === row.month).forEach(item => item.status = row.status);
    }
    refreshRows(side);
    refreshTotals(); message('개별 기록 저장 중…'); clearTimeout(timer); timer = setTimeout(flushIndependent, 350);
  }
  section.addEventListener('input', edit);
  section.addEventListener('compositionend', edit);
  section.addEventListener('change', event => {
    if (event.target.tagName !== 'SELECT') return;
    if (event.target.dataset.independentField === 'month') {
      const side = event.target.closest('table').dataset.independentSide;
      const row = data[side].find(row => row.id === event.target.closest('tr').dataset.independentId);
      const previous = structuredClone(data);
      const members = row.bundleId ? data[side].filter(item => item.bundleId === row.bundleId && item.month === row.month) : [row];
      members.forEach(item => item.month = event.target.value);
      if (!flushIndependent()) data = previous;
      for (const kind of sides) if (!data[kind].some(item => item.month === currentMonth)) data[kind].push(blank(kind));
      renderTables();
    } else {edit(event); flushIndependent(); preserveEditor(section, renderTables);}
  });
  let sortTimer;
  section.addEventListener('focusout', event => {
    if (event.target.matches('[data-independent-field]')) flushIndependent();
    if (event.target.matches('[data-independent-field="name"]')) {
      clearTimeout(sortTimer);
      sortTimer = setTimeout(() => preserveEditor(section, renderTables), 0);
    }
  });
  section.addEventListener('keydown', event => {
    const element = event.target;
    if (event.isComposing || !element.matches('[data-independent-field]') || !['Tab', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const table = element.closest('table'); let next;
    if (event.key === 'Tab') {const fields = [...table.querySelectorAll('[data-independent-field]')]; next = fields[fields.indexOf(element) + (event.shiftKey ? -1 : 1)];}
    else if (element.tagName !== 'SELECT') {const row = element.closest('tr'); const adjacent = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey) ? row.previousElementSibling : row.nextElementSibling; next = adjacent?.querySelector(`[data-independent-field="${element.dataset.independentField}"]`);}
    if (next) {event.preventDefault(); next.focus(); if (next.type === 'text') next.select();}
  });
  section.addEventListener('click', event => {
    const check = event.target.closest('[data-select-row]');
    if (check) {
      const side = check.closest('table').dataset.independentSide;
      const visible = orderedBundles(data[side].filter(row => row.month === currentMonth), side).flat();
      const id = check.dataset.selectRow, memberIds = JSON.parse(check.dataset.selectIds);
      const checked = !memberIds.every(value => selected[side].has(value));
      let range = memberIds;
      const anchor = visible.findIndex(row => row.id === selectionAnchor[side]), end = visible.findIndex(row => row.id === id);
      if (event.shiftKey && anchor >= 0) range = visible.slice(Math.min(anchor, end), Math.max(anchor, end) + 1).map(row => row.id);
      const touched = new Set(range);
      range = bundles(visible).filter(group => group.some(row => touched.has(row.id))).flat().map(row => row.id);
      range.forEach(value => { if (checked) selected[side].add(value); else selected[side].delete(value); });
      if (!event.shiftKey || anchor < 0) selectionAnchor[side] = id;
      check.closest('table').querySelectorAll('[data-select-row]').forEach(button => {
        const active = JSON.parse(button.dataset.selectIds).every(id => selected[side].has(id));
        button.setAttribute('aria-checked', String(active)); button.textContent = active ? '✓' : '';
      });
      updateSelection(); return;
    }
    const action = event.target.closest('[data-bundle-side],[data-unbundle-side]');
    if (action) {
      const side = action.dataset.bundleSide || action.dataset.unbundleSide;
      const previous = structuredClone(data);
      if (action.dataset.bundleSide) {
        if (!valid(data)) { message('금액 입력을 확인한 후 묶어주세요.', true); return; }
        try { data[side] = mergeRows(data[side], selected[side], side, crypto.randomUUID()); }
        catch (error) { message(error.message, true); return; }
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
    let inserted;
    if (button.dataset.independentAdd) {
      inserted = blank(side);
      const chosen = data[side].filter(row => row.month === currentMonth && selected[side].has(row.id));
      const target = chosen.at(-1);
      if (target) {
        const members = target.bundleId ? data[side].filter(row => row.bundleId === target.bundleId && row.month === currentMonth) : [target];
        if (target.bundleId) {
          inserted.bundleId = target.bundleId;
          inserted.status = target.status; inserted.month = target.month;
        }
        data[side].splice(data[side].indexOf(members.at(-1)) + 1, 0, inserted);
      } else data[side].push(inserted);
    }
    else {const row = data[side].find(row => row.id === button.dataset.independentDelete); if (used(row) && !confirm('이 개별 기록을 삭제할까요?')) return; const remaining = data[side].filter(item => item.id !== row.id && row.bundleId && item.bundleId === row.bundleId && item.month === row.month); if (remaining.length && row.shipping) remaining[0].shipping = String(amount(remaining[0].shipping) + amount(row.shipping)); data[side] = data[side].filter(row => row.id !== button.dataset.independentDelete); if (!data[side].some(row => row.month === currentMonth)) data[side].push(blank(side));}
    const saved = flushIndependent(); if (!saved) data = previous;
    if (saved && inserted) { selected[side].clear(); selectionAnchor[side] = null; }
    renderTables();
    if (saved && inserted) document.querySelector(`[data-independent-id="${inserted.id}"] [data-independent-field="name"]`)?.focus();
  });
  if (!blocked) {
    tabStorage = createTabStorage({key, empty: {purchases: [], sales: []}, initialBase: initialSavedData, valid, transform: rolloverSales,
      getValue: () => data,
      onValue: next => {
        data = next;
        sides.forEach(side => {
          const ids = new Set(data[side].map(row => row.id));
          for (const id of selected[side]) if (!ids.has(id)) selected[side].delete(id);
          if (!ids.has(selectionAnchor[side])) selectionAnchor[side] = null;
        });
        preserveEditor(section, renderTables);
      },
      onError: error => message(error.message, true), onFlush: flushIndependent});
    tabStorage.initialize().catch(error => message(error.message, true));
  }
  const checkRollover = () => {
    if (!blocked && tabStorage && data.salesRolloverPeriod !== salesPeriod()) flushIndependent();
  };
  window.addEventListener('focus', checkRollover);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkRollover(); });
  setInterval(checkRollover, 60_000);
  window.addEventListener('pagehide', flushIndependent);
}

export function setIndependentMonth(month) {
  currentMonth = month;
  sides.forEach(side => selected[side].clear());
  for (const side of sides) if (!data[side].some(row => row.month === month)) data[side].push(blank(side));
  renderTables();
}

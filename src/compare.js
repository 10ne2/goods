import 'pretendard/dist/web/variable/pretendardvariable.css';
import './style.css';
import {formatMoney, readMoneyInput, enableCellEditing} from './sheet-utils.js';
import {createTabStorage, preserveEditor} from './tab-storage.js';
import {validComparisonPrice, validComparisonRows, validComparisonGroups, comparisonGroupUsed, comparisonGroupReady, comparisonGroupTotals, comparisonRanking, migrateComparisonRows} from './price-comparison.js';

const key = 'goods-price-comparison-v2';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('ko-KR').format(value) + '원';
const blankRow = () => ({id: crypto.randomUUID(), name: '', price: '', operation: '+'});
const blankGroup = index => ({id: crypto.randomUUID(), name: '', shipping: '', rows: [blankRow()]});
let groups = [], initialBase = [], blocked = false, storage, timer;
try {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    const value = JSON.parse(raw);
    if (!validComparisonGroups(value)) throw Error();
    groups = value; initialBase = structuredClone(value);
  } else {
    const legacy = localStorage.getItem('goods-price-comparison-v1');
    if (legacy !== null) {
      const value = JSON.parse(legacy);
      if (!validComparisonRows(value)) throw Error();
      groups = migrateComparisonRows(value, () => crypto.randomUUID());
      if (!groups[0].rows.length) groups[0].rows.push(blankRow());
      groups.push(blankGroup(2));
    }
  }
} catch { blocked = true; }
if (!groups.length) groups = [blankGroup(1), blankGroup(2)];

document.querySelector('#app').innerHTML = `<header><a class="brand" href="./">모니굿즈</a><span class="comparison-page-label">계산페이지</span><a class="header-page-link comparison-back" href="./">장부로 돌아가기</a></header><main class="comparison-page comparison-bundles"><div class="comparison-heading"><h1>묶음별 구매 가격 비교</h1><button type="button" id="comparison-add-group">＋ 묶음 추가</button></div><p class="comparison-guide">묶음마다 상품과 배송비를 입력해 비교하세요. ＋는 더하기, −는 빼기이며 배송비는 묶음당 한 번 더합니다.</p><div id="comparison-notice" role="status" aria-live="polite"></div><table class="comparison-overview" aria-label="묶음별 가격 비교"><thead><tr><th scope="col">테이블 이름</th><th scope="col">상품 합계</th><th scope="col">배송비</th><th scope="col">총액</th><th scope="col">최저가와 차이</th></tr></thead><tbody></tbody></table><div id="comparison-groups" class="comparison-groups"></div></main>`;
const root = document.querySelector('#comparison-groups');
const message = text => { document.querySelector('#comparison-notice').textContent = text; };
function field(group, row, name, label) {
  const source = row || group;
  const numeric = name === 'price' || name === 'shipping';
  return `<input type="text" data-group="${esc(group.id)}" data-id="${esc(source.id)}" ${row ? `data-row="${esc(row.id)}"` : ''} data-field="${name}" value="${esc(numeric ? formatMoney(source[name]) : source[name])}" aria-label="${esc(label)}" maxlength="${numeric ? 20 : 160}" ${numeric ? `data-money inputmode="text" lang="ko" aria-invalid="${!validComparisonPrice(source[name])}"` : ''} ${row && name === 'name' ? 'placeholder="상품명 입력"' : !row && name === 'name' ? 'placeholder="예: A쇼핑몰, 세트 A"' : ''} autocomplete="off">`;
}
function groupHTML(group, index) {
  const prefix = `${index+1}번 묶음`;
  return `<section class="comparison-group" data-comparison-group="${esc(group.id)}" aria-label="${prefix}"><div class="comparison-group-heading"><label class="comparison-name-label"><span>테이블 이름</span>${field(group,null,'name',`${prefix} 테이블 이름`)}</label><span class="comparison-best" data-best hidden>최저가</span><button type="button" data-add-row="${esc(group.id)}" aria-label="${prefix} 행 추가">＋</button><button type="button" data-copy-group="${esc(group.id)}">복제</button><button type="button" data-delete-group="${esc(group.id)}" aria-label="${prefix} 삭제">×</button></div><table class="comparison-sheet" aria-label="${prefix} 계산표"><colgroup><col class="comparison-number"><col><col class="comparison-price"><col class="comparison-operation"><col class="comparison-delete"></colgroup><thead><tr><th scope="col">번호</th><th scope="col">상품명</th><th scope="col">가격</th><th scope="col">계산</th><th scope="col" aria-label="행 삭제"></th></tr></thead><tbody>${group.rows.map((row,i)=>`<tr data-compare-id="${esc(row.id)}"><th scope="row">${i+1}</th><td>${field(group,row,'name',`${prefix} ${i+1}행 상품명`)}</td><td>${field(group,row,'price',`${prefix} ${i+1}행 가격`)}</td><td class="comparison-operators"><button type="button" data-operation="+" data-row="${esc(row.id)}" data-group="${esc(group.id)}" aria-label="${prefix} ${i+1}행 더하기" aria-pressed="${row.operation==='+'}">＋</button><button type="button" data-operation="-" data-row="${esc(row.id)}" data-group="${esc(group.id)}" aria-label="${prefix} ${i+1}행 빼기" aria-pressed="${row.operation==='-'}">−</button></td><td><button type="button" class="comparison-delete-button" data-delete-row="${esc(row.id)}" data-group="${esc(group.id)}" aria-label="${prefix} ${i+1}행 삭제">×</button></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5"><button type="button" data-add-row="${esc(group.id)}" aria-label="${prefix} 아래 행 추가">＋</button></td></tr><tr><th colspan="2" scope="row">상품 합계</th><td colspan="3" class="comparison-group-amount" data-group-result="subtotal">0원</td></tr><tr><th colspan="2" scope="row">배송비</th><td>${field(group,null,'shipping',`${prefix} 배송비`)}</td><td colspan="2"></td></tr><tr class="comparison-group-final"><th colspan="2" scope="row">총액</th><td colspan="3" class="comparison-group-amount" data-group-result="total" aria-live="polite">0원</td></tr></tfoot></table></section>`;
}
function updateTotals() {
  const ranking = comparisonRanking(groups);
  document.querySelector('.comparison-overview tbody').innerHTML = groups.map((group,index)=>{
    const values = comparisonGroupTotals(group), eligible = comparisonGroupReady(group);
    const lowest = ranking.count > 1 && eligible && values.total === ranking.lowest;
    const card = root.querySelector(`[data-comparison-group="${CSS.escape(group.id)}"]`);
    if (card) {
      card.querySelector('[data-best]').hidden = !lowest;
      for (const name of ['subtotal','total']) card.querySelector(`[data-group-result="${name}"]`).textContent = money(values[name]);
    }
    return `<tr ${lowest ? 'class="comparison-lowest"' : ''}><th scope="row">${esc(group.name.trim() || '테이블 '+(index+1))}${lowest ? ' · 최저가' : ''}</th><td>${money(values.subtotal)}</td><td>${money(values.shipping)}</td><td>${money(values.total)}</td><td>${eligible && ranking.lowest !== null ? money(values.total-ranking.lowest) : '—'}</td></tr>`;
  }).join('');
}
function renderGroups() { root.innerHTML = groups.map(groupHTML).join(''); updateTotals(); }
function save() {
  clearTimeout(timer);
  if (blocked) { message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.'); return; }
  if (!validComparisonGroups(groups)) { message('가격과 배송비는 0 이상의 정수로 입력해주세요.'); return; }
  try { storage.save(groups).then(()=>message('')).catch(()=>message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.')); }
  catch { message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.'); }
}
function focusField(group, row, name) { root.querySelector(`[data-group="${CSS.escape(group.id)}"][data-id="${CSS.escape((row||group).id)}"][data-field="${name}"]`)?.focus(); }
function addRow(group) { const row=blankRow(); group.rows.push(row); renderGroups(); save(); focusField(group,row,'name'); }
renderGroups();
if (!blocked) {
  storage = createTabStorage({key, empty: [], initialBase, valid:validComparisonGroups, getValue:()=>groups,
    onValue:value=>{groups=value;preserveEditor(root,renderGroups);},onError:error=>message(error.message),onFlush:save});
  storage.initialize().catch(error=>message(error.message));
} else message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.');
enableCellEditing(root);
function edit(event) {
  const input=event.target;
  if (!input.matches('input[data-field]')) return;
  const group=groups.find(group=>group.id===input.dataset.group);
  const source=input.dataset.row ? group.rows.find(row=>row.id===input.dataset.row) : group;
  source[input.dataset.field]=input.hasAttribute('data-money') ? readMoneyInput(input,event.isComposing) : input.value;
  if(input.hasAttribute('data-money'))input.setAttribute('aria-invalid',String(!validComparisonPrice(source[input.dataset.field])));
  updateTotals();clearTimeout(timer);timer=setTimeout(save,350);
}
root.addEventListener('input',edit);
root.addEventListener('compositionend',edit);
root.addEventListener('focusout',event=>{if(event.target.matches('input[data-field]'))save();});
root.addEventListener('click',event=>{
  const button=event.target.closest('[data-add-row],[data-copy-group],[data-delete-group],[data-operation],[data-delete-row]');
  if(!button)return;
  const id=button.dataset.addRow||button.dataset.copyGroup||button.dataset.deleteGroup||button.dataset.group;
  const group=groups.find(group=>group.id===id);
  if(button.dataset.addRow){addRow(group);return;}
  if(button.dataset.copyGroup){const duplicate={...structuredClone(group),id:crypto.randomUUID(),name:(group.name||'테이블')+' 복사',rows:group.rows.map(row=>({...row,id:crypto.randomUUID()}))};groups.splice(groups.indexOf(group)+1,0,duplicate);renderGroups();save();focusField(duplicate,null,'name');return;}
  if(button.dataset.deleteGroup){if(comparisonGroupUsed(group)&&!confirm('이 비교 묶음을 삭제할까요?'))return;groups=groups.filter(item=>item.id!==id);if(!groups.length)groups.push(blankGroup(1));renderGroups();save();return;}
  if(button.dataset.operation){const row=group.rows.find(row=>row.id===button.dataset.row);row.operation=button.dataset.operation;button.closest('td').querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.operation===row.operation)));updateTotals();save();return;}
  group.rows=group.rows.filter(row=>row.id!==button.dataset.deleteRow);if(!group.rows.length)group.rows.push(blankRow());renderGroups();save();
});
root.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing||!event.target.matches('input[data-row]'))return;
  event.preventDefault();const group=groups.find(group=>group.id===event.target.dataset.group),index=group.rows.findIndex(row=>row.id===event.target.dataset.row),name=event.target.dataset.field;
  if(index===group.rows.length-1){group.rows.push(blankRow());renderGroups();save();}
  focusField(group,group.rows[index+1],name);
});
document.querySelector('#comparison-add-group').onclick=()=>{const group=blankGroup(groups.length+1);groups.push(group);renderGroups();save();focusField(group,null,'name');};
window.addEventListener('pagehide',save);

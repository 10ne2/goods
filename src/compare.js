import 'pretendard/dist/web/variable/pretendardvariable.css';
import './style.css';
import {formatMoney, readMoneyInput, enableCellEditing} from './sheet-utils.js';
import {createTabStorage, preserveEditor} from './tab-storage.js';
import {validComparisonPrice, validComparisonItemPrice, validComparisonQuantity, normalizeComparisonGroups, validComparisonRows, validComparisonGroups, comparisonGroupUsed, comparisonGroupReady, comparisonGroupTotals, comparisonRanking, migrateComparisonRows} from './price-comparison.js';

const key = 'goods-price-comparison-v4';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('ko-KR').format(value) + '원';
const blankRow = () => ({id: crypto.randomUUID(), name: '', price: '', quantity: '1'});
const blankSubgroup = () => ({id: crypto.randomUUID(), name: '', shipping: '', rows: [blankRow()]});
const blankGroup = () => ({id: crypto.randomUUID(), name: '', subgroups: [blankSubgroup()]});
let groups = [], initialBase = [], blocked = false, storage, timer;
try {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    const value = JSON.parse(raw);
    if (!validComparisonGroups(value)) throw Error();
    groups = normalizeComparisonGroups(value); initialBase = structuredClone(value);
  } else {
    const previous = localStorage.getItem('goods-price-comparison-v3') ?? localStorage.getItem('goods-price-comparison-v2');
    if (previous !== null) {
      const value = JSON.parse(previous);
      if (!validComparisonGroups(value)) throw Error();
      groups = normalizeComparisonGroups(value);
    } else {
      const legacy = localStorage.getItem('goods-price-comparison-v1');
      if (legacy !== null) {
        const value = JSON.parse(legacy);
        if (!validComparisonRows(value)) throw Error();
        groups = normalizeComparisonGroups(migrateComparisonRows(value, () => crypto.randomUUID()));
        if (!groups[0].subgroups[0].rows.length) groups[0].subgroups[0].rows.push(blankRow());
        groups.push(blankGroup());
      }
    }
  }
} catch { blocked = true; }
if (!groups.length) groups = [blankGroup(), blankGroup()];

document.querySelector('#app').innerHTML = `<header><a class="brand" href="./">모니굿즈</a><span class="comparison-page-label">계산페이지</span><a class="header-page-link comparison-back" href="./">장부로 돌아가기</a></header><main class="comparison-page comparison-bundles"><div class="comparison-heading"><h1>묶음별 구매 가격 비교</h1><button type="button" id="comparison-add-group">＋ 묶음 추가</button></div><p class="comparison-guide">비교 묶음 안에 내부 묶음을 추가하세요. 내부 묶음별 상품 가격 × 수량과 배송비를 합산해 전체 총액을 비교합니다.</p><div id="comparison-notice" role="status" aria-live="polite"></div><table class="comparison-overview" aria-label="묶음별 가격 비교"><thead><tr><th scope="col">테이블 이름</th><th scope="col">배송비 합계</th><th scope="col">총액</th><th scope="col">최저가와 차이</th></tr></thead><tbody></tbody></table><div id="comparison-groups" class="comparison-groups"></div></main>`;
const root = document.querySelector('#comparison-groups');
const message = text => { document.querySelector('#comparison-notice').textContent = text; };
function field(group, subgroup, row, name, label) {
  const source = row || subgroup || group;
  const numeric = ['price','shipping','quantity'].includes(name);
  const validate = name === 'price' ? validComparisonItemPrice : name === 'quantity' ? validComparisonQuantity : validComparisonPrice;
  const value = numeric ? (name === 'price' && validComparisonItemPrice(source[name]) && source[name] !== '' ? new Intl.NumberFormat('ko-KR').format(Number(source[name])) : formatMoney(source[name])) : source[name];
  const html = `<input type="text" data-group="${esc(group.id)}" data-id="${esc(source.id)}" ${subgroup ? `data-subgroup="${esc(subgroup.id)}"` : ''} ${row ? `data-row="${esc(row.id)}"` : ''} data-field="${name}" value="${esc(value)}" aria-label="${esc(label)}" maxlength="${numeric ? 20 : 160}" ${numeric ? `data-money inputmode="text" lang="ko" aria-invalid="${!validate(source[name])}"` : ''} ${name === 'name' ? `placeholder="${row ? '상품명 입력' : subgroup ? '예: 판매처, 배송 묶음' : '예: A쇼핑몰, 세트 A'}"` : ''} autocomplete="off">`;
  if (name !== 'quantity') return html;
  return `<div class="comparison-quantity-control"><button type="button" data-quantity-step="-1" aria-label="${esc(label)} 줄이기" title="수량 줄이기">−</button>${html}<button type="button" data-quantity-step="1" aria-label="${esc(label)} 늘리기" title="수량 늘리기">＋</button></div>`;
}
function subgroupHTML(group, subgroup, parentIndex, index) {
  const prefix = `${parentIndex+1}번 묶음 ${index+1}번 내부 묶음`;
  return `<section class="comparison-subgroup" data-comparison-subgroup="${esc(subgroup.id)}" aria-label="${prefix}"><div class="comparison-subgroup-heading"><label class="comparison-name-label"><span>내부 묶음 이름</span>${field(group,subgroup,null,'name',`${prefix} 이름`)}</label><button type="button" data-add-row="${esc(subgroup.id)}" data-group="${esc(group.id)}" aria-label="${prefix} 행 추가">＋</button><button type="button" data-copy-subgroup="${esc(subgroup.id)}" data-group="${esc(group.id)}" aria-label="${prefix} 복제">묶음 복제</button><button type="button" data-delete-subgroup="${esc(subgroup.id)}" data-group="${esc(group.id)}" aria-label="${prefix} 삭제">×</button></div><table class="comparison-sheet" aria-label="${prefix} 계산표"><colgroup><col class="comparison-number"><col><col class="comparison-price"><col class="comparison-quantity"><col class="comparison-delete"></colgroup><thead><tr><th scope="col">번호</th><th scope="col">상품명</th><th scope="col">가격</th><th scope="col">수량</th><th scope="col" aria-label="행 삭제"></th></tr></thead><tbody>${subgroup.rows.map((row,i)=>`<tr data-compare-id="${esc(row.id)}"><th scope="row">${i+1}</th><td>${field(group,subgroup,row,'name',`${prefix} ${i+1}행 상품명`)}</td><td>${field(group,subgroup,row,'price',`${prefix} ${i+1}행 가격`)}</td><td>${field(group,subgroup,row,'quantity',`${prefix} ${i+1}행 수량`)}</td><td><button type="button" class="comparison-delete-button" data-delete-row="${esc(row.id)}" data-group="${esc(group.id)}" data-subgroup="${esc(subgroup.id)}" aria-label="${prefix} ${i+1}행 삭제">×</button></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5"><button type="button" data-add-row="${esc(subgroup.id)}" data-group="${esc(group.id)}" aria-label="${prefix} 아래 행 추가">＋</button></td></tr><tr><th colspan="2" scope="row">배송비</th><td>${field(group,subgroup,null,'shipping',`${prefix} 배송비`)}</td><td colspan="2"></td></tr><tr class="comparison-group-final"><th colspan="2" scope="row">내부 묶음 총액</th><td colspan="3" class="comparison-group-amount" data-child-result="total">0원</td></tr></tfoot></table></section>`;
}
function groupHTML(group, index) {
  const prefix = `${index+1}번 묶음`;
  return `<section class="comparison-group comparison-parent" data-comparison-group="${esc(group.id)}" aria-label="${prefix}"><div class="comparison-group-heading"><label class="comparison-name-label"><span>테이블 이름</span>${field(group,null,null,'name',`${prefix} 테이블 이름`)}</label><span class="comparison-best" data-best hidden>최저가</span><button type="button" data-add-subgroup="${esc(group.id)}">＋ 내부 묶음</button><button type="button" data-copy-group="${esc(group.id)}" aria-label="${prefix} 테이블 복제">테이블 복제</button><button type="button" data-delete-group="${esc(group.id)}" aria-label="${prefix} 삭제">×</button></div><div class="comparison-subgroups">${group.subgroups.map((child,i)=>subgroupHTML(group,child,index,i)).join('')}</div><div class="comparison-parent-total"><div><span>배송비 합계</span><strong data-parent-result="shipping">0원</strong></div><div><span>최종 총액</span><strong data-parent-result="total" aria-live="polite">0원</strong></div></div></section>`;
}
function updateTotals() {
  const ranking = comparisonRanking(groups);
  document.querySelector('.comparison-overview tbody').innerHTML = groups.map((group,index)=>{
    const values = comparisonGroupTotals(group), eligible = comparisonGroupReady(group);
    const lowest = ranking.count > 1 && eligible && values.total === ranking.lowest;
    const card = root.querySelector(`[data-comparison-group="${CSS.escape(group.id)}"]`);
    if (card) {
      card.querySelector('[data-best]').hidden = !lowest;
      for (const name of ['shipping','total']) card.querySelector(`[data-parent-result="${name}"]`).textContent = money(values[name]);
      for (const child of group.subgroups) {
        const section = card.querySelector(`[data-comparison-subgroup="${CSS.escape(child.id)}"]`), childTotals = comparisonGroupTotals(child);
        for (const name of ['total']) section.querySelector(`[data-child-result="${name}"]`).textContent = money(childTotals[name]);
      }
    }
    return `<tr ${lowest ? 'class="comparison-lowest"' : ''}><th scope="row">${esc(group.name.trim() || '테이블 '+(index+1))}${lowest ? ' · 최저가' : ''}</th><td>${money(values.shipping)}</td><td>${money(values.total)}</td><td>${eligible && ranking.lowest !== null ? money(values.total-ranking.lowest) : '—'}</td></tr>`;
  }).join('');
}
function renderGroups() { root.innerHTML = groups.map(groupHTML).join(''); updateTotals(); }
function save() {
  clearTimeout(timer);
  if (blocked) { message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.'); return; }
  if (!validComparisonGroups(groups)) { message('가격·배송비·수량을 확인해주세요. 수량은 0 이상의 정수로 입력할 수 있습니다.'); return; }
  try { storage.save(groups).then(()=>message('')).catch(()=>message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.')); }
  catch { message('저장하지 못했습니다. 입력값은 화면에 유지됩니다.'); }
}
function focusField(group, subgroup, row, name) { root.querySelector(`[data-group="${CSS.escape(group.id)}"][data-id="${CSS.escape((row||subgroup||group).id)}"][data-field="${name}"]`)?.focus(); }
function addRow(group, subgroup) { const row=blankRow(); subgroup.rows.push(row); renderGroups(); save(); focusField(group,subgroup,row,'name'); }
function copySubgroup(subgroup, rename) { return {...structuredClone(subgroup),id:crypto.randomUUID(),name:rename?(subgroup.name||'내부 묶음')+' 복사':subgroup.name,rows:subgroup.rows.map(row=>({...row,id:crypto.randomUUID()}))}; }
renderGroups();
if (!blocked) {
  storage = createTabStorage({key, empty: [], initialBase, valid:validComparisonGroups, transform:normalizeComparisonGroups, getValue:()=>groups,
    onValue:value=>{groups=value;preserveEditor(root,renderGroups);},onError:error=>message(error.message),onFlush:save});
  storage.initialize().catch(error=>message(error.message));
} else message('기존 계산 기록을 읽지 못해 저장을 중지했습니다.');
enableCellEditing(root);
function edit(event) {
  const input=event.target;
  if (!input.matches('input[data-field]')) return;
  const group=groups.find(group=>group.id===input.dataset.group);
  const subgroup=input.dataset.subgroup?group.subgroups.find(child=>child.id===input.dataset.subgroup):null;
  const source=input.dataset.row ? subgroup.rows.find(row=>row.id===input.dataset.row) : subgroup||group;
  if (input.dataset.field === 'price') {
    const raw=input.value.replaceAll(',',''),position=input.selectionStart??input.value.length,count=input.value.slice(0,position).replaceAll(',','').length;
    if(!event.isComposing&&validComparisonItemPrice(raw)) {
      input.value=raw===''?'':new Intl.NumberFormat('ko-KR').format(Number(raw));let cursor=0,chars=0;
      while(cursor<input.value.length&&chars<count){if(input.value[cursor]!==',')chars++;cursor++;}input.setSelectionRange(cursor,cursor);
    }
    source.price=raw;
  } else source[input.dataset.field]=input.hasAttribute('data-money')?readMoneyInput(input,event.isComposing):input.value;
  if(input.hasAttribute('data-money')){const validate=input.dataset.field==='price'?validComparisonItemPrice:input.dataset.field==='quantity'?validComparisonQuantity:validComparisonPrice;input.setAttribute('aria-invalid',String(!validate(source[input.dataset.field])));}
  updateTotals();clearTimeout(timer);timer=setTimeout(save,350);
}
root.addEventListener('input',edit);
root.addEventListener('compositionend',edit);
root.addEventListener('focusout',event=>{if(event.target.matches('input[data-field]'))save();});
function stepQuantity(input, step) {
  const raw = input.value.replaceAll(',', '');
  const current = validComparisonQuantity(raw) ? Number(raw || 0) : 0;
  input.value = String(Math.max(0, Math.min(999999, current + step)));
  input.dispatchEvent(new Event('input', {bubbles: true}));
  save();
  input.focus({preventScroll: true});
}
root.addEventListener('click',event=>{
  const arrow = event.target.closest('[data-quantity-step]');
  if (arrow) {
    stepQuantity(arrow.closest('.comparison-quantity-control').querySelector('input'), Number(arrow.dataset.quantityStep));
    return;
  }
  const button=event.target.closest('[data-add-subgroup],[data-add-row],[data-copy-group],[data-delete-group],[data-copy-subgroup],[data-delete-subgroup],[data-delete-row]');
  if(!button)return;
  const id=button.dataset.group||button.dataset.addSubgroup||button.dataset.copyGroup||button.dataset.deleteGroup;
  const group=groups.find(group=>group.id===id);
  if(button.dataset.addSubgroup){const child=blankSubgroup();group.subgroups.push(child);renderGroups();save();focusField(group,child,null,'name');return;}
  if(button.dataset.copyGroup){const duplicate={id:crypto.randomUUID(),name:(group.name||'테이블')+' 복사',subgroups:group.subgroups.map(child=>copySubgroup(child,false))};groups.splice(groups.indexOf(group)+1,0,duplicate);renderGroups();save();focusField(duplicate,null,null,'name');return;}
  if(button.dataset.deleteGroup){if(comparisonGroupUsed(group)&&!confirm('이 비교 묶음을 삭제할까요?'))return;groups=groups.filter(item=>item.id!==id);if(!groups.length)groups.push(blankGroup());renderGroups();save();return;}
  const childId=button.dataset.addRow||button.dataset.copySubgroup||button.dataset.deleteSubgroup||button.dataset.subgroup;
  const child=group.subgroups.find(item=>item.id===childId);
  if(button.dataset.addRow){addRow(group,child);return;}
  if(button.dataset.copySubgroup){const duplicate=copySubgroup(child,true);group.subgroups.splice(group.subgroups.indexOf(child)+1,0,duplicate);renderGroups();save();focusField(group,duplicate,null,'name');return;}
  if(button.dataset.deleteSubgroup){if(comparisonGroupUsed(child)&&!confirm('이 내부 묶음을 삭제할까요?'))return;group.subgroups=group.subgroups.filter(item=>item.id!==childId);if(!group.subgroups.length)group.subgroups.push(blankSubgroup());renderGroups();save();return;}
  child.rows=child.rows.filter(row=>row.id!==button.dataset.deleteRow);if(!child.rows.length)child.rows.push(blankRow());renderGroups();save();
});
root.addEventListener('keydown',event=>{
  if (!event.isComposing && event.target.matches('input[data-field="quantity"]') && ['ArrowUp','ArrowDown'].includes(event.key)) {
    event.preventDefault();
    stepQuantity(event.target, event.key === 'ArrowUp' ? 1 : -1);
    return;
  }
  if(event.key!=='Enter'||event.isComposing||!event.target.matches('input[data-row]'))return;
  event.preventDefault();const group=groups.find(group=>group.id===event.target.dataset.group),child=group.subgroups.find(item=>item.id===event.target.dataset.subgroup),index=child.rows.findIndex(row=>row.id===event.target.dataset.row),name=event.target.dataset.field;
  if(index===child.rows.length-1){child.rows.push(blankRow());renderGroups();save();}
  focusField(group,child,child.rows[index+1],name);
});
document.querySelector('#comparison-add-group').onclick=()=>{const group=blankGroup();groups.push(group);renderGroups();save();focusField(group,null,null,'name');};
window.addEventListener('pagehide',save);

import {DEFAULT_MONTH, validMonth, monthOf, monthOptions} from './months.js';
import {purchaseColor, saleColor} from './status-colors.js';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import {formatMoney, readMoneyInput, enableWheelScroll, enableCellEditing} from './sheet-utils.js';
import {mountIndependent, setIndependentMonth, flushIndependent, independentCSVRows} from './independent.js';
import './style.css';
import {totals, migrate} from './groups.js';
const key='goods-ledger-groups-v2';
const groupColumnWidths=[270,84,84,84,68,270,84,84,84,68,84,84,135,84,68,68,68];
let currentMonth=DEFAULT_MONTH;
try{const saved=localStorage.getItem('goods-ledger-month');if(validMonth(saved))currentMonth=saved;}catch{}
const fmt=n=>new Intl.NumberFormat('ko-KR').format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>crypto.randomUUID();
const purchaseStates=['주문완료','배송중','수령완료'];
const saleStates=['판매전','판매중','배송중','예약중','판매완료'];
const blankLine=side=>({id:uuid(),name:'',price:'',status:side==='purchases'?'주문완료':'판매전',...(side==='sales'?{shipping:''}:{})});
const blankActual=()=>({id:uuid(),name:'',price:''});
const blankGroup=()=>({id:uuid(),month:currentMonth,confirmed:false,name:'',purchaseStatus:'주문완료',shipping:'',extra:'',purchases:[],sales:[],actualPurchases:[blankActual()]});
const lineUsed=r=>!!(r.name.trim()||r.price!==''||r.shipping||r.fee||r.actualName?.trim()||(r.actualPrice!==undefined&&r.actualPrice!==''));
const groupUsed=g=>!!(g.name||g.shipping||g.extra||g.purchases.some(lineUsed)||g.sales.some(lineUsed)||g.actualPurchases?.some(lineUsed));
const moneyValid=v=>v===''||(/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))&&Number(v)<=999999999999);
function validGroup(g){return g&&typeof g.id==='string'&&typeof g.name==='string'&&(g.actualPurchases===undefined||(Array.isArray(g.actualPurchases)&&g.actualPurchases.every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&moneyValid(r.price))))&&(g.confirmed===undefined||typeof g.confirmed==='boolean')&&(g.month===undefined||validMonth(g.month))&&moneyValid(g.shipping)&&moneyValid(g.extra)&&(!g.purchaseStatus||purchaseStates.includes(g.purchaseStatus))&&['purchases','sales'].every(side=>Array.isArray(g[side])&&g[side].every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&(r.actualName===undefined||typeof r.actualName==='string')&&(r.actualPrice===undefined||moneyValid(r.actualPrice))&&moneyValid(r.price)&&(side==='purchases'?purchaseStates:saleStates).includes(r.status)&&(side!=='sales'||(moneyValid(r.shipping)))));}
let groups=[],blocked=false,timer,query='';
try{
 const stored=localStorage.getItem(key);
 if(stored!==null){const parsed=JSON.parse(stored);if(!Array.isArray(parsed)||!parsed.every(validGroup))throw Error();groups=parsed;}
 else{const legacy=JSON.parse(localStorage.getItem('goods-ledger-v1')||'[]');if(!Array.isArray(legacy)||!legacy.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.date==='string'&&['price','shipping','extra'].every(k=>Number.isSafeInteger(i[k])&&i[k]>=0)&&(!i.sale||(['price','shipping','fee'].every(k=>Number.isSafeInteger(i.sale[k])&&i.sale[k]>=0)&&typeof i.sale.date==='string'))))throw Error();groups=migrate(legacy);}
}catch{blocked=true;}
function normalize(){
 groups=groups.filter(g=>g.manualRows||groupUsed(g));
 for(const g of groups){
  g.month=monthOf(g);
  for(const side of ['purchases','sales']){
   if(!g.manualRows)g[side]=g[side].filter(lineUsed);
   if(!g[side].length)g[side].push(side==='actualPurchases'?blankActual():blankLine(side));
  }
  if(g.actualPurchases===undefined){g.actualPurchases=g.purchases.filter(r=>r.actualName?.trim()||(r.actualPrice!==undefined&&r.actualPrice!=='')).map(r=>({id:uuid(),name:r.actualName||'',price:r.actualPrice??''}));for(const row of g.purchases){delete row.actualName;delete row.actualPrice;}}
  if(!g.actualPurchases.length)g.actualPurchases.push(blankActual());
  g.purchaseStatus=g.purchaseStatus||g.purchases[0]?.status||'주문완료';
  g.manualRows=true;
 }
 if(!groups.length){const g=blankGroup();g.manualRows=true;g.purchases=[blankLine('purchases')];g.sales=[blankLine('sales')];groups.push(g);}
}
normalize();
function storedGroups(){return groups;}
function status(text,error=false){const node=document.querySelector('#notice');if(node){node.textContent=error?text:'';node.classList.toggle('error',error);}}
function flush(){clearTimeout(timer);if(blocked){status('기존 기록을 읽지 못해 자동 저장을 중지했습니다. 브라우저 데이터를 확인해주세요.',true);return false;}const data=storedGroups();if(!data.every(validGroup)){status('저장 대기 · 금액은 0 이상의 정수로 입력해주세요. 이전 저장 기록은 유지됩니다.',true);return false;}try{localStorage.setItem(key,JSON.stringify(data));status('✓ 자동 저장 완료');return true;}catch{status('저장 실패 · 입력은 화면에 유지됩니다. 브라우저 저장 공간을 확인해주세요.',true);return false;}}
function input(g,side,row,field,label,type='text',placeholder=''){
 const source=side==='group'?g:row;
 return `<input data-group="${g.id}" data-side="${side}" data-id="${row?.id||''}" data-field="${field}" aria-label="${esc(label)}" type="text" value="${esc(type==='number'?formatMoney(source[field]??''):source[field]??'')}" ${type==='number'?'data-money inputmode="text" lang="ko" maxlength="20"':'maxlength="160"'} placeholder="${esc(placeholder)}" autocomplete="off">`;
}
function select(g,side,r,label){const states=side==='purchases'?purchaseStates:saleStates;return `<select data-group="${g.id}" data-side="${side}" data-id="${r.id}" data-field="status" aria-label="${label}">${states.map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select>`;}
function rowCells(g,side,r,i){const buy=side==='purchases',label=`${groups.indexOf(g)+1}묶음 ${buy?'구매':'판매'} ${i+1}행`;
 if(!r)return `<td class="${buy?'purchase':'sale'}"></td><td class="${buy?'purchase':'sale'}"></td>`;
 return `<td class="${buy?'purchase':'sale'} product"><div class="product-cell">${input(g,side,r,'name',label+' 상품명','text','상품명 입력')}<button class="delete-line" data-delete-line="${r.id}" data-group="${g.id}" data-side="${side}" aria-label="${label} 삭제" title="이 상품 삭제">×</button></div></td><td class="${buy?'purchase':'sale'} price">${input(g,side,r,'price',label+' 가격','number')}</td>`;
}
function purchaseStatus(g,index){return `<select data-group="${g.id}" data-side="group" data-id="" data-field="purchaseStatus" aria-label="${index}묶음 구매상황">${purchaseStates.map(s=>`<option ${g.purchaseStatus===s?'selected':''}>${s}</option>`).join('')}</select>`;}
function bodyHTML(g){
 const index=groups.indexOf(g)+1,pn=g.purchases.length,sn=g.sales.length,an=g.actualPurchases.length,n=Math.max(pn,sn,an)+(g.confirmed?0:1);
 const add=side=>`<td colspan="${side==='actualPurchases'?2:5}" class="add-line-cell"><button data-add-line="${side}" data-group="${g.id}" aria-label="${index}묶음 ${side==='purchases'?'구매':side==='sales'?'판매':'실구매'} 행 추가">＋</button></td>`;
 return `<tbody data-body="${g.id}">${Array.from({length:n},(_,i)=>{
  const p=g.purchases[i],r=g.sales[i];
  const purchase=p?`${rowCells(g,'purchases',p,i)}${i===0?`<td class="purchase shared" rowspan="${pn}">${input(g,'group',null,'shipping',index+'묶음 배송비','number')}</td><td class="purchase total" rowspan="${pn}" data-total="cost"></td><td class="purchase state" rowspan="${pn}">${purchaseStatus(g,index)}</td>`:''}`:!g.confirmed&&i===pn?add('purchases'):i===pn+(g.confirmed?0:1)?`<td colspan="5" rowspan="${n-pn-(g.confirmed?0:1)}" class="side-spacer"></td>`:'';
  const sale=r?`${rowCells(g,'sales',r,i)}${i===0?`<td class="total" rowspan="${sn}" data-total="current"></td><td class="total" rowspan="${sn}" data-total="expected"></td>`:''}<td class="sale state">${select(g,'sales',r,index+'묶음 판매 '+(i+1)+'행 판매상황')}</td>`:!g.confirmed&&i===sn?add('sales'):i===sn+(g.confirmed?0:1)?`<td colspan="5" rowspan="${n-sn-(g.confirmed?0:1)}" class="side-spacer sales-spacer"></td>`:'';
  const a=g.actualPurchases[i];
  const actual=a?`<td class="actual-purchase product"><div class="product-cell">${input(g,'actualPurchases',a,'name',index+'묶음 실구매 '+(i+1)+'행 상품명','text','상품명 입력')}<button class="delete-line" data-delete-line="${a.id}" data-group="${g.id}" data-side="actualPurchases" aria-label="${index}묶음 실구매 ${i+1}행 삭제">×</button></div></td><td class="actual-purchase price">${input(g,'actualPurchases',a,'price',index+'묶음 실구매 '+(i+1)+'행 가격','number')}</td>`:!g.confirmed&&i===an?add('actualPurchases'):i===an+(g.confirmed?0:1)?`<td colspan="2" rowspan="${n-an-(g.confirmed?0:1)}" class="side-spacer"></td>`:'';
  return `<tr class="${i===0?'group-start ':''}${p||r?'data-row':'add-row'}" ${r?`data-sale-id="${r.id}"`:''}>${purchase}${sale}${i===0?`<td class="difference total" rowspan="${n}" data-total="currentDifference"></td><td class="difference total" rowspan="${n}" data-total="expectedDifference"></td>`:''}${actual}${i===0?`<td class="month-cell" rowspan="${n}"><select data-group="${g.id}" data-side="group" data-id="" data-field="month" aria-label="${index}묶음 월">${monthOptions(g.month)}</select></td><td class="group-confirm-cell" rowspan="${n}"><button data-confirm-group="${g.id}" aria-label="${index}묶음 ${g.confirmed?'확정 해제':'확정'}" aria-pressed="${!!g.confirmed}">${g.confirmed?'해제':'확정'}</button></td><td class="group-delete-cell" rowspan="${n}"><button data-delete-group="${g.id}" aria-label="${index}묶음 삭제" title="묶음 삭제">×</button></td>`:''}</tr>`;
 }).join('')}</tbody>`;
}
function updateColors(g,body){
 if(!body)return;
 body.style.setProperty('--purchase-fill',purchaseColor(g.purchaseStatus));
 for(const row of g.sales){const tr=body.querySelector(`[data-sale-id="${row.id}"]`);tr?.style.setProperty('--sale-fill',saleColor(row.status));}
}
function matches(g){return g.month===currentMonth&&(!groupUsed(g)||!query||[g.name,...g.purchases.flatMap(r=>[r.name,r.actualName||'']),...g.sales.map(r=>r.name),...g.actualPurchases.map(r=>r.name)].some(s=>s.toLowerCase().includes(query.toLowerCase())));}
function renderTable(){const sheet=document.querySelector('#sheet');const totalWidth=groupColumnWidths.reduce((sum,value)=>sum+value,0);sheet.style.width='100%';sheet.style.minWidth=totalWidth+'px';sheet.innerHTML=`<colgroup>${groupColumnWidths.map(w=>`<col style="width:${w/totalWidth*100}%">`).join('')}</colgroup><thead><tr class="bands"><th colspan="5" class="purchase">구매 내역</th><th colspan="5" class="sale">판매 내역</th><th colspan="2">차액</th><th colspan="2">실구매금액</th><th>월</th><th colspan="2" class="delete-heading" aria-label="묶음 관리"></th></tr><tr>${['상품명','가격','배송비','총합','구매상황','상품명','가격','현재총합','예상총합','판매상황','현재 차액','확정 차액','상품명','가격','월','',''].map((label,i)=>`<th scope="col" class="${i<5?'purchase':i<10?'sale':'difference'}">${label}</th>`).join('')}</tr></thead>${groups.filter(matches).map(bodyHTML).join('')}`;updateTotals();}
function updateTotals(){const sum={cost:0,current:0,expected:0,expectedDifference:0};for(const g of groups){const t=totals(g);const body=document.querySelector(`[data-body="${g.id}"]`);updateColors(g,body);body?.classList.toggle('equal-group',groupUsed(g)&&t.currentDifference!==0&&t.currentDifference===t.expectedDifference);body?.querySelectorAll('[data-total]').forEach(el=>{const v=t[el.dataset.total];el.textContent=groupUsed(g)?fmt(v):'—';el.classList.toggle('recovered',el.dataset.total.includes('Difference')&&v<0);el.classList.toggle('equal-balance',el.classList.contains('difference')&&groupUsed(g)&&t.currentDifference!==0&&t.currentDifference===t.expectedDifference);});if(g.month===currentMonth)for(const k in sum)sum[k]+=t[k];}for(const [k,v]of Object.entries(sum))document.querySelector(`[data-summary="${k}"]`).textContent=fmt(v)+'원';}
function edit(e){const el=e.target;if(!el.matches('[data-field]')||(e.type==='input'&&el.dataset.field==='month'))return;const g=groups.find(g=>g.id===el.dataset.group);const source=el.dataset.side==='group'?g:g[el.dataset.side].find(r=>r.id===el.dataset.id);source[el.dataset.field]=el.hasAttribute('data-money')?readMoneyInput(el,e.isComposing):el.value;el.setAttribute('aria-invalid',String(el.hasAttribute('data-money')&&!moneyValid(source[el.dataset.field])));if(el.dataset.field==='purchaseStatus')g.purchases.forEach(r=>r.status=g.purchaseStatus);updateTotals();status('저장 중…');clearTimeout(timer);timer=setTimeout(flush,350);
}
function closeMonthPicker(){document.querySelector('#month-grid').hidden=true;document.querySelector('#month-filter').setAttribute('aria-expanded','false');}
function changeMonth(next){
 const savedGroups=flush(),savedIndependent=flushIndependent();
 if(!savedGroups||!savedIndependent){document.querySelector('#month-filter').value=currentMonth;return;}
 currentMonth=next;
 try{localStorage.setItem('goods-ledger-month',currentMonth);}catch{}
 query='';document.querySelector('#search').value='';document.querySelector('#month-filter').value=currentMonth;document.querySelector('#month-filter').textContent=currentMonth+'월';document.querySelectorAll('[data-month]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.month===currentMonth)));closeMonthPicker();
 setIndependentMonth(currentMonth);renderTable();
}
function render(){document.querySelector('#app').innerHTML=`<header><a class="brand" href="#">모니굿즈</a><span class="local">이 브라우저에 자동 저장</span></header><main><div class="page-title"><nav class="month-nav" aria-label="월 이동"><button id="previous-month" aria-label="이전 달">&lt;</button><div class="month-choice"><button id="month-filter" type="button" value="${currentMonth}" aria-label="월 선택" aria-expanded="false" aria-controls="month-grid">${currentMonth}월</button><div id="month-grid" class="month-grid" role="group" aria-label="월 선택 달력" hidden>${Array.from({length:12},(_,i)=>`<button type="button" data-month="${i+1}" aria-pressed="${currentMonth===String(i+1)}">${i+1}월</button>`).join('')}</div></div><button id="next-month" aria-label="다음 달">&gt;</button></nav><div class="tools"><input id="search" aria-label="묶음 또는 상품 검색" placeholder="묶음 · 상품 검색"><button id="export">↓ CSV 내보내기</button></div></div><section class="summary">${[['cost','총 구매 비용'],['current','판매완료 금액'],['expected','판매예정 포함 금액'],['expectedDifference','판매 후 남는 구매 비용']].map(([k,label])=>`<div><span>${label}</span><strong data-summary="${k}">0원</strong></div>`).join('')}</section><div class="group-title"><h2 class="group-heading">묶음 테이블</h2><button id="add-group" aria-label="묶음 추가" title="묶음 추가">＋</button><span id="notice" role="status" aria-live="polite"></span></div><div class="sheet-scroll" tabindex="0" aria-label="묶음 장부. 마우스 휠로 좌우 이동할 수 있습니다."><table id="sheet"></table></div><section id="independent"></section></main>`;renderTable();status(blocked?'기존 데이터를 읽지 못했습니다. 자동 저장이 중지되었습니다.':'빈 칸에 바로 입력하세요.',blocked);
 const sheet=document.querySelector('#sheet');enableCellEditing(sheet);sheet.addEventListener('input',edit);sheet.addEventListener('change',e=>{if(e.target.tagName==='SELECT'){const previousMonth=e.target.dataset.field==='month'?groups.find(g=>g.id===e.target.dataset.group).month:null;edit(e);const saved=flush();if(previousMonth!==null){if(!saved)groups.find(g=>g.id===e.target.dataset.group).month=previousMonth;renderTable();}}});sheet.addEventListener('compositionend',edit);sheet.addEventListener('focusout',e=>{if(e.target.matches('[data-field]'))flush();});
 sheet.addEventListener('keydown',e=>{if(e.isComposing||!e.target.matches('input,select')||!['Tab','Enter','ArrowUp','ArrowDown'].includes(e.key))return;const el=e.target;if(e.key==='Tab'){const cells=[...sheet.querySelectorAll('input,select')].filter(n=>n.getClientRects().length);const next=cells[cells.indexOf(el)+(e.shiftKey?-1:1)];if(next){e.preventDefault();next.focus();if(next.type==='text')next.select();}return;}if(el.dataset.side==='group'||el.tagName==='SELECT')return;const tr=el.closest('tr'),other=e.key==='ArrowUp'||(e.key==='Enter'&&e.shiftKey)?tr.previousElementSibling:tr.nextElementSibling;const next=other?.querySelector(`[data-side="${el.dataset.side}"][data-field="${el.dataset.field}"]`);if(next){e.preventDefault();next.focus();if(next.type==='text')next.select();}});
 sheet.addEventListener('click',e=>{
  const button=e.target.closest('[data-delete-group],[data-delete-line],[data-add-line],[data-confirm-group]');if(!button)return;
  const id=button.dataset.confirmGroup||button.dataset.deleteGroup||button.dataset.group;const g=groups.find(g=>g.id===id);const previous=structuredClone(groups);
  if(button.dataset.confirmGroup){g.confirmed=!g.confirmed;}
  else if(button.dataset.addLine){if(g.confirmed)return;const row=button.dataset.addLine==='actualPurchases'?blankActual():blankLine(button.dataset.addLine);if(button.dataset.addLine==='purchases')row.status=g.purchaseStatus;g[button.dataset.addLine].push(row);}
  else{const hasData=button.dataset.deleteGroup?groupUsed(g):lineUsed(g[button.dataset.side].find(r=>r.id===button.dataset.deleteLine));if(hasData&&!confirm(button.dataset.deleteGroup?'이 묶음의 구매·판매 기록을 모두 삭제할까요?':'이 상품 행을 삭제할까요?'))return;
   if(button.dataset.deleteGroup)groups=groups.filter(g=>g.id!==id);
   else{const side=button.dataset.side;g[side]=g[side].filter(r=>r.id!==button.dataset.deleteLine);if(!g[side].length)g[side].push(side==='actualPurchases'?blankActual():blankLine(side));}
  }
  if(!flush())groups=previous;renderTable();
  if(button.dataset.addLine){const side=button.dataset.addLine;document.querySelector(`[data-body="${id}"] [data-side="${side}"][data-id="${g[side].at(-1).id}"][data-field="name"]`)?.focus();}
 });
 document.querySelector('#add-group').onclick=()=>{const previous=structuredClone(groups);const g=blankGroup();g.manualRows=true;g.purchases=[blankLine('purchases')];g.sales=[blankLine('sales')];groups.push(g);query='';document.querySelector('#search').value='';if(!flush())groups=previous;renderTable();document.querySelector(`[data-body="${g.id}"] [data-field="name"]`)?.focus();};
 document.querySelector('#search').oninput=e=>{query=e.target.value;renderTable();};document.querySelector('#export').onclick=()=>{const grouped=flush(),individual=flushIndependent();if(grouped&&individual)exportCSV();};mountIndependent(currentMonth);document.querySelector('#month-filter').onclick=()=>{const picker=document.querySelector('#month-grid'),open=picker.hidden;picker.hidden=!open;document.querySelector('#month-filter').setAttribute('aria-expanded',String(open));if(open)picker.querySelector(`[data-month="${currentMonth}"]`).focus();};document.querySelector('#month-grid').onclick=e=>{const button=e.target.closest('[data-month]');if(button){changeMonth(button.dataset.month);document.querySelector('#month-filter').focus();}};document.querySelector('#month-grid').onkeydown=e=>{const keys={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};if(e.key in keys){e.preventDefault();const buttons=[...document.querySelectorAll('[data-month]')],index=buttons.indexOf(document.activeElement);buttons[(index+keys[e.key]+12)%12].focus();}};document.addEventListener('click',e=>{if(!e.target.closest('.month-choice'))closeMonthPicker();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#month-grid').hidden){closeMonthPicker();document.querySelector('#month-filter').focus();}});document.querySelector('#previous-month').onclick=()=>changeMonth(String((Number(currentMonth)+10)%12+1));document.querySelector('#next-month').onclick=()=>changeMonth(String(Number(currentMonth)%12+1));enableWheelScroll(document.querySelector('.sheet-scroll'));}
function exportCSV(){const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const lines=[['묶음 이름','종류','상품명','가격','상황','구매 배송비','구매 기타 비용','판매 배송비','구매 총합','현재총합','예상총합','현재 차액','확정 차액','날짜','월','실구매 상품명','실구매 가격']];for(const g of storedGroups()){const t=totals(g);for(const side of ['purchases','sales'])g[side].forEach((r,i)=>lines.push([g.name,side==='purchases'?'구매':'판매',r.name,r.price,side==='purchases'?g.purchaseStatus:r.status,side==='purchases'&&i===0?g.shipping:'',side==='purchases'&&i===0?g.extra:'',r.shipping||'',t.cost,t.current,t.expected,t.currentDifference,t.expectedDifference,r.date||'',g.month,'','']));for(const r of g.actualPurchases.filter(lineUsed)){const row=Array(17).fill('');row[0]=g.name;row[1]='실구매';row[2]=r.name;row[3]=r.price;row[14]=g.month;row[15]=r.name;row[16]=r.price;lines.push(row);}}lines.push(...independentCSVRows());const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='goods-구매판매장부.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.addEventListener('pagehide',flush);
render();

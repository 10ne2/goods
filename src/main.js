import {formatMoney, readMoneyInput, enableWheelScroll} from './sheet-utils.js';
import {mountIndependent, flushIndependent, independentCSVRows} from './independent.js';
import './style.css';
import {totals, migrate} from './groups.js';
const key='goods-ledger-groups-v2';
const fmt=n=>new Intl.NumberFormat('ko-KR').format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>crypto.randomUUID();
const purchaseStates=['주문완료','배송중','수령완료'];
const saleStates=['판매전','판매중','예약중','판매완료'];
const blankLine=side=>({id:uuid(),name:'',price:'',status:side==='purchases'?'주문완료':'판매전',...(side==='sales'?{shipping:''}:{})});
const blankGroup=()=>({id:uuid(),name:'',purchaseStatus:'주문완료',shipping:'',extra:'',purchases:[],sales:[]});
const lineUsed=r=>!!(r.name||r.price!==''||r.shipping||r.fee);
const groupUsed=g=>!!(g.name||g.shipping||g.extra||g.purchases.some(lineUsed)||g.sales.some(lineUsed));
const moneyValid=v=>v===''||(/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))&&Number(v)<=999999999999);
function validGroup(g){return g&&typeof g.id==='string'&&typeof g.name==='string'&&moneyValid(g.shipping)&&moneyValid(g.extra)&&(!g.purchaseStatus||purchaseStates.includes(g.purchaseStatus))&&['purchases','sales'].every(side=>Array.isArray(g[side])&&g[side].every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&moneyValid(r.price)&&(side==='purchases'?purchaseStates:saleStates).includes(r.status)&&(side!=='sales'||(moneyValid(r.shipping)))));}
let groups=[],blocked=false,timer,query='';
try{
 const stored=localStorage.getItem(key);
 if(stored!==null){const parsed=JSON.parse(stored);if(!Array.isArray(parsed)||!parsed.every(validGroup))throw Error();groups=parsed;}
 else{const legacy=JSON.parse(localStorage.getItem('goods-ledger-v1')||'[]');if(!Array.isArray(legacy)||!legacy.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.date==='string'&&['price','shipping','extra'].every(k=>Number.isSafeInteger(i[k])&&i[k]>=0)&&(!i.sale||(['price','shipping','fee'].every(k=>Number.isSafeInteger(i.sale[k])&&i.sale[k]>=0)&&typeof i.sale.date==='string'))))throw Error();groups=migrate(legacy);}
}catch{blocked=true;}
function normalize(){
 groups=groups.filter(g=>g.manualRows||groupUsed(g));
 for(const g of groups){
  for(const side of ['purchases','sales']){
   if(!g.manualRows)g[side]=g[side].filter(lineUsed);
   if(!g[side].length)g[side].push(blankLine(side));
  }
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
 return `<input data-group="${g.id}" data-side="${side}" data-id="${row?.id||''}" data-field="${field}" aria-label="${esc(label)}" type="text" value="${esc(type==='number'?formatMoney(source[field]):source[field])}" ${type==='number'?'data-money inputmode="numeric" maxlength="20"':'maxlength="160"'} placeholder="${esc(placeholder)}" autocomplete="off">`;
}
function select(g,side,r,label){const states=side==='purchases'?purchaseStates:saleStates;return `<select data-group="${g.id}" data-side="${side}" data-id="${r.id}" data-field="status" aria-label="${label}">${states.map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select>`;}
function rowCells(g,side,r,i){const buy=side==='purchases',label=`${groups.indexOf(g)+1}묶음 ${buy?'구매':'판매'} ${i+1}행`;
 if(!r)return `<td class="${buy?'purchase':'sale'}"></td><td class="${buy?'purchase':'sale'}"></td>`;
 return `<td class="${buy?'purchase':'sale'} product"><div class="product-cell">${input(g,side,r,'name',label+' 상품명','text',i===0?'상품명 입력':'')}<button class="delete-line" data-delete-line="${r.id}" data-group="${g.id}" data-side="${side}" aria-label="${label} 삭제" title="이 상품 삭제">×</button></div></td><td class="${buy?'purchase':'sale'} price">${input(g,side,r,'price',label+' 가격','number')}</td>`;
}
function purchaseStatus(g,index){return `<select data-group="${g.id}" data-side="group" data-id="" data-field="purchaseStatus" aria-label="${index}묶음 구매상황">${purchaseStates.map(s=>`<option ${g.purchaseStatus===s?'selected':''}>${s}</option>`).join('')}</select>`;}
function sideTable(g,side){
 const buy=side==='purchases',rows=g[side],n=rows.length,index=groups.indexOf(g)+1;
 const widths=buy?[185,80,80,90,85]:[185,80,90,90,85];const total=widths.reduce((s,v)=>s+v,0);
 return `<table class="group-side" aria-label="${index}묶음 ${buy?'구매':'판매'} 내역"><colgroup>${widths.map(w=>`<col style="width:${w/total*100}%">`).join('')}</colgroup><tbody>${rows.map((r,i)=>`<tr class="data-row">${rowCells(g,side,r,i)}${buy?(i===0?`<td class="purchase shared" rowspan="${n}">${input(g,'group',null,'shipping',index+'묶음 배송비','number')}</td><td class="purchase total" rowspan="${n}" data-total="cost"></td><td class="purchase state" rowspan="${n}">${purchaseStatus(g,index)}</td>`:''):`${i===0?`<td class="sale total" rowspan="${n}" data-total="current"></td><td class="sale total" rowspan="${n}" data-total="expected"></td>`:''}<td class="sale state">${select(g,'sales',r,index+'묶음 판매 '+(i+1)+'행 판매상황')}</td>`}</tr>`).join('')}<tr class="add-row"><td colspan="5" class="add-line-cell"><button data-add-line="${side}" data-group="${g.id}" aria-label="${index}묶음 ${buy?'구매':'판매'} 행 추가">＋</button></td></tr></tbody></table>`;
}
function bodyHTML(g){const index=groups.indexOf(g)+1;return `<tbody data-body="${g.id}"><tr class="group-row"><td class="side-container" colspan="5">${sideTable(g,'purchases')}</td><td class="side-container" colspan="5">${sideTable(g,'sales')}</td><td class="difference total" data-total="currentDifference"></td><td class="difference total" data-total="expectedDifference"></td><td class="group-delete-cell"><button data-delete-group="${g.id}" aria-label="${index}묶음 삭제" title="묶음 삭제">×</button></td></tr></tbody>`;}
function matches(g){return !groupUsed(g)||!query||[g.name,...g.purchases.map(r=>r.name),...g.sales.map(r=>r.name)].some(s=>s.toLowerCase().includes(query.toLowerCase()));}
function renderTable(){document.querySelector('#sheet').innerHTML=`<colgroup>${[185,80,80,90,85,185,80,90,90,85,95,95,24].map(w=>`<col style="width:${w/1284*100}%">`).join('')}</colgroup><thead><tr class="bands"><th colspan="5" class="purchase">구매 내역</th><th colspan="5" class="sale">판매 내역</th><th colspan="2">차액</th><th class="delete-heading" aria-label="묶음 관리"></th></tr><tr>${['상품명','가격','배송비','총합','구매상황','상품명','가격','현재총합','예상총합','판매상황','현재 차액','확정 차액',''].map((label,i)=>`<th scope="col" class="${i<5?'purchase':i<10?'sale':'difference'}">${label}</th>`).join('')}</tr></thead>${groups.filter(matches).map(bodyHTML).join('')}`;updateTotals();}
function updateTotals(){const sum={cost:0,current:0,expected:0,expectedDifference:0};for(const g of groups){const t=totals(g);const body=document.querySelector(`[data-body="${g.id}"]`);body?.querySelectorAll('[data-total]').forEach(el=>{const v=t[el.dataset.total];el.textContent=groupUsed(g)?fmt(v):'—';el.classList.toggle('recovered',el.dataset.total.includes('Difference')&&v<0);});for(const k in sum)sum[k]+=t[k];}for(const [k,v]of Object.entries(sum))document.querySelector(`[data-summary="${k}"]`).textContent=fmt(v)+'원';}
function edit(e){const el=e.target;if(!el.matches('[data-field]'))return;const g=groups.find(g=>g.id===el.dataset.group);const source=el.dataset.side==='group'?g:g[el.dataset.side].find(r=>r.id===el.dataset.id);source[el.dataset.field]=el.hasAttribute('data-money')?readMoneyInput(el,e.isComposing):el.value;el.setAttribute('aria-invalid',String(el.hasAttribute('data-money')&&!moneyValid(source[el.dataset.field])));if(el.dataset.field==='purchaseStatus')g.purchases.forEach(r=>r.status=g.purchaseStatus);updateTotals();status('저장 중…');clearTimeout(timer);timer=setTimeout(flush,350);
}
function render(){document.querySelector('#app').innerHTML=`<header><a class="brand" href="#">▧ 차곡<span>.</span></a><span>구매 · 판매 장부</span><span class="local">이 브라우저에 자동 저장</span></header><main><div class="page-title"><div><h1>나의 구매 · 판매 시트</h1><p>묶음별 구매부터 판매까지, 한 장의 표에서 관리하세요.</p></div><div class="tools"><button id="add-group">＋ 묶음 추가</button><input id="search" aria-label="묶음 또는 상품 검색" placeholder="묶음 · 상품 검색"><button id="export">↓ CSV 내보내기</button></div></div><div class="summary-caption">묶음 장부 요약</div><section class="summary">${[['cost','총 구매 비용'],['current','판매완료 금액'],['expected','판매예정 포함 금액'],['expectedDifference','판매 후 남는 구매 비용']].map(([k,label])=>`<div><span>${label}</span><strong data-summary="${k}">0원</strong></div>`).join('')}</section><div class="group-title"><h2 class="group-heading">묶음 테이블</h2><span id="notice" role="status" aria-live="polite"></span></div><div class="sheet-scroll" tabindex="0" aria-label="묶음 장부. 마우스 휠로 좌우 이동할 수 있습니다."><table id="sheet"></table></div><section id="independent"></section><div class="sheet-notes"><p><b>입력 방법</b> 빈 칸을 클릭해 입력 · 묶음 추가로 새 묶음 생성 · 구매·판매 행 아래 ＋로 행 추가 · 좁은 화면은 표 위에서 마우스 휠로 좌우 이동 · Tab으로 옆 칸, Enter로 같은 열의 다음 행 이동</p><p><b>계산 기준</b> 현재총합 = 판매완료 금액 · 예상총합 = 판매전·판매중·예약중·판매완료 금액 합계<br>현재 차액 = 구매 총합 − 현재총합 + 완료 판매 비용 · 확정 차액 = 구매 총합 − 예상총합 + 전체 판매 비용<br>차액은 아직 회수하지 못한 구매 비용입니다. 음수이면 그만큼 이익이며, 확정 차액은 판매예정 가격을 포함한 예상값입니다.</p><p>배송비는 묶음당 한 번만 합산합니다. 기존 기록은 개별 묶음으로 유지하며, 다른 기기와 동기화되지 않으니 CSV로 백업하세요.</p></div></main>`;renderTable();status(blocked?'기존 데이터를 읽지 못했습니다. 자동 저장이 중지되었습니다.':'빈 칸에 바로 입력하세요.',blocked);
 const sheet=document.querySelector('#sheet');sheet.addEventListener('input',edit);sheet.addEventListener('change',e=>{if(e.target.tagName==='SELECT'){edit(e);flush();}});sheet.addEventListener('compositionend',edit);sheet.addEventListener('focusout',e=>{if(e.target.matches('[data-field]'))flush();});
 sheet.addEventListener('keydown',e=>{if(e.isComposing||!e.target.matches('input,select')||!['Tab','Enter','ArrowUp','ArrowDown'].includes(e.key))return;const el=e.target;if(e.key==='Tab'){const cells=[...sheet.querySelectorAll('input,select')].filter(n=>n.getClientRects().length);const next=cells[cells.indexOf(el)+(e.shiftKey?-1:1)];if(next){e.preventDefault();next.focus();if(next.type==='text')next.select();}return;}if(el.dataset.side==='group'||el.tagName==='SELECT')return;const tr=el.closest('tr'),other=e.key==='ArrowUp'||(e.key==='Enter'&&e.shiftKey)?tr.previousElementSibling:tr.nextElementSibling;const next=other?.querySelector(`[data-side="${el.dataset.side}"][data-field="${el.dataset.field}"]`);if(next){e.preventDefault();next.focus();if(next.type==='text')next.select();}});
 sheet.addEventListener('click',e=>{
  const button=e.target.closest('[data-delete-group],[data-delete-line],[data-add-line]');if(!button)return;
  const id=button.dataset.deleteGroup||button.dataset.group;const g=groups.find(g=>g.id===id);const previous=structuredClone(groups);
  if(button.dataset.addLine){const row=blankLine(button.dataset.addLine);if(button.dataset.addLine==='purchases')row.status=g.purchaseStatus;g[button.dataset.addLine].push(row);}
  else{if(!confirm(button.dataset.deleteGroup?'이 묶음의 구매·판매 기록을 모두 삭제할까요?':'이 상품 행을 삭제할까요?'))return;
   if(button.dataset.deleteGroup)groups=groups.filter(g=>g.id!==id);
   else{const side=button.dataset.side;g[side]=g[side].filter(r=>r.id!==button.dataset.deleteLine);if(!g[side].length)g[side].push(blankLine(side));}
  }
  if(!flush())groups=previous;renderTable();
  if(button.dataset.addLine){const side=button.dataset.addLine;document.querySelector(`[data-body="${id}"] [data-side="${side}"][data-id="${g[side].at(-1).id}"][data-field="name"]`)?.focus();}
 });
 document.querySelector('#add-group').onclick=()=>{const previous=structuredClone(groups);const g=blankGroup();g.manualRows=true;g.purchases=[blankLine('purchases')];g.sales=[blankLine('sales')];groups.push(g);query='';document.querySelector('#search').value='';if(!flush())groups=previous;renderTable();document.querySelector(`[data-body="${g.id}"] [data-field="name"]`)?.focus();};
 document.querySelector('#search').oninput=e=>{query=e.target.value;renderTable();};document.querySelector('#export').onclick=()=>{const grouped=flush(),individual=flushIndependent();if(grouped&&individual)exportCSV();};mountIndependent();enableWheelScroll(document.querySelector('.sheet-scroll'));}
function exportCSV(){const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const lines=[['묶음 이름','종류','상품명','가격','상황','구매 배송비','구매 기타 비용','판매 배송비','구매 총합','현재총합','예상총합','현재 차액','확정 차액','날짜']];for(const g of storedGroups()){const t=totals(g);for(const side of ['purchases','sales'])g[side].forEach((r,i)=>lines.push([g.name,side==='purchases'?'구매':'판매',r.name,r.price,side==='purchases'?g.purchaseStatus:r.status,side==='purchases'&&i===0?g.shipping:'',side==='purchases'&&i===0?g.extra:'',r.shipping||'',t.cost,t.current,t.expected,t.currentDifference,t.expectedDifference,r.date||'']));}lines.push(...independentCSVRows());const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='goods-구매판매장부.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.addEventListener('pagehide',flush);
render();

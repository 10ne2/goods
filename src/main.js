import './style.css';
import {totalCost,profit,summarize} from './ledger.js';
const won=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const key='goods-ledger-v1';
let items=[],filter='all',query='',timer,storageError=false;
try{
 const saved=JSON.parse(localStorage.getItem(key)||'[]');
 if(!Array.isArray(saved)||!saved.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.date==='string'&&['price','shipping','extra'].every(k=>Number.isSafeInteger(i[k])&&i[k]>=0)&&(!i.sale||(['price','shipping','fee'].every(k=>Number.isSafeInteger(i.sale[k])&&i.sale[k]>=0)&&typeof i.sale.date==='string'))))throw Error();
 items=saved;
}catch{storageError=true;}
const columns=[['name','상품명','text'],['date','구매일','date'],['price','구매가','number'],['shipping','구매 배송비','number'],['extra','기타 비용','number'],['cost','총 구매 비용'],['saleDate','판매일','date'],['salePrice','판매가','number'],['saleShipping','판매 배송비','number'],['fee','수수료','number'],['profit','손익']];
const editable=columns.filter(c=>c[2]).map(c=>c[0]);
function emptyRow(){return {id:crypto.randomUUID(),name:'',date:'',price:'',shipping:'',extra:'',saleDate:'',salePrice:'',saleShipping:'',fee:''};}
let rows=items.map(i=>({id:i.id,name:i.name,date:i.date,price:String(i.price),shipping:String(i.shipping),extra:String(i.extra),saleDate:i.sale?.date||'',salePrice:i.sale?String(i.sale.price):'',saleShipping:i.sale?String(i.sale.shipping):'',fee:i.sale?String(i.sale.fee):''}));
function touched(r){return editable.some(k=>r[k]!=='');}
function padRows(){while(rows.length<10||touched(rows.at(-1)))rows.push(emptyRow());}
padRows();
function candidate(r){
 if(!r.name.trim()||!r.date)return null;
 for(const k of ['price','shipping','extra','salePrice','saleShipping','fee'])if(r[k]!==''&&(!/^\d+$/.test(r[k])||!Number.isSafeInteger(Number(r[k]))||Number(r[k])>999999999999))return null;
 if(r.price==='')return null;
 if(r.salePrice!==''&&!r.saleDate)return null;
 return {id:r.id,name:r.name.trim(),date:r.date,price:Number(r.price),shipping:Number(r.shipping),extra:Number(r.extra),sale:r.salePrice===''?null:{date:r.saleDate,price:Number(r.salePrice),shipping:Number(r.saleShipping),fee:Number(r.fee)}};
}
function currentItems(){return rows.flatMap(r=>{const i=candidate(r)||items.find(i=>i.id===r.id);return i?[i]:[];});}
function status(text,error=false){const el=document.querySelector('#notice');el.textContent=text;el.classList.toggle('error',error);}
function flush(){
 clearTimeout(timer);
 if(storageError){status('기존 데이터를 읽지 못해 자동 저장을 중지했습니다. CSV 또는 브라우저 데이터를 먼저 확인해주세요.',true);return false;}
 const next=currentItems();
 try{localStorage.setItem(key,JSON.stringify(next));items=next;refreshSummary();const incomplete=rows.some(r=>touched(r)&&!candidate(r));status(incomplete?'입력 중 · 상품명, 구매일, 구매가를 확인해주세요. 미완성 행은 아직 저장되지 않습니다.':'✓ 자동 저장 완료');return true;}
 catch{status('저장 실패 · 입력값은 화면에 유지됩니다. 저장 공간을 확인하고 다시 입력해주세요.',true);return false;}
}
function summaryHTML(){const s=summarize(currentItems());return `<article><span>총 구매 비용</span><strong>${won(s.cost)}</strong></article><article><span>총 판매 금액</span><strong>${won(s.revenue)}</strong></article><article class="profit-card"><span>판매 손익</span><strong>${s.profit>0?'+':''}${won(s.profit)}</strong></article><article><span>보유 상품</span><strong>${s.stock}<em>개</em></strong></article>`;}
function refreshSummary(){document.querySelector('.stats').innerHTML=summaryHTML();document.querySelector('#count').textContent=currentItems().length;}
function render(){document.querySelector('#app').innerHTML=`<aside><a class="brand" href="#">▧ <span>차곡<span class="brand-dot">.</span></span></a><div class="side-label">MY WORKSPACE</div><div class="active-nav">▦ <span>구매 · 판매 장부</span></div><div class="side-bottom">작은 기록이 모여<br>분명한 수익이 되도록.</div></aside><main><header><span>나의 거래 관리</span><span class="local-badge">● 이 브라우저에 저장</span></header><section class="heading"><div><div class="eyebrow">MY GOODS LEDGER</div><h1>구매 · 판매 장부</h1><p>빈 칸에 바로 입력하세요. 비용과 손익은 자동으로 계산됩니다.</p></div></section><section class="stats">${summaryHTML()}</section><section class="ledger"><div class="ledger-title"><h2>거래 내역 <span id="count">${items.length}</span></h2><button class="text-btn" id="export">↓ CSV 내보내기</button></div><div class="toolbar"><div class="tabs">${[['all','전체'],['stock','보유 중'],['sold','판매 완료']].map(([v,l])=>`<button data-filter="${v}" class="${filter===v?'selected':''}">${l}</button>`).join('')}</div><input id="search" aria-label="상품 검색" placeholder="⌕ 상품명으로 검색" value="${escape(query)}"></div><p class="entry-help">Tab: 다음 칸 · Enter / ↑ ↓: 위아래 행 · 판매가 입력 시 판매 완료 · 판매가를 비우면 판매 취소</p><div id="notice" role="status" aria-live="polite"></div><div id="records"></div></section><footer>이 브라우저에 자동 저장됩니다. 다른 기기와 동기화되지 않으니 CSV로 백업하세요.</footer></main>`;
 renderRecords();status(storageError?'기존 저장 데이터를 읽지 못했습니다. 자동 저장을 중지했습니다.':'빈 행에 상품명과 구매가를 입력하면 자동 저장됩니다.',storageError);
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{flush();filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>t.classList.toggle('selected',t.dataset.filter===filter));renderRecords();});
 document.querySelector('#search').oninput=e=>{query=e.target.value;renderRecords();};
 document.querySelector('#export').onclick=()=>{if(flush())exportCSV();};
}
function cell(r,column,index){const [name,label,type]=column;
 if(!type)return `<td class="computed" data-computed="${name}">—</td>`;
 return `<td><input data-col="${name}" aria-label="${index+1}행 ${label}" type="${type}" value="${escape(r[name])}" ${type==='number'?'min="0" max="999999999999" step="1" inputmode="numeric"':type==='text'?'maxlength="120" placeholder="상품명 입력"':''} autocomplete="off"></td>`;
}
function rowHTML(r){const index=rows.indexOf(r);return `<tr data-row="${r.id}"><th scope="row" class="row-number">${index+1}</th>${columns.map(c=>cell(r,c,index)).join('')}<td class="row-menu"><button data-delete="${r.id}" aria-label="${index+1}행 삭제" title="행 삭제">×</button></td></tr>`;}
function renderRecords(){
 const visible=rows.filter(r=>!touched(r)||((filter==='all'||(filter==='sold'?r.salePrice!=='':r.salePrice===''))&&r.name.toLowerCase().includes(query.toLowerCase())));
 document.querySelector('#records').innerHTML=`<div class="table-wrap sheet-scroll" tabindex="0" aria-label="구매 판매 스프레드시트. 가로로 스크롤할 수 있습니다."><table class="sheet"><thead><tr><th class="row-number">#</th>${columns.map(([name,label],i)=>`<th scope="col" class="${['cost','profit'].includes(name)?'computed':''}"><small>${String.fromCharCode(65+i)}</small>${label}${['cost','profit'].includes(name)?' · 자동':''}</th>`).join('')}<th scope="col">관리</th></tr></thead><tbody>${visible.map(rowHTML).join('')}</tbody></table></div>`;
 for(const r of visible)updateRow(r);
 const body=document.querySelector('tbody');
 body.oninput=e=>{if(!e.target.matches('[data-col]'))return;const input=e.target;const r=rows.find(r=>r.id===input.closest('tr').dataset.row);r[input.dataset.col]=input.value;
  if(!r.date&&r.name.trim()){r.date=today();input.closest('tr').querySelector('[data-col="date"]').value=r.date;}
  if(input.dataset.col==='salePrice'&&r.salePrice!==''&&!r.saleDate){r.saleDate=today();input.closest('tr').querySelector('[data-col="saleDate"]').value=r.saleDate;}
  updateRow(r);refreshSummary();status('저장 중…');clearTimeout(timer);timer=setTimeout(flush,350);
  const n=rows.length;padRows();for(const added of rows.slice(n)){body.insertAdjacentHTML('beforeend',rowHTML(added));updateRow(added);}
 };
 body.addEventListener('focusout',e=>{if(e.target.matches('[data-col]'))flush();});
 body.onkeydown=e=>{
  if(!e.target.matches('[data-col]')||e.isComposing)return;
  if(!['Enter','ArrowUp','ArrowDown','Tab'].includes(e.key))return;
  const inputs=[...body.querySelectorAll('input')],index=inputs.indexOf(e.target);let target;
  if(e.key==='Tab')target=inputs[index+(e.shiftKey?-1:1)];
  else{const tr=e.target.closest('tr');const other=e.key==='ArrowUp'||(e.key==='Enter'&&e.shiftKey)?tr.previousElementSibling:tr.nextElementSibling;target=other?.querySelector(`[data-col="${e.target.dataset.col}"]`);}
  if(target){e.preventDefault();target.focus();if(target.type!=='date')target.select();}
 };
 body.onclick=e=>{const b=e.target.closest('[data-delete]');if(!b)return;const r=rows.find(r=>r.id===b.dataset.delete);
  if(touched(r)&&!confirm('이 행의 구매·판매 기록을 삭제할까요?'))return;
  const saved=items;items=items.filter(i=>i.id!==r.id);const remaining=rows.filter(i=>i.id!==r.id);
  try{if(storageError)throw Error();localStorage.setItem(key,JSON.stringify(items));rows=remaining;padRows();renderRecords();refreshSummary();status('행을 삭제했습니다.');}
  catch{items=saved;status('삭제하지 못했습니다. 저장 공간과 설정을 확인해주세요.',true);}
 };
}
function updateRow(r){const tr=document.querySelector(`[data-row="${r.id}"]`);if(!tr)return;const item=candidate(r);const hasCost=['price','shipping','extra'].some(k=>r[k]!=='');const cost=Number(r.price)+Number(r.shipping)+Number(r.extra);const p=r.salePrice===''?null:Number(r.salePrice)-Number(r.saleShipping)-Number(r.fee)-cost;
 tr.querySelector('[data-computed="cost"]').textContent=hasCost&&Number.isFinite(cost)?won(cost):'—';
 const out=tr.querySelector('[data-computed="profit"]');out.textContent=p!==null&&Number.isFinite(p)?`${p>0?'+':''}${won(p)}`:'—';out.className=`computed ${p>0?'positive':p<0?'negative':''}`;
 tr.classList.toggle('unsaved',touched(r)&&!item);tr.classList.toggle('sold-row',r.salePrice!=='');
 tr.querySelectorAll('input').forEach(input=>{const invalid=(input.type==='number'&&!input.validity.valid)||(input.dataset.col==='name'&&touched(r)&&!r.name.trim());input.setAttribute('aria-invalid',String(invalid));});
}
window.addEventListener('pagehide',flush);
function exportCSV(){const cell=v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';const rows=[['상품명','구매일','구매가','구매 배송비','기타 비용','총 구매 비용','판매일','판매가','판매 배송비','수수료','손익'],...items.map(i=>[i.name,i.date,i.price,i.shipping,i.extra,totalCost(i),i.sale?.date||'',i.sale?.price??'',i.sale?.shipping??'',i.sale?.fee??'',profit(i)??''])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`차곡-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

render();

import './style.css';
import {totalCost,profit,summarize} from './ledger.js';
const won=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const key='goods-ledger-v1';
let items=[],filter='all',query='';
const drafts=new Map();
let notice='';
let storageError=false;
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved)||!saved.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.date==='string'&&['price','shipping','extra'].every(k=>Number.isSafeInteger(i[k])&&i[k]>=0)&&(!i.sale||(['price','shipping','fee'].every(k=>Number.isSafeInteger(i.sale[k])&&i.sale[k]>=0)&&typeof i.sale.date==='string'))))throw Error();items=saved;}catch{storageError=true;}
function save(next){
 try{localStorage.setItem(key,JSON.stringify(next));items=next;return true;}
 catch{notice='저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해주세요.';return false;}
}
function render(){const s=summarize(items);document.querySelector('#app').innerHTML=`<aside><a class="brand" href="#">▧ <span>차곡<span class="brand-dot">.</span></span></a><div class="side-label">MY WORKSPACE</div><div class="active-nav">▦ <span>구매 · 판매 장부</span></div><div class="side-bottom">작은 기록이 모여<br>분명한 수익이 되도록.</div></aside><main><header><span>나의 거래 관리</span><span class="local-badge">● 이 브라우저에 저장 중</span></header><section class="heading"><div><div class="eyebrow">MY GOODS LEDGER</div><h1>구매 · 판매 장부</h1><p>무엇을 사고, 얼마를 남겼는지 한눈에 확인하세요.</p></div><button class="primary" id="add">＋ 행 추가</button></section>${storageError?'<div class="warning">기존 저장 데이터를 읽지 못했습니다. 새 기록을 저장하기 전에 브라우저 데이터를 확인해주세요.</div>':''}<section class="stats"><article><span>총 구매 비용</span><strong>${won(s.cost)}</strong><small>배송비와 기타 비용 포함</small></article><article><span>총 판매 금액</span><strong>${won(s.revenue)}</strong><small>판매 완료 상품의 판매가 합계</small></article><article class="profit-card"><span>판매 손익</span><strong>${s.profit>0?'+':''}${won(s.profit)}</strong><small>판매 완료 상품의 모든 비용 차감</small></article><article><span>보유 상품</span><strong>${s.stock}<em>개</em></strong><small>아직 판매하지 않은 상품</small></article></section><section class="ledger"><div class="ledger-title"><h2>거래 내역 <span>${items.length}</span></h2><button class="text-btn" id="export">↓ CSV 내보내기</button></div><div class="toolbar"><div class="tabs">${[['all','전체'],['stock','보유 중'],['sold','판매 완료']].map(([v,l])=>`<button data-filter="${v}" class="${filter===v?'selected':''}">${l}</button>`).join('')}</div><input id="search" aria-label="상품 검색" placeholder="⌕  상품명으로 검색" value="${escape(query)}"></div><p class="entry-help">행을 추가해 바로 입력하세요. 저장하면 합계에 반영됩니다.</p><div id="notice" role="status" aria-live="polite">${escape(notice)}</div><div id="records"></div></section><footer>기록은 이 브라우저에만 저장됩니다. 중요한 내역은 CSV로 내보내 보관하세요.</footer></main>`;renderRecords();document.querySelector('#add').onclick=()=>openPurchase();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});document.querySelector('#search').oninput=e=>{query=e.target.value;renderRecords();};document.querySelector('#export').onclick=exportCSV;}
function field(d,name,label,type='number'){
 const numeric=type==='number';
 return `<label class="cell-field">${label}<input form="form-${d.id}" data-field="${name}" name="${name}" aria-label="${label}" type="${type}" value="${escape(d.values[name])}" ${numeric?'min="0" max="999999999999" step="1" inputmode="numeric"':''} ${type==='text'?'maxlength="120"':''} required ${d.pending?'disabled':''}></label>`;
}
function draftRow(d){
 const item=items.find(i=>i.id===d.itemId);
 const sale=d.kind==='sale';
 return `<tr class="entry-row" data-draft="${d.id}">
 <td>${sale?`<b>${escape(item.name)}</b><small>${escape(item.date)}</small>`:field(d,'name','상품명','text')+field(d,'date','구매일','date')}</td>
 <td><span class="pill ${sale?'sold':''}">${sale?'판매 입력':d.itemId?'구매 수정':'새 구매'}</span></td>
 <td>${sale?won(totalCost(item)):field(d,'price','구매 가격')+field(d,'shipping','구매 배송비')+field(d,'extra','기타 비용')}<small>${sale?'':'총 구매 비용 '}<output data-cost></output></small></td>
 <td>${sale?field(d,'date','판매일','date')+field(d,'price','판매 가격')+field(d,'shipping','내가 부담한 판매 배송비')+field(d,'fee','판매 수수료'):item?.sale?won(item.sale.price):'—'}</td>
 <td><output data-profit aria-live="polite"></output></td>
 <td><div class="entry-actions"><button class="primary" type="submit" form="form-${d.id}" ${d.pending?'disabled':''}>${d.pending?'저장 중…':'저장'}</button><button type="button" data-cancel="${d.id}" ${d.pending?'disabled':''}>취소</button>${sale&&item.sale?`<button type="button" data-undo="${d.id}" ${d.pending?'disabled':''}>판매 취소</button>`:''}</div><small class="entry-error" role="status">${escape(d.error||'')}</small></td></tr>`;
}
function renderRecords(){
 const visible=items.filter(i=>(filter==='all'||(filter==='sold'?!!i.sale:!i.sale))&&i.name.toLowerCase().includes(query.toLowerCase()));
 const edited=new Set([...drafts.values()].map(d=>d.itemId));
 document.querySelector('#records').innerHTML=`${[...drafts.values()].map(d=>`<form id="form-${d.id}" data-form="${d.id}"></form>`).join('')}<div class="table-wrap"><table><thead><tr><th scope="col">상품 / 구매일</th><th scope="col">상태</th><th scope="col">구매 비용</th><th scope="col">판매 내역</th><th scope="col">손익</th><th scope="col">관리</th></tr></thead><tbody>${[...drafts.values()].map(draftRow).join('')}${visible.filter(i=>!edited.has(i.id)).map(i=>`<tr><td><b>${escape(i.name)}</b><small>${escape(i.date)}</small></td><td><span class="pill ${i.sale?'sold':''}">${i.sale?'판매 완료':'보유 중'}</span></td><td>${won(totalCost(i))}<small>상품 ${won(i.price)} · 배송 ${won(i.shipping)} · 기타 ${won(i.extra)}</small></td><td>${i.sale?won(i.sale.price):'—'}${i.sale?`<small>${escape(i.sale.date)} · 배송 ${won(i.sale.shipping)} · 수수료 ${won(i.sale.fee)}</small>`:''}</td><td class="${profit(i)>0?'positive':profit(i)<0?'negative':''}">${i.sale?`${profit(i)>0?'+':''}${won(profit(i))}`:'—'}</td><td><div class="actions"><button data-sale="${escape(i.id)}">${i.sale?'판매 수정':'판매 기록'}</button><button data-edit="${escape(i.id)}">수정</button><button data-delete="${escape(i.id)}" aria-label="${escape(i.name)} 삭제">×</button></div></td></tr>`).join('')}${!visible.length&&!drafts.size?`<tr><td colspan="6"><div class="empty"><div class="empty-icon">▧</div><h3>${items.length?'해당하는 기록이 없어요':'첫 구매를 기록해보세요'}</h3><p>${items.length?'검색어나 필터를 바꿔보세요.':'행을 추가하고 상품 가격과 배송비를 입력하세요.'}</p><button id="empty-add" class="primary">＋ 행 추가</button></div></td></tr>`:''}</tbody></table></div><button class="add-row" id="table-add">＋ 구매 행 추가</button>`;
 document.querySelectorAll('#empty-add, #table-add').forEach(b=>b.onclick=()=>openPurchase());
 document.querySelectorAll('[data-sale]').forEach(b=>b.onclick=()=>openSale(items.find(i=>i.id===b.dataset.sale)));
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openPurchase(items.find(i=>i.id===b.dataset.edit)));
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('구매 기록과 연결된 판매 기록을 삭제할까요?')){save(items.filter(i=>i.id!==b.dataset.delete));render();}});
 document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{drafts.delete(b.dataset.cancel);renderRecords();});
 document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>{if(confirm('판매 기록을 취소하고 보유 중으로 변경할까요?')){if(save(items.map(i=>i.id===drafts.get(b.dataset.undo).itemId?{...i,sale:null}:i)))drafts.delete(b.dataset.undo);render();}});
 for(const d of drafts.values()){
  const row=document.querySelector(`[data-draft="${d.id}"]`);
  row.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{input.setCustomValidity('');d.values[input.name]=input.value;updatePreview(d);});
  document.querySelector(`#form-${d.id}`).onsubmit=e=>{e.preventDefault();commitDraft(d);};
  updatePreview(d);
 }
}
function updatePreview(d){
 const row=document.querySelector(`[data-draft="${d.id}"]`);
 const v=d.values,original=items.find(i=>i.id===d.itemId);
 const candidate=d.kind==='sale'?{...original,sale:{price:Number(v.price),shipping:Number(v.shipping),fee:Number(v.fee)}}:{...original,price:Number(v.price),shipping:Number(v.shipping),extra:Number(v.extra)};
 row.querySelector('[data-cost]').textContent=d.kind==='sale'?'':won(totalCost(candidate));
 const p=profit(candidate);const out=row.querySelector('[data-profit]');
 out.textContent=p===null?'—':`${p>0?'+':''}${won(p)}`;out.className=p>0?'positive':p<0?'negative':'';
}
function openDraft(kind,item){
 const existing=[...drafts.values()].find(d=>item&&d.itemId===item.id);
 if(existing){document.querySelector(`[data-draft="${existing.id}"] input`).focus();return;}
 const source=kind==='sale'?item?.sale:item;
 const d={id:crypto.randomUUID(),itemId:item?.id,kind,values:kind==='sale'?{date:source?.date||today(),price:source?.price??0,shipping:source?.shipping??0,fee:source?.fee??0}:{name:item?.name||'',date:item?.date||today(),price:item?.price??0,shipping:item?.shipping??0,extra:item?.extra??0}};
 drafts.set(d.id,d);renderRecords();
 const row=document.querySelector(`[data-draft="${d.id}"]`);row.scrollIntoView({block:'nearest',behavior:'smooth'});row.querySelector('input').focus({preventScroll:true});
}
function openPurchase(item){openDraft('purchase',item);}
function openSale(item){openDraft('sale',item);}
async function commitDraft(d){
 if(d.pending)return;
 const v={...d.values};
 if(d.kind==='purchase'&&!String(v.name).trim()){
  const input=document.querySelector(`[data-draft="${d.id}"] [name="name"]`);input.setCustomValidity('상품명을 입력해주세요.');input.reportValidity();return;
 }
 d.pending=true;d.error='';renderRecords();
 // Let the browser paint the pending row without navigating or blocking other rows.
 await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 const original=items.find(i=>i.id===d.itemId);
 const next=d.kind==='sale'?{...original,sale:{date:v.date,price:Number(v.price),shipping:Number(v.shipping),fee:Number(v.fee)}}:{...original,id:d.itemId||crypto.randomUUID(),name:v.name.trim(),date:v.date,price:Number(v.price),shipping:Number(v.shipping),extra:Number(v.extra)};
 if(save(d.itemId?items.map(i=>i.id===d.itemId?next:i):[next,...items])){drafts.delete(d.id);notice='저장했습니다.';}else{d.pending=false;d.error=notice;}
 render();
}
function exportCSV(){const cell=v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';const rows=[['상품명','구매일','구매가','구매 배송비','기타 비용','총 구매 비용','판매일','판매가','판매 배송비','수수료','손익'],...items.map(i=>[i.name,i.date,i.price,i.shipping,i.extra,totalCost(i),i.sale?.date||'',i.sale?.price??'',i.sale?.shipping??'',i.sale?.fee??'',profit(i)??''])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`차곡-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
render();

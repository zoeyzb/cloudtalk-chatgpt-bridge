import {PHONE,OUTCOMES,parseEvent} from './core.mjs';
const $=id=>document.getElementById(id),iframe=$('phone');
async function send(message){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||'Extension unavailable');return r;}
async function action(fn){$('error').textContent='';try{await fn();await render();}catch(e){$('error').textContent=e.message;}}
async function render(tabs=false){
 const r=await send({type:'STATUS'}),s=r.state;
 if(tabs){for(const [id,test] of [['gpt',t=>t.url.includes('chatgpt.com/')],['site',t=>t.url.includes('chatgpt.site')]]){const el=$(id),old=el.value;el.replaceChildren(new Option('Choose a tab',''));for(const t of r.tabs.filter(test))el.add(new Option(t.title||t.url,String(t.id)));if([...el.options].some(o=>o.value===old))el.value=old;}}
 $('badge').textContent=s.armed?'Connected':'Stopped';$('arm').disabled=!!s.armed;$('auto').disabled=!!s.armed;$('gpt').disabled=!!s.armed;$('site').disabled=!!s.armed;$('tags').disabled=!!s.armed;
 $('name').textContent=s.call?.company||s.call?.name||'Waiting for verified contact';$('number').textContent=s.call?.number||'—';$('phase').textContent=s.call?.event||'—';
 $('status').textContent=s.armed?`Monitoring this embedded phone. ${s.pending.length} context update(s) waiting.`:'Not connected. No monitoring or writes are running.';
 if(s.error)$('error').textContent=s.error;
 for(const el of $('mapping').querySelectorAll('select'))el.disabled=!!s.armed;
 const writes=Object.entries(s.writes??{});const waiting=s.autoMark?s.ended.filter(c=>!s.writes[c.call_uuid]).map(c=>`${c.call_uuid}: ${c.contact_id?'Awaiting GPT outcome':'No contact ID; cannot mark'}`):[];
 $('writes').textContent=[...writes.map(([id,w])=>`${id}: ${w.state}${w.outcome?' · '+w.outcome:''}${w.result?.error?' · '+w.result.error:''}${w.error?' · '+w.error:''}`),...waiting].join('\n')||'No writes this session.';
}
$('refresh').onclick=()=>action(()=>render(true));
$('tags').onclick=()=>action(async()=>{if(!$('site').value)throw Error('Select CloudTalk Control first');const r=await send({type:'TAGS',siteTab:Number($('site').value)});$('mapping').replaceChildren();for(const outcome of OUTCOMES){const label=document.createElement('label');label.textContent=outcome.replaceAll('_',' ');const select=document.createElement('select');select.dataset.outcome=outcome;select.add(new Option('Note only',''));for(const tag of r.tags)select.add(new Option(tag,tag));label.append(select);$('mapping').append(label);}});
$('arm').onclick=()=>action(async()=>{if(!$('gpt').value||!$('site').value)throw Error('Choose both tabs');const tagMap={};for(const el of $('mapping').querySelectorAll('select'))if(el.value)tagMap[el.dataset.outcome]=el.value;await send({type:'ARM',gptTab:Number($('gpt').value),siteTab:Number($('site').value),autoMark:$('auto').checked,tagMap});});
$('stop').onclick=()=>action(()=>send({type:'STOP'}));$('retry').onclick=()=>action(()=>send({type:'RETRY_DELIVERY'}));
window.addEventListener('message',e=>{
 if(e.origin!==PHONE||e.source!==iframe.contentWindow)return;
 const event=parseEvent(e.data);if(!event)return;
 action(()=>send({type:'EVENT',data:event.event?e.data:null}));
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.bridge)render().catch(()=>{});});
render(true).catch(e=>{$('error').textContent=e.message;});
let retrying=false;
setInterval(async()=>{if(retrying)return;retrying=true;try{const {state:s}=await send({type:'STATUS'}),job=s.pending[0];if(s.armed&&job&&s.delivery[job.id]?.state==='blocked'&&(job.retries??0)<10)await send({type:'RETRY_DELIVERY',automatic:true});}catch{}finally{retrying=false;}},1500);

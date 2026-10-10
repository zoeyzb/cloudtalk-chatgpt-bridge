import {SITE,parseEvent,reduceCall,chatURL,contextMessage,validateOutcome} from './core.mjs';
const CONTROL=chrome.runtime.getURL('control.html');
let serial=Promise.resolve();let halted=new Set();let stopped=false;
chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const state=async()=>({armed:false,autoMark:false,call:null,pending:[],ended:[],delivery:{},writes:{},...(await chrome.storage.session.get('bridge')).bridge});
const save=bridge=>chrome.storage.session.set({bridge});
const controlSender=sender=>sender.url===CONTROL&&sender.id===chrome.runtime.id;
async function targetTab(id,url){const t=await chrome.tabs.get(id);if(url&&chatURL(t.url)!==url)throw Error('GPT chat changed. Reconnect the exact chat.');return t;}
async function siteRequest(s,operation,args={}){
 const t=await chrome.tabs.get(s.siteTab);if(new URL(t.url).origin!==SITE)throw Error('CloudTalk Control tab changed');
 const r=await chrome.tabs.sendMessage(s.siteTab,{type:'SITE_REQUEST',operation,args});
 if(!r?.ok)throw Error(r?.error||'Sign in to CloudTalk Control and refresh its tab');return r.data;
}
async function mute(s,muted){await targetTab(s.gptTab,s.gptURL);await chrome.tabs.update(s.gptTab,{muted});}
async function deliver(s){
 if(!s.armed||stopped||!s.pending.length)return s;
 const job=s.pending[0];if(s.delivery[job.id]?.state==='uncertain')throw Error('Delivery is uncertain. Check GPT; never resend automatically.');
 await targetTab(s.gptTab,s.gptURL);
 // Persist before submission so service-worker termination cannot duplicate it.
 s.delivery[job.id]={state:'uncertain'};await save(s);
 const ack=await chrome.tabs.sendMessage(s.gptTab,{type:'DELIVER',url:s.gptURL,id:job.id,text:job.text});
 if(ack?.ok){s.delivery[job.id]={state:'delivered'};s.pending.shift();s.error=null;
  if(job.event==='calling'&&s.call?.call_uuid===job.uuid&&!s.call.ended&&!halted.has(job.uuid)&&!stopped){await mute(s,false);}
 }else{if(ack?.submitted===false)s.delivery[job.id]={state:'blocked'};s.error=ack?.error||'Delivery acknowledgment missing; check GPT';}
 await save(s);if(ack?.ok&&s.pending.length&&!stopped)return deliver(s);return s;
}
async function handle(message,sender){
 let s=await state();
 if(controlSender(sender)){
  if(message.type==='STATUS'){const tabs=await chrome.tabs.query({});return {ok:true,state:s,tabs:tabs.filter(t=>chatURL(t.url)||t.url?.startsWith(SITE)).map(t=>({id:t.id,title:t.title,url:t.url}))};}
  if(message.type==='ARM'){
   if(s.armed)throw Error('Stop the bridge before changing its session');
   const t=await chrome.tabs.get(message.gptTab),url=chatURL(t.url);if(!url)throw Error('Choose an existing GPT conversation, not the home page');
   const site=await chrome.tabs.get(message.siteTab);if(new URL(site.url).origin!==SITE)throw Error('Choose the private CloudTalk Control tab');
   const probe=await chrome.tabs.sendMessage(t.id,{type:'PROBE',url});if(!probe?.ok)throw Error(probe?.error||'Refresh the GPT tab after installing the extension');
   s={armed:false,controlTab:sender.tab?.id,gptTab:t.id,gptURL:url,siteTab:site.id,originalMuted:!!t.mutedInfo?.muted,autoMark:message.autoMark===true,tagMap:{},call:null,pending:[],ended:[],delivery:{},writes:{},error:null};
   const tags=await siteRequest(s,'tags');
   if(!Array.isArray(tags))throw Error('CloudTalk tag catalog unavailable');
   for(const [outcome,name] of Object.entries(message.tagMap??{})){if(!['interested','demo_requested','follow_up_requested','not_interested','do_not_call','voicemail','no_answer','unknown'].includes(outcome)||typeof name!=='string'||!tags.includes(name))throw Error('Choose existing tags only');s.tagMap[outcome]=name;}
   await chrome.tabs.sendMessage(t.id,{type:'WATCH',url,enabled:s.autoMark});
   stopped=false;halted=new Set();s.armed=true;await mute(s,true);await save(s);return {ok:true};
  }
  if(message.type==='TAGS'){
   s.siteTab=message.siteTab;return {ok:true,tags:await siteRequest(s,'tags')};
  }
  if(message.type==='STOP'){
   if(s.gptTab){try{await chrome.tabs.sendMessage(s.gptTab,{type:'WATCH',url:s.gptURL,enabled:false});await mute(s,s.originalMuted??false);}catch{/* Navigated tabs are not touched. */}}
   stopped=true;await save({armed:false,call:null,pending:[],ended:[],delivery:{},writes:{}});return {ok:true};
  }
  if(message.type==='RETRY_DELIVERY'){
   const job=s.pending[0];if(job&&s.delivery[job.id]?.state==='uncertain')throw Error('Submission uncertain. Check GPT and stop/reconnect; no resend.');
   if(job&&message.automatic){if((job.retries??0)>=10)return {ok:true};job.retries=(job.retries??0)+1;await save(s);}
   return {ok:true,state:await deliver(s)};
  }
  if(message.type==='EVENT'){
   if(!s.armed)return {ok:true,ignored:true};
   const event=parseEvent(message.data),r=reduceCall(s.call,event);if(r.error)throw Error(r.error);if(r.duplicate)return {ok:true,ignored:true};
   s.call=r.call;
   // Only provider-confirmed answered lifecycle permits audio output.
   if(['dialing','ringing','hangup','ended'].includes(event.event))await mute(s,true);
   if(s.call.ended){s.ended=[...s.ended.filter(c=>c.call_uuid!==s.call.call_uuid),{...s.call,ended_at:Date.now()}].slice(-8);}
   if(event.event!=='hangup'){
    if(!s.call.number)throw Error('CloudTalk did not provide an international number. Audio remains muted.');
    if(s.pending.length>=20)throw Error('GPT delivery queue is full. Stop and inspect.');
    const id=crypto.randomUUID();s.pending.push({id,event:event.event,uuid:s.call.call_uuid,text:contextMessage(s.call,s.autoMark)+'\nDelivery ID: '+id});
   }
   await save(s);await deliver(s);return {ok:true};
  }
 }
 // Outcome text comes only from the selected GPT tab, never window messages.
 if(message.type==='OUTCOME'&&s.armed&&s.autoMark&&sender.id===chrome.runtime.id&&sender.tab?.id===s.gptTab&&chatURL(sender.url)===s.gptURL){
  const c=s.ended.find(c=>c.call_uuid===message.data?.call_uuid&&Date.now()-c.ended_at<15*60*1000);
  const outcome=validateOutcome(message.data,c);if(!outcome||!c.contact_id||!c.number)throw Error('No verified ended contact for outcome');
  if(s.writes[c.call_uuid])return {ok:true,ignored:true};
  s.writes[c.call_uuid]={state:'pending',outcome:outcome.outcome};await save(s);
  try{
   const result=await siteRequest(s,'mark',{contact_id:c.contact_id,expected_phone_number:c.number,call_uuid:c.call_uuid,note:outcome.note,outcome:outcome.outcome,tag:s.tagMap[outcome.outcome]??null,write_authorized:true});
   s.writes[c.call_uuid]={state:result.ok?'saved':'failed',outcome:outcome.outcome,result};
  }catch(e){s.writes[c.call_uuid]={state:'uncertain',outcome:outcome.outcome,error:e.message};}
  await save(s);return {ok:true};
 }
 throw Error('Unapproved extension request');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 // Mute terminal events immediately, even while a previous UI submission is
 // waiting for its acknowledgment. Serialized state still validates them.
 if(controlSender(sender)){
  const e=message.type==='EVENT'?parseEvent(message.data):null;
  if(message.type==='STOP'||(e&&['hangup','ended'].includes(e.event))){
   if(message.type==='STOP')stopped=true;else halted.add(e.call_uuid);
   state().then(s=>{if(s.armed)return mute(s,true);}).catch(()=>{});
  }
 }
 const job=serial.then(()=>handle(message,sender));serial=job.catch(()=>{});
 job.then(reply).catch(async e=>{const s=await state();s.error=e.message;if(s.armed)try{await mute(s,true);}catch{}await save(s);reply({ok:false,error:e.message});});return true;
});
chrome.action.onClicked.addListener(async()=>{const tabs=await chrome.tabs.query({url:CONTROL});if(tabs[0])await chrome.tabs.update(tabs[0].id,{active:true});else await chrome.tabs.create({url:CONTROL});});
chrome.tabs.onRemoved.addListener(id=>{serial=serial.then(async()=>{const s=await state();if(s.armed&&[s.gptTab,s.siteTab,s.controlTab].includes(id)){try{await mute(s,true);}catch{}s.armed=false;s.error='A connected tab closed. Reconnect the bridge.';await save(s);}}).catch(()=>{});});

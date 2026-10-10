import {test} from 'node:test';import assert from 'node:assert/strict';
const uuid='12345678-1234-1234-1234-123456789abc';
let listener,removed,stored={},sent=[],muted=[],delivery='ok',write='ok',hold=null;
const tabs={1:{id:1,url:'https://chatgpt.com/c/test-chat',mutedInfo:{muted:false}},2:{id:2,url:'https://cloudtalk-control.zzoey9979.chatgpt.site'}};
global.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:fn=>listener=fn}},storage:{session:{setAccessLevel:async()=>{},get:async()=>structuredClone(stored),set:async value=>{stored=structuredClone(value);}}},tabs:{get:async id=>tabs[id],update:async(id,changes)=>{if('muted' in changes)muted.push(changes.muted);return tabs[id];},query:async()=>Object.values(tabs),sendMessage:async(id,m)=>{sent.push({id,m});if(['PROBE','WATCH'].includes(m.type))return {ok:true};if(m.type==='DELIVER'){if(hold)await hold;return delivery==='ok'?{ok:true}:{ok:false,submitted:delivery==='uncertain',error:delivery};}if(m.operation==='tags')return {ok:true,data:['Existing']};if(m.operation==='mark')return write==='ok'?{ok:true,data:{ok:true,note_saved:true,tag_saved:true}}:{ok:false,error:'timeout'};},onRemoved:{addListener:fn=>removed=fn}},action:{onClicked:{addListener:()=>{}}}};
await import('../background.mjs');
const control={id:'test',url:'chrome-extension://test/control.html'};
const send=(m,s=control)=>new Promise(r=>listener(m,s,r));
const event=kind=>({type:'EVENT',data:{event:kind,properties:{call_uuid:uuid,external_number:'+13125551234',contact:{id:12,name:'Test'}}}});
const arm=()=>send({type:'ARM',gptTab:1,siteTab:2,autoMark:true,tagMap:{unknown:'Existing'}});
test('full mocked event to GPT to contact mark path',async()=>{
 assert.equal((await arm()).ok,true);assert.equal(muted.at(-1),true);
 await send(event('dialing'));await send(event('calling'));assert.equal(muted.at(-1),false);
 await send(event('ended'));assert.equal(muted.at(-1),true);
 const outcome={type:'OUTCOME',data:{call_uuid:uuid,outcome:'unknown',note:'Test only'}};
 assert.equal((await send(outcome,{id:'test',url:tabs[1].url,tab:{id:1}})).ok,true);
 assert.equal(stored.bridge.writes[uuid].state,'saved');
 await send(outcome,{id:'test',url:tabs[1].url,tab:{id:1}});assert.equal(sent.filter(x=>x.m.operation==='mark').length,1);
 const mark=sent.find(x=>x.m.operation==='mark').m.args;assert.equal(mark.contact_id,12);assert.equal(mark.expected_phone_number,'+13125551234');assert.equal(mark.tag,'Existing');
 assert.equal((await send(outcome,{id:'test',url:'https://evil.test',tab:{id:9}})).ok,false);
 await send({type:'STOP'});assert.equal(muted.at(-1),false);
});
test('uncertain submission never retries',async()=>{
 delivery='uncertain';sent=[];await arm();await send(event('dialing'));const before=sent.filter(x=>x.m.type==='DELIVER').length;
 assert.equal((await send({type:'RETRY_DELIVERY'})).ok,false);assert.equal(sent.filter(x=>x.m.type==='DELIVER').length,before);await send({type:'STOP'});delivery='ok';
});
test('navigation blocks sending to a different GPT chat',async()=>{
 await arm();tabs[1].url='https://chatgpt.com/c/different-chat';sent=[];
 assert.equal((await send(event('dialing'))).ok,false);assert.equal(sent.length,0);
 tabs[1].url='https://chatgpt.com/c/test-chat';await send({type:'STOP'});
});
test('hangup mutes immediately during an in-flight answered delivery',async()=>{
 await arm();await send(event('dialing'));let release;hold=new Promise(r=>release=r);
 const answer=send(event('calling'));await new Promise(r=>setTimeout(r,10));const end=send(event('ended'));await new Promise(r=>setTimeout(r,10));assert.equal(muted.at(-1),true);
 release();hold=null;await answer;await end;assert.equal(muted.at(-1),true);await send({type:'STOP'});
});
test('uncertain contact write remains visible and is never duplicated',async()=>{
 await arm();await send(event('dialing'));await send(event('calling'));await send(event('ended'));write='timeout';sent=[];
 const m={type:'OUTCOME',data:{call_uuid:uuid,outcome:'unknown',note:'Test only'}};const sender={id:'test',url:tabs[1].url,tab:{id:1}};
 await send(m,sender);await send(m,sender);assert.equal(stored.bridge.writes[uuid].state,'uncertain');assert.equal(sent.filter(x=>x.m.operation==='mark').length,1);await send({type:'STOP'});
});

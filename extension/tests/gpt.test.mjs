import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../gpt.js',import.meta.url),'utf8');
function environment({draft='',navigate=false,ack=true}={}){
 let listeners=[],clicked=0,inserted=0;
 const editor={tagName:'DIV',innerText:draft,getClientRects:()=>[1],getAttribute:key=>key==='aria-label'?'Ask ChatGPT':null,focus(){},dispatchEvent(){}};
 const send={disabled:false,getClientRects:()=>[1],getAttribute:k=>k==='aria-label'?'Send':null,click(){clicked++;editor.innerText='';}};
 const doc={body:{},execCommand:(_,__,text)=>{inserted++;editor.innerText=text;return true;},querySelectorAll:selector=>selector.includes('contenteditable')?[editor]:selector==='button'?[send]:selector.includes('data-user-message')&&ack?[{textContent:'Delivery ID: test-id'}]:[]};
 const context={window:null,document:doc,location:{origin:'https://chatgpt.com',pathname:navigate?'/c/other':'/c/test'},chrome:{runtime:{id:'test',onMessage:{addListener:f=>listeners.push(f)},sendMessage:async()=>({ok:true})}},MutationObserver:class{observe(){}},setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},Event:class{},InputEvent:class{},URL};context.window={top:null};context.window.top=context.window;
 vm.runInNewContext(source,context);
 return {send:m=>new Promise(r=>listeners.forEach(f=>f(m,{id:'test'},r))),clicked:()=>clicked,inserted:()=>inserted,editor};
}
const message={type:'DELIVER',url:'https://chatgpt.com/c/test',id:'test-id',text:'Test context\nDelivery ID: test-id'};
test('actual observed GPT selectors, transcript acknowledgment and deduplication',async()=>{const e=environment();assert.equal((await e.send(message)).ok,true);assert.equal(e.clicked(),1);assert.equal((await e.send(message)).ok,true);assert.equal(e.clicked(),1);});
test('human drafts and changed conversations are untouched',async()=>{const d=environment({draft:'Human draft'});assert.equal((await d.send(message)).submitted,false);assert.equal(d.editor.innerText,'Human draft');assert.equal(d.inserted(),0);const n=environment({navigate:true});assert.equal((await n.send(message)).submitted,false);assert.equal(n.clicked(),0);});
test('missing transcript acknowledgment reports uncertainty',async()=>{const e=environment({ack:false});const result=await e.send(message);assert.equal(result.ok,false);assert.equal(result.submitted,true);assert.equal(e.clicked(),1);});

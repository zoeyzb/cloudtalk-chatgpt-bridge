(() => {
 if(window.top!==window)return;
 const sameChat=url=>{try{const u=new URL(url);return location.origin+location.pathname===u.origin+u.pathname;}catch{return false;}};
 const visible=e=>!!e?.getClientRects().length;
 const composer=()=>Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"],textarea')).find(e=>visible(e)&&['Type','Ask ChatGPT'].includes(e.getAttribute('aria-label')));
 const button=name=>Array.from(document.querySelectorAll('button')).find(e=>visible(e)&&e.getAttribute('aria-label')===name);
 const value=e=>e.tagName==='TEXTAREA'?e.value:e.innerText;
 const seen=new Set();let busy=false;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function acknowledged(id){return Array.from(document.querySelectorAll('[data-message-author-role="user"],[data-user-message-bubble="true"]')).some(e=>e.textContent.includes('Delivery ID: '+id));}
 async function deliver(m){
  if(!sameChat(m.url))return {ok:false,submitted:false,error:'Selected GPT conversation changed'};
  if(seen.has(m.id))return {ok:true};
  if(busy)return {ok:false,submitted:false,error:'Another context update is still being submitted'};
  const e=composer();if(!e)return {ok:false,submitted:false,error:'GPT composer unavailable. Use Voice with its text composer visible.'};
  if(value(e).trim()&&value(e).trim()!==m.text?.trim())return {ok:false,submitted:false,error:'GPT has an unsent human draft. Send or clear it yourself.'};
  if(button('Cancel loading')||button('Loading voice'))return {ok:false,submitted:false,error:'GPT Voice is still loading'};
  if(typeof m.text!=='string'||m.text.length>7000||typeof m.id!=='string')return {ok:false,submitted:false,error:'Invalid context message'};
  busy=true;let submitted=false;
  try{
   e.focus();
   if(value(e).trim()===m.text.trim()){
    // Resume only this exact bridge draft after a pre-submit block.
   }else if(e.tagName==='TEXTAREA'){
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,m.text);
    e.dispatchEvent(new Event('input',{bubbles:true}));
   }else{
    // Use the editing command so the editor's own input handlers receive it.
    const inserted=document.execCommand('insertText',false,m.text);
    if(!inserted)return {ok:false,submitted:false,error:'GPT editor rejected insertion'};
    e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:m.text}));
   }
   if(value(e).trim()!==m.text.trim())return {ok:false,submitted:false,error:'Inserted context did not match; inspect the draft'};
   let send;
   for(let i=0;i<10;i++){send=button('Send')||button('Send prompt');if(send&&!send.disabled)break;await sleep(100);}
   if(!send||send.disabled)return {ok:false,submitted:false,error:'GPT Send button unavailable. Context remains as a draft.'};
   if(!sameChat(m.url))return {ok:false,submitted:false,error:'Chat changed before submission'};
   submitted=true;send.click();
   for(let i=0;i<30;i++){if(acknowledged(m.id)){seen.add(m.id);return {ok:true};}await sleep(100);}
   return {ok:false,submitted:true,error:'Submission was attempted but transcript acknowledgment is missing. Check GPT; no automatic retry.'};
  }catch{return {ok:false,submitted,error:'GPT context delivery failed; check the conversation'};}finally{busy=false;}
 }
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(m.type==='PROBE'){reply({ok:sameChat(m.url)&&!!composer()&&!button('Cancel loading'),error:'Open the existing GPT chat with its text composer visible; finish Voice loading first'});return;}
  if(m.type==='DELIVER'){deliver(m).then(reply);return true;}
 });
 // Capture only bounded JSON outcome blocks from assistant messages. Never
 // evaluate page text, arbitrary tool arguments, links, or instructions.
 const sent=new Set();let timer;let watchURL=null;
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id===chrome.runtime.id&&m.type==='WATCH'){watchURL=m.enabled&&sameChat(m.url)?m.url:null;sent.clear();reply({ok:true});}});
 function inspect(){
  if(!watchURL||!sameChat(watchURL))return;
  const blocks=document.querySelectorAll('[data-message-author-role="assistant"] pre code,[data-markdown-text-style="assistant-message"] pre code');
  for(const block of Array.from(blocks).slice(-3)){
   const text=block.textContent;if(text.length>4500||sent.has(text))continue;
   let data;try{data=JSON.parse(text);}catch{continue;}
   if(!data||Object.keys(data).some(k=>!['call_uuid','outcome','note'].includes(k))||typeof data.call_uuid!=='string'||typeof data.outcome!=='string'||typeof data.note!=='string')continue;
   sent.add(text);chrome.runtime.sendMessage({type:'OUTCOME',data}).catch(()=>{});
  }
 }
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inspect,300);}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();

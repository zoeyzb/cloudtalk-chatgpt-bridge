(() => {
 if(window.top!==window)return;
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||message.type!=='SITE_REQUEST')return;
  (async()=>{try{
   const r=await fetch('/api/contact-bridge',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-sierra-bridge':'1'},body:JSON.stringify({operation:message.operation,args:message.args}),signal:AbortSignal.timeout(25000)});
   if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('Sign in to CloudTalk Control');
   const body=await r.json();if(!r.ok||(body.error&&body.ok===undefined))throw Error(body.error||'Private bridge request failed');reply({ok:true,data:body});
  }catch(e){reply({ok:false,error:e.message});}})();return true;
 });
})();

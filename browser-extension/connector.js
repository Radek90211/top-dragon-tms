(() => {
  if(globalThis.__tdConnector)return;globalThis.__tdConnector=true;
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='td-assistant-call')return;
    const requestId=crypto.randomUUID();
    const listener=event=>{
      if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='td-assistant-response'||event.data.requestId!==requestId)return;
      clearTimeout(timer);window.removeEventListener('message',listener);respond(event.data.result);
    };
    const timer=setTimeout(()=>{window.removeEventListener('message',listener);respond({ok:false,message:'TOP DRAGON nie odpowiedział. Odśwież jego kartę i zaloguj się.'});},20000);
    window.addEventListener('message',listener);
    window.postMessage({channel:'td-assistant-request',requestId,action:message.action,payload:message.payload||{}},location.origin);
    return true;
  });
})();

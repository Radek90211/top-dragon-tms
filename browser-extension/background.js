const TMS='https://topdragon.dyspiqon.pl';
chrome.runtime.onInstalled.addListener(()=>{chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  // Dane planu/negocjacji są dostępne wyłącznie dla własnego panelu dodatku.
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('sidepanel.html'))return;
  if(!['context','shared','save'].includes(message?.action))return;
  (async()=>{
    const tabs=await chrome.tabs.query({url:TMS+'/*'});
    if(!tabs.length)return {ok:false,message:'Otwórz TOP DRAGON i zaloguj się w tej samej przeglądarce.'};
    const requested=Number(message.tmsTabId);
    const tab=requested?tabs.find(tab=>tab.id===requested):tabs.length===1?tabs[0]:null;
    if(!tab)return {ok:false,message:'Wybierz kartę TOP DRAGON.',tabs:tabs.map(t=>({id:t.id,title:t.title}))};
    return chrome.tabs.sendMessage(tab.id,{type:'td-assistant-call',action:message.action,payload:message.payload});
  })().then(respond).catch(()=>respond({ok:false,message:'Odśwież kartę TOP DRAGON po zainstalowaniu dodatku.'}));
  return true;
});

// Bez zapytań i analizy planu do chwili jawnego połączenia dodatku.
export function installExchangeAssistant({supabase,getProfile,getUser,getFrame,loadClients}) {
  let pending=0;
  const planScripts=new WeakMap();
  async function readPlan(offer){
    const frame=getFrame();
    if(!frame?.contentWindow||!frame.contentDocument)throw new Error('Otwórz plan kierowców TOP DRAGON.');
    const doc=frame.contentDocument;
    if(!planScripts.has(doc))planScripts.set(doc,new Promise((resolve,reject)=>{
      const script=doc.createElement('script');script.src='/tms-assistant-plan.js?build=assistant-0.1.0';
      script.onload=resolve;script.onerror=()=>{planScripts.delete(doc);reject(new Error('Nie udało się wczytać analizy planu.'));};doc.head.appendChild(script);
    }));
    await planScripts.get(doc);
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const listener=event=>{
        if(event.source!==frame.contentWindow||event.origin!==window.location.origin||event.data?.type!=='td-assistant-plan-result'||event.data.requestId!==requestId)return;
        clearTimeout(timer);window.removeEventListener('message',listener);
        event.data.ok?resolve(event.data.data):reject(new Error(event.data.message||'Brak danych planu.'));
      };
      const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('Plan nie odpowiedział. Spróbuj ponownie po zakończeniu ładowania.'));},14000);
      window.addEventListener('message',listener);
      frame.contentWindow.postMessage({type:'td-assistant-plan-request',requestId,offer},window.location.origin);
    });
  }
  async function execute(action,payload){
    const profile=getProfile(),user=getUser();
    const {data:{session}}=await supabase.auth.getSession();
    if(!profile?.active||!user?.id||session?.user?.id!==user.id)throw new Error('Zaloguj się do TOP DRAGON.');
    if(action==='context'){
      const [plan,clients,branches]=await Promise.all([readPlan(payload.offer||{}),loadClients(),supabase.from('branches').select('id,name').order('name')]);
      if(branches.error)throw branches.error;
      if(getUser()?.id!==user.id||getProfile()!==profile)throw new Error('Sesja została zmieniona. Połącz ponownie.');
      return {...plan,actor:{id:user.id,name:profile.display_name||'Spedytor',role:profile.role,branchId:profile.branch_id||''},branches:branches.data||[],clients:clients.map(row=>({id:row.id,client:row.payload.name||'',nip:row.payload.nip||'',transId:row.payload.transId||'',dispatcher:[row.payload.dispatcher,...(Array.isArray(row.payload.dispatchers)?row.payload.dispatchers:[])].filter(Boolean).join(', ')}))};
    }
    let result;
    if(action==='shared')result=await supabase.rpc('list_tms_exchange_records',{p_branch_id:payload.branchId});
    else if(action==='save'){
      if(!['offer','client'].includes(payload.kind)||!['write','claim','release'].includes(payload.action)||!Number.isInteger(payload.version)||payload.version<0)throw new Error('Nieprawidłowe dane zapisu.');
      result=await supabase.rpc('save_tms_exchange_record',{p_branch_id:payload.branchId,p_kind:payload.kind,p_key:String(payload.key||'').slice(0,180),p_payload:payload.payload,p_version:payload.version,p_action:payload.action});
    }
    if(result.error){
      if(/PGRST202|PGRST205|42883|42P01/.test(String(result.error.code)))throw new Error('Połączono z planem. Zapis zespołowy wymaga migracji 035_exchange_assistant.sql w Supabase. Kalkulacje i zapis lokalny są dostępne.');
      throw new Error(result.error.message||'Nie udało się zapisać danych zespołu.');
    }
    if(getUser()?.id!==user.id||getProfile()!==profile)throw new Error('Sesja została zmieniona. Połącz ponownie.');
    return action==='shared'?{rows:result.data||[]}:result.data;
  }
  window.addEventListener('message',async event=>{
    const msg=event.data;
    if(event.source!==window||event.origin!==window.location.origin||msg?.channel!=='td-assistant-request'||!['context','shared','save'].includes(msg.action)||!/^[-a-f0-9]{36}$/i.test(msg.requestId||''))return;
    const respond=result=>window.postMessage({channel:'td-assistant-response',requestId:msg.requestId,result},window.location.origin);
    if(pending>=3||JSON.stringify(msg).length>25000){respond({ok:false,message:'Zbyt wiele żądań lub zbyt duża wiadomość.'});return;}
    pending++;
    try{respond({ok:true,data:await execute(msg.action,msg.payload||{})});}catch(error){respond({ok:false,message:error.message||'Nie udało się połączyć.'});}finally{pending--;}
  });
}

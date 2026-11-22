(() => {
  if(window.__tdAssistantPlan)return;window.__tdAssistantPlan=true;
  function coords(value){return value&&routeSwapValidPoint(value)?[Number(value.lat),Number(value.lng)]:null;}
  function time(date,hour){const result=new Date(String(date||'')+'T00:00:00');result.setTime(result.getTime()+Number(hour)*3600000);return result.getTime();}
  window.addEventListener('message',async event=>{
    if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='td-assistant-plan-request')return;
    const requestId=event.data.requestId;
    const respond=value=>window.parent.postMessage({type:'td-assistant-plan-result',requestId,...value},location.origin);
    try{
      if(!state.user||state.boardStartupV188?.active)throw new Error('Zaczekaj na wczytanie planu kierowców.');
      const offer=event.data.offer||{},sample=Boolean(offer.examples);
      if(sample&&!isAdminUser())throw new Error('Plan przykładowy jest dostępny dla administratora.');
      const at=Date.parse(offer.start)||Date.now(),until=Math.max(at,Date.parse(offer.end)||at);
      const byDriver=new Map(),previous=new Map(),next=new Map(),history=[];
      for(const route of activeRoutes()){
        if(!route||route.futureQueue||isFreeDayRoute(route)||route.approvalStatus==='rejected'||Boolean(route.sampleRelationV167)!==sample)continue;
        const start=time(route.date,routeStartHour(route));let end=time(routeEndDate(route),routeEndHour(route));
        if(!Number.isFinite(start)||!Number.isFinite(end))continue;
        if(end<=start)end=start+3600000;
        if(end<=at){const last=previous.get(route.driverId);if(!last||end>last.end)previous.set(route.driverId,{route,start,end});}
        else if(start>=until){const following=next.get(route.driverId);if(!following||start<following.start)next.set(route.driverId,{route,start,end});}
        else {const list=byDriver.get(route.driverId)||[];list.push({route,start,end});byDriver.set(route.driverId,list);}
        if(route.client||route.clientId)history.push({clientId:route.clientId||'',client:route.client||'',date:route.date,load:route.load,unload:route.unload,price:route.price??route.rate??'',currency:route.currency||''});
      }
      const drivers=operationalDrivers().map(driver=>({id:driver.id,name:driver.driver,dispatcher:driver.dispatcher||'',basePoint:coords(driverBasePoint(driver)),maxHeight:maxLoadHeightForDriver(driver),nationality:driver.nationality||'',brand:driver.vehicleBrand||''}));
      const routes=[];
      for(const driver of drivers){
        const list=byDriver.get(driver.id)||[];const last=previous.get(driver.id),following=next.get(driver.id);if(last)list.push(last);if(following)list.push(following);
        for(const item of list){const r=item.route;routes.push({id:r.id,driverId:driver.id,start:item.start,end:item.end,label:`${r.load||''} → ${r.unload||''}`,loadPoint:coords(operationalPointForRoute(r,'load')),unloadPoint:coords(finalUnloadPointForRoute(r))});}
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      respond({ok:true,data:{drivers,routes,history:history.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3000),offerPoints:{load:coords(operationalPointForRoute({load:offer.load||''},'load')),unload:coords(operationalPointForRoute({unload:offer.unload||''},'unload'))},sample,asOf:new Date().toISOString()}});
    }catch(error){respond({ok:false,message:error.message||'Nie udało się odczytać planu.'});}
  });
})();

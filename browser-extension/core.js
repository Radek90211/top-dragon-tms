export const STATUSES = {new:'Nowa',checked:'Sprawdzone',negotiating:'Negocjacje',waiting:'Czekamy na odpowiedź',low:'Za niska stawka',accepted:'Przyjęte',rejected:'Odrzucone'};
export const TAGS = {normal:'Standard',favorite:'Stały klient',prospect:'Pozyskać klienta',caution:'Sprawdź warunki'};
export function number(value) {
  if (value === '' || value == null) return null;
  if (!String(value).trim()) return null;
  const n=Number(String(value).replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(n) && n>=0 ? n : null;
}
export function point(value) {
  if (!Array.isArray(value)||value.length!==2||value.some(v=>v==null||v==='')) return null;
  const [lat,lng]=value.map(Number);
  return Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180?[lat,lng]:null;
}
export function estimateKm(a,b) {
  a=point(a);b=point(b);if(!a||!b)return null;
  const rad=n=>n*Math.PI/180;
  const h=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;
  const km=6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
  return km*(km>=350?1.12:km>=180?1.16:km>=80?1.22:1.30);
}
export function clientKey({nip='',transId='',client=''}) {
  const tax=String(nip).replace(/[^a-z0-9]/gi,'').toUpperCase();
  if(tax)return 'nip:'+tax;
  if(String(transId).trim())return 'trans:'+String(transId).trim();
  return String(client).trim()?'name:'+String(client).trim().toLocaleLowerCase('pl'):'';
}
export function offerKey(offer) {
  if(String(offer.offerId||'').trim())return 'id:'+String(offer.offerId).trim();
  return '';
}
export function profitability(values) {
  const loaded=number(values.loadedKm),approach=number(values.approachKm),after=number(values.afterKm),revenue=number(values.revenue);
  if([loaded,approach,after,revenue].some(n=>n===null))return {error:'Uzupełnij cenę oraz wszystkie trzy odległości. Dla braku dojazdu wpisz 0.'};
  const totalKm=loaded+approach+after;
  if(!totalKm)return {error:'Łączna odległość musi być większa od 0.'};
  const mode=values.mode==='broker'?'broker':'fleet';
  let costs;
  if(mode==='broker') {
    const carrier=number(values.carrierPrice),extras=number(values.extras);
    if(carrier===null||extras===null)return {error:'Podaj cenę przewoźnika oraz pozostałe koszty.'};
    costs=carrier+extras;
  }else{
    const perKm=number(values.costPerKm),tolls=number(values.tolls),extras=number(values.extras);
    if([perKm,tolls,extras].some(n=>n===null))return {error:'Podaj pełny koszt/km, opłaty drogowe i pozostałe koszty.'};
    costs=totalKm*perKm+tolls+extras;
  }
  return {totalKm,costs,result:revenue-costs,perKm:revenue/totalKm,margin:revenue?(revenue-costs)/revenue*100:null};
}
export function matchDrivers(offer,snapshot) {
  const start=Date.parse(offer.start),end=Date.parse(offer.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {error:'Podaj datę i godzinę załadunku oraz rozładunku.'};
  const load=point(offer.loadPoint),unload=point(offer.unloadPoint);
  if(!load||!unload)return {error:'Brak współrzędnych. Podaj je lub połącz panel z TOP DRAGON, aby rozpoznać miejscowości.'};
  const rows=[];
  for(const driver of snapshot.drivers||[]) {
    const plan=(snapshot.routes||[]).filter(r=>r.driverId===driver.id).sort((a,b)=>a.start-b.start);
    if(plan.some(r=>r.start<end&&r.end>start))continue;
    const height=number(offer.height);
    if(height && (!driver.maxHeight || height>driver.maxHeight))continue;
    if(offer.polish && !['PL','POLSKA','POLSKI','POLAK'].includes(String(driver.nationality||'').toUpperCase()))continue;
    if(offer.noVolvo&&/volvo/i.test(driver.brand||''))continue;
    const previous=plan.filter(r=>r.end<=start).sort((a,b)=>b.end-a.end)[0];
    const next=plan.find(r=>r.start>=end);
    const origin=previous?previous.unloadPoint:driver.basePoint;
    const approach=estimateKm(origin,load),after=next?estimateKm(unload,next.loadPoint):0;
    const oldNext=next?estimateKm(origin,next.loadPoint):0;
    if(approach===null||after===null||oldNext===null)continue;
    const speed=number(offer.speed)||60;
    const beforeGap=previous?(start-previous.end)/3600000:null,afterGap=next?(next.start-end)/3600000:null;
    const warnings=[];
    if(beforeGap!==null&&approach/speed>beforeGap)warnings.push('Za mało czasu na dojazd do załadunku');
    if(afterGap!==null&&after/speed>afterGap)warnings.push('Za mało czasu na dojazd do następnej relacji');
    rows.push({driverId:driver.id,name:driver.name,dispatcher:driver.dispatcher,approachKm:approach,afterKm:after,deltaEmptyKm:approach+after-oldNext,
      previous:previous?.label||'Baza kierowcy — brak wcześniejszej relacji',next:next?.label||'Brak kolejnej zaplanowanej relacji',warnings});
  }
  return {rows:rows.sort((a,b)=>a.warnings.length-b.warnings.length||a.deltaEmptyKm-b.deltaEmptyKm).slice(0,12)};
}
export function parseText(text) {
  const result={};
  const route=String(text).match(/([^\n;]+?)\s*(?:→|->|–>)\s*([^\n;]+)/);
  if(route){result.load=route[1].trim();result.unload=route[2].trim();}
  const dates=[...String(text).matchAll(/\b(\d{2})\.(\d{2})\.(\d{4})[ T]+([01]\d|2[0-3]):([0-5]\d)\b/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`);
  if(dates[0])result.start=dates[0];
  if(dates[1])result.end=dates[1];
  const price=String(text).match(/\b(\d+(?:[,.]\d{1,2})?)\s*(EUR|PLN|€|zł)\b/i);
  if(price){result.revenue=price[1];result.currency=/EUR|€/i.test(price[2])?'EUR':'PLN';}
  return result;
}

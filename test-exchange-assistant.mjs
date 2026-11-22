import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {number,point,estimateKm,profitability,matchDrivers,clientKey,offerKey,parseText} from './browser-extension/core.js';
import {installExchangeAssistant} from './src/exchange-assistant.js';

assert.equal(number('1 234,50'),1234.5);
for(const value of ['',null,'  ','x',Infinity,-1])assert.equal(number(value),null);
assert.equal(point(['','']),null);assert.equal(point([91,1]),null);
assert.equal(estimateKm([52,21],[52,21]),0);
assert.ok(estimateKm([52.2297,21.0122],[51.7592,19.456])>120);
const fleet=profitability({mode:'fleet',loadedKm:300,approachKm:50,afterKm:50,revenue:1000,costPerKm:1.5,tolls:50,extras:20});
assert.equal(fleet.totalKm,400);assert.equal(fleet.costs,670);assert.equal(fleet.result,330);assert.equal(fleet.perKm,2.5);assert.equal(fleet.margin,33);
assert.equal(profitability({mode:'broker',loadedKm:300,approachKm:50,afterKm:50,revenue:1000,carrierPrice:850,extras:20}).result,130);
assert.ok(profitability({loadedKm:1,approachKm:'',afterKm:0,revenue:10}).error);
assert.ok(profitability({loadedKm:0,approachKm:0,afterKm:0,revenue:10}).error);
assert.equal(clientKey({nip:'PL 123-456',client:'A'}),'nip:PL123456');
assert.notEqual(clientKey({nip:'PL123',client:'A'}),clientKey({nip:'DE123',client:'A'}));
assert.equal(offerKey({offerId:' 123 '}),'id:123');assert.equal(offerKey({load:'A',unload:'B'}),'');
assert.equal(parseText('Warszawa → Łódź\n900 eur').currency,'EUR');
assert.equal(parseText('24.11.2026').start,undefined,'Nie zgaduj brakującej godziny');
assert.equal(parseText('24.11.2026 10:30\n25.11.2026 14:00').end,'2026-11-25T14:00');

const start=Date.parse('2026-11-24T10:00:00Z'),end=start+4*3600000;
const offer={start:new Date(start).toISOString(),end:new Date(end).toISOString(),loadPoint:[52,21],unloadPoint:[52,20],height:2};
const driver={id:'a',name:'Test',basePoint:[52,20],maxHeight:3,nationality:'PL',brand:'DAF'};
const plan={drivers:[driver],routes:[{driverId:'a',start:start-7200000,end:start-3600000,unloadPoint:[52,20],label:'Poprzednia'},{driverId:'a',start:end+7200000,end:end+10800000,loadPoint:[52,20],label:'Następna'}]};
const matching=matchDrivers(offer,plan).rows[0];
assert.ok(matching.approachKm>49);assert.equal(matching.afterKm,0);
assert.equal(matching.deltaEmptyKm,matching.approachKm,'Uwzględnij poprzednią i następną relację');
assert.equal(matching.next,'Następna');
assert.equal(matchDrivers({...offer,height:4},plan).rows.length,0);
assert.equal(matchDrivers({...offer,noVolvo:true},{drivers:[{...driver,brand:'Volvo'}],routes:[]}).rows.length,0);
assert.equal(matchDrivers(offer,{...plan,routes:[...plan.routes,{driverId:'a',start,end}]}).rows.length,0);
assert.equal(matchDrivers(offer,{...plan,routes:[{...plan.routes[0],unloadPoint:null}]}).rows.length,0,'Nie zastępuj nieznanego poprzedniego rozładunku bazą');
const returning=matchDrivers({...offer,unloadPoint:[52,21]},plan).rows[0];
assert.ok(returning.deltaEmptyKm>matching.deltaEmptyKm,'Dolicz powrót do kolejnej relacji');

// Gwarancje komunikacji bez udostępniania sesji rozszerzeniu.
let listener,calls=0;const replies=[];
const priorWindow=globalThis.window;
globalThis.window={location:{origin:'https://topdragon.dyspiqon.pl'},addEventListener(type,fn){listener=fn;},postMessage(msg){replies.push(msg);}};
let user=null,profile=null;
const supabase={auth:{async getSession(){return {data:{session:user?{user}:null}};}},async rpc(name,args){calls++;return {data:[],error:{code:'PGRST202'}};}};
installExchangeAssistant({supabase,getProfile:()=>profile,getUser:()=>user,getFrame:()=>null,loadClients:async()=>[]});
const request={channel:'td-assistant-request',requestId:'00000000-0000-4000-8000-000000000000',action:'shared',payload:{branchId:'x'}};
await listener({source:{},origin:window.location.origin,data:request});assert.equal(replies.length,0,'Odrzuć inną ramkę');
await listener({source:window,origin:'https://platform.trans.eu',data:request});assert.equal(replies.length,0,'Odrzuć obcą domenę');
await listener({source:window,origin:window.location.origin,data:request});assert.equal(replies.at(-1).result.ok,false);assert.equal(calls,0);
user={id:'user-1'};profile={active:true,role:'dispatcher'};
await listener({source:window,origin:window.location.origin,data:request});assert.match(replies.at(-1).result.message,/035_exchange_assistant/);
assert.equal(JSON.stringify(replies).includes('access_token'),false);
globalThis.window=priorWindow;

// Service worker nie akceptuje poleceń danych z kart Trans.eu ani innych rozszerzeń.
let workerListener;
const chrome={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onInstalled:{addListener(){}},onMessage:{addListener(fn){workerListener=fn;}}},sidePanel:{},tabs:{query:async()=>[]}};
vm.runInNewContext(fs.readFileSync('browser-extension/background.js','utf8'),{chrome,URL});
let workerResponse;
assert.equal(workerListener({action:'shared'},{id:'test',url:'https://platform.trans.eu/'},()=>{throw Error('Unexpected response');}),undefined);
assert.equal(workerListener({action:'shared'},{id:'other',url:'chrome-extension://test/sidepanel.html'},()=>{}),undefined);
workerListener({action:'shared'},{id:'test',url:'chrome-extension://test/sidepanel.html'},r=>{workerResponse=r;});
await new Promise(resolve=>setImmediate(resolve));assert.equal(workerResponse.ok,false);assert.match(workerResponse.message,/Otwórz TOP DRAGON/);

const manifest=JSON.parse(fs.readFileSync('browser-extension/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);assert.ok(!manifest.permissions.includes('cookies'));assert.ok(!manifest.permissions.includes('webRequest'));
let planListener;const planReplies=[];
const planWindow={parent:{postMessage:message=>planReplies.push(message)},addEventListener:(_,fn)=>{planListener=fn;}};
const context={window:planWindow,location:{origin:'https://topdragon.dyspiqon.pl'},state:{user:{},boardStartupV188:{active:false}},Date,Map,Set,Number,Boolean,String,Promise,
  setTimeout:resolve=>resolve(),isAdminUser:()=>true,isFreeDayRoute:()=>false,
  routeSwapValidPoint:p=>Boolean(p&&point([p.lat,p.lng])),
  activeRoutes:()=>[{id:'prev',driverId:'a',date:'2026-11-23',startHour:8,endHour:12,load:'A',unload:'B'},{id:'far-next',driverId:'a',date:'2027-06-01',startHour:8,endHour:12,load:'C',unload:'D'}],
  routeStartHour:r=>r.startHour,routeEndHour:r=>r.endHour,routeEndDate:r=>r.date,
  operationalDrivers:()=>[{id:'a',driver:'Test',phone:'NOT-FOR-EXTENSION',identityDocumentNumber:'NOT-FOR-EXTENSION'}],driverBasePoint:()=>({lat:52,lng:21}),maxLoadHeightForDriver:()=>3,
  operationalPointForRoute:()=>({lat:52,lng:21}),finalUnloadPointForRoute:()=>({lat:51,lng:20})};
vm.runInNewContext(fs.readFileSync('public/tms-assistant-plan.js','utf8'),context);
await planListener({source:planWindow.parent,origin:context.location.origin,data:{type:'td-assistant-plan-request',requestId:'fixture',offer:{start:'2026-11-24T10:00',end:'2026-11-24T15:00'}}});
assert.equal(planReplies[0].ok,true);assert.deepEqual(Array.from(planReplies[0].data.routes,r=>r.id),['prev','far-next'],'Uwzględnij kolejną relację nawet po 45 dniach');
assert.equal(JSON.stringify(planReplies).includes('NOT-FOR-EXTENSION'),false,'Nie eksportuj dokumentów tożsamości ani telefonów');
console.log('Asystent: obliczenia, następne relacje, kolizje, wymagania, brak zgadywania dat, komunikacja i brak migracji: OK');

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('public/tms.html','utf8');
const match = html.match(/<script id="targeted-v136-route-match-hover-alerts">([\s\S]*?)<\/script>/);
assert(match, 'Brak skryptu alertu kafelków V136');
const source = match[1];

const storage = new Map();
const listeners = {};
const parent = {};
const tile = {
  dataset:{routeId:'r1'},
  active:false,
  classList:{toggle(name,on){ if(name==='queue-match-pulse-v136') tile.active=!!on; }}
};
const state = {
  user:{role:'spedytor',login:'ANGE',supabaseId:'u1',branchId:'b1',branch:'B1'},
  proposedLoads:[], futureRoutes:[], reportDate:'2026-09-10'
};
const document = {
  querySelectorAll(selector){ return selector.includes('.time-route') ? [tile] : []; },
  addEventListener(type,fn){ (listeners[type] ||= []).push(fn); }
};
const context = {
  state, START_DATE:'2026-09-10', console, document,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
  window:{location:{origin:'https://example.test'},parent,addEventListener:(type,fn)=>{(listeners[type] ||= []).push(fn)}},
  requestAnimationFrame:fn=>fn(), setInterval:()=>0,
  preferredQueueMatchRows:rows=>rows,
  proposedDistancesForRoute:route=>route.match ? [{driver:{dispatcher:'ANGE'},previousRoute:{id:'r1'}}] : [],
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'v136-inline.js'});

function emit(rows){ for(const fn of listeners.message||[]) fn({origin:'https://example.test',source:parent,data:{type:'top-dragon-load-queue-data',rows}}); }

// Pierwszy snapshot jest bazą i nie uruchamia alarmu.
const old={id:'old',queueBranchId:'b1',match:true};
state.proposedLoads=[old];
emit([{branchId:'b1',queueType:'proposed',id:'old',payload:old,updatedAt:'1'}]);
assert.strictEqual(tile.active,false,'Pierwszy snapshot nie powinien pulsować');

// Nowy dopasowany wolny ładunek uruchamia pulsowanie kafelka.
const fresh={id:'new',queueBranchId:'b1',match:true};
state.proposedLoads=[old,fresh];
emit([
  {branchId:'b1',queueType:'proposed',id:'old',payload:old,updatedAt:'1'},
  {branchId:'b1',queueType:'proposed',id:'new',payload:fresh,updatedAt:'1'}
]);
assert.strictEqual(tile.active,true,'Dopasowany kafelek powinien pulsować na zielono');

// Samo najechanie kursorem kończy pulsowanie.
for(const fn of listeners.pointerover||[]) fn({target:{closest:()=>tile}});
assert.strictEqual(tile.active,false,'Najechanie na kafelek powinno wygasić pulsowanie');

console.log('test-v136-behavior: OK');

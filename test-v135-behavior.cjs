const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('public/tms.html','utf8');
const match = html.match(/<script id="targeted-v135-queue-attention-alerts-script">([\s\S]*?)<\/script>/);
assert(match, 'Brak skryptu V135');
const source = match[1];

const storage = new Map();
const listeners = {};
const parent = {};
const state = {
  user:{ role:'spedytor', login:'ANGE', supabaseId:'u1', branchId:'b1', branch:'B1' },
  proposedLoads:[], futureRoutes:[], proposedPanelOpen:false, futurePanelOpen:false,
  reportDate:'2026-09-10', loadQueueChat3L52:{messages:[],reads:[]}
};
let proposedSyncs=0, futureSyncs=0;
const context = {
  state,
  START_DATE:'2026-09-10',
  console,
  localStorage:{
    getItem:k => storage.has(k) ? storage.get(k) : null,
    setItem:(k,v) => storage.set(k,String(v)),
    removeItem:k => storage.delete(k)
  },
  window:{
    location:{origin:'https://example.test'}, parent,
    addEventListener:(type,fn) => { (listeners[type] ||= []).push(fn); },
    openQueueRelationChat3L52:function(){},
  },
  requestAnimationFrame:fn => fn(),
  centralLoadQueueBranchId:route => route._centralBranchId || route.queueBranchId || 'b1',
  preferredQueueMatchRows:rows => (rows || []).filter(row => row.match),
  proposedDistancesForRoute:route => route.matchCurrent ? [{match:true}] : [],
  attr:value => String(value),
  renderProposedLoadsUi:() => '<button class="proposed-tab side-tool-tab side-tool-proposed"><span class="side-tool-icon"><svg></svg></span><span class="side-tool-label">Wolne ładunki</span></button>',
  renderFutureTab:() => '<button class="future-tab side-tool-tab side-tool-future"><span class="side-tool-icon"><svg></svg></span><span class="side-tool-label">Planowane relacje</span></button>',
  toggleProposedPanel:function(force=null){ state.proposedPanelOpen = force === null ? !state.proposedPanelOpen : !!force; },
  toggleFuturePanel:function(force=null){ state.futurePanelOpen = force === null ? !state.futurePanelOpen : !!force; },
  syncProposedPanel:() => { proposedSyncs++; },
  syncFuturePanel:() => { futureSyncs++; },
  applyAuthenticatedUser:user => { state.user=user; },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, {filename:'v135-inline.js'});

function emit(type, data){
  for(const fn of listeners.message || []) fn({origin:'https://example.test',source:parent,data:{type,...data}});
}

// 1. Pierwszy snapshot tylko ustawia bazę - bez alarmu.
const existing={id:'old1',createdBy:'OTHER',queueBranchId:'b1'};
state.proposedLoads=[existing];
emit('top-dragon-load-queue-data',{rows:[{branchId:'b1',queueType:'proposed',id:'old1',payload:existing,updatedAt:'1'}]});
assert(!context.renderProposedLoadsUi().includes('queue-alert-'), 'Pierwszy snapshot nie powinien alarmować');

// 2. Nowy niedopasowany Wolny ładunek = niebieski.
const blue={id:'p2',createdBy:'OTHER',queueBranchId:'b1',matchCurrent:false};
state.proposedLoads=[existing,blue];
emit('top-dragon-load-queue-data',{rows:[
  {branchId:'b1',queueType:'proposed',id:'old1',payload:existing,updatedAt:'1'},
  {branchId:'b1',queueType:'proposed',id:'p2',payload:blue,updatedAt:'1'}
]});
assert(context.renderProposedLoadsUi().includes('queue-alert-blue-v135'), 'Nowy niedopasowany wpis powinien świecić na niebiesko');

// 3. Własny nowy wpis nie uruchamia niebieskiego alertu.
const ownFuture={id:'f-own',createdBy:'ANGE',queueBranchId:'b1',matchCurrent:false};
state.futureRoutes=[ownFuture];
emit('top-dragon-load-queue-data',{rows:[
  {branchId:'b1',queueType:'proposed',id:'old1',payload:existing,updatedAt:'1'},
  {branchId:'b1',queueType:'proposed',id:'p2',payload:blue,updatedAt:'1'},
  {branchId:'b1',queueType:'future',id:'f-own',payload:ownFuture,updatedAt:'1'}
]});
assert(!context.renderFutureTab().includes('queue-alert-blue-v135'), 'Własna relacja nie powinna uruchamiać niebieskiej poświaty');

// 4. Kolejny nowy Planowany, dopasowany = zielony.
const future={id:'f2',createdBy:'OTHER',queueBranchId:'b1',matchCurrent:true};
state.futureRoutes=[future];
emit('top-dragon-load-queue-data',{rows:[
  {branchId:'b1',queueType:'proposed',id:'old1',payload:existing,updatedAt:'1'},
  {branchId:'b1',queueType:'proposed',id:'p2',payload:blue,updatedAt:'1'},
  {branchId:'b1',queueType:'future',id:'f2',payload:future,updatedAt:'1'}
]});
assert(context.renderFutureTab().includes('queue-alert-green-v135'), 'Dopasowany wpis powinien świecić na zielono');

// 5. Otwarcie panelu usuwa poświatę.
context.toggleFuturePanel(true);
assert(!context.renderFutureTab().includes('queue-alert-'), 'Otwarcie Planowanych relacji powinno zgasić poświatę');

// 6. Wiadomość do własnego wolnego ładunku = koperta.
const own={id:'mine1',createdBy:'ANGE',queueBranchId:'b1'};
state.proposedLoads=[existing,blue,own];
state.loadQueueChat3L52.messages=[{id:'m1',branchId:'b1',loadRef:'mine1',authorId:'u2',createdAt:'2026-09-10T12:00:00Z'}];
state.loadQueueChat3L52.reads=[];
assert(context.renderProposedLoadsUi().includes('queue-message-indicator-v135'), 'Nieprzeczytana wiadomość do własnej relacji powinna pokazać kopertę');

// 7. Odczyt usuwa kopertę.
state.loadQueueChat3L52.reads=[{branchId:'b1',loadRef:'mine1',lastReadAt:'2026-09-10T12:01:00Z'}];
assert(!context.renderProposedLoadsUi().includes('queue-message-indicator-v135'), 'Po odczycie koperta powinna zniknąć');

console.log('test-v135-behavior: OK');

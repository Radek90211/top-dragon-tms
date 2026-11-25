const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('public/tms.html','utf8');
const from=html.indexOf('    function normalizeTextImportDate(');
const to=html.indexOf('    function createProposedLoadFromTextItem(',from);
assert.ok(from>=0&&to>from);
const ctx={state:{reportDate:'2026-11-25'},currentAppDate:()=> '2026-11-25',
 parseDateInput:(value,fallback)=>/^26\.11$/.test(value)?'2026-11-26':fallback,
 normalizeLocation:value=>String(value||'').trim(),isFreeDayText:()=>false,snapToQuarterHour:n=>n,
 removePolishChars:s=>s,orderStopFields:()=>({}),normalizeClientNip:()=>'',addDaysToIso:x=>x};
vm.createContext(ctx);vm.runInContext(html.slice(from,to),ctx);
const text='warszawa - kraków 2500 26.11';
const local=ctx.localTextOrderParser(text)[0];
assert.equal(local.load,'warszawa');assert.equal(local.unload,'kraków');
assert.equal(local.rate,2500);assert.equal(local.loadDate,'2026-11-26');
assert.equal(local.startHour,null);assert.equal(local.endHour,null);
const ai=ctx.normalizeTextOrderAnalysis({routes:[{pickup:{city:'warszawa',time:'12:00'},delivery:{city:'kraków',time:'10:00'},rate:0}]},text)[0];
assert.equal(ai.startHour,null);assert.equal(ai.endHour,null);
const timed=ctx.localTextOrderParser('warszawa - kraków 2500 26.11 08:30 14:15')[0];
assert.equal(timed.startHour,8.5);assert.equal(timed.endHour,14.25);
console.log('Analiza trasy: stawka, data i brak wymyślonych godzin OK');

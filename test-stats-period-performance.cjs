const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('    function routesForStatsDates(dates)');
const end = html.indexOf('    function statsDispatcherBranch(', start);
assert.ok(start >= 0 && end > start);
let reads = 0;
const routes = Array.from({length:3000}, (_,i)=>({id:i, start:(i%70)*24+(i%8), end:(i%70)*24+30, approvalStatus:i%31===0?'rejected':'accepted'}));
const ctx = {activeRoutes:()=>routes,getDateIndex:date=>date,getDateIndexCalls:0,
  routeGlobalStart:route=>{reads++;return route.start;},routeGlobalEnd:route=>{reads++;return route.end;}};
vm.createContext(ctx); vm.runInContext(html.slice(start,end),ctx);
for (const dates of [[4],[4,5,6,7,8,9,10],Array.from({length:31},(_,i)=>i),[1,3,7,12,69],[-1],[]]) {
  reads=0;
  const actual=Array.from(ctx.routesForStatsDates(dates),r=>r.id);
  const expected=routes.filter(r=>r.approvalStatus!=='rejected' && dates.some(d=>d>=0 && r.start<(d+1)*24 && r.end>d*24)).map(r=>r.id);
  assert.deepEqual(actual,expected,'Wybór relacji odpowiada poprzedniemu algorytmowi');
  assert.ok(reads<=routes.length*2,'Każdą relację sprawdzamy co najwyżej raz');
}
console.log('Zakresy statystyk: zgodność wyników i liniowy koszt odczytu relacji OK');

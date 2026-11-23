const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('      function sampleCompanyDispatcherStats(stats)');
const end = html.indexOf('      function renderCompanyDispatcherStatsTable(stats)', start);
assert.ok(start >= 0 && end > start);
const routes = [
  {sampleRelationV167:true, login:'A', date:'2026-11-21', loaded:100, approach:20, income:800, cost:600},
  {sampleRelationV167:true, login:'A', date:'2026-11-21', loaded:50, approach:10, income:200, cost:300, issue:true},
  {sampleRelationV167:true, login:'B', date:'2026-11-21', loaded:20, approach:0, income:100, cost:100},
  {sampleRelationV167:true, login:'A', date:'2026-11-22', loaded:500, approach:0, income:0, cost:0},
  {login:'A', date:'2026-11-21', loaded:1000, approach:0, income:0, cost:0}
];
const ctx = {state:{user:{supabaseRole:'admin',login:'A'}},
  statsAvailableDispatcherUsers:()=>[{login:'A'}],
  routesForStatsDates:dates=>routes.filter(route=>dates.includes(route.date)),
  isFreeDayRoute:route=>!!route.freeDay, statsRouteDispatcherLogin:route=>route.login,
  statsDispatcherName:route=>route.login, statsRouteBranch:()=> 'Oddział',
  routeStatsValues:route=>({loaded:route.loaded,approach:route.approach,totalKm:route.loaded+route.approach,income:route.income,cost:route.cost,profit:route.income-route.cost}),
  statsRouteHasAccountingIssue:route=>!!route.issue};
vm.createContext(ctx);
vm.runInContext(html.slice(start,end),ctx);
const stats={dates:['2026-11-21']};
const rows=ctx.sampleCompanyDispatcherStats(stats);
assert.equal(rows.length,2);
const row=rows.find(item=>item.dispatcherName==='A');
assert.equal(row.relationCount,2);
assert.equal(row.profit,100);
assert.equal(row.totalKm,180);
assert.equal(row.emptyPercent,100*30/180);
assert.equal(row.verificationCount,1);
assert.equal(row.lowRateCount,1);
assert.equal(row.sample,true);
ctx.state.user.supabaseRole='dispatcher';
assert.equal(ctx.sampleCompanyDispatcherStats(stats).length,1);
ctx.state.user.supabaseRole='branch_manager';
assert.equal(ctx.sampleCompanyDispatcherStats(stats).length,1);
assert.equal(ctx.sampleCompanyDispatcherStats({dates:['2026-11-23']}).length,0);
console.log('Przykładowe statystyki: zakres, sumy i uprawnienia OK');

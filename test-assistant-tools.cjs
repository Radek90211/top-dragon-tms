const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('      renderCommercialIntelligence = function() {');
const end = html.indexOf('      const originalSetCommercialView', start);
assert.ok(start >= 0 && end > start);
const ctx = {state:{user:{role:'spedytor'},commercialPanelOpen:true,commercialView:'rates',boardToolsOpen:false},
  tmsCommercialViewEnabledV261:()=>true,tmsFeatureEnabledV261:()=>true,
  clientLoadRequestUnreadCount:()=>0,renderCommercialBody:()=>'<div>Treść</div>'};
vm.createContext(ctx); vm.runInContext(html.slice(start,end),ctx);
let result=ctx.renderCommercialIntelligence();
assert.match(result,/toggleBoardTools\(\);syncCommercialIntelligenceSection\(\)/);
assert.match(result,/window\.toggleStatsPanel\(true\)/);
ctx.tmsFeatureEnabledV261=()=>false;
result=ctx.renderCommercialIntelligence();
assert.doesNotMatch(result,/window\.toggleStatsPanel\(true\)/);
assert.match(result,/Ustawienia planu/);
const tabStart=html.indexOf('    function renderWorkspaceToolTabs()');
const tabEnd=html.indexOf('    function syncWorkspaceToolTabs()',tabStart);
assert.doesNotMatch(html.slice(tabStart,tabEnd),/side-tool-settings/);
console.log('Narzędzia asystenta i uprawnienie do statystyk: OK');

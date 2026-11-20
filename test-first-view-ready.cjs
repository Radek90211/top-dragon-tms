const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('    function finishBoardStartupV188(');
const end = html.indexOf('    function applyAuthenticatedUser(', start);
assert.ok(start >= 0 && end > start, 'Nie znaleziono zakończenia startu tablicy');

const events = [];
const context = {
  state: { boardStartupV188: { active:true, usersReady:false, fleetReady:false, relationsReady:false, weeklyReady:true, timeout:1 } },
  clearTimeout:() => {},
  render:() => events.push('render'),
  EMBEDDED_MODE:true,
  window:{ location:{ origin:'https://example.test' }, parent:{ postMessage:message => events.push(message.type) } },
  boardRenderCache:null,
  cachedPlanMainFragment:null
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

assert.equal(vm.runInContext('finishBoardStartupV188(false)', context), false);
assert.deepEqual(events, [], 'Nie wolno odsłaniać niegotowego panelu');
Object.assign(context.state.boardStartupV188, { usersReady:true, fleetReady:true, relationsReady:true });
assert.equal(vm.runInContext('finishBoardStartupV188(false)', context), true);
assert.deepEqual(events, ['render', 'top-dragon-view-ready'], 'Panel można odsłonić dopiero po pełnym renderze');
console.log('Pierwszy widok: OK');

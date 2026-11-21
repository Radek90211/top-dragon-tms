const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('async function loadFleetData()');
const end = source.indexOf('async function saveFleetExtraDetails(', start);
assert.ok(start >= 0 && end > start);

async function run({ optionalError = false, requiredError = '' } = {}) {
  const pending = new Map();
  const assignments = Array.from({ length: 5 }, (_, index) => ({
    id:`a${index}`, driver:{ id:`d${index}`, full_name:`Kierowca ${index}` },
    vehicle:{ id:`v${index}` }, trailer:{ id:`t${index}` }, carrier:{ id:'c1', name:'Firma' },
  }));
  const responses = {
    fleet_assignments: assignments,
    fleet_relation_usage: [
      {fleet_assignment_id:'a0'}, {driver_id:'d1'}, {vehicle_id:'v2'}, {trailer_id:'t3'},
    ],
    get_tms_fleet_extra_details: [{assignment_id:'a0', vehicle_model:'Model'}],
    driver_row_preferences: [{driver_id:'d0', color:'yellow'}],
    tms_carrier_rate_history: [{id:'rate', carrier_id:'c1', rate_per_km:4, effective_from:'2026-11-01'}],
  };
  function query(table) {
    return {
      select() { return this; }, eq() { return this; }, order() { return this; },
      then(resolve, reject) {
        pending.set(table, () => {
          if (optionalError && ['get_tms_fleet_extra_details', 'tms_carrier_rate_history'].includes(table)) {
            reject(new Error('offline')); return;
          }
          resolve({data:responses[table], error:table === requiredError ? {message:'test error'} : null});
        });
      },
    };
  }
  const context = {
    supabase:{from:query, rpc:query}, currentActorId:() => 'admin', currentRole:() => 'admin',
    firstRelated:value => value, console:{warn() {}},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const result = vm.runInContext('loadFleetData()', context);
  await Promise.resolve();
  assert.equal(pending.size, 5, 'Wszystkie odczyty floty muszą rozpocząć się bez oczekiwania na poprzedni');
  for (const resolve of pending.values()) resolve();
  if (requiredError) {
    await assert.rejects(result, /test error/);
    return;
  }
  const rows = await result;
  assert.deepEqual(Array.from(rows, row => row.relationLocked), [true, true, true, true, false]);
  assert.equal(rows[0].privateColor, 'yellow');
  assert.equal(rows[0].vehicle.model, optionalError ? '' : 'Model');
  assert.equal(rows[0].carrier.rateHistory.length, optionalError ? 0 : 1);
}

(async () => {
  await run();
  await run({optionalError:true});
  for (const requiredError of ['fleet_assignments', 'fleet_relation_usage', 'driver_row_preferences']) await run({requiredError});
  console.log('Flota: 5 odczytów równoległych, blokady relacji, kolory, stawki i błędy: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

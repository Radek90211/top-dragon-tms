const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = fs.readFileSync('api/truck-routing.js','utf8').replace(/\r\n/g,'\n');
const html = fs.readFileSync('public/tms.html','utf8').replace(/\r\n/g,'\n');
function section(source, from, to) {
  const a=source.indexOf(from),b=source.indexOf(to,a);
  assert.ok(a>=0&&b>a,`Brak: ${from}`);
  return source.slice(a,b);
}
let requested;
const context = {
  URL,Number,Array,TOMTOM_BASE:'https://api.tomtom.com',
  readJson:async()=>({routes:[{summary:{lengthInMeters:123400,travelTimeInSeconds:7200},legs:[]}]}),
  fetch:async(url)=>{requested=url;return {ok:true};}
};
vm.createContext(context);
vm.runInContext(section(api,'async function calculateTruckRoute(', 'async function calculateTruckMatrix('),context);
const points=[{lat:52,lng:19},{lat:51,lng:20}];
async function run() {
  const empty=await context.calculateTruckRoute('test',points,'empty');
  assert.equal(requested.searchParams.get('travelMode'),'truck');
  assert.equal(requested.searchParams.get('vehicleLength'),'16.5');
  assert.equal(requested.searchParams.get('vehicleWidth'),'2.55');
  assert.equal(requested.searchParams.get('vehicleHeight'),'4');
  assert.equal(requested.searchParams.get('vehicleWeight'),'14000');
  assert.equal(empty.distanceKm,123.4);
  await context.calculateTruckRoute('test',points,'loaded');
  assert.equal(requested.searchParams.get('vehicleWeight'),'40000','Trasa ładownego zestawu musi uwzględniać uzgodnioną masę 40 t');
  let matrixBody;
  const matrixCtx={URL,Number,Array,Map,JSON,TOMTOM_BASE:'https://api.tomtom.com',
    fetch:async(url,options)=>{matrixBody=JSON.parse(options.body);return {ok:true};},readJson:async()=>({data:[]})};
  vm.createContext(matrixCtx);
  vm.runInContext(section(api,'async function calculateTruckMatrix(', 'export default async function handler('),matrixCtx);
  await matrixCtx.calculateTruckMatrix('test',points[0],[points[1]]);
  assert.equal(matrixBody.options.vehicleWeight,14000);
  assert.equal(matrixBody.options.vehicleLength,16.5);
  assert.equal(matrixBody.options.vehicleWidth,2.55);
  assert.equal(matrixBody.options.vehicleHeight,4);
  await matrixCtx.calculateTruckMatrix('test',points[0],[points[1]],'loaded');
  assert.equal(matrixBody.options.vehicleWeight,40000);
  const c={
    coordsForNewRoutePoint:key=>({key}),approachPointForNewRoute:()=>({key:'approach'}),routePlannerStoredWaypoints:()=>[],
    normalizeRoutePlannerOrder:()=>['load','secondLoad','unload','secondUnload','base'],basePointForNewRoute:()=>({key:'base'}),
    routePointFromRoute:(route,key)=>({key}),approachPointForRoute:()=>({key:'approach'}),routeWaypointList:()=>[],
    normalizeDetailsRouteOrder:()=>['load','secondLoad','unload','secondUnload','base'],basePointForRoute:()=>({key:'base'}),
    dedupeRoutePlannerPoints:points=>points.filter(Boolean)
  };
  vm.createContext(c);
  vm.runInContext(section(html,'    function routeComponentPointsForNew(', '    async function routePlannerComponentDistance('),c);
  const keys=list=>Array.from(list,p=>p.key);
  assert.deepEqual(keys(c.routeComponentPointsForNew('loaded')),['load','secondLoad','unload','secondUnload']);
  assert.deepEqual(keys(c.routeComponentPointsForNew('approach')),['approach','load']);
  assert.deepEqual(keys(c.routeComponentPointsForNew('base')),['secondUnload','base']);
  assert.deepEqual(keys(c.routeComponentPointsForDetails({},'loaded')),['load','secondLoad','unload','secondUnload']);
  assert.deepEqual(keys(c.routeComponentPointsForDetails({},'base')),['secondUnload','base']);
  const a={previousRouteBeforeNewRoute:()=>({id:'previous'}),routeSwapEndpoint:()=>({lat:52,lng:19}),
    routeSwapValidPoint:p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng),coordsForNewRoutePoint:()=>({lat:53,lng:20}),
    requestTruckRouting:async(mode,payload)=>{a.sent=payload;return {distanceKm:123.4};},Number};
  vm.createContext(a);
  vm.runInContext(section(html,'    async function estimateEmptyApproachForNewRoute()', '    function openAiTextImportBatchItem('),a);
  const approach=await a.estimateEmptyApproachForNewRoute();
  assert.equal(approach.distanceKm,123.4);assert.equal(a.sent.vehicleState,'empty');
  a.previousRouteBeforeNewRoute=()=>null;
  assert.equal(await a.estimateEmptyApproachForNewRoute(),null,'Brak poprzedniego rozładunku nie tworzy sztucznego dolotu');
  console.log('Routing: masa pustego zestawu, pełna trasa z drugim rozładunkiem i baza: OK');
}
run().catch(error=>{console.error(error);process.exitCode=1;});

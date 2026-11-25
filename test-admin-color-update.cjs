const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY='test-service-key';
const id='12345678-1234-4123-8123-123456789012';
let saved, ignoreWrite=false;
global.fetch=async (url,options={})=>{
  const path=String(url);
  const response=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
  if(path.endsWith('/auth/v1/user')) return response({id,email:'admin@example.com'});
  if(path.includes('select=role,active')) return response([{role:'admin',active:true}]);
  if(path.includes('/auth/v1/admin/users/')) return response({id,email:'admin@example.com'});
  if(path.includes('/rest/v1/profiles') && options.method==='PATCH') { saved=JSON.parse(options.body); return response([{id,...saved}]); }
  if(path.includes('/rest/v1/profiles')) return response([{id,display_name:'Administrator',role:'admin',branch_id:null,ui_color:ignoreWrite ? '#ABCDEF' : (saved?.ui_color || '#ABCDEF'),active:true}]);
  throw Error('Unexpected request '+path);
};
(async()=>{
  const handler=(await import('./api/admin/users.js')).default;
  let status,body;
  const res={setHeader(){},status(code){status=code;return this;},json(value){body=value;}};
  await handler({method:'PATCH',headers:{authorization:'Bearer test'},body:{userId:id,uiColor:'#123456'}},res);
  assert.equal(status,200,JSON.stringify(body));
  assert.equal(saved.display_name,'Administrator');assert.equal(saved.ui_color,'#123456');
  assert.equal(saved.role,'admin');assert.equal(saved.active,true);
  saved=undefined;ignoreWrite=true;
  await handler({method:'PATCH',headers:{authorization:'Bearer test'},body:{userId:id,uiColor:'#123456'}},res);
  assert.equal(status,409,'Niepotwierdzony zapis nie może być zgłoszony jako sukces');
  console.log('Zmiana koloru administratora zachowuje nazwę i uprawnienia: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});

import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
import {studioPanel,schema,parts,validate,version} from './assets.mjs';
import {Studio} from './state.mjs';
import {VmixBridge} from './vmix.mjs';
import {Preparation} from './preparation.mjs';
import {NdiController} from './ndi/controller.mjs';
import {Settings} from './settings.mjs';

export function createStudioServer({dataDir=process.env.SOUZ_DATA_DIR?pathToFileURL(resolve(process.env.SOUZ_DATA_DIR)+sep):new URL('../data/',import.meta.url),preparationTimeoutMs=10000}={}){
 const studio=new Studio(),bridge=new VmixBridge(),ndi=new NdiController(),preparation=new Preparation(preparationTimeoutMs),clients=new Set();
 const instanceId=randomUUID();
 const snapshot=()=>{const state=studio.snapshot(),pending=preparation.describe();return {...state,preparation:pending,outputs:preparation.outputs.size,scene:pending?{status:1,progress:0}:state.scene};};
 mkdirSync(dataDir,{recursive:true});const tokenFile=new URL('session-token.txt',dataDir);
 const settings=new Settings(dataDir);bridge.configure(settings.get().vmixUrl);
 const token=existsSync(tokenFile)?readFileSync(tokenFile,'utf8').trim():randomBytes(24).toString('hex');
 if(!/^[a-f0-9]{48}$/.test(token))throw Error('Invalid local access token');
 if(!existsSync(tokenFile))writeFileSync(tokenFile,token,{mode:0o600});
 const presetFile=new URL('presets.json',dataDir);let presets=[];
 if(existsSync(presetFile)){presets=JSON.parse(readFileSync(presetFile,'utf8'));if(!Array.isArray(presets)||presets.length>100)throw Error('Invalid preset file');for(const p of presets)validate(p.values,true);}
 const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const text=(res,value,type='text/html; charset=utf-8')=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(value);};
 function pairs(body){const result={};for(const row of body.trim().split('\n')){const m=/^(\w+)\s+(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*$/i.exec(row);if(!m||Object.hasOwn(result,m[1]))throw Error('Invalid body');result[m[1]]=Number(m[2]);}return result;}
 function save(next){const tmp=new URL('presets.json.tmp',dataDir);writeFileSync(tmp,JSON.stringify(next,null,2));renameSync(tmp,presetFile);presets=next;}
 const server=http.createServer(async(req,res)=>{try{
  // Local-only runtime. Reject DNS rebinding and cross-origin mutations.
  const address=server.address(),host=`127.0.0.1:${address.port}`;
  if(![host,`localhost:${address.port}`].includes(req.headers.host))return json(res,{error:'Invalid host'},403);
  const origin=`http://${req.headers.host}`;if(req.headers.origin&&req.headers.origin!==origin)return json(res,{error:'Invalid origin'},403);
  const u=new URL(req.url,origin),path=u.pathname;
  if(req.method==='GET'&&path==='/health')return json(res,{application:'souz-bg-studio-vmix',version,instanceId});
  if(req.method==='GET'&&path==='/')return text(res,readFileSync(new URL('web/home.html',import.meta.url),'utf8').replaceAll('{{TOKEN}}',token).replace(/versão \d+\.\d+\.\d+/,`versão ${version}`)+'<script type="module" src="/ndi-ui.mjs"></script>');
  if(req.method==='GET'&&path==='/studio')return text(res,studioPanel);
  if(req.method==='GET'&&path==='/output')return text(res,readFileSync(new URL('web/output.html',import.meta.url),'utf8'));
  if(req.method==='GET'&&path==='/output.mjs')return text(res,readFileSync(new URL('web/output.mjs',import.meta.url),'utf8'),'text/javascript');
  if(req.method==='GET'&&path==='/ndi-ui.mjs')return text(res,readFileSync(new URL('web/ndi-ui.mjs',import.meta.url),'utf8'),'text/javascript');
  if(req.method==='GET'&&path==='/home.mjs')return text(res,readFileSync(new URL('web/home.mjs',import.meta.url),'utf8'),'text/javascript');
  const supplied=req.headers['x-souz-token']||(path==='/api/events'?u.searchParams.get('token'):null);
  if(supplied!==token)return json(res,{error:'Unauthorized'},403);
  if(req.method==='GET'&&path==='/api/assets')return json(res,{schema,parts});
  if(req.method==='GET'&&path==='/api/events'){
   const outputId=u.searchParams.get('output');if(outputId){if(!/^[a-f0-9-]{36}$/.test(outputId))throw Error('Invalid output ID');preparation.connect(outputId);}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(snapshot())}\n\n`);clients.add(res);req.on('close',()=>{clients.delete(res);if(outputId)preparation.disconnect(outputId);});return;
  }
  if(req.method==='GET'&&path==='/api/state')return json(res,snapshot());
  if(req.method==='GET'&&path==='/api/info')return json(res,{port:address.port,urls:[],revision:version+'-vmix',output:'/output',ndi:true});
  if(req.method==='GET'&&path==='/api/ndi/status')return json(res,ndi.snapshot());
  if(req.method==='GET'&&path==='/api/settings')return json(res,{...settings.get(),warning:settings.warning});
  if(req.method==='GET'&&path==='/api/presets')return json(res,{max:100,presets});
  if(req.method==='GET'&&path==='/api/vmix/state')return json(res,await bridge.state());
  if(req.method!=='POST')return json(res,{error:'Not found'},404);
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)throw Error('Body too large');}
  if(path==='/api/shutdown'){json(res,{ok:true});setImmediate(()=>stop());return;}
  if(path==='/api/settings'){
   const patch=JSON.parse(body);if(patch?.ndi&&['starting','running'].includes(ndi.state.status))return json(res,{error:'Pare o NDI antes de alterar sua configuração.'},409);
   const saved=settings.update(patch);bridge.configure(saved.vmixUrl);return json(res,saved);
  }
  if(path==='/api/ndi/start'){
   if(['starting','running'].includes(ndi.state.status))return json(res,{error:'NDI já está iniciado'},409);
   const config=settings.update({ndi:JSON.parse(body||'{}')}).ndi;return json(res,await ndi.start(config,origin,token));
  }
  if(path==='/api/ndi/stop')return json(res,await ndi.stop());
  if(path==='/api/output/ready'){const {outputId,preparationId}=JSON.parse(body);return json(res,{accepted:preparation.ready(outputId,preparationId)});}
  if(path==='/api/output/error'){const {outputId,preparationId}=JSON.parse(body);if(preparation.outputs.has(outputId)&&preparation.pending?.id===preparationId)preparation.cancel('Falha ao preparar engine na saída. Cena anterior preservada.');return json(res,{ok:true});}
  if(path==='/api/params'){
   const values=validate(pairs(body));preparation.assertIdle();studio.advance();if(studio.busy())throw Object.assign(Error('Transition in progress'),{status:409});
   if('Engine'in values&&values.Engine!==studio.params.Engine)await preparation.run(values.Engine,()=>studio.edit(values));else studio.edit(values);
  }
  else if(path==='/api/take'){
   const {Duration,Time,...values}=pairs(body);validate(values,true);
   if(!Number.isFinite(Duration)||Duration<.1||Duration>10||!Number.isFinite(Time)||Math.abs(Time)>1e9)throw Error('Invalid TAKE');
   preparation.assertIdle();studio.advance();if(studio.busy())throw Object.assign(Error('Transition in progress'),{status:409});
   await preparation.run(values.Engine,()=>studio.take(values,Duration,Time));
  }
  else if(path==='/api/presets'){
   const rows=body.split('\n'),name=rows.shift()?.replace(/^Name /,'');if(!body.startsWith('Name ')||!name||name!==name.trim()||Buffer.byteLength(name)>120||/[\x00-\x1f\x7f]/.test(name))throw Error('Invalid name');
   const values=validate(pairs(rows.join('\n')),true),existing=presets.find(p=>p.name===name);
   if(!existing&&presets.length>=100)return json(res,{error:'Preset limit'},409);
   const next=presets.filter(p=>p!==existing);next.push({id:existing?.id??Math.max(0,...presets.map(p=>p.id))+1,name,values});save(next);return json(res,{max:100,presets});
  }else if(path==='/api/presets/delete'){const {Id,...other}=pairs(body);if(Object.keys(other).length||!presets.some(p=>p.id===Id))return json(res,{error:'Preset not found'},404);save(presets.filter(p=>p.id!==Id));return json(res,{max:100,presets});}
  else if(path==='/api/vmix/config'){const saved=settings.update({vmixUrl:JSON.parse(body).url});bridge.configure(saved.vmixUrl);return json(res,{ok:true});}
  else if(path==='/api/vmix/command'){const {function:fn,input,duration}=JSON.parse(body);return json(res,await bridge.command(fn,input,duration));}
  else return json(res,{error:'Not available in local vMix edition'},404);
  json(res,snapshot());
 }catch(e){json(res,{error:e.message},e.status||400);}});
 const timer=setInterval(()=>{const value=`data: ${JSON.stringify(snapshot())}\n\n`;for(const res of clients){if(res.writableLength>262144){res.destroy();clients.delete(res);}else res.write(value);}},50);timer.unref();
 server.on('close',()=>clearInterval(timer));
 function stop(){ndi.stop();preparation.cancel('Studio encerrado');for(const res of clients)res.end();server.close();}
 return {server,studio,token,bridge,ndi,settings,preparation,stop};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const app=createStudioServer();app.server.listen(Number(process.env.PORT||3947),'127.0.0.1',()=>console.log(`Souz BG Studio vMix: http://127.0.0.1:${app.server.address().port}`));
 app.server.on('error',e=>{console.error(e.message);process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.stop());
}

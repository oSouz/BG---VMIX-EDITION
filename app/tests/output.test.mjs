import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {defaults,schema,studioPanel} from '../assets.mjs';

test('real output script keeps rendering outgoing scene while compiling and acknowledges only after link',async()=>{
 let now=0,frame,stream,linkReady=true,currentProgram,draws=0;const requests=[];
 const gl=new Proxy({
  createProgram:()=>({}),createShader:()=>({}),createVertexArray:()=>({}),
  getExtension:()=>({COMPLETION_STATUS_KHR:91}),
  getProgramParameter:(_,key)=>key===91?linkReady:true,
  getUniformLocation:(_,name)=>name,useProgram:p=>{currentProgram=p;},
  drawArrays:()=>{assert.ok(currentProgram);draws++;},
 },{get:(target,key)=>key in target?target[key]:(typeof key==='string'&&key===key.toUpperCase()?1:()=>{})});
 const canvas={getContext:()=>gl,addEventListener:()=>{}},status={textContent:''};
 const context=vm.createContext({
  location:{hash:'#test',search:''},document:{querySelector:s=>s==='canvas'?canvas:status},
  crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},URLSearchParams,AbortSignal,console,
  performance:{now:()=>now},requestAnimationFrame:f=>{frame=f;},window:{addEventListener:()=>{}},
  EventSource:class{constructor(){stream=this;}close(){}},
  fetch:async(path,options)=>{requests.push({path,options});return {ok:true,json:async()=>path==='/api/assets'?{schema,parts:{common:'',engines:Array(105).fill('shader')}}:{accepted:true}};},
 });
 vm.runInContext(readFileSync(new URL('../web/output.mjs',import.meta.url),'utf8'),context);
 await new Promise(r=>setImmediate(r));assert.ok(stream);
 const initial={params:{...defaults},animTime:0,phase:0,bpm:120,scene:{status:0},fade:{from:0,to:0,progress:1},preparation:null};
 const send=s=>stream.onmessage({data:JSON.stringify(s)}),tick=()=>{now+=40;frame(now);};
 send(initial);tick();tick();const before=draws;assert.ok(before>0);
 send({...initial,preparation:{id:'prepare-42',engine:42}});linkReady=false;tick();tick();
 assert.ok(draws>=before+2,'outgoing animation must continue during compilation');
 assert.equal(requests.filter(r=>r.path==='/api/output/ready').length,0);
 linkReady=true;tick();await new Promise(r=>setImmediate(r));
 const ready=requests.filter(r=>r.path==='/api/output/ready');assert.equal(ready.length,1);assert.equal(JSON.parse(ready[0].options.body).preparationId,'prepare-42');
 tick();assert.equal(requests.filter(r=>r.path==='/api/output/ready').length,1,'acknowledgement must not repeat each frame');
 assert.match(studioPanel,/includes\(path\)\?15000:5000/);
});

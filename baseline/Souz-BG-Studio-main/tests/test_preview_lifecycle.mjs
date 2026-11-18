import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../web/panel.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('// No WebGL context,'),html.indexOf('</script>',html.indexOf('// No WebGL context,')));
const schema=JSON.parse(html.match(/const SCHEMA=(.*);/)[1]);
function setup({available=true,complete=true,link=true}={}){
 let clock=0,contextCalls=0,queries=0,nextID=0,blendDraws=0,blending=false;
 const shaders=new Set(),programs=new Set(),vaos=new Set(),rafs=new Map(),listeners={};
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,BLEND:4,TRIANGLES:5,SRC_ALPHA:6,ONE_MINUS_SRC_ALPHA:7,ONE:8,COLOR_BUFFER_BIT:9,
 createShader(){const x={};shaders.add(x);return x},createProgram(){const x={};programs.add(x);return x},createVertexArray(){const x={};vaos.add(x);return x},
 deleteShader:x=>shaders.delete(x),deleteProgram:x=>programs.delete(x),deleteVertexArray:x=>vaos.delete(x),
 getExtension:name=>name==='KHR_parallel_shader_compile'?{COMPLETION_STATUS_KHR:99}:{loseContext(){}},
 getProgramParameter(p,name){queries++;return name===99?complete:link},getProgramInfoLog:()=> 'test link error',getShaderInfoLog:()=>'',
 shaderSource(){},compileShader(){},attachShader(){},detachShader(){},linkProgram(){},useProgram(){},bindVertexArray(){},viewport(){},getUniformLocation:()=>0,uniform1f(){},uniform1i(){},uniform2f(){},uniform4f(){},
 clearColor(){},clear(){},blendFuncSeparate(){},disable(){blending=false},enable(){blending=true},drawArrays(){if(blending)blendDraws++}
 };
 const ids=new Map();
 function node(id){const x={id,width:2,height:2,style:{},textContent:'',hidden:false,events:{},replaceWith(n){ids.set(id,n)},addEventListener(n,fn){this.events[n]=fn},getContext(){contextCalls++;return available?gl:null}};ids.set(id,x);return x;}
 for(const id of ['native-preview','preview-status','preview-pause','preview-empty'])node(id);
 const document={hidden:false,querySelector:s=>ids.get(s.slice(1)),createElement:()=>node('native-preview'),addEventListener:(n,f)=>listeners[n]=f};
 const values=Object.fromEntries(schema.map(x=>[x.name,x.default]));
 const context={document,window:{addEventListener(){}},console:{error(){}},performance:{now:()=>clock},requestAnimationFrame:fn=>{rafs.set(++nextID,fn);return nextID},cancelAnimationFrame:id=>rafs.delete(id),SCHEMA:schema,values,demo:true,connected:false,hsvToHex:()=> '#7f00ff',
  // Main-script globals the preview reads (PGM/PVW banks and the TAKE scene).
  bank:'pgm',pgmValues:values,pvwClock:0,pgmClock:0,latestState:null,demoScene:null,definitions:new Map(schema.map(p=>[p.name,p]))};
 vm.createContext(context);vm.runInContext(source,context);
 function tick(dt=80){clock+=dt;const callbacks=[...rafs.values()];rafs.clear();callbacks.forEach(f=>f(clock));}
 return {context,ids,values,tick,document,listeners,rafs,shaders,programs,vaos,get contexts(){return contextCalls},get queries(){return queries},get blends(){return blendDraws}};
}
const t=setup();assert.equal(t.contexts,0);assert.equal(t.rafs.size,0);assert.equal(t.programs.size,0);
t.ids.get('preview-pause').events.click();assert.equal(t.contexts,1);t.tick();assert.equal(t.programs.size,1);assert.equal(t.queries,0);t.tick();assert.equal(t.shaders.size,0);
for(let i=1;i<28;i++){
 t.values.Engine=i%schema[0].options.length;
 for(let f=0;f<10;f++){t.tick();assert(t.programs.size<=2);assert(t.shaders.size<=2);assert(t.vaos.size<=1);}
}
assert(t.blends>0);t.document.hidden=true;t.listeners.visibilitychange();assert.equal(t.rafs.size,0);t.document.hidden=false;t.listeners.visibilitychange();assert.equal(t.rafs.size,1);
t.ids.get('preview-pause').events.click();assert.equal(t.programs.size,0);assert.equal(t.shaders.size,0);assert.equal(t.vaos.size,0);assert.equal(t.rafs.size,0);
t.ids.get('preview-pause').events.click();t.tick();t.ids.get('native-preview').events.webglcontextlost({preventDefault(){}});assert.equal(t.rafs.size,0);assert.equal(vm.runInContext('previewRunning',t.context),false);assert.equal(t.contexts,2);
const slow=setup({complete:false});slow.ids.get('preview-pause').events.click();slow.tick();slow.tick(10100);assert.equal(slow.programs.size,0);assert.equal(slow.shaders.size,0);assert.equal(slow.rafs.size,0);
const bad=setup({link:false});bad.ids.get('preview-pause').events.click();bad.tick();bad.tick();assert.equal(bad.programs.size,0);assert.equal(bad.shaders.size,0);assert(bad.ids.get('preview-empty').textContent.includes('test link error'));
const unavailable=setup({available:false});unavailable.ids.get('preview-pause').events.click();assert.equal(unavailable.rafs.size,0);assert.equal(unavailable.programs.size,0);
// Demo TAKE: two programs (outgoing and incoming scene), incoming blended over the outgoing one.
const take=setup();take.ids.get('preview-pause').events.click();take.tick();take.tick();
const blendsBefore=take.blends;
vm.runInContext('demoScene={from:{...values,Engine:3},oldTime:0,progress:.4,duration:2,start:performance.now()}',take.context);take.values.Engine=90;
for(let f=0;f<12;f++){take.tick();assert(take.programs.size<=2)}
assert(take.blends>blendsBefore,'TAKE crossfade must blend the incoming scene');
console.log('PASS: zero WebGL at startup, bounded cache over 48 changes, asynchronous status, engine and TAKE fade blending, background suspend, cleanup, context loss, timeout, link failure and unavailable GPU');

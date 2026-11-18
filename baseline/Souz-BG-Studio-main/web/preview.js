// No WebGL context, shader compilation or animation loop at page load.
// Activate explicitly. At most two engine programs (including an in-flight one).
const PREVIEW_PARTS=/*PREVIEW_PARTS*/{};
let previewCanvas=document.querySelector('#native-preview');
const previewStatus=document.querySelector('#preview-status'),previewPause=document.querySelector('#preview-pause'),previewEmpty=document.querySelector('#preview-empty');
let previewGL=null,previewVAO=null,previewRAF=0,previewRunning=false,previewLost=false,previewExt=null;
let previewPrograms=new Map(),previewPending=null,previewLast=0,previewEpoch=0,previewRatio=16/9;
let previewFade={from:0,to:0,progress:1,duration:.6},previewFadeSync=null,previewFadeInitialized=false;
let previewClock=0,previewPhase=0,previewBpm=120,previewSyncAt=0,previewHostTime=null,previewHostMoving=false;
const previewDiagnostics={revision:'{{REVISION}}',state:'off',engine:null,parallelCompile:false,compileMs:0,error:''};
const PREVIEW_VERTEX='#version 300 es\nprecision highp float;\nout vec2 i_uv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));i_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
function previewMessage(text,overlay=false){previewStatus.textContent=text;previewEmpty.hidden=!overlay;if(overlay)previewEmpty.textContent=text;}
function syncPreview(s){
 if(s.fade&&Number.isInteger(s.fade.from)&&Number.isInteger(s.fade.to)&&s.fade.from>=0&&s.fade.from<definitions.get("Engine").options.length&&s.fade.to>=0&&s.fade.to<definitions.get("Engine").options.length&&Number.isFinite(s.fade.progress)){
  previewFade={from:s.fade.from,to:s.fade.to,progress:Math.max(0,Math.min(1,s.fade.progress)),duration:.6};previewFadeSync={...previewFade,at:performance.now()};previewFadeInitialized=true;
 }
 if(!s.fade&&s.params&&Number.isFinite(s.params.Engine))previewFade={from:s.params.Engine,to:s.params.Engine,progress:1,duration:.6};
 if(Number.isFinite(s.animTime)){previewHostMoving=previewHostTime!==null&&s.animTime!==previewHostTime;previewHostTime=s.animTime;previewClock=s.animTime;previewSyncAt=performance.now();}
 if(Number.isFinite(s.phase))previewPhase=s.phase;
 if(Number.isFinite(s.bpm))previewBpm=s.bpm;
 if(s.width>0&&s.height>0){previewRatio=s.width/s.height;if(previewRunning)resizePreview();}
}
// Fill (default): the shader renders at the frame's own shape, so the image covers the whole preview
// frame. LED: the output's proportion, letterboxed. Fixed pixel budget (~480 × 270) keeps it light.
const PREVIEW_PIXELS=480*270;
let previewFill=(()=>{try{return localStorage.getItem('souz-preview-fit')!=='led'}catch{return true}})();
const previewFit=document.querySelector('#preview-fit');
function previewShape(){const cw=previewCanvas.clientWidth,ch=previewCanvas.clientHeight;return previewFill&&cw>0&&ch>0?cw/ch:previewRatio}
function resizePreview(){
 const ratio=Math.max(.1,Math.min(20,previewShape()));
 const w=Math.max(1,Math.min(1280,Math.round(Math.sqrt(PREVIEW_PIXELS*ratio)))),h=Math.max(1,Math.round(w/ratio));
 if(previewCanvas.width!==w||previewCanvas.height!==h){previewCanvas.width=w;previewCanvas.height=h;}
}
function showPreviewFit(){
 if(!previewFit)return;
 previewFit.textContent=previewFill?'Preencher':'Proporção do LED';previewFit.setAttribute('aria-pressed',String(previewFill));
 previewFit.title=previewFill?'A imagem ocupa o quadro todo. Clique para ver na proporção do LED.':'Mostra a proporção exata do LED. Clique para preencher o quadro.';
 if(previewCanvas.style)previewCanvas.style.objectFit=previewFill?'fill':'contain';
}
if(previewFit)previewFit.addEventListener('click',()=>{previewFill=!previewFill;try{localStorage.setItem('souz-preview-fit',previewFill?'fill':'led')}catch{}showPreviewFit();if(previewRunning)resizePreview();});
showPreviewFit();
function advanceLocalFade(requested,dt){
 if(!previewFadeInitialized){previewFade={from:requested,to:requested,progress:1,duration:.6};previewFadeInitialized=true;return}
 if(previewFade.progress>=1&&requested!==previewFade.to){previewFade.from=previewFade.to;previewFade.to=requested;previewFade.progress=0;}
 if(previewFade.progress<1){previewFade.progress=Math.min(1,previewFade.progress+dt/.6);if(previewFade.progress>=1&&requested!==previewFade.to){previewFade.from=previewFade.to;previewFade.to=requested;previewFade.progress=0;}}
}
function dropProgram(entry){if(!previewGL||!entry)return;previewGL.deleteProgram(entry.program);if(entry.vs)previewGL.deleteShader(entry.vs);if(entry.fs)previewGL.deleteShader(entry.fs);}
function releasePreview(){
 cancelAnimationFrame(previewRAF);previewRAF=0;previewEpoch++;
 const gl=previewGL;
 if(gl&&!previewLost){
  gl.useProgram(null);for(const entry of previewPrograms.values())dropProgram(entry);dropProgram(previewPending);
  if(previewVAO)gl.deleteVertexArray(previewVAO);
 }
 previewPrograms.clear();previewPending=null;previewVAO=null;previewGL=null;previewExt=null;
 // An explicit stop relinquishes the context too, not just the JS references.
 if(gl&&!previewLost){const ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}
 previewCanvas.width=2;previewCanvas.height=2;
}
function stopPreview(message='Preview desligado · controles do plugin continuam ativos'){
 previewRunning=false;releasePreview();previewDiagnostics.state='off';previewPause.textContent='Ativar preview';previewMessage(message,true);
}
function failPreview(message,error){
 previewDiagnostics.error=String(error&&error.message||error||message).slice(0,2000);
 console.error('Souz preview V09:',previewDiagnostics.error);
 stopPreview(message);previewEmpty.textContent=message+'\n\nDetalhe: '+previewDiagnostics.error.slice(0,600);previewDiagnostics.state='error';previewPause.textContent='Tentar preview novamente';
 previewEmpty.title=previewDiagnostics.error;
}
function startPreview(){
 if(previewRunning)return;
 try{
  // Replace the old canvas only on explicit activation: a lost context is never
  // automatically recompiled in a crash/restore loop.
  const fresh=document.createElement('canvas');fresh.id='native-preview';fresh.width=2;fresh.height=2;fresh.style.cssText='width:100%;height:100%;object-fit:'+(previewFill?'fill':'contain');previewCanvas.replaceWith(fresh);previewCanvas=fresh;
  previewLost=false;
  const gl=previewCanvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
  if(!gl)throw Error('WebGL 2 com aceleração gráfica indisponível.');
  previewGL=gl;const epoch=++previewEpoch;
  previewCanvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();if(epoch!==previewEpoch||previewGL!==gl)return;
   previewLost=true;failPreview('Preview interrompido pela GPU. Os controles continuam ativos. Tente novamente apenas quando desejar.','webglcontextlost');
  });
  previewExt=gl.getExtension('KHR_parallel_shader_compile');previewDiagnostics.parallelCompile=!!previewExt;previewDiagnostics.error='';previewDiagnostics.state='starting';
  previewVAO=gl.createVertexArray();if(!previewVAO)throw Error('Falha ao criar estado de desenho.');resizePreview();previewRunning=true;previewLast=performance.now();previewPause.textContent='Desligar preview';
  previewMessage('Preparando somente o motor selecionado…',true);
  previewRAF=requestAnimationFrame(drawPreview);
 }catch(e){failPreview('Preview indisponível. Verifique a aceleração gráfica/WebGL 2. Os controles continuam ativos.',e);}
}
function beginProgram(engine,needed,now){
 const gl=previewGL;
 // Purge engines no longer needed BEFORE allocating another program.
 for(const [key,entry]of previewPrograms)if(!needed.includes(key)){dropProgram(entry);previewPrograms.delete(key);}
 if(previewPrograms.size>=2)return;
 const entry={engine,program:null,vs:null,fs:null,locations:new Map(),started:now};
 previewPending=entry;
 entry.vs=gl.createShader(gl.VERTEX_SHADER);entry.fs=gl.createShader(gl.FRAGMENT_SHADER);entry.program=gl.createProgram();
 if(!entry.vs||!entry.fs||!entry.program)throw Error('GPU não conseguiu alocar o programa.');
 gl.shaderSource(entry.vs,PREVIEW_VERTEX);gl.shaderSource(entry.fs,PREVIEW_PARTS.common+PREVIEW_PARTS.engines[engine]);
 gl.compileShader(entry.vs);gl.compileShader(entry.fs);gl.attachShader(entry.program,entry.vs);gl.attachShader(entry.program,entry.fs);gl.linkProgram(entry.program);
 // Do not query COMPILE_STATUS or LINK_STATUS here: it can block the UI.
 previewDiagnostics.state='compiling';previewDiagnostics.engine=engine;
}
function finishProgram(now){
 if(!previewPending)return;
 const entry=previewPending,gl=previewGL;
 if(now-entry.started>10000)throw Error('Tempo limite ao preparar o motor.');
 if(previewExt){if(!gl.getProgramParameter(entry.program,previewExt.COMPLETION_STATUS_KHR))return;}
 else if(now-entry.started<100)return; // yield first; older drivers may still block here
 if(!gl.getProgramParameter(entry.program,gl.LINK_STATUS)){
  throw Error([gl.getProgramInfoLog(entry.program),gl.getShaderInfoLog(entry.vs),gl.getShaderInfoLog(entry.fs)].filter(Boolean).join('\n')||'Falha na compilação do motor.');
 }
 gl.detachShader(entry.program,entry.vs);gl.detachShader(entry.program,entry.fs);gl.deleteShader(entry.vs);gl.deleteShader(entry.fs);entry.vs=entry.fs=null;
 previewPrograms.set(entry.engine,entry);previewPending=null;previewDiagnostics.compileMs=Math.round(now-entry.started);
}
function renderEngine(entry,opacity,params=values,clock=previewClock){
 const gl=previewGL;gl.useProgram(entry.program);
 const loc=name=>{if(!entry.locations.has(name))entry.locations.set(name,gl.getUniformLocation(entry.program,name));return entry.locations.get(name);};
 for(const d of SCHEMA){if(d.kind==='bool')gl.uniform1i(loc(d.name),params[d.name]>.5?1:0);else gl.uniform1f(loc(d.name),params[d.name]);}
 gl.uniform2f(loc('resolution'),previewCanvas.width,previewCanvas.height);gl.uniform1f(loc('animTime'),clock);gl.uniform1f(loc('phase'),previewPhase);gl.uniform1f(loc('previewOpacity'),opacity);gl.drawArrays(gl.TRIANGLES,0,3);
}
function drawPreview(now){
 previewRAF=0;if(!previewRunning||previewLost||document.hidden)return;
 if(now-previewLast<1000/15){previewRAF=requestAnimationFrame(drawPreview);return;}
 const dt=Math.min(Math.max((now-previewLast)/1000,0),.25);previewLast=now;
 try{
  resizePreview(); // follows window resizes and interface scale
  if(bank==='pvw'||demo||(connected&&previewHostMoving&&now-previewSyncAt<250))previewClock+=dt*values.Speed*values.Speed*4*(values.Reverse>.5?-1:1);
  if(demo||(connected&&now-previewSyncAt<250))previewPhase=(previewPhase+dt*previewBpm/240)%1;
  if(bank==='pvw'||demo)advanceLocalFade(Math.round(values.Engine),dt);
  else if(connected&&previewFadeSync)previewFade.progress=Math.min(1,previewFadeSync.progress+Math.min(Math.max(0,now-previewFadeSync.at),200)/600);
  const scene=bank==='pgm'?(demo?demoScene:(latestState?.scene?.status===3?latestState.scene:null)):null;
  const from=scene?Math.round(scene.from.Engine):previewFade.from,to=scene?Math.round(pgmValues.Engine):previewFade.to,transition=!!scene||(previewFade.progress<1&&from!==to);
  const sceneProgress=scene?scene.progress:previewFade.progress;
  if(bank==='pvw')pvwClock=previewClock;else pgmClock=previewClock;
  const needed=transition?[from,to]:[to];
  finishProgram(now);
  if(!previewPending){const missing=needed.find(n=>!previewPrograms.has(n));if(missing!==undefined)beginProgram(missing,needed,now);else for(const [key,entry]of previewPrograms)if(!needed.includes(key)){dropProgram(entry);previewPrograms.delete(key);}}
  const gl=previewGL,a=previewPrograms.get(from),b=previewPrograms.get(to);
  gl.bindVertexArray(previewVAO);gl.viewport(0,0,previewCanvas.width,previewCanvas.height);gl.disable(gl.BLEND);
  if(transition&&a&&b){renderEngine(a,1,scene?scene.from:values,scene?scene.oldTime+(demo?(now-scene.start)/1000*scene.from.Speed*scene.from.Speed*4*(scene.from.Reverse>.5?-1:1):0):previewClock);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);const p=sceneProgress;renderEngine(b,p*p*(3-2*p));gl.disable(gl.BLEND);}
  else if(b||a){renderEngine(b||a,1);}
  else {gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}
  if(previewPending){previewMessage('Preparando motor '+(previewPending.engine+1)+' · controles continuam ativos',!a&&!b);}
  else{previewDiagnostics.state='running';previewMessage('Preview leve · '+previewCanvas.width+' × '+previewCanvas.height+' / 15 FPS · '+(demo?'modo local':connected?'conectado ao plugin':'último estado recebido'));}
  previewRAF=requestAnimationFrame(drawPreview);
 }catch(e){failPreview('Falha ao preparar o preview. Controles preservados. Passe o mouse sobre esta mensagem para ver o erro.',e);}
}
previewPause.addEventListener('click',()=>previewRunning?stopPreview():startPreview());
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(previewRAF);previewRAF=0;}else if(previewRunning&&!previewRAF){previewLast=performance.now();previewRAF=requestAnimationFrame(drawPreview);}});
window.addEventListener('pagehide',()=>stopPreview());
// Exposes diagnostics without tokens or user data; useful in the browser console.
globalThis.souzPreviewDiagnostics=()=>({...previewDiagnostics,running:previewRunning,programs:previewPrograms.size+(previewPending?1:0),width:previewCanvas.width,height:previewCanvas.height});

previewMessage('Preview desligado · clique em Ativar preview para testar',true);

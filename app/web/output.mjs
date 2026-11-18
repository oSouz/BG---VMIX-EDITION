const token=location.hash.slice(1),canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const headers={'X-Souz-Token':token},query=new URLSearchParams(location.search);
const dimension=(key,fallback)=>{const n=Number(query.get(key));return Number.isInteger(n)&&n>=16&&n<=3840?n:fallback;};
canvas.width=dimension('width',1920);canvas.height=dimension('height',1080);
const fps=[25,30,50,60].includes(Number(query.get('fps')))?Number(query.get('fps')):30;
let gl,state,received=0,lastDraw=0,parts,schema,events,programs=new Map(),pending=null,failed=false;
const outputId=crypto.randomUUID();let ackInFlight=false,acked='',rejected='',retryAt=0;
async function report(path,data){const r=await fetch(path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({outputId,...data}),signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Falha ao confirmar saída');return r.json();}
function acknowledge(prep){if(!prep||acked===prep.id||ackInFlight||performance.now()<retryAt)return;ackInFlight=true;report('/api/output/ready',{preparationId:prep.id}).then(r=>{if(r.accepted)acked=prep.id;}).catch(()=>{retryAt=performance.now()+500;}).finally(()=>{ackInFlight=false;});}
const vertex='#version 300 es\nprecision highp float;\nout vec2 i_uv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));i_uv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);}';
function error(e){failed=true;status.textContent='Saída interrompida: '+e.message;console.error(e);if(state?.preparation)report('/api/output/error',{preparationId:state.preparation.id}).catch(()=>{});events?.close();}
function compile(engine,needed){
 for(const [id,p] of programs)if(!needed.includes(id)){gl.deleteProgram(p);programs.delete(id);}
 const shaders=[gl.createShader(gl.VERTEX_SHADER),gl.createShader(gl.FRAGMENT_SHADER)],program=gl.createProgram();
 for(let i=0;i<2;i++){gl.shaderSource(shaders[i],i?parts.common+parts.engines[engine]:vertex);gl.compileShader(shaders[i]);gl.attachShader(program,shaders[i]);}gl.linkProgram(program);
 pending={engine,program,shaders,start:performance.now()};
}
function finish(){if(!pending)return;const p=pending,ext=gl.getExtension('KHR_parallel_shader_compile');if(ext&&!gl.getProgramParameter(p.program,ext.COMPLETION_STATUS_KHR)){if(performance.now()-p.start>10000)throw Error('Tempo limite de compilação');return;}if(!gl.getProgramParameter(p.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p.program)||p.shaders.map(s=>gl.getShaderInfoLog(s)).join('\n'));for(const s of p.shaders){gl.detachShader(p.program,s);gl.deleteShader(s);}programs.set(p.engine,p.program);pending=null;}
function render(engine,values,time,phase,opacity){const p=programs.get(engine);gl.useProgram(p);for(const d of schema){const l=gl.getUniformLocation(p,d.name);if(d.kind==='bool')gl.uniform1i(l,values[d.name]>.5?1:0);else gl.uniform1f(l,values[d.name]);}gl.uniform2f(gl.getUniformLocation(p,'resolution'),canvas.width,canvas.height);gl.uniform1f(gl.getUniformLocation(p,'animTime'),time);gl.uniform1f(gl.getUniformLocation(p,'phase'),phase);gl.uniform1f(gl.getUniformLocation(p,'previewOpacity'),opacity);gl.drawArrays(gl.TRIANGLES,0,3);}
const speed=p=>p.Speed*p.Speed*4*(p.Reverse>.5?-1:1);
function draw(now){if(failed)return;requestAnimationFrame(draw);if(!state||now-lastDraw<1000/fps)return;lastDraw=now-(now-lastDraw)%(1000/fps);try{
 const elapsed=Math.min(.25,Math.max(0,(now-received)/1000));
 const scene=state.scene.status===3?state.scene:null,fade=state.fade;
 const from=scene?scene.from.Engine:fade.from,to=state.params.Engine;
 const progress=Math.min(1,scene?scene.progress+elapsed/scene.duration:fade.progress+elapsed/.6),transition=progress<1&&(!!scene||from!==to),needed=transition?[from,to]:[to];
 const prep=state.preparation?.id!==rejected?state.preparation:null;
 const preparing=prep&&!transition?[...new Set([...needed,prep.engine])]:needed;
 try{finish();}catch(e){
  if(!prep||!pending||pending.engine!==prep.engine)throw e;
  rejected=prep.id;for(const s of pending.shaders)gl.deleteShader(s);gl.deleteProgram(pending.program);pending=null;
  report('/api/output/error',{preparationId:prep.id}).catch(()=>{});console.error('Preparação cancelada:',e);
 }
 if(!pending){const missing=preparing.find(id=>!programs.has(id));if(missing!==undefined&&prep?.id!==rejected)compile(missing,preparing);}
 if(!needed.every(id=>programs.has(id))){status.textContent='Preparando engine…';return;}
 gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);
 const phase=(state.phase+elapsed*state.bpm/240)%1,time=state.animTime+elapsed*speed(state.params);
 if(transition){const old=scene?scene.from:{...state.params,Engine:from};render(from,old,scene?scene.oldTime+elapsed*speed(old):time,phase,1);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);render(to,state.params,time,phase,progress*progress*(3-2*progress));}else render(to,state.params,time,phase,1);
 if(prep&&prep.id!==rejected&&programs.has(prep.engine)&&!pending)acknowledge(prep);
 status.textContent=now-received>1000?'Conexão perdida · último estado preservado':'';
 }catch(e){error(e);}}
async function start(){try{
 const r=await fetch('/api/assets',{headers});if(!r.ok)throw Error('Abra a saída pelo início do Studio');({schema,parts}=await r.json());
 gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL 2 indisponível');gl.bindVertexArray(gl.createVertexArray());
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();error(Error('Contexto da GPU perdido. Recarregue a saída.'));});
 events=new EventSource('/api/events?token='+encodeURIComponent(token)+'&output='+outputId);events.onmessage=e=>{state=JSON.parse(e.data);received=performance.now();};events.onerror=()=>{status.textContent='Reconectando ao Studio…';};
 requestAnimationFrame(draw);
 }catch(e){error(e);}}
window.addEventListener('pagehide',()=>events?.close());
start();

import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';

const senderFile=fileURLToPath(new URL('sender.py',import.meta.url));
export function validateNdiOptions({name='Souz BG Studio',width=1920,height=1080,fps=30}={}){
 if(typeof name!=='string'||!name.trim()||name.length>100||/[\\/:*?"<>|\x00-\x1f]/.test(name))throw Error('Nome de fonte inválido');
 if(!Number.isInteger(width)||width<16||width>1920||width%2||!Number.isInteger(height)||height<16||height>1080||![25,30,50,60].includes(fps))throw Error('Resolução/FPS NDI inválidos');
 return {name:name.trim(),width,height,fps};
}
export class NdiController {
 constructor(){this.state={status:'stopped',frames:0,actualFps:0,connections:0,error:''};this.child=null;this.job=null;}
 snapshot(){return {...this.state};}
 async start(options,base,token){
  if(this.state.status!=='stopped'&&this.state.status!=='error')throw Object.assign(Error('NDI já está iniciado'),{status:409});
  const config=validateNdiOptions(options);this.state={...config,status:'starting',frames:0,actualFps:0,connections:0,error:''};this.job=randomUUID();const job=this.job;
  try{
   const child=spawn(process.env.SOUZ_PYTHON||'python',[senderFile,'--render','--name',config.name,'--width',String(config.width),'--height',String(config.height),'--fps',String(config.fps)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8',SOUZ_STUDIO_URL:base,SOUZ_STUDIO_TOKEN:token}});this.child=child;
   child.stdin.on('error',()=>{});let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Runtime NDI não respondeu')),10000);
    const ready=()=>{clearTimeout(timer);resolve();},fail=e=>{clearTimeout(timer);reject(e);};
    child.once('error',fail);child.once('exit',code=>{if(this.job===job&&this.state.status!=='stopped'){fail(Error(stderr||`Emissor NDI encerrou (${code})`));this.fail(stderr||'Emissor NDI encerrou');}});
    createInterface({input:child.stdout}).on('line',line=>{try{const m=JSON.parse(line);if(this.job!==job)return;if(m.event==='ready')ready();if(m.event==='error'){fail(Error(m.error));this.fail(m.error);}if(m.event==='stats'){Object.assign(this.state,{frames:m.frames,actualFps:m.fps,connections:m.connections,renderer:m.renderer});if(this.state.status==='starting')this.state.status='running';}}catch{}});
   });
   if(this.job!==job)throw Error('Inicialização NDI cancelada');
   const deadline=Date.now()+20000;while(this.job===job&&this.state.status==='starting'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
   if(this.state.status!=='running')throw Error(this.state.error||'A saída NDI não produziu quadros');
   return this.snapshot();
  }catch(e){if(this.job===job)await this.fail(e.message);throw e;}
 }
 async release(){
  this.job=null;const child=this.child;this.child=null;
  if(child){child.stdin.end();const killTimer=setTimeout(()=>child.kill(),1500);killTimer.unref();child.once('exit',()=>clearTimeout(killTimer));}
 }
 async stop(){await this.release();this.state={...this.state,status:'stopped',connections:0,actualFps:0};return this.snapshot();}
 async fail(error){this.state={...this.state,status:'error',error};await this.release();}
}

const token=JSON.parse(document.querySelector('#studio-access').textContent).token;
const status=document.querySelector('#status'),inputs=document.querySelector('#inputs');
document.querySelector('#output').value=location.origin+'/output#'+token;
async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:{'X-Souz-Token':token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
let savedInput='';
try{const settings=await api('/api/settings');document.querySelector('#url').value=settings.vmixUrl;savedInput=settings.vmixInput;if(settings.warning)status.textContent=settings.warning;}catch(e){status.textContent=e.message;}
document.querySelector('#connect').onclick=async()=>{
 const button=document.querySelector('#connect');button.disabled=true;
 try{
  await api('/api/vmix/config',{url:document.querySelector('#url').value});
  const {xml}=await api('/api/vmix/state'),doc=new DOMParser().parseFromString(xml,'text/xml');if(doc.querySelector('parsererror'))throw Error('XML inválido');
  inputs.replaceChildren(new Option('Selecione uma entrada',''));
  for(const input of doc.querySelectorAll('inputs > input'))inputs.append(new Option(input.getAttribute('number')+' · '+input.getAttribute('title'),input.getAttribute('key')));
  if([...inputs.options].some(o=>o.value===savedInput))inputs.value=savedInput;
  status.textContent='vMix conectado · '+(inputs.options.length-1)+' entradas';
 }catch(e){inputs.replaceChildren(new Option('Selecione uma entrada',''));status.textContent=e.message;}finally{button.disabled=false;}
};
document.querySelector('#url').addEventListener('change',async()=>{try{const s=await api('/api/settings',{vmixUrl:document.querySelector('#url').value,vmixInput:''});savedInput=s.vmixInput;inputs.replaceChildren(new Option('Selecione uma entrada',''));status.textContent='Endereço salvo. Consulte as entradas para conectar.';}catch(e){status.textContent=e.message;}});
inputs.onchange=async()=>{try{savedInput=(await api('/api/settings',{vmixInput:inputs.value})).vmixInput;}catch(e){status.textContent=e.message;}};
for(const b of document.querySelectorAll('[data-function]'))b.onclick=async()=>{b.disabled=true;try{await api('/api/vmix/command',{function:b.dataset.function,input:inputs.value,duration:1000});status.textContent='Comando enviado ao vMix';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};

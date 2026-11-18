import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {normalizeVmixUrl} from './vmix.mjs';
import {validateNdiOptions} from './ndi/controller.mjs';

const defaults=()=>({schemaVersion:1,vmixUrl:'http://127.0.0.1:8088',vmixInput:'',ndi:validateNdiOptions({})});
export class Settings {
 constructor(dataDir){
  this.file=new URL('settings.json',dataDir);this.value=defaults();this.warning='';
  if(existsSync(this.file)){
   try{const saved=JSON.parse(readFileSync(this.file,'utf8'));if(saved.schemaVersion!==1)throw Error('Unknown settings version');this.value=this.validate(saved);}
   catch{this.warning='Configurações anteriores inválidas; valores padrão carregados. O arquivo original foi preservado.';}
  }
 }
 validate(patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['schemaVersion','vmixUrl','vmixInput','ndi'].includes(k)))throw Error('Configurações inválidas');
  if('schemaVersion'in patch&&patch.schemaVersion!==1)throw Error('Versão de configuração inválida');
  const next={...this.value,...patch};next.vmixUrl=normalizeVmixUrl(next.vmixUrl);
  if(typeof next.vmixInput!=='string'||(next.vmixInput&&!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(next.vmixInput)))throw Error('GUID de entrada inválido');
  if('ndi'in patch){if(!patch.ndi||typeof patch.ndi!=='object'||Array.isArray(patch.ndi)||Object.keys(patch.ndi).some(k=>!['name','width','height','fps'].includes(k)))throw Error('Configuração NDI inválida');next.ndi=validateNdiOptions({...this.value.ndi,...patch.ndi});}
  return next;
 }
 get(){return structuredClone(this.value);}
 update(patch){
  const next=this.validate(patch),tmp=new URL('settings.json.tmp',this.file);
  if(this.warning&&existsSync(this.file)){const backup=new URL(`settings.invalid-${Date.now()}.json`,this.file);writeFileSync(backup,readFileSync(this.file));}
  writeFileSync(tmp,JSON.stringify(next,null,2)+'\n');renameSync(tmp,this.file);this.value=next;this.warning='';return this.get();
 }
}

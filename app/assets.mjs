import {readFileSync} from 'node:fs';
export const baseline=new URL('../baseline/Souz-BG-Studio-main/',import.meta.url);
export const version=readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();
export const originalPanel=readFileSync(new URL('web/panel.html',baseline),'utf8');
export const studioPanel=originalPanel.replaceAll('Resolume','Studio vMix')
 .replaceAll('1.17.1',version+'-vMix')
 .replace("timer=setTimeout(()=>controller.abort(),5000)","timer=setTimeout(()=>controller.abort(),['/api/take','/api/params'].includes(path)?15000:5000)")
 .replace('throw error}return await r.json()', 'try{const detail=await r.json();if(detail.error)error.message=detail.error}catch{}throw error}return await r.json()');
function extract(name){const match=originalPanel.match(new RegExp(`const ${name}=(.*);`));if(!match)throw Error(`Missing ${name}`);return JSON.parse(match[1]);}
export const schema=extract('SCHEMA');
export const parts=extract('PREVIEW_PARTS');
export const defaults=Object.fromEntries(schema.map(p=>[p.name,p.default]));
export function validate(values,full=false){
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Invalid parameters');
 const entries=Object.entries(values);if(!entries.length||(full&&entries.length!==schema.length))throw Error('Incomplete scene');
 for(const [name,v] of entries){const d=schema.find(p=>p.name===name);if(!d||!Number.isFinite(v)||v<0||v>d.max||(['bool','option'].includes(d.kind)&&!Number.isInteger(v)))throw Error(`Invalid parameter: ${name}`);}
 return {...values};
}

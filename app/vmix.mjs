export function normalizeVmixUrl(value){const u=new URL(value);if(u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Use http://host:port');return u.origin;}
export class VmixBridge {
 constructor(){this.base='http://127.0.0.1:8088';}
 configure(value){this.base=normalizeVmixUrl(value);}
 async request(query=''){const r=await fetch(`${this.base}/api/${query}`,{signal:AbortSignal.timeout(2500),redirect:'error'});if(!r.ok)throw Error(`vMix HTTP ${r.status}`);return r.text();}
 async state(){const xml=await this.request();if(!/<vmix[>\s]/.test(xml))throw Error('Response is not vMix XML');return {connected:true,xml};}
 async command(fn,input,duration){if(!['PreviewInput','Cut','Fade'].includes(fn)||typeof input!=='string'||!/^\{?[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\}?$/i.test(input))throw Error('Select an input GUID');const q=new URLSearchParams({Function:fn,Input:input});if(fn==='Fade'){if(!Number.isInteger(duration)||duration<0||duration>10000)throw Error('Invalid fade duration');q.set('Duration',duration);}await this.request('?'+q);return {ok:true};}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {Settings} from '../settings.mjs';
import {createStudioServer} from '../server.mjs';

const directory=()=>pathToFileURL(mkdtempSync(join(tmpdir(),'souz-settings-'))+'/');
test('settings persist independently of transmission and reject invalid updates atomically',()=>{
 const dir=directory(),s=new Settings(dir);
 s.update({vmixUrl:'http://192.168.1.5:8088',ndi:{name:'Palco',width:1280,height:720,fps:60}});
 const before=readFileSync(new URL('settings.json',dir),'utf8');
 assert.throws(()=>s.update({vmixUrl:'http://other:8088',ndi:{fps:13}}));
 assert.equal(readFileSync(new URL('settings.json',dir),'utf8'),before);
 const restored=new Settings(dir);assert.equal(restored.get().ndi.name,'Palco');assert.equal(restored.get().ndi.fps,60);assert.equal(restored.get().vmixUrl,'http://192.168.1.5:8088');
 assert.throws(()=>s.update({ndi:{unexpected:true}}));assert.throws(()=>s.update({vmixInput:'1'}));
 const copy=s.get();copy.ndi.name='mutated';assert.equal(s.get().ndi.name,'Palco');
});
test('damaged settings do not prevent startup and are backed up before replacement',()=>{
 const dir=directory(),file=new URL('settings.json',dir);writeFileSync(file,'broken json');
 const s=new Settings(dir);assert.ok(s.warning);assert.equal(s.get().ndi.fps,30);assert.equal(readFileSync(file,'utf8'),'broken json');
 s.update({ndi:{fps:25}});assert.equal(s.warning,'');const backup=readdirSync(dir).find(n=>n.startsWith('settings.invalid-'));assert.ok(backup);assert.equal(readFileSync(new URL(backup,dir),'utf8'),'broken json');
});
test('saved HTTP configuration survives a new runtime without starting NDI or sending vMix commands',async t=>{
 const dir=directory(),app=createStudioServer({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(()=>{if(app.server.listening)app.stop();});
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'X-Souz-Token':app.token};
 assert.equal((await fetch(base+'/api/settings')).status,403);
 const payload={ndi:{name:'Saved',width:1280,height:720,fps:25},vmixUrl:'http://192.168.1.12:8088',vmixInput:'12345678-1234-1234-1234-123456789abc'};
 assert.equal((await fetch(base+'/api/settings',{method:'POST',headers,body:JSON.stringify(payload)})).status,200);
 app.ndi.state.status='running';assert.equal((await fetch(base+'/api/settings',{method:'POST',headers,body:JSON.stringify({ndi:{fps:60}})})).status,409);app.ndi.state.status='stopped';
 app.stop();
 const restored=createStudioServer({dataDir:dir});t.after(()=>restored.stop());
 assert.equal(restored.bridge.base,payload.vmixUrl);assert.equal(restored.settings.get().vmixInput,payload.vmixInput);assert.equal(restored.settings.get().ndi.name,'Saved');assert.equal(restored.ndi.snapshot().status,'stopped');assert.equal(restored.ndi.child,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {once} from 'node:events';
import http from 'node:http';
import {Studio} from '../state.mjs';
import {defaults} from '../assets.mjs';
import {createStudioServer} from '../server.mjs';
import {VmixBridge} from '../vmix.mjs';

test('TAKE owns independent clocks, rejects concurrent edits and ends without panel polling',()=>{
 let time=0;const s=new Studio(()=>time);s.edit({Speed:.5});time=1000;assert.equal(s.snapshot().animTime,1);
 const next={...defaults,Speed:1,Engine:2};s.take(next,2,10);time=1500;
 const state=s.snapshot();assert.equal(state.animTime,12);assert.equal(state.scene.oldTime,1.5);assert.equal(state.scene.progress,.25);
 assert.throws(()=>s.edit({Brightness:1}),/progress/);assert.throws(()=>s.take(next,1,0),/progress/);
 time=3100;assert.equal(s.snapshot().scene.status,0);s.edit({Brightness:.7});assert.equal(s.params.Brightness,.7);
});
test('parameter validation is atomic and preserves engine IDs',()=>{
 const s=new Studio(()=>0);assert.throws(()=>s.edit({Scale:.8,Engine:105}));assert.equal(s.params.Scale,.5);assert.throws(()=>s.edit({Mirror:1.5}));s.edit({Engine:104});assert.equal(s.params.Engine,104);
});
test('real HTTP panel protocol, auth, presets persistence, events and clean output',async t=>{
 const dataDir=pathToFileURL(mkdtempSync(join(tmpdir(),'souz-vmix-test-'))+'/');
 const app=createStudioServer({dataDir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.stop());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'X-Souz-Token':app.token};
 const get=path=>fetch(base+path,{headers}),post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body});
 const health=await (await fetch(base+'/health')).json();assert.equal(health.application,'souz-bg-studio-vmix');assert.match(health.version,/^\d+\.\d+\.\d+$/);assert.equal('token'in health,false);
 assert.equal((await fetch(base+'/api/shutdown',{method:'POST',body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/state')).status,403);
 assert.equal((await fetch(base+'/api/ndi/status')).status,403);
 assert.equal((await (await get('/api/ndi/status')).json()).status,'stopped');
 assert.equal((await post('/api/ndi/start',JSON.stringify({width:3840}))).status,400);
 assert.equal((await (await get('/api/ndi/status')).json()).status,'stopped');
 assert.equal((await post('/api/params','Scale 0.9',{Origin:'http://elsewhere.test'})).status,403);
 assert.equal((await post('/api/params','Scale 0.9\nEngine 200')).status,400);
 assert.equal((await (await get('/api/state')).json()).params.Scale,.5);
 assert.equal((await post('/api/params','Scale 0.7')).status,200);
 const values=Object.entries(defaults).map(([k,v])=>`${k} ${v}`).join('\n');
 assert.equal((await post('/api/presets','Name Test scene\n'+values)).status,200);
 assert.equal(JSON.parse(readFileSync(new URL('presets.json',dataDir)))[0].name,'Test scene');
 const second=createStudioServer({dataDir});second.server.listen(0,'127.0.0.1');await once(second.server,'listening');t.after(()=>second.stop());
 const restored=await (await fetch(`http://127.0.0.1:${second.server.address().port}/api/presets`,{headers:{'X-Souz-Token':second.token}})).json();assert.equal(restored.presets[0].name,'Test scene');assert.equal(restored.presets[0].values.Engine,defaults.Engine);
 const ac=new AbortController(),events=await fetch(base+'/api/events?token='+app.token,{signal:ac.signal});
 const reader=events.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/data: .*"revision"/);ac.abort();
 const output=await (await get('/output')).text();assert.match(output,/canvas/);assert.doesNotMatch(output,/take-duration/);
 assert.match(await (await get('/studio')).text(),/const SCHEMA=/);
 assert.equal((await post('/api/take','Duration 0.1\nTime 7\n'+values)).status,200);
 await new Promise(r=>setTimeout(r,150));assert.equal((await (await get('/api/state')).json()).scene.status,0);
});
test('authenticated shutdown closes the runtime without terminating unrelated processes',async()=>{
 const app=createStudioServer({dataDir:pathToFileURL(mkdtempSync(join(tmpdir(),'souz-stop-'))+'/')});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const closed=once(app.server,'close'),base=`http://127.0.0.1:${app.server.address().port}`;
 const response=await fetch(base+'/api/shutdown',{method:'POST',headers:{'X-Souz-Token':app.token},body:'{}'});
 assert.equal(response.status,200);assert.equal((await response.json()).ok,true);await closed;assert.equal(app.server.listening,false);assert.equal(app.ndi.snapshot().status,'stopped');
});
test('vMix bridge uses exact GUID, distinguishes Preview and Fade, never retries commands',async t=>{
 const requests=[],mock=http.createServer((req,res)=>{requests.push(req.url);if(req.url==='/api/'){res.end('<vmix><inputs/></vmix>');}else{res.statusCode=500;res.end('failed');}});
 mock.listen(0,'127.0.0.1');await once(mock,'listening');t.after(()=>mock.close());
 const b=new VmixBridge();b.configure(`http://127.0.0.1:${mock.address().port}`);assert.equal((await b.state()).connected,true);
 const id='12345678-1234-1234-1234-123456789abc';await assert.rejects(()=>b.command('Fade',id,1000),/500/);
 assert.equal(requests.length,2);assert.match(requests[1],/Function=Fade&Input=12345678/);assert.match(requests[1],/Duration=1000/);
 await assert.rejects(()=>b.command('Cut','1',0));assert.throws(()=>b.configure('https://example.com'));assert.equal(requests.length,2);
});

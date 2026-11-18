import test from 'node:test';
import assert from 'node:assert/strict';
import {Preparation} from '../preparation.mjs';
import {createStudioServer} from '../server.mjs';
import {defaults} from '../assets.mjs';
import {mkdtempSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('all outputs must acknowledge the exact preparation before committing',async()=>{
 const p=new Preparation();p.connect('browser');p.connect('obs');let commits=0;
 const result=p.run(9,()=>commits++),id=p.describe().id;
 assert.throws(()=>p.assertIdle(),/andamento/);
 assert.equal(p.ready('unknown',id),false);assert.equal(p.ready('browser','stale'),false);
 p.ready('browser',id);assert.equal(commits,0);assert.equal(p.describe().waiting,1);
 p.ready('obs',id);await result;assert.equal(commits,1);assert.equal(p.describe(),null);
});
test('disconnect, timeout and shader failure never commit the new scene',async()=>{
 const p=new Preparation(20);p.connect('a');p.connect('b');let commits=0;
 let result=p.run(1,()=>commits++);p.ready('a',p.describe().id);p.disconnect('a');await assert.rejects(result,/desconectada/);
 result=p.run(1,()=>commits++);await assert.rejects(result,/pronta/);
 result=p.run(1,()=>commits++);p.cancel('Shader failed');await assert.rejects(result,/Shader failed/);
 assert.equal(commits,0);assert.equal(p.describe(),null);p.disconnect('b');await p.run(1,()=>commits++);assert.equal(commits,1);
});
test('HTTP TAKE keeps PGM intact until output readiness, then runs the requested duration',async t=>{
 const app=createStudioServer({dataDir:pathToFileURL(mkdtempSync(join(tmpdir(),'souz-ready-'))+'/'),preparationTimeoutMs:1500});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.stop());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'X-Souz-Token':app.token},output='12345678-1234-1234-1234-123456789abc';
 const controller=new AbortController();t.after(()=>controller.abort());
 const events=await fetch(base+'/api/events?token='+app.token+'&output='+output,{signal:controller.signal});
 const reader=events.body.getReader();await reader.read();
 const values={...defaults,Engine:42},body=['Duration 2','Time 10',...Object.entries(values).map(([k,v])=>`${k} ${v}`)].join('\n');
 const take=fetch(base+'/api/take',{method:'POST',headers,body});
 let state;for(let i=0;i<30;i++){state=await (await fetch(base+'/api/state',{headers})).json();if(state.preparation)break;await new Promise(r=>setTimeout(r,10));}
 assert.ok(state.preparation);assert.equal(state.params.Engine,0);assert.equal(state.scene.status,1);
 assert.equal((await fetch(base+'/api/params',{method:'POST',headers,body:'Brightness 0.8'})).status,409);
 const ready=await fetch(base+'/api/output/ready',{method:'POST',headers,body:JSON.stringify({outputId:output,preparationId:state.preparation.id})});assert.equal((await ready.json()).accepted,true);
 const committed=await (await take).json();assert.equal(committed.params.Engine,42);assert.equal(committed.scene.duration,2);assert.ok(committed.scene.progress<.1);assert.equal(committed.preparation,null);
});

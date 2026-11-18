// Explicit hardware/runtime integration check, excluded from the unit test suite.
import {createStudioServer} from '../server.mjs';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults} from '../assets.mjs';
const app=createStudioServer({dataDir:pathToFileURL(mkdtempSync(join(tmpdir(),'souz-ndi-check-'))+'/')});
try{
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const base=`http://127.0.0.1:${app.server.address().port}`;
 console.log('Starting actual shared-shader GPU -> RGBA -> NDI integration check');
 console.log(await app.ndi.start({name:'Souz Integration Check',width:1920,height:1080,fps:30},base,app.token));
 const body=['Duration 1','Time 0',...Object.entries({...defaults,Engine:42}).map(([k,v])=>`${k} ${v}`)].join('\n');
 const take=await fetch(base+'/api/take',{method:'POST',headers:{'X-Souz-Token':app.token},body});
 if(!take.ok)throw Error('NDI output did not acknowledge TAKE: '+await take.text());
 await new Promise(r=>setTimeout(r,5000));
 const check=spawn(process.env.SOUZ_PYTHON||'python',[fileURLToPath(new URL('receive_check.py',import.meta.url)),'Souz Integration Check'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 check.stdout.on('data',b=>process.stdout.write(b));check.stderr.on('data',b=>process.stderr.write(b));
 const [code]=await once(check,'exit');if(code!==0)throw Error('Real NDI receiver check failed');
 console.log('PASS:',app.ndi.snapshot());
 const redBody=Object.entries({Speed:0,TintBlackR:1,TintBlackG:0,TintBlackB:0,TintWhiteR:1,TintWhiteG:0,TintWhiteB:0}).map(([k,v])=>`${k} ${v}`).join('\n');
 const red=await fetch(base+'/api/params',{method:'POST',headers:{'X-Souz-Token':app.token},body:redBody});if(!red.ok)throw Error('Cannot set color check');
 await new Promise(r=>setTimeout(r,300));
 const colorCheck=spawn(process.env.SOUZ_PYTHON||'python',[fileURLToPath(new URL('receive_check.py',import.meta.url)),'Souz Integration Check','--red'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 colorCheck.stdout.on('data',b=>process.stdout.write(b));colorCheck.stderr.on('data',b=>process.stderr.write(b));
 const [colorCode]=await once(colorCheck,'exit');if(colorCode!==0)throw Error('Real NDI color check failed');
 await app.ndi.stop();if(app.preparation.outputs.size)await new Promise(r=>setTimeout(r,100));
 if(app.preparation.outputs.size)throw Error('NDI output did not unregister');
}finally{await app.ndi.stop();app.stop();}

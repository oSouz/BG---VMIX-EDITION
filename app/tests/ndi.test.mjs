import test from 'node:test';
import assert from 'node:assert/strict';
import {NdiController,validateNdiOptions} from '../ndi/controller.mjs';

test('NDI configuration bounds resolution and source name before launching processes',()=>{
 assert.deepEqual(validateNdiOptions({}),{name:'Souz BG Studio',width:1920,height:1080,fps:30});
 for(const options of [{width:1919},{width:3840},{height:2160},{fps:0},{fps:59.94},{name:'bad/source'},{name:'   '},{name:'x'.repeat(101)}])assert.throws(()=>validateNdiOptions(options));
 const ndi=new NdiController();assert.equal(ndi.snapshot().status,'stopped');assert.equal(ndi.snapshot().frames,0);
});

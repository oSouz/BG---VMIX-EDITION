// DOM adapter + actual JavaScript + actual HTTP server. Not a visual layout test.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
// Saved backgrounds go to a throwaway file, never to the real user folder.
const presetsDir=mkdtempSync(join(tmpdir(),'souz-presets-'));
const child=spawn(process.argv[2],[],{stdio:['pipe','pipe','inherit'],env:{...process.env,SOUZ_PRESETS_FILE:join(presetsDir,'backgrounds.txt')}});
const source=readFileSync(new URL('../web/panel.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.slice(8,-9)).find(s=>s.includes('const SCHEMA='));
function dom(){
 const nodes=[],ids=new Map();
 class Element{
  readyState=2;videoWidth=1920;videoHeight=1080;hidden=false;
  async play(){}
  replaceWith(){}
  getContext(){return null}
  toBlob(callback){callback(new Blob([new Uint8Array([255,216,1,2,255,217])],{type:'image/jpeg'}))}
  value='';checked=false;disabled=false;textContent='';events={};children=[];dataset={};attrs={};
  classList={add:n=>{this.attrs.class=(this.attrs.class||'')+' '+n},toggle:(n,on)=>{this.attrs.class=on?n:''}};
  style={};focus(){} select(){} replaceChildren(...children){this.children=children} querySelectorAll(){return []}
  constructor(tag){this.tag=tag;nodes.push(this)}
  removeAttribute(n){delete this.attrs[n]}
  setAttribute(n,v){this.attrs[n]=String(v);if(n==='id')ids.set(v,this);if(n==='value')this.value=String(v)}
  addEventListener(n,f){this.events[n]=f}append(...nodes){this.children.push(...nodes)}
  contains(n){return this===n||this.children.some(c=>c.contains?.(n))}getAttribute(n){return this.attrs[n]}
 }
 for(const id of ['colors-palettes','colors-custom','bg-palettes','palette-name','status','generator-controls','color-controls','tint-controls','color-cards','custom','instance','links','native-preview','preview-empty','preview-status','preview-pause','color-tabs','network-qr','network-overlay','network-open','network-close','network-address','network-link','network-status','network-copy','network-test','pairing','pairing-key','pairing-connect','pairing-code','pairing-owner','pairing-generate','workspace','view-preview','view-controls','parameter-controls','colors-adjust','engine-categories','engine-gallery','engine-next','engine-prev','engine-page','bank-pgm','bank-pvw','bank-hint','copy-pgm','monitor-title','take','take-duration','take-note','take-progress','take-seconds','palette-search-toggle','essential-controls','inspector-title','inspector-badge','inspector-scope','panel-essential','panel-generator','panel-params','panel-colors','panel-presets','preset-name','preset-save','preset-note','preset-list','preset-export','preset-import','preset-file']){const e=new Element(['custom','take','copy-pgm','preset-save','preset-export','preset-import'].includes(id)?'button':['preset-name','preset-file'].includes(id)?'input':'div');e.setAttribute('id',id)}
 ids.get('take-duration').value='1.5';
 return {nodes,ids,document:{addEventListener(){},querySelector:s=>ids.get(s.slice(1)),querySelectorAll:s=>nodes.filter(n=>s.split(',').map(x=>x.split(' ').pop()).includes(n.tag)),createElement:tag=>new Element(tag)}};
}
const wait=async check=>{for(let i=0;i<150;i++){if(await check())return;await new Promise(r=>setTimeout(r,20))}throw Error('UI timeout')};
try{
 const [line]=await once(child.stdout,'data');const harnessLines=[];child.stdout.on('data',d=>harnessLines.push(...String(d).trim().split('\n')));const[port,token]=String(line).trim().split(' ');const base=`http://127.0.0.1:${port}`;
 const ui=dom();let trackStopped=false;const track={stop(){trackStopped=true},addEventListener(){}};const media={getTracks:()=>[track],getVideoTracks:()=>[track]};const context={Date,performance,console:{error(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},isSecureContext:true,navigator:{mediaDevices:{getDisplayMedia:async()=>media}},URL,Blob,clearTimeout,document:ui.document,window:{addEventListener(){}},location:{hash:'#'+token,protocol:'http:',search:''},fetch:(path,opts)=>fetch(base+path,opts),AbortController,AbortSignal,URLSearchParams,setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),setInterval:(fn,ms)=>setInterval(fn,ms).unref(),clearInterval};vm.createContext(context);vm.runInContext(source,context);
 const get=()=>fetch(base+'/api/state',{headers:{'X-Souz-Token':token}}).then(r=>r.json()).then(s=>s.params);
 await wait(()=>!ui.ids.get('p-Speed').disabled);assert.equal(ui.ids.get('generator-controls').children.length,1);assert.equal(ui.ids.get('parameter-controls').children.length,15);assert.equal(ui.ids.get('color-controls').children.length,4);
 assert.equal(ui.ids.get('p-Engine').children.length,97); // 8 removed duplicates are hidden
 // Essenciais (v1.13): repeated controls share the same state as the other tabs.
 assert.deepEqual(ui.ids.get('essential-controls').children.map(w=>w.children.find(e=>e.attrs.id?.startsWith('p-'))?.attrs.id),['p-Engine-ess','p-Speed-ess','p-Scale-ess','p-Rotation-ess','p-Brightness-ess','p-Contrast-ess']);
 assert.equal(ui.ids.get('inspector-badge').textContent,'Ao vivo');assert(ui.ids.get('inspector-scope').textContent.includes('PGM'));
 // Exact value fields: readable units, and typing writes the same parameter as the slider.
 assert.equal(vm.runInContext('NUM.PositionX.to(.25)',context),-50);assert.equal(vm.runInContext('NUM.Speed.from(1)',context),.5);
 // Engine gallery: 7 categories covering all 105 engines, 8 real thumbnails per page.
 assert.equal(vm.runInContext('ENGINE_CATEGORIES.length',context),7);assert.equal(vm.runInContext('ENGINE_CATEGORIES.reduce((n,c)=>n+c.engines.length,0)',context),97);
 assert.equal(ui.ids.get('engine-gallery').children.length,8);assert(ui.ids.get('engine-gallery').children.every(b=>b.children[0].attrs.src.startsWith('data:image/jpeg;base64,')));
 for(const name of ['Engine','Scale','Density','Smoothness','Blur','Speed','Warp','Rotation','Reverse','Brightness','Contrast','Saturation','PositionX','PositionY','Twist','Ripple','Stretch','Mirror','Vignette','Grain','Posterize']){
  const input=ui.ids.get('p-'+name);assert(input,name);
  const value=name==='Engine'?104:name==='Mirror'?3:name==='Shape'?13:name==='ColorizePalette'?8:name==='ColorizeMode'?2:['Reverse','Invert','Warp','Pulse'].includes(name)?1:.61;
  input.value=String(value);input.checked=true;(input.events.change||input.events.input)();await wait(async()=>Math.abs((await get())[name]-value)<1e-5);
 }
 // Presets reach the native state together without changing motion.
 ui.ids.get('colors-custom').events.click();
 assert.equal(ui.ids.get('bg-palettes').hidden,true);
 assert.equal(ui.ids.get('tint-controls').hidden,false);
 ui.ids.get('colors-palettes').events.click();
 assert.equal(ui.ids.get('bg-palettes').hidden,false);
 assert.equal(ui.ids.get('tint-controls').hidden,true);
 const beforePalette=await get();
 const paletteIndex=n=>vm.runInContext(`BG_PALETTES.findIndex(p=>p[0]===${JSON.stringify(n)})`,context);
 assert.equal(vm.runInContext('BG_PALETTES.length',context),60);assert.equal(vm.runInContext('PALETTE_GROUPS.length',context),10);
 const folders=ui.ids.get('bg-palettes').children.filter(c=>c.attrs.class==='palette-folder');assert.equal(folders.length,10);
 assert.deepEqual(folders.map(f=>!!f.open),[true,false,false,false,false,false,false,false,false,false]); // families are folders, first one open
 // Subtle search next to Ajustes: name (any part, no accents) or family (beginning).
 const search=ui.ids.get('palette-search'),shown=b=>!b.hidden;assert(search.hidden);
 ui.ids.get('palette-search-toggle').events.click();assert(!search.hidden);
 const find=q=>{search.value=q;search.events.input();return Array.from(vm.runInContext('paletteButtons',context).filter(shown),b=>b.attrs['aria-label'].slice(8))};
 assert.deepEqual(find('limao'),['Limão']);assert.equal(find('azu').length,6);assert.deepEqual(find('ros'),['Rosa suave','Neon','Chiclete','Magenta','Blush','Fúcsia'].sort((a,b)=>vm.runInContext('BG_PALETTES.findIndex(p=>p[0]==='+JSON.stringify(a)+')',context)-vm.runInContext('BG_PALETTES.findIndex(p=>p[0]==='+JSON.stringify(b)+')',context)));
 assert(!vm.runInContext('paletteEmpty.hidden',context)||find('xyz').length===0);find('xyz');assert.equal(vm.runInContext('paletteEmpty.hidden',context),false);
 search.events.keydown({key:'Escape'});assert(search.hidden);assert.equal(vm.runInContext('paletteButtons',context).filter(shown).length,60);
 assert(vm.runInContext('PALETTE_GROUPS.every(([,l])=>l.length===6)',context));
 ui.ids.get('bg-palette-'+paletteIndex('Aurora')).events.click();
 await wait(async()=>{const s=await get();return Math.abs(s.TintBlackR-16/255)<1e-5&&Math.abs(s.TintWhiteG-242/255)<1e-5});
 const afterPalette=await get();
 for(const n of ['Engine','Speed','Brightness','Contrast','Saturation'])assert.equal(afterPalette[n],beforePalette[n]);
 assert.equal(ui.ids.get('palette-name').textContent,'Aurora');
 ui.ids.get('bg-palette-'+paletteIndex('Puro')).events.click();
 await wait(async()=>{const s=await get();return s.TintBlackR===0&&s.TintWhiteG===1});
 // Tint: individual HEX fields reach native state; host changes update the picker.
 const blackHex=ui.ids.get('TintBlack-hex'),whiteHex=ui.ids.get('TintWhite-hex');
 blackHex.value='#FF0000';blackHex.events.change();
 await wait(async()=>{const s=await get();return s.TintBlackR===1&&s.TintBlackG===0&&s.TintBlackB===0});
 assert.equal((await get()).TintWhiteG,1);
 whiteHex.value='#00FF00';whiteHex.events.change();
 await wait(async()=>{const s=await get();return s.TintWhiteR===0&&s.TintWhiteG===1&&s.TintWhiteB===0});
 blackHex.value='bad';blackHex.events.change();assert.equal(blackHex.attrs['aria-invalid'],'true');assert.equal((await get()).TintBlackR,1);
 child.stdin.write('param TintBlackR 0\nparam TintBlackG 0\nparam TintBlackB 1\n');
 await wait(()=>blackHex.value==='#0000FF');
 const brightness=ui.ids.get('TintBlack-B-HSB');brightness.validity={valid:true};brightness.value='50';brightness.events.input();
 await wait(async()=>Math.abs((await get()).TintBlackB-.5)<.001);
 // Pulse is a real pressed button, toggles the server and follows host changes.
 const pulse=ui.ids.get('p-Pulse');assert.equal(pulse.tag,'button');
 pulse.events.click();await wait(async()=>(await get()).Pulse===1);assert.equal(pulse.textContent,'pulse on');assert.equal(pulse.attrs['aria-pressed'],'true');
 pulse.events.click();await wait(async()=>(await get()).Pulse===0);assert.equal(pulse.textContent,'pulse off');
 child.stdin.write('param Pulse 1\n');await wait(()=>pulse.textContent==='pulse on');
 const order=id=>ui.ids.get(id).children.map(c=>c.children.find(e=>e.attrs.id?.startsWith('p-'))?.attrs.id);
 assert.deepEqual(order('generator-controls'),['p-Engine']);
 const params=ui.ids.get('parameter-controls').children;
 assert.deepEqual(order('parameter-controls').slice(1,-1),['p-Scale','p-Speed','p-Rotation','p-Density','p-Smoothness','p-Blur','p-Twist','p-Ripple','p-Stretch','p-Mirror','p-Vignette','p-Grain','p-Posterize']);
 const ids=c=>c.children.map(w=>w.children.find(e=>e.attrs.id?.startsWith('p-'))?.attrs.id);
 assert.deepEqual(ids(params[0]),['p-PositionX','p-PositionY']);assert.deepEqual(ids(params.at(-1)),['p-Warp','p-Reverse']); // position on top, switches at the bottom
 for(const n of ['PositionX','PositionY','Scale','Speed','Rotation','Density','Smoothness','Blur','Twist','Ripple','Stretch','Mirror','Vignette','Grain','Posterize','Warp','Reverse'])assert(ui.ids.get('reset-'+n),'reset '+n);
 assert.equal(vm.runInContext('display("PositionX",.25)',context),'-50%');
 for(const name of ['Shape','Seed','ColorShift','Invert','ColorizeMode','ColorizePalette'])assert(!ui.ids.has('p-'+name));
 // Host->panel for a dropdown, slider and switch.
 child.stdin.write('param Engine 4\nparam Contrast 0.22\nparam Reverse 0\n');
 await wait(()=>Number(ui.ids.get('p-Engine').value)===4&&Math.abs(Number(ui.ids.get('p-Contrast').value)-.22)<1e-5&&!ui.ids.get('p-Reverse').checked);
 // Drag ends without freezing updates; rapid writes coalesce to latest value.
 const speed=ui.ids.get('p-Speed');for(let i=0;i<=20;i++){speed.value=String(i/20);speed.events.input()}
 await wait(async()=>(await get()).Speed===1);
 // No WebGL support must leave parameter controls functional.
 assert.equal(vm.runInContext('previewGL',context),null);assert.equal(vm.runInContext('previewRunning',context),false);
 assert(ui.ids.get('preview-status').textContent.includes('desligado'));
 ui.ids.get('preview-pause').events.click();
 assert(ui.ids.get('preview-status').textContent.includes('indisponível'));
 assert(!ui.ids.get('p-Speed').disabled);
 const state=await fetch(base+'/api/state',{headers:{'X-Souz-Token':token}}).then(r=>r.json());
 assert.equal(state.fade.duration,.6);assert.equal(state.fade.progress,1);
 for(const key of ['animTime','phase','bpm','width','height'])assert(Number.isFinite(state[key]),key);
 assert(!source.includes('getDisplayMedia'));
 vm.runInContext('previewFadeInitialized=false;advanceLocalFade(5,0);advanceLocalFade(3,.06);advanceLocalFade(7,.06)',context);
 assert.equal(vm.runInContext('previewFade.from',context),5);assert.equal(vm.runInContext('previewFade.to',context),3);assert(Math.abs(vm.runInContext('previewFade.progress',context)-.2)<1e-5);
 vm.runInContext('syncPreview({fade:{from:3,to:9,progress:.42},animTime:12,phase:.25,bpm:120,width:1920,height:1080})',context);
 assert.equal(vm.runInContext('previewFade.to',context),9);assert.equal(vm.runInContext('previewFade.progress',context),.42);

 // Pair using only the six-digit code; long token remains internal.
 await ui.ids.get('pairing-generate').events.click();
 const code=ui.ids.get('pairing-code').textContent;assert(/^\d{6}$/.test(code));
 ui.ids.get('network-address').value='http://192.168.1.10:54321';vm.runInContext('updateNetworkLink()',context);assert(ui.ids.get('network-qr').innerHTML.includes('<svg'));assert(!ui.ids.get('network-qr').innerHTML.includes(token));
 ui.ids.get('pairing-key').value=code;await ui.ids.get('pairing-connect').events.click();assert.equal(vm.runInContext('token',context),token);
 // Zero label resets actual defaults; global reset restores neutral tint.
 const exact=ui.ids.get('p-Scale-ess-value');exact.checkValidity=()=>true;exact.value='25';exact.events.change();
 await wait(async()=>Math.abs((await get()).Scale-.25)<1e-5);
 await wait(()=>Math.abs(Number(ui.ids.get('p-Scale').value)-.25)<1e-5&&ui.ids.get('p-Scale-value').value==='25'); // copy in Parâmetros follows
 ui.ids.get('reset-Contrast').events.click();await wait(async()=>Math.abs((await get()).Contrast-.5)<1e-5);
 ui.ids.get('reset-Twist').events.click();ui.ids.get('reset-Mirror').events.click();ui.ids.get('reset-Warp').events.click();
 await wait(async()=>{const s=await get();return s.Twist===.5&&s.Mirror===0&&s.Warp===0});
 assert.equal(vm.runInContext('display("Contrast",.5)',context),'0');
 ui.ids.get('custom').events.click();await wait(async()=>{const s=await get();return s.Brightness===.5&&s.Contrast===.5&&s.Saturation===.5&&s.Pulse===0});
 // Network credentials and pairing are independent of WebGL availability.
 ui.ids.get('pairing-key').value=base+'/#'+token;await ui.ids.get('pairing-connect').events.click();assert.equal(vm.runInContext('token',context),token);
 ui.ids.get('view-controls').events.click();assert.equal(ui.ids.get('workspace').dataset.view,'controls');
 await ui.ids.get('network-test').events.click();assert(ui.ids.get('network-status').textContent.includes('conectado ao plugin'));
 // PVW is an isolated draft; TAKE sends the complete scene; PGM is locked until the DLL finishes the fade.
 const live=await get();
 ui.ids.get('bank-pvw').events.click();assert.equal(ui.ids.get('monitor-title').textContent,'PVW · Preview');
 assert.equal(ui.ids.get('inspector-badge').textContent,'PVW');assert(ui.ids.get('inspector-scope').textContent.includes('PVW'));
 const engine=ui.ids.get('p-Engine');engine.value='77';engine.events.change();
 const posX=ui.ids.get('p-PositionX');posX.value='0.2';posX.events.input();
 await new Promise(r=>setTimeout(r,250));
 const untouched=await get();assert.equal(untouched.Engine,live.Engine);assert.equal(untouched.PositionX,live.PositionX);
 ui.ids.get('take-duration').value='2.5';
 await wait(()=>!ui.ids.get('take').disabled);await ui.ids.get('take').events.click();
 const scene=()=>fetch(base+'/api/state',{headers:{'X-Souz-Token':token}}).then(r=>r.json()).then(s=>s.scene);
 await wait(async()=>(await scene()).status===1);assert.equal((await scene()).duration,2.5);
 await wait(()=>vm.runInContext('sceneBusy',context)&&ui.ids.get('take').disabled);
 ui.ids.get('bank-pgm').events.click();await wait(()=>ui.ids.get('p-Speed').disabled); // PGM locked during the transition
 harnessLines.length=0;child.stdin.write('commit\n');await wait(()=>harnessLines.length>0);
 const gen=harnessLines[0].split(' ')[0];assert.notEqual(gen,'0');
 await wait(async()=>{const s=await get();return s.Engine===77&&Math.abs(s.PositionX-.2)<1e-5});
 const fading=await scene();assert.equal(fading.status,3);assert.equal(fading.from.Engine,live.Engine);
 child.stdin.write(`publish ${gen} 1 1\n`);
 await wait(async()=>(await scene()).status===0&&!vm.runInContext('sceneBusy',context)&&!ui.ids.get('p-Speed').disabled);
 assert.equal(Number(ui.ids.get('p-Engine').value),77);
 // Salvos: save the PGM scene by name, load it only into PVW, delete with confirmation, import a file.
 const presetList=()=>fetch(base+'/api/presets',{headers:{'X-Souz-Token':token}}).then(r=>r.json()).then(r=>r.presets);
 await wait(()=>vm.runInContext('presetsLoaded',context));assert.equal(ui.ids.get('preset-list').children[0].attrs.class,'preset-empty');
 assert.equal(ui.ids.get('preset-save').textContent,'Salvar PGM');
 ui.ids.get('preset-name').value='   ';await ui.ids.get('preset-save').events.click();
 assert.equal(ui.ids.get('preset-note').dataset.error,'true');assert.equal((await presetList()).length,0);
 ui.ids.get('preset-name').value='  Abertura\tdo culto  ';await ui.ids.get('preset-save').events.click();
 await wait(async()=>(await presetList()).length===1);
 let saved=(await presetList())[0];assert.equal(saved.name,'Abertura do culto');assert.equal(saved.values.Engine,77);assert(Math.abs(saved.values.PositionX-.2)<1e-5);
 assert.equal(ui.ids.get('preset-name').value,'');assert(ui.ids.get('preset-note').textContent.includes('salvo'));
 await wait(()=>ui.ids.get('preset-list').children.length===1&&ui.ids.get('preset-load-'+saved.id));
 child.stdin.write('param Engine 5\n');await wait(async()=>(await get()).Engine===5);
 ui.ids.get('preset-load-'+saved.id).events.click();
 assert.equal(vm.runInContext('bank',context),'pvw');assert.equal(vm.runInContext('pvwValues.Engine',context),77);assert.equal(ui.ids.get('preset-save').textContent,'Salvar PVW');
 await new Promise(r=>setTimeout(r,250));assert.equal((await get()).Engine,5,'loading never touches PGM');
 ui.ids.get('preset-delete-'+saved.id).events.click();assert.equal(ui.ids.get('preset-delete-'+saved.id).attrs['data-confirm'],'true');
 assert.equal((await presetList()).length,1,'first click only asks for confirmation');
 await ui.ids.get('preset-delete-'+saved.id).events.click();await wait(async()=>(await presetList()).length===0);
 await vm.runInContext(`importPresets(${JSON.stringify(JSON.stringify({format:'souz-bg-studio-backgrounds',version:1,presets:[{name:'Louvor',values:{Engine:12,Scale:.8,Future:3}},{name:'Bad',values:{Engine:999,Mirror:1.5,Scale:'x'}},{name:'',values:{}}]}))})`,context);
 const imported=await presetList();assert.deepEqual(imported.map(p=>p.name),['Louvor','Bad']);
 assert.equal(imported[0].values.Scale,.8);assert.equal(imported[1].values.Engine,0);assert.equal(imported[1].values.Mirror,0);assert.equal(imported[1].values.Scale,.5);
 assert(ui.ids.get('preset-note').textContent.includes('2 background'));
 await vm.runInContext('importPresets("not json")',context);assert.equal(ui.ids.get('preset-note').dataset.error,'true');
 child.stdin.write('stop1\n');await wait(()=>speed.disabled);
 // Offline preview never accesses the network and identifies itself clearly.
 const preview=dom();const ctx={performance,console:{error(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},document:preview.document,window:{addEventListener(){}},location:{hash:'',protocol:'file:',search:''},URLSearchParams,fetch:()=>{throw Error('unexpected preview network')},setTimeout,clearTimeout,setInterval:(fn,ms)=>setInterval(fn,ms).unref(),clearInterval,AbortController,AbortSignal};vm.createContext(ctx);vm.runInContext(source,ctx);assert(preview.ids.get('status').textContent.includes('Prévia visual'));assert(!preview.ids.get('p-Speed').disabled);
 // Scanned QR fills the code without treating it as a long authentication token.
 const tablet=dom();const tabletCtx={...ctx,document:tablet.document,location:{hash:'#pair=123456',protocol:'http:',search:''},fetch:()=>{throw Error('No automatic request before confirmation')}};
 vm.createContext(tabletCtx);vm.runInContext(source,tabletCtx);assert.equal(tablet.ids.get('pairing-key').value,'123456');assert.equal(vm.runInContext('token',tabletCtx),'');
 console.log('PASS: engine gallery, both groups, every control, PVW isolation, TAKE lock/commit/unlock, dropdown options, button pulse, reset and removal checks, host sync, rapid writes, disconnect, offline preview and saved backgrounds (save, load to PVW, delete, import)');
}finally{child.stdin.write('quit\n');child.stdin.end();child.on('exit',()=>rmSync(presetsDir,{recursive:true,force:true}));}

// Launch with Electron directly, without CDP/Playwright's capture instrumentation.
const {app,BrowserWindow,webContents,session}=require('electron');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
if(!process.env.CHERRY_TEST_PROFILE)throw new Error('A separate test profile is required');
const started=Date.now();require('../src/main');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(read,expected){for(let i=0;i<100;i++){if(await read()===expected)return;await pause(100);}throw new Error('Condition timed out');}
let server;
(async()=>{
 await app.whenReady();await until(()=>!!BrowserWindow.getAllWindows()[0]?.webContents.getURL(),true);
 const win=BrowserWindow.getAllWindows()[0];await until(()=>win.webContents.executeJavaScript('!!window.cherry').catch(()=>false),true);
 await until(()=>win.webContents.executeJavaScript("!!document.querySelector('.hero-search')?.offsetWidth && [...document.images].every(i=>i.complete && i.naturalWidth>0)"),true);
 const state=()=>win.webContents.executeJavaScript('window.cherry.getState()');
 const call=async(a,p)=>{const result=await win.webContents.executeJavaScript(`window.cherry.command(${JSON.stringify(a)},${JSON.stringify(p??null)})`);assert.equal(result.ok,true,result.error);return result;};
 const startupMs=Date.now()-started;const measurements=[];
 const measure=label=>({label,webContents:webContents.getAllWebContents().length,processes:app.getAppMetrics().length,workingSetKB:app.getAppMetrics().reduce((n,p)=>n+(p.memory?.workingSetSize||0),0)});
 server=http.createServer((req,res)=>{
  if(req.url==='/silence.wav'){const b=Buffer.alloc(22094);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(11025,24);b.writeUInt32LE(22050,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);res.setHeader('Content-Type','audio/wav');res.end(b);return;}
  if(req.url==='/download'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="memory-test.bin"','Content-Length':2097152});let sent=0;const timer=setInterval(()=>{res.write(Buffer.alloc(65536));sent+=65536;if(sent>=2097152){clearInterval(timer);res.end();}},150);res.on('close',()=>clearInterval(timer));return;}
  res.setHeader('Content-Type','text/html');res.end('<html><head><title>Native lifecycle fixture</title></head><body><h1>Real web content</h1><input id="draft"></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 await call('navigate',base);await until(async()=>(await state()).tabs.some(t=>t.loading),false);const first=(await state()).activeId;measurements.push(measure('baseline-one-web-tab'));
 for(let round=0;round<3;round++){
  for(let i=0;i<19;i++)await call('new-tab',`${base}?round=${round}&tab=${i}`);
  await until(async()=>(await state()).tabs.some(t=>t.loading),false);measurements.push(measure(`round-${round+1}-20-tabs`));
  const target=(await state()).tabs[1];await call('activate-tab',first);
  const wc=webContents.getAllWebContents().find(w=>w.getURL()===target.url);
  assert.equal(wc.isBeingCaptured(),false,'Unexpected external capture: lifecycle test needs uncaptured webContents');
  await call('suspend-tab',{id:target.id,confirmed:true});assert.equal((await state()).tabs.find(t=>t.id===target.id).suspended,true);assert.equal(wc.isDestroyed(),true);
  await call('activate-tab',target.id);await until(async()=>(await state()).tabs.some(t=>t.loading),false);assert.equal((await state()).tabs.find(t=>t.id===target.id).suspended,false);
  const activeDenied=await win.webContents.executeJavaScript(`window.cherry.command('suspend-tab',{id:${JSON.stringify(target.id)},confirmed:true})`);assert.equal(activeDenied.ok,false);
  const restored=webContents.getAllWebContents().find(w=>w.getURL()===target.url);await restored.executeJavaScript("document.querySelector('#draft').value='unsaved test draft'");await call('activate-tab',first);await call('tab-auto-suspend',{id:target.id,enabled:true});
  const editedDenied=await win.webContents.executeJavaScript(`window.cherry.command('suspend-tab',{id:${JSON.stringify(target.id)}})`);assert.equal(editedDenied.ok,false);
  if(round===0){
   await restored.executeJavaScript("document.querySelector('#draft').value='';window.testAudio=new Audio('/silence.wav');testAudio.loop=true;document.body.append(testAudio);testAudio.play()",true);
   const audioDenied=await win.webContents.executeJavaScript(`window.cherry.command('suspend-tab',{id:${JSON.stringify(target.id)},confirmed:true})`);assert.equal(audioDenied.ok,false);await restored.executeJavaScript('testAudio.pause();testAudio.remove()');
   session.fromPartition('persist:cherry-web').once('will-download',(_e,item)=>item.setSavePath(path.join(process.env.CHERRY_TEST_PROFILE,'memory-test.bin')));restored.downloadURL(base+'download');
   await until(async()=>(await state()).downloads[0]?.received>0,true);
   const downloadDenied=await win.webContents.executeJavaScript(`window.cherry.command('suspend-tab',{id:${JSON.stringify(target.id)},confirmed:true})`);assert.equal(downloadDenied.ok,false);await call('cancel-download',(await state()).downloads[0].id);await until(async()=>(await state()).downloads[0].state,'cancelled');
  }
  for(const t of (await state()).tabs.filter(t=>t.id!==first))await call('close-tab',t.id);
  await pause(1200);assert.equal(webContents.getAllWebContents().length,2);measurements.push(measure(`round-${round+1}-closed-to-baseline`));
 }
 const report={method:'Direct Electron launch, no Playwright/CDP, real WebContents disposal and reload',version:require('../package.json').version,startupMs,startupScope:'main test entry start to visible New Tab search and decoded local images; excludes OS process bootstrap',platform:process.platform,arch:process.arch,electron:process.versions.electron,measurements,checks:['three cycles of 20 actual tabs','suspend destroys background WebContents','wake reloads URL','active tab protected','unsaved input protected','playing silent WAV media protected','background active download protected; cancelled through real DownloadItem','all child WebContents return to baseline after closing']};
 fs.mkdirSync(path.resolve('docs'),{recursive:true});fs.writeFileSync(path.resolve('docs/native-lifecycle.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));server.close();app.quit();
})().catch(error=>{console.error(error);if(server)server.close();app.exit(1);});

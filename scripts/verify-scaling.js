const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
(async()=>{
 const results=[];
 for(const scale of [1.25,1.5]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'elysium-scale-'));
  const instance=await electron.launch({...(process.env.ELYSIUM_EXECUTABLE?{executablePath:process.env.ELYSIUM_EXECUTABLE,args:[`--force-device-scale-factor=${scale}`]}:{args:[path.resolve('.'),`--force-device-scale-factor=${scale}`]}),env:{...process.env,ELYSIUM_TEST_PROFILE:profile}});
  try{
   const page=await instance.firstWindow();await page.waitForSelector('.hero-search');
   await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({x:30,y:30,width:1366,height:768}));
   await expect.poll(()=>page.evaluate(()=>Math.abs(innerWidth-1366)<=1)).toBe(true);await page.waitForTimeout(300);
   const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,search:document.querySelector('.hero-search').getBoundingClientRect().toJSON(),shortcuts:document.querySelector('.quick-links').getBoundingClientRect().toJSON()}));
   expect(geometry.dpr).toBe(scale);expect(geometry.shortcuts.bottom).toBeLessThanOrEqual(geometry.height);
   const captured=await instance.evaluate(async({BrowserWindow,desktopCapturer},scale)=>{const w=BrowserWindow.getAllWindows()[0];const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:Math.ceil(1366*scale),height:Math.ceil(768*scale)}});const s=sources.find(s=>s.id===w.getMediaSourceId());if(!s||s.thumbnail.isEmpty())throw new Error('No native window capture');return {png:s.thumbnail.toPNG().toString('base64'),pixels:s.thumbnail.getSize()};},scale);
   fs.writeFileSync(path.resolve(`docs/screenshots/scaling-${scale*100}.png`),Buffer.from(captured.png,'base64'));
   await page.evaluate(()=>window.elysium.command('navigate','https://example.com/'));
   await expect.poll(async()=>{const s=await page.evaluate(()=>window.elysium.getState());return s.tabs[0].title.includes('Example Domain')&&!s.tabs[0].loading&&!s.tabs[0].error;},{timeout:30000}).toBe(true);
   await page.evaluate(()=>window.elysium.command('panel','notes'));
   await expect(page.locator('#side-panel')).toBeVisible();
   const native=await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents?.getURL().startsWith('http')).map(v=>({bounds:v.getBounds(),visible:v.getVisible()})));
   const shellBounds=await page.locator('#viewport').boundingBox();
   expect(Math.abs(native[0].bounds.x-shellBounds.x)).toBeLessThanOrEqual(1);expect(Math.abs(native[0].bounds.width-shellBounds.width)).toBeLessThanOrEqual(1);expect(native[0].bounds.y).toBe(96);
   results.push({scale,geometry,captured:captured.pixels,nativeBounds:native[0].bounds});
  }finally{await instance.close();}
 }
 const report={method:'Chromium force-device-scale-factor simulation. Host Windows display settings were not changed; this is not a physical Windows DPI test.',results};fs.writeFileSync(path.resolve('docs/scaling-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});

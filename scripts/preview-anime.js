const { _electron: electron, expect }=require('@playwright/test');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cherry-anime-preview-'));
 const instance=await electron.launch({args:[path.resolve('.')],env:{...process.env,CHERRY_TEST_PROFILE:profile}});
 try{
  await instance.firstWindow();await expect.poll(()=>instance.windows().some(p=>p.url().endsWith('/index.html'))).toBe(true);
  const page=instance.windows().find(p=>p.url().endsWith('/index.html'));page.on('pageerror',e=>console.error(e));
  await expect(page.locator('.hero h1')).toContainText('Browse smarter.');
  console.log(await instance.evaluate(({screen,BrowserWindow})=>({displays:screen.getAllDisplays().map(d=>({size:d.size,scale:d.scaleFactor})),window:BrowserWindow.getAllWindows()[0].getBounds()})));
  for(const [width,height]of [[1440,900],[1366,768]]){
   await instance.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setBounds({x:0,y:0,...size}),{width,height});
   await page.waitForTimeout(300);
   await page.screenshot({path:`docs/screenshots/draft-newtab-${width}.png`});
  }
  console.log('state',await page.evaluate(async()=>{const s=await window.cherry.getState();return {tabCount:s.tabs.length,workspaceCount:s.workspaces.length,ui:s.ui};}));
 }finally{await instance.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

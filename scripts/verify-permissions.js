// Uses an isolated packaged app and a public HTTPS document. The native dialog is
// replaced only in this test process so the request can be denied automatically.
const {_electron:electron,expect}=require('@playwright/test');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'elysium-permission-'));
 const instance=await electron.launch({executablePath:path.resolve('release/win-unpacked/elysium-browser.exe'),args:[],env:{...process.env,ELYSIUM_TEST_PROFILE:profile}});
 try{
  const page=await instance.firstWindow();await page.waitForSelector('.hero-search');await page.evaluate(()=>window.elysium.command('navigate','https://example.com/'));
  await expect.poll(async()=>{const s=await page.evaluate(()=>window.elysium.getState());return !s.tabs[0].loading&&s.tabs[0].title==='Example Domain';},{timeout:30000}).toBe(true);
  const permission=await instance.evaluate(async({webContents,dialog})=>{const w=webContents.getAllWebContents().find(w=>w.getURL()==='https://example.com/');const original=dialog.showMessageBox;let prompt='';dialog.showMessageBox=async(_win,options)=>{prompt=options.message;return {response:0};};try{return {decision:await w.executeJavaScript('Notification.requestPermission()',true),prompt};}finally{dialog.showMessageBox=original;}});
  expect(permission.decision).toBe('denied');expect(permission.prompt).toContain('https://example.com');
  await page.evaluate(()=>window.elysium.command('permission-set',{origin:'https://example.com',permission:'notifications',value:'deny'}));await page.evaluate(()=>window.elysium.command('clear-origin-data','https://example.com'));
  expect((await page.evaluate(()=>window.elysium.getState())).permissions['https://example.com']).toBeUndefined();
  const report={method:'Actual HTTPS Notification.requestPermission with an intercepted native dialog returning deny; no hardware permission was granted',permission,revocation:true};fs.writeFileSync(path.resolve('docs/permissions-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await instance.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

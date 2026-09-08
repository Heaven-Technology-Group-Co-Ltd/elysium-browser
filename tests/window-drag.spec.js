const {test,expect,_electron:electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

for(const scale of [1,1.25])test(`native drag areas follow chrome without blocking controls at ${scale*100}% scale`,async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'elysium-drag-e2e-'));
  const args=[`--force-device-scale-factor=${scale}`];
  const app=await electron.launch({...process.env.ELYSIUM_EXECUTABLE?{executablePath:process.env.ELYSIUM_EXECUTABLE,args}:{args:[path.resolve('.'),...args]},env:{...process.env,ELYSIUM_TEST_PROFILE:profile}});
  try{
    await app.firstWindow();await expect.poll(()=>app.windows().some(p=>p.url().endsWith('/index.html'))).toBe(true);
    const page=app.windows().find(p=>p.url().endsWith('/index.html'));const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const call=(a,p)=>page.evaluate(([a,p])=>window.elysium.command(a,p),[a,p]);
    const uncoveredHeader=()=>page.evaluate(()=>{
      const side=document.querySelector('.sidebar').getBoundingClientRect();
      const nav=document.querySelector('.navigation').getBoundingClientRect();
      const button=document.querySelector('#compact-toggle').getBoundingClientRect();
      const misses=[];
      for(let y=8;y<nav.top-1;y+=4)for(let x=8;x<side.right-1;x+=4){
        if(x>=button.left-1&&x<=button.right+1&&y>=button.top-1&&y<=button.bottom+1)continue;
        const el=document.elementFromPoint(x,y);
        if(!el?.classList.contains('native-window-drag-region'))misses.push({x,y});
      }
      return misses;
    });
    for(let i=0;i<11;i++)await call('new-tab');
    for(const [width,height] of [[1440,900],[1024,768]]){
      await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setBounds({x:30,y:30,width,height}),{width,height});
      await expect.poll(()=>page.evaluate(()=>innerWidth)).toBeGreaterThanOrEqual(width-1);
      await page.locator('.tab.active .tab-close').scrollIntoViewIfNeeded();
      await expect.poll(()=>page.evaluate(()=>{
        const name=document.querySelector('.brand-name').getBoundingClientRect();
        const target=document.elementFromPoint(name.left+name.width/2,name.top+name.height/2);
        return target?.classList.contains('native-window-drag-region')&&getComputedStyle(target).webkitAppRegion==='drag';
      })).toBe(true);
      const hit=await page.evaluate(()=>{
        const t=document.querySelector('.titlebar-drag').getBoundingClientRect();
        const hit=document.elementFromPoint(t.x+t.width/2,t.y+t.height/2);
        const controls=['#compact-toggle','#new-tab','#back','#address','#bookmark-toggle','.tab.active .tab-close','.navigation [data-page="calendar"]'];
        return {space:t.width,title:hit?.classList.contains('native-window-drag-region'),controls:controls.map(s=>{const el=document.querySelector(s),r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{selector:s,unblocked:el===hit||el.contains(hit)};})};
      });
      expect(hit.space).toBeGreaterThanOrEqual(96);expect(hit.title).toBe(true);expect(hit.controls.filter(c=>!c.unblocked)).toEqual([]);
      await expect.poll(uncoveredHeader).toEqual([]);
      const toggle=page.locator('#compact-toggle');await toggle.click();await expect(page.locator('body')).toHaveAttribute('data-sidebar','compact');
      await expect.poll(uncoveredHeader).toEqual([]);
      await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('body')).toHaveAttribute('data-sidebar','full');
      await page.locator('.navigation [data-page="calendar"]').click();await expect(page.locator('.calendar-grid')).toBeVisible();
      await page.locator('.calendar-heading [data-calendar-action="new"]').click();await expect(page.locator('#form-dialog')).toBeVisible();
      await expect(page.locator('.native-window-drag-region:visible')).toHaveCount(0);
      await page.locator('#confirm-cancel').click();await expect.poll(()=>page.locator('.native-window-drag-region:visible').count()).toBeGreaterThan(0);
      await page.locator('#new-tab').click();await expect(page.locator('.hero')).toBeVisible();
    }
    expect(errors).toEqual([]);
  }finally{await app.close();}
});

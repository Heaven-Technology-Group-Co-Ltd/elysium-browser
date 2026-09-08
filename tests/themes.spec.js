const {test,expect,_electron:electron} = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const {novel} = require('../src/themes');
let app,page,profile,errors;
async function launch() {
  app = await electron.launch({...process.env.ELYSIUM_EXECUTABLE?{executablePath:process.env.ELYSIUM_EXECUTABLE,args:['--themes']}:{args:[path.resolve('.'),'--themes']},env:{...process.env,ELYSIUM_TEST_PROFILE:profile}});
  await app.firstWindow(); await expect.poll(()=>app.windows().some(p=>p.url().endsWith('/index.html'))).toBe(true);
  page=app.windows().find(p=>p.url().endsWith('/index.html'));page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('.novel-studio')).toBeVisible();
}
const state=()=>page.evaluate(()=>window.elysium.getState());
async function call(a,p){const r=await page.evaluate(([a,p])=>window.elysium.command(a,p),[a,p]);expect(r.ok,r.error).toBe(true);if(a==='internal')await expect(page.locator('#address')).toHaveValue(p==='home'?'':`elysium://${p}`);return r;}
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(c=>parseInt(c,16)).join(', ')})`;
test.beforeEach(async()=>{profile=fs.mkdtempSync(path.join(os.tmpdir(),'elysium-novel-e2e-'));errors=[];await launch();});
test.afterEach(async()=>{if(app){await app.close();app=null;}expect(errors).toEqual([]);});

test('12 story themes load, apply app colors, filter, randomize and survive restart',async()=>{
  await expect(page.locator('.theme-tile')).toHaveCount(12);
  await page.locator('.theme-tile img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
  expect(await page.locator('.theme-tile img').evaluateAll(images=>images.every(i=>i.naturalWidth===640&&i.naturalHeight===360))).toBe(true);
  for(const theme of novel){
    await page.locator(`[data-theme-choice=${theme.id}]`).click();
    await expect.poll(async()=>(await state()).settings.theme).toMatchObject({variant:theme.id,background:theme.id,character:theme.character});
    await expect(page.locator('body')).toHaveAttribute('data-tone',theme.palette.mode);
    await expect(page.locator(`[data-theme-choice=${theme.id}]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.toolbar')).toHaveCSS('background-color',rgb(theme.palette.surface));
    await expect(page.locator('#content')).toHaveCSS('background-color',rgb(theme.palette.canvas));
    await expect(page.locator('.theme-current h2')).toHaveCSS('color',rgb(theme.palette.text));
  }
  for(const [filter,count] of [['light',4],['dark',8],['classic',12],['new',12]]){
    await page.locator(`[data-theme-filter=${filter}]`).click();await expect(page.locator('.theme-tile')).toHaveCount(count);
  }
  const before=(await state()).settings.theme.variant;
  await page.locator('[data-theme-random]').click();await expect.poll(async()=>(await state()).settings.theme.variant).not.toBe(before);
  const saved=(await state()).settings.theme;
  await app.close();app=null;await launch();expect((await state()).settings.theme).toEqual(saved);
});

test('art controls preserve the palette and guest website styling stays independent',async()=>{
  await page.locator('[data-theme-choice=jadeatelier]').click();
  await page.locator('.theme-customize summary').click();await page.locator('#graphics-enabled').uncheck();
  await expect(page.locator('.theme-customize')).toHaveAttribute('open','');
  await call('internal','home');await expect(page.locator('.hero-scene')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-tone','light');
  await call('internal','themes');await page.locator('.theme-customize summary').click();await page.locator('#graphics-enabled').check();
  await page.locator('#theme-background').selectOption('starlibrary');await call('internal','home');
  await expect(page.locator('.hero-character')).toBeHidden();await expect(page.locator('.hero-scene')).toBeVisible();
  expect(await page.evaluate(()=>document.body.style.getPropertyValue('--scene'))).toContain('starlibrary.webp');
  expect((await state()).settings.theme.variant).toBe('jadeatelier');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><body style="background:rgb(244, 232, 210);color:rgb(38, 40, 50)">Independent website</body></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
  try{
    await call('navigate',url);await expect.poll(async()=>(await state()).tabs.find(t=>t.url===url)?.loading).toBe(false);
    await call('theme-save',{variant:'scarletpulse',background:'scarletpulse'});
    const colors=await app.evaluate(async({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL()===url).executeJavaScript('({background:getComputedStyle(document.body).backgroundColor,color:getComputedStyle(document.body).color})'),url);
    expect(colors).toEqual({background:'rgb(244, 232, 210)',color:'rgb(38, 40, 50)'});
  }finally{await new Promise(r=>server.close(r));}
});

test('story themes fit the home, calendar, settings and gallery at desktop widths',async()=>{
  test.setTimeout(90000);
  const directory=path.resolve('docs/screenshots/novel-themes');fs.mkdirSync(directory,{recursive:true});
  async function capture(name,width=1440,height=900){
    await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setBounds({x:20,y:20,width,height}),{width,height});
    await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(width);
    await page.locator('img').evaluateAll(images=>Promise.all(images.filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{}))));
    await page.waitForTimeout(150);
    expect(await page.locator('#content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(directory,name+'.png'),Buffer.from(png,'base64'));
  }
  for(const theme of novel){await call('theme-save',{variant:theme.id,background:theme.id,character:theme.character});await call('internal','home');await expect(page.locator('.hero-character')).toBeHidden();await capture('home-'+theme.id);}
  for(const id of ['roseglass','jadeatelier','ivoryorbit','lilacdream','honeycloud']){
    await call('theme-save',{variant:id,background:id});await call('internal','calendar');await capture('calendar-'+id,1024,768);
  }
  await call('internal','settings');await capture('settings-light',1024,768);
  await call('panel','ai');await capture('panel-light',1440,900);await call('panel',null);
  await call('internal','themes');await capture('gallery-light',1440,900);await capture('gallery-small',1024,768);
  await call('theme-save',{variant:'roseglass',background:'roseglass'});await capture('gallery-dark',1440,900);
});

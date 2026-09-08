const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-online-'));
  const instance = await electron.launch({
    executablePath: process.env.ELYSIUM_EXECUTABLE || path.resolve('release/win-unpacked/elysium-browser.exe'), args: [],
    env: { ...process.env, ELYSIUM_TEST_PROFILE: profile },
  });
  try {
    const page = await instance.firstWindow();
    await page.waitForSelector('.hero');
    const cases = process.env.ELYSIUM_SMOKE_URL ? [[process.env.ELYSIUM_SMOKE_URL, process.env.ELYSIUM_SMOKE_TITLE || '']] : [['https://example.com/', 'Example Domain']];
    for (const [url, title] of cases) {
      await page.locator('#address').fill(url);
      await page.locator('#address').press('Enter');
      await expect.poll(async () => {
        const state = await page.evaluate(() => window.elysium.getState());
        const tab = state.tabs.find(tab => tab.id === state.activeId);
        return tab.url.startsWith(url) && !tab.loading && (tab.error || tab.title.includes(title));
      }, { timeout: 20000 }).toBe(true).catch(async error => {
        const state = await page.evaluate(() => window.elysium.getState());
        console.error('Current tab:', state.tabs.find(tab => tab.id === state.activeId));
        throw error;
      });
      const state = await page.evaluate(() => window.elysium.getState());
      const tab = state.tabs.find(tab => tab.id === state.activeId);
      assert.equal(tab.error, null, JSON.stringify(tab.error));
      assert.ok(tab.title.includes(title), tab.title);
      console.log(JSON.stringify({ url: tab.url, title: tab.title, loaded: !tab.loading }));
      const guest = await instance.evaluate(async ({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);return {title:wc.getTitle(),text:await wc.executeJavaScript('document.body.innerText.slice(0,500)'),userAgent:await wc.executeJavaScript('navigator.userAgent')};},tab.url);
      assert.ok(guest.text.length>0);
      if (process.env.ELYSIUM_EXPECT_USER_AGENT) assert.ok(guest.userAgent.includes(process.env.ELYSIUM_EXPECT_USER_AGENT), guest.userAgent);
      const captured = await instance.evaluate(async ({BrowserWindow,desktopCapturer})=>{const w=BrowserWindow.getAllWindows()[0];const [width,height]=w.getSize();const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width,height}});const s=sources.find(s=>s.id===w.getMediaSourceId());if(!s||s.thumbnail.isEmpty())throw new Error('Native capture unavailable');return s.thumbnail.toPNG().toString('base64');});
      fs.mkdirSync(path.resolve('docs/screenshots'),{recursive:true});fs.writeFileSync(path.resolve('docs/screenshots/online-example.png'),Buffer.from(captured,'base64'));
      fs.writeFileSync(path.resolve('docs/online-report.json'),JSON.stringify({url:tab.url,title:tab.title,version:state.version,userAgent:guest.userAgent,guestTextLength:guest.text.length,nativeCapture:'docs/screenshots/online-example.png'},null,2));
    }
  } finally { await instance.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

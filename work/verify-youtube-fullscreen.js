const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const executablePath = path.resolve('release-youtube-fullscreen-stable/win-unpacked/elysium-browser.exe');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-youtube-fullscreen-'));
const targetUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const screenshotPath = path.resolve('docs/screenshots/youtube-fullscreen-1.3.9.png');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let instance;
  try {
    instance = await electron.launch({
      ...(process.env.CHERRY_VERIFY_SOURCE ? { args: [path.resolve('.')] } : { executablePath, args: [] }),
      env: { ...process.env, ELYSIUM_TEST_PROFILE: profile },
    });
    await instance.firstWindow();
    const page = instance.windows().find(item => item.url().endsWith('/index.html'));
    if (!page) throw new Error('elysium-browser shell was not found');
    await page.waitForSelector('#tabs .tab');
    const result = await page.evaluate(url => window.elysium.command('navigate', url), targetUrl);
    if (!result.ok) throw new Error(result.error || 'Navigation failed');

    let guest;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      guest = await instance.evaluate(({ webContents }) => {
        const item = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('https://www.youtube.com/watch'));
        return item ? { id: item.id, url: item.getURL() } : null;
      });
      if (guest) break;
      await delay(250);
    }
    if (!guest) throw new Error('YouTube WebContents did not load');

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await instance.evaluate(({ webContents }, id) => {
        const contents = webContents.fromId(id);
        if (!contents || contents.isDestroyed()) return false;
        return contents.executeJavaScript("!!document.querySelector('#movie_player, video')").catch(() => false);
      }, guest.id);
      if (ready) break;
      if (attempt === 119) throw new Error('YouTube player did not become ready');
      await delay(250);
    }

    const fullscreenButton = await instance.evaluate(({ webContents }, id) => webContents.fromId(id).executeJavaScript(`(() => {
      const button = document.querySelector('.ytp-fullscreen-button');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), width: rect.width, height: rect.height };
    })()`), guest.id);
    if (!fullscreenButton || fullscreenButton.width < 1 || fullscreenButton.height < 1) throw new Error('YouTube fullscreen button was not available');
    await instance.evaluate(({ webContents }, { id, point }) => {
      const contents = webContents.fromId(id);
      contents.focus();
      contents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
      contents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      contents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    }, { id: guest.id, point: fullscreenButton });

    let entered;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      entered = await instance.evaluate(async ({ BrowserWindow, webContents }, id) => {
        const window = BrowserWindow.getAllWindows()[0];
        const contents = webContents.fromId(id);
        const state = await window.webContents.executeJavaScript('window.elysium.getState()');
        const view = window.contentView.children.find(item => item.webContents?.id === id);
        return {
          htmlFullscreen: state.ui.htmlFullscreen,
          nativeFullscreen: window.isFullScreen(),
          contentSize: window.getContentSize(),
          viewBounds: view?.getBounds(),
          documentFullscreen: await contents.executeJavaScript('!!document.fullscreenElement').catch(() => false),
        };
      }, guest.id);
      if (entered.htmlFullscreen && entered.nativeFullscreen && entered.documentFullscreen) break;
      await delay(250);
    }
    if (!entered?.htmlFullscreen || !entered.nativeFullscreen || !entered.documentFullscreen) {
      throw new Error(`YouTube did not enter fullscreen: ${JSON.stringify(entered)}`);
    }

    await delay(2500);
    const stable = await instance.evaluate(async ({ BrowserWindow, webContents, desktopCapturer }, id) => {
      const window = BrowserWindow.getAllWindows()[0];
      const contents = webContents.fromId(id);
      const state = await window.webContents.executeJavaScript('window.elysium.getState()');
      const view = window.contentView.children.find(item => item.webContents?.id === id);
      const mediaSourceId = window.getMediaSourceId();
      const [width, height] = window.getSize();
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height }, fetchWindowIcons: false });
      const source = sources.find(item => item.id === mediaSourceId);
      if (!source || source.thumbnail.isEmpty()) throw new Error('Native screenshot unavailable');
      const youtubeState = await contents.executeJavaScript(`(() => {
        const fullscreen = document.fullscreenElement;
        const player = document.querySelector('#movie_player');
        const video = document.querySelector('video');
        const flexy = document.querySelector('ytd-watch-flexy');
        const rect = element => element ? Object.fromEntries(['x','y','width','height'].map(key => [key, Math.round(element.getBoundingClientRect()[key])])) : null;
        return {
          fullscreen: fullscreen ? { tag: fullscreen.tagName, id: fullscreen.id, className: String(fullscreen.className).slice(0, 500), rect: rect(fullscreen) } : null,
          player: player ? { className: String(player.className).slice(0, 2000), fullscreen: player.classList.contains('ytp-fullscreen'), rect: rect(player) } : null,
          video: rect(video),
          flexy: flexy ? { className: String(flexy.className).slice(0, 500), fullscreen: flexy.hasAttribute('fullscreen'), theater: flexy.hasAttribute('theater'), rect: rect(flexy) } : null,
          button: (() => { const item = document.querySelector('.ytp-fullscreen-button'); return item ? { title: item.title, ariaLabel: item.getAttribute('aria-label'), rect: rect(item) } : null; })(),
          viewport: { width: innerWidth, height: innerHeight },
        };
      })()`).catch(() => null);
      return {
        htmlFullscreen: state.ui.htmlFullscreen,
        nativeFullscreen: window.isFullScreen(),
        documentFullscreen: await contents.executeJavaScript('!!document.fullscreenElement').catch(() => false),
        contentSize: window.getContentSize(),
        viewBounds: view?.getBounds(),
        youtubeState,
        png: source.thumbnail.toPNG().toString('base64'),
      };
    }, guest.id);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(stable.png, 'base64'));
    delete stable.png;
    if (!stable.htmlFullscreen || !stable.nativeFullscreen || !stable.documentFullscreen) {
      throw new Error(`YouTube fullscreen did not remain stable: ${JSON.stringify(stable)}`);
    }
    if (stable.viewBounds.x !== 0 || stable.viewBounds.y !== 0 || stable.viewBounds.width !== stable.contentSize[0] || stable.viewBounds.height !== stable.contentSize[1]) {
      throw new Error(`Fullscreen bounds do not cover the window: ${JSON.stringify(stable)}`);
    }
    const { player, video, viewport } = stable.youtubeState;
    if (!player || player.rect.x !== 0 || player.rect.y !== 0 || player.rect.width !== viewport.width || player.rect.height !== viewport.height) {
      throw new Error(`YouTube player does not cover the viewport: ${JSON.stringify(stable.youtubeState)}`);
    }
    if (!video || video.width < viewport.width * 0.5 || video.height < viewport.height * 0.8) {
      throw new Error(`YouTube video is not visible at fullscreen size: ${JSON.stringify(stable.youtubeState)}`);
    }

    const exitPoint = stable.youtubeState.button.rect;
    await instance.evaluate(({ webContents }, { id, point }) => {
      const contents = webContents.fromId(id);
      contents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
      contents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      contents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    }, { id: guest.id, point: exitPoint });
    let restored;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      restored = await instance.evaluate(async ({ BrowserWindow }, id) => {
        const window = BrowserWindow.getAllWindows()[0];
        const state = await window.webContents.executeJavaScript('window.elysium.getState()');
        const view = window.contentView.children.find(item => item.webContents?.id === id);
        return { htmlFullscreen: state.ui.htmlFullscreen, nativeFullscreen: window.isFullScreen(), normalBounds: state.ui.bounds.left, viewBounds: view?.getBounds() };
      }, guest.id);
      if (!restored.htmlFullscreen && !restored.nativeFullscreen && JSON.stringify(restored.normalBounds) === JSON.stringify(restored.viewBounds)) break;
      await delay(250);
    }
    if (restored.htmlFullscreen || restored.nativeFullscreen || JSON.stringify(restored.normalBounds) !== JSON.stringify(restored.viewBounds)) {
      throw new Error(`elysium-browser layout did not restore: ${JSON.stringify(restored)}`);
    }
    console.log(JSON.stringify({ ok: true, entered, stable, restored, screenshotPath }));
  } finally {
    if (instance) await instance.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

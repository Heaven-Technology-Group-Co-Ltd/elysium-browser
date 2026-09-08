const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { novel, catalog } = require('../src/themes');
const { BrowserStore, sanitizeTheme } = require('../src/core');

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(c => parseInt(c,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('all story palettes keep normal and secondary text readable on app surfaces', () => {
  assert.equal(novel.length,12); assert.equal(new Set(catalog.map(t=>t[0])).size,24);
  assert.equal(novel.filter(t=>t.palette.mode==='light').length,4);
  for (const {id,palette:p} of novel) {
    for (const foreground of ['text','muted']) for (const background of ['canvas','surface','raised','input']) {
      assert.ok(contrast(p[foreground],p[background])>=4.5,`${id} ${foreground}/${background}`);
    }
    assert.ok(contrast(p.onAccent,p.accent)>=4.5,`${id} button label`);
    assert.ok(contrast(p.focus,p.surface)>=3,`${id} focus indicator`);
  }
});

test('every novel theme survives a real profile round trip without losing local data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'elysium-theme-store-'));
  try {
    const store = new BrowserStore(dir);
    store.data.notes.push({id:'existing-note',title:'Keep me',body:'Existing local note'});
    for (const theme of novel) {
      store.data.settings.theme = sanitizeTheme({...store.data.settings.theme,variant:theme.id,background:theme.id,character:theme.character});
      store.save();
      const loaded = new BrowserStore(dir);
      assert.equal(loaded.data.settings.theme.variant,theme.id);
      assert.equal(loaded.data.settings.theme.background,theme.id);
      assert.equal(loaded.data.notes[0].title,'Keep me');
    }
    assert.equal(sanitizeTheme({variant:'unknown',background:'unknown'}).variant,'midnight');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('all original story wallpapers and thumbnails are included in the offline app', () => {
  const crypto = require('node:crypto');
  const hashes = new Set();
  for (const {id} of novel) for (const suffix of ['', '-thumb']) {
    const data = fs.readFileSync(path.resolve('assets/anime/novel-themes',`${id}${suffix}.webp`));
    assert.equal(data.subarray(8,12).toString(),'WEBP');
    if (!suffix) hashes.add(crypto.createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(hashes.size,12);
});

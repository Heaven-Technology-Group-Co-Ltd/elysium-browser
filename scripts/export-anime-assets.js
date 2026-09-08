// Deterministic crop/resize/WebP export as specified in the supplied asset plan.
// Semantic retouch and new artwork use the built-in imagegen tool, not this script.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const dest = path.resolve('assets/anime');
const inputs = {
  hero: 'artwork-source/cherry-hero.png',
  homeShort: 'artwork-source/cherry-home-short.png',
  assistantShort: 'artwork-source/cherry-assistant-short.png',
  cyrvor: 'artwork-source/cyrvor-brand.png',
  city: 'artwork-source/city-backdrop.png',
  team: 'artwork-source/team-banner.png',
};
const themeInputs = Object.fromEntries(['rose', 'aurora', 'solar', 'crimson', 'emerald', 'cosmic', 'aqua', 'lunar', 'silver'].map(name => [name, `artwork-source/theme-${name}.png`]));
(async () => {
  fs.mkdirSync(dest, { recursive: true });
  await sharp(inputs.hero).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(dest, 'cherry-hero.webp'));
  const shortHeroPanel = await sharp(inputs.homeShort)
    .resize(1120, 720, { fit: 'cover', position: 'top' })
    .composite([{ input: Buffer.from('<svg width="1120" height="720"><defs><linearGradient id="fade"><stop offset="0" stop-color="black" stop-opacity="0"/><stop offset="0.18" stop-color="white" stop-opacity="1"/></linearGradient></defs><rect width="1120" height="720" fill="url(#fade)"/></svg>'), blend: 'dest-in' }])
    .png()
    .toBuffer();
  await sharp({ create: { width: 1920, height: 720, channels: 3, background: '#061225' } })
    .composite([{ input: shortHeroPanel, left: 800, top: 0 }])
    .webp({ quality: 91 })
    .toFile(path.join(dest, 'cherry-home-short.webp'));
  await sharp(inputs.assistantShort).resize(720, 480, { fit: 'cover', position: 'top' }).webp({ quality: 90 }).toFile(path.join(dest, 'cherry-assistant-short.webp'));
  await sharp(inputs.homeShort).extract({ left: 840, top: 40, width: 560, height: 560 }).resize(256, 256).webp({ quality: 91 }).toFile(path.join(dest, 'avatar-cherry-short.webp'));
  await sharp(inputs.cyrvor).resize(960, 360, { fit: 'cover', position: 'center' }).webp({ quality: 90 }).toFile(path.join(dest, 'cyrvor-brand.webp'));
  await sharp(inputs.city).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 87 }).toFile(path.join(dest, 'city-backdrop.webp'));
  await sharp(inputs.team).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(dest, 'team-banner.webp'));
  const board = path.resolve('Cherry_Browser_Codex_Handoff/cherry-browser-handoff/reference/characters/character-board.png');
  const meta = await sharp(board).metadata();
  // Reference board is measured proportionally. Face-only crops exclude captions and clothing patches.
  const faces = { violet: [.835,.191,.15,.09], ghost: [.827,.342,.155,.088], nova: [.833,.493,.15,.092] };
  for (const [name, [x,y,w,h]] of Object.entries(faces)) {
    const crop = { left: Math.round(x*meta.width), top: Math.round(y*meta.height), width: Math.round(w*meta.width), height: Math.round(h*meta.height) };
    await sharp(board).extract(crop).resize(256,256,{fit:'cover'}).webp({quality:90}).toFile(path.join(dest, `avatar-${name}.webp`));
  }
  await sharp(inputs.hero).extract({left:900,top:200,width:420,height:420}).resize(256,256).webp({quality:90}).toFile(path.join(dest,'avatar-cherry.webp'));
  const portraits = { violet: {left:1200,top:65,width:345,height:610}, ghost: {left:1510,top:0,width:335,height:675}, nova: {left:1880,top:30,width:292,height:365}, cherry: {left:820,top:0,width:385,height:675} };
  for (const [name,crop] of Object.entries(portraits)) await sharp(inputs.team).extract(crop).webp({quality:90}).toFile(path.join(dest,`portrait-${name}.webp`));
  for (const [name, input] of Object.entries({ midnight: inputs.city, violet: themeInputs.cosmic, slate: inputs.city })) {
    await sharp(input).resize(480,270,{fit:'cover',position:name==='violet'?'right':'center'}).webp({quality:85}).toFile(path.join(dest, `theme-${name}.webp`));
  }
  for (const [name, input] of Object.entries(themeInputs)) {
    await sharp(input).resize(1672,941,{fit:'cover'}).webp({quality:87}).toFile(path.join(dest, `backdrop-${name}.webp`));
    await sharp(input).resize(480,270,{fit:'cover'}).webp({quality:85}).toFile(path.join(dest, `theme-${name}.webp`));
  }
  const files = [];
  for(const file of fs.readdirSync(dest).filter(file=>file.endsWith('.webp'))) { const stat=fs.statSync(path.join(dest,file)); const meta=await sharp(path.join(dest,file)).metadata(); files.push({file,bytes:stat.size,width:meta.width,height:meta.height,alpha:meta.hasAlpha}); }
  fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({
    method: 'Imagegen generation/retouch + deterministic crop/export',
    hero: 'Short-blue-bob Cherry illustration exported as a navy matte artwork panel; not claimed as an alpha cutout',
    assistant: 'Separate short-blue-bob chibi scene for the assistant card; no UI text baked into the artwork',
    cyrvor: 'Deterministic card crop from the supplied CYRVOR reference; not claimed as a transparent logo cutout',
    inputs: { ...inputs, themes: themeInputs }, files, totalBytes: files.reduce((sum,f)=>sum+f.bytes,0)
  },null,2));
  console.log(files);
})();

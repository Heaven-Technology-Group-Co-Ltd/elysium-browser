const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const { novel } = require('../src/themes');
(async () => {
  const output = path.resolve('assets/anime/novel-themes');
  fs.mkdirSync(output, { recursive:true });
  const files = [];
  for (const theme of novel) {
    const source = path.resolve('artwork-source/novel-themes', `${theme.id}.png`);
    if (!fs.existsSync(source)) throw new Error(`Missing generated artwork: ${theme.id}`);
    const wallpaper = path.join(output, `${theme.id}.webp`);
    const thumbnail = path.join(output, `${theme.id}-thumb.webp`);
    await sharp(source).resize(1672,941,{fit:'cover',position:'center'}).webp({quality:88}).toFile(wallpaper);
    await sharp(source).resize(640,360,{fit:'cover',position:'center'}).webp({quality:86}).toFile(thumbnail);
    files.push({id:theme.id,wallpaper:`${theme.id}.webp`,thumbnail:`${theme.id}-thumb.webp`,bytes:fs.statSync(wallpaper).size+fs.statSync(thumbnail).size});
  }
  fs.writeFileSync(path.join(output,'manifest.json'), JSON.stringify({method:'Twelve independently generated illustrations using built-in ImageGen, with BeezaChat character references; deterministic WebP resizing only.',files,totalBytes:files.reduce((sum,item)=>sum+item.bytes,0)},null,2));
  console.log(JSON.stringify({count:files.length,totalBytes:files.reduce((sum,item)=>sum+item.bytes,0)}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});

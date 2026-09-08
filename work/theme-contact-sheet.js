const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const directory=path.resolve('docs/screenshots/novel-themes');
  const files=fs.readdirSync(directory).filter(f=>f.endsWith('.png'));
  for(const group of ['home','other']){
    const selected=files.filter(f=>group==='home'?f.startsWith('home-'):!f.startsWith('home-'));
    const tiles=[];const width=480,height=326;
    for(let i=0;i<selected.length;i++){
      const label=Buffer.from(`<svg width="480" height="26"><rect width="480" height="26" fill="#eee"/><text x="8" y="19" font-family="Arial" font-size="14">${selected[i]}</text></svg>`);
      tiles.push({input:await sharp(path.join(directory,selected[i])).resize(480,300,{fit:'contain',background:'#ddd'}).png().toBuffer(),left:(i%3)*width,top:Math.floor(i/3)*height+26});
      tiles.push({input:label,left:(i%3)*width,top:Math.floor(i/3)*height});
    }
    await sharp({create:{width:width*3,height:height*Math.ceil(selected.length/3),channels:3,background:'#eee'}}).composite(tiles).png().toFile(path.resolve(`work/themes-qa-${group}.png`));
  }
})();

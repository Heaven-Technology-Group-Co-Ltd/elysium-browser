const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const assets = path.resolve(__dirname, '../assets');
const input = path.resolve(process.argv[2] || path.join(assets, 'elysium-icon-source.png'));
const masterOutput = path.join(assets, 'elysium-anime-icon.png');
const pngOutput = path.join(assets, 'elysium.png');
const icoOutput = path.join(assets, 'elysium.ico');
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function makePng(size) {
  return sharp(masterOutput)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const meta = await sharp(input).metadata();
  if (meta.width !== meta.height || (meta.width || 0) < 512) {
    throw new Error(`Icon master must be a square image of at least 512 px; got ${meta.width}x${meta.height}.`);
  }

  // ImageGen leaves a checkerboard preview around the tile. Crop to the tile and
  // apply a real alpha mask so Windows receives clean transparent corners.
  const cropInset = Math.round(meta.width * 0.027);
  const cropSize = meta.width - (cropInset * 2);
  const mask = Buffer.from('<svg width="1024" height="1024"><rect width="1024" height="1024" rx="260" fill="white"/></svg>');
  await sharp(input)
    .extract({ left: cropInset, top: cropInset, width: cropSize, height: cropSize })
    .resize(1024, 1024)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(masterOutput);

  await sharp(masterOutput)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(pngOutput);

  const images = await Promise.all(sizes.map(makePng));
  const headerSize = 6 + (16 * images.length);
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  images.forEach((image, index) => {
    const size = sizes[index];
    const entry = 6 + (index * 16);
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });

  fs.writeFileSync(icoOutput, Buffer.concat([header, ...images]));
  const masterMeta = await sharp(masterOutput).metadata();
  console.log(JSON.stringify({ input, masterOutput, pngOutput, icoOutput, source: `${meta.width}x${meta.height}`, master: `${masterMeta.width}x${masterMeta.height}`, alpha: masterMeta.hasAlpha, sizes }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

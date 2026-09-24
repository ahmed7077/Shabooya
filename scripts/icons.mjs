import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = 'assets/branding/shabooya-approved.png';
const output = 'public/icons';
const fullArtwork = { left: 130, top: 140, width: 990, height: 990 };
const pictogram = { left: 455, top: 225, width: 600, height: 600 };

await mkdir(output, { recursive: true });

async function cropToPng(crop, size, path) {
  await sharp(source)
    .extract(crop)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path);
}

await cropToPng(fullArtwork, 192, `${output}/icon-192.png`);
await cropToPng(fullArtwork, 512, `${output}/icon-512.png`);
await cropToPng(fullArtwork, 180, `${output}/apple-touch-icon.png`);
await cropToPng(pictogram, 64, `${output}/brand-mark-64.png`);
await cropToPng(pictogram, 32, `${output}/favicon-32.png`);

const maskableArtwork = await sharp(source)
  .extract(pictogram)
  .resize(390, 390, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 3,
    background: '#171411',
  },
})
  .composite([{ input: maskableArtwork, left: 61, top: 61 }])
  .png({ compressionLevel: 9 })
  .toFile(`${output}/maskable-512.png`);

// ICO is a small container around a PNG payload. A 32px pictogram stays
// recognizable in browser tabs without shrinking the complete wordmark.
const favicon = await readFile(`${output}/favicon-32.png`);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.length, 14);
header.writeUInt32LE(22, 18);
await writeFile('src/app/favicon.ico', Buffer.concat([header, favicon]));

import sharp from 'sharp';
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#176958"/><g fill="none" stroke="#e8f4bc" stroke-width="31" stroke-linecap="round" stroke-linejoin="round"><path d="M113 259l68 69 122-142"/><path d="M239 293l36 35 124-142"/></g></svg>',
);
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile('public/icons/' + name + '.png');

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'public', 'ocr');
const coreOutput = path.join(output, 'core');
const coreSource = path.join(root, 'node_modules', 'tesseract.js-core');

await mkdir(coreOutput, { recursive: true });
await copyFile(
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  path.join(output, 'worker.min.js'),
);

for (const file of await readdir(coreSource)) {
  if (/^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.wasm(?:\.js)?$/.test(file))
    await copyFile(path.join(coreSource, file), path.join(coreOutput, file));
}

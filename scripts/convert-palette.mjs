import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');

const svg = fs.readFileSync(path.join(root, 'palette.svg'), 'utf8');

await sharp(Buffer.from(svg))
  .resize(1520, 440)
  .png()
  .toFile(path.join(root, 'palette.png'));

console.log('palette.png created');

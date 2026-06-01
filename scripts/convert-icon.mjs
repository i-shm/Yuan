import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');

const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');

await sharp(Buffer.from(svg))
  .resize(128, 128)
  .png()
  .toFile(path.join(root, 'icon.png'));

console.log('icon.png created');

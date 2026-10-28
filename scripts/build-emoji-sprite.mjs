// Packs every OpenMoji SVG in public/emoji into one sprite (public/emoji/sprite.svg) so the app
// makes a single request instead of one per glyph. Run: node scripts/build-emoji-sprite.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('public/emoji');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.svg') && f !== 'sprite.svg')
  .sort();

const symbols = files.map((f) => {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const inner = src
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+id="[^"]*"/g, '') // ids repeat in every file ("color", "line", …)
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  return `<symbol id="e-${f.replace('.svg', '')}" viewBox="0 0 72 72">${inner}</symbol>`;
});

fs.writeFileSync(
  path.join(dir, 'sprite.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>\n`,
);
console.log(`sprite.svg: ${files.length} symbols`);

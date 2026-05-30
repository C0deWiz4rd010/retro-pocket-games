// Dependency-free PNG icon generator for the PWA.
// Draws the Retro Pocket mark procedurally at each size and encodes a real PNG
// via Node's built-in zlib — no native image libraries required.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

/** @typedef {[number,number,number,number]} RGBA */

function makeCanvas(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    // alpha-over composite onto existing pixel
    px[i] = Math.round(r * ia + px[i] * (1 - ia));
    px[i + 1] = Math.round(g * ia + px[i + 1] * (1 - ia));
    px[i + 2] = Math.round(b * ia + px[i + 2] * (1 - ia));
    px[i + 3] = Math.max(px[i + 3], a);
  };
  return { px, size, set };
}

function fillRoundRect(c, x0, y0, w, h, r, color) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inCornerX = x < r ? r - x : x >= w - r ? x - (w - r - 1) : 0;
      const inCornerY = y < r ? r - y : y >= h - r ? y - (h - r - 1) : 0;
      if (inCornerX > 0 && inCornerY > 0 && inCornerX * inCornerX + inCornerY * inCornerY > r * r)
        continue;
      c.set(x0 + x, y0 + y, color);
    }
  }
}

function strokeRoundRect(c, x0, y0, w, h, r, color, t) {
  fillRoundRect(c, x0, y0, w, h, r, color);
  // punch a transparent inner hole by repainting inner with bg later — simpler: draw border via two fills
  // (caller draws inner fill afterward)
  void t;
}

function drawIcon(size, { maskable = false } = {}) {
  const c = makeCanvas(size);
  const bg = [10, 10, 18, 255];
  const surface = [20, 20, 31, 255];
  const cyan = [0, 247, 255, 255];
  const magenta = [255, 46, 151, 255];
  const grey = [138, 138, 163, 255];

  // background (full bleed; maskable keeps art within an 80% safe zone)
  fillRoundRect(c, 0, 0, size, size, maskable ? 0 : Math.round(size * 0.22), bg);

  const pad = maskable ? size * 0.18 : size * 0.1;
  const inner = size - pad * 2;
  const u = inner / 100; // unit relative to a 100x100 design grid inside the safe area
  const X = (n) => Math.round(pad + n * u);
  const S = (n) => Math.round(n * u);

  // screen bezel (neon) + screen
  fillRoundRect(c, X(8), X(6), S(84), S(58), S(8), cyan);
  fillRoundRect(c, X(11), X(9), S(78), S(52), S(6), surface);
  // glowing screen tint
  fillRoundRect(c, X(15), X(13), S(70), S(44), S(3), [0, 247, 255, 36]);

  // D-pad
  fillRoundRect(c, X(16), X(74), S(8), S(20), S(2), grey);
  fillRoundRect(c, X(10), X(80), S(20), S(8), S(2), grey);

  // A / B buttons
  fillRoundRect(c, X(70), X(74), S(11), S(11), S(5), magenta);
  fillRoundRect(c, X(82), X(82), S(11), S(11), S(5), cyan);

  void strokeRoundRect;
  return c;
}

// ---- PNG encoding (truecolor + alpha, 8-bit) ----
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(c) {
  const { size, px } = c;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // filter type 0 per scanline
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(name, size, opts) {
  const png = encodePNG(drawIcon(size, opts));
  writeFileSync(join(OUT, name), png);
  console.info(`generated icons/${name} (${png.length} bytes)`);
}

write('icon-192.png', 192);
write('icon-512.png', 512);
write('maskable-512.png', 512, { maskable: true });

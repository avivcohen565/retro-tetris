// Generates the pixel-art app icons (PNG) without any image dependencies.
// Usage: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#0f380f');
const T = { base: hex('#b040d8'), light: hex('#e8a0ff'), dark: hex('#5a1878') };
const I = { base: hex('#38c8e8'), light: hex('#a8f0ff'), dark: hex('#1a6c88') };

// 16x16 pixel design: a T piece resting on a completed cyan line.
const GRID = 16;
const art = Array.from({ length: GRID }, () => Array(GRID).fill(BG));

function block(x0, y0, size, c) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let col = c.base;
      if (x === size - 1 || y === size - 1) col = c.dark;
      else if (x === 0 || y === 0) col = c.light;
      art[y0 + y][x0 + x] = col;
    }
  }
}

block(6, 4, 4, T);
block(2, 8, 4, T);
block(6, 8, 4, T);
block(10, 8, 4, T);
for (let i = 0; i < 4; i++) block(i * 4, 12, 4, I);

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = art[Math.floor((y * GRID) / size)][Math.floor((x * GRID) / size)];
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-512.png', render(512));
writeFileSync('icons/icon-192.png', render(192));
writeFileSync('icons/apple-touch-icon.png', render(180));
console.log('icons written');

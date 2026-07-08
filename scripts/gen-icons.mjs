// Genera icone PNG (192, 512, 180) senza dipendenze: sfondo verde, fiamma stilizzata.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [20, 83, 45];        // verde scuro
  const flame = [249, 115, 22];   // arancio
  const core = [253, 224, 71];    // giallo
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b] = bg;
      // fiamma: goccia — cerchio in basso + cono verso l'alto
      const fy = size * 0.62, fr = size * 0.24;
      const inCircle = (x - cx) ** 2 + (y - fy) ** 2 < fr * fr;
      const apex = size * 0.16;
      const t = (y - apex) / (fy - apex);
      const inCone = y >= apex && y <= fy && Math.abs(x - cx) < fr * Math.max(t, 0) ** 1.4;
      if (inCircle || inCone) [r, g, b] = flame;
      const cr = size * 0.11, cyc = size * 0.66;
      if ((x - cx) ** 2 + (y - cyc) ** 2 < cr * cr) [r, g, b] = core;
      const i = (y * size + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', makePng(192));
writeFileSync('public/pwa-512.png', makePng(512));
writeFileSync('public/apple-touch-icon.png', makePng(180));
console.log('Icone generate in public/');

// 纯 Node 生成应用图标(PNG):SDF 绘制圆角渐变方块 + 对勾,零外部依赖
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---------- PNG 编码 ----------
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + stride)] = 0; // filter none
    rgba.copy(raw, y * (1 + stride) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
const C1 = [99, 102, 241]; // #6366F1
const C2 = [168, 85, 247]; // #A855F7

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
function sdSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const l2 = abx * abx + aby * aby;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / l2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
const cov = (d) => Math.max(0, Math.min(1, 0.5 - d)); // 1px 抗锯齿

/** 在 S 尺寸画布上绘制,返回 RGBA(未预乘) */
function render(S, opts) {
  const rectInset = opts.maskable ? 0.185 : 0.055;
  const radiusFrac = opts.maskable ? 0.30 : 0.235; // 半径占半宽比例
  const hw = S * (0.5 - rectInset);
  const cx = S / 2, cy = S / 2;
  const r = hw * radiusFrac;
  const stroke = S * 0.085;

  const checkPts = opts.maskable
    ? [
        [0.305, 0.525, 0.445, 0.665],
        [0.445, 0.665, 0.715, 0.36],
      ]
    : [
        [0.28, 0.515, 0.44, 0.675],
        [0.44, 0.675, 0.735, 0.345],
      ];

  const buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5, py = y + 0.5;
      // 背景渐变
      const t = (x + y) / (2 * S);
      let cr = C1[0] + (C2[0] - C1[0]) * t;
      let cg = C1[1] + (C2[1] - C1[1]) * t;
      let cb = C1[2] + (C2[2] - C1[2]) * t;
      // maskable:全出血渐变背景;普通图标:圆角方块
      let a = opts.maskable ? 1 : cov(sdRoundRect(px, py, cx, cy, hw, hw, r));
      // 对勾
      const d1 = sdSeg(px, py, ...checkPts[0].map((v) => v * S));
      const d2 = sdSeg(px, py, ...checkPts[1].map((v) => v * S));
      const dCheck = Math.min(d1, d2);
      const ca = cov(dCheck - stroke / 2);
      // 白色对勾覆盖在背景上(over 合成)
      const outA = ca + a * (1 - ca);
      if (outA > 0) {
        cr = (255 * ca + cr * a * (1 - ca)) / outA;
        cg = (255 * ca + cg * a * (1 - ca)) / outA;
        cb = (255 * ca + cb * a * (1 - ca)) / outA;
      }
      const i = (y * S + x) * 4;
      buf[i] = Math.round(cr);
      buf[i + 1] = Math.round(cg);
      buf[i + 2] = Math.round(cb);
      buf[i + 3] = Math.round(Math.min(1, outA) * 255);
    }
  }
  return buf;
}

/** 2x 超采样后盒式降采样 */
function renderDownsampled(size, opts) {
  const S = size * 2;
  const big = render(S, opts);
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * S + x * 2 + dx) * 4;
          // 预乘后平均
          const al = big[i + 3] / 255;
          r += big[i] * al;
          g += big[i + 1] * al;
          b += big[i + 2] * al;
          a += al;
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a);
        out[i + 1] = Math.round(g / a);
        out[i + 2] = Math.round(b / a);
      }
      out[i + 3] = Math.round((a / 4) * 255);
    }
  }
  return out;
}

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'icon-180.png', size: 180, maskable: false },
  { name: 'icon-32.png', size: 32, maskable: false },
];

for (const t of targets) {
  const png = encodePNG(t.size, t.size, renderDownsampled(t.size, t));
  writeFileSync(join(outDir, t.name), png);
  console.log('wrote', t.name, png.length, 'bytes');
}

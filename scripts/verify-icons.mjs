// 解码 gen-icons 生成的 PNG(仅 filter=0),抽样验证绘制结果
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

function decode(path) {
  const buf = readFileSync(path);
  let off = 8;
  let width = 0, height = 0;
  let idat = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idat = Buffer.concat([idat, data]);
    }
    off += 12 + len;
  }
  const raw = inflateSync(idat);
  const stride = width * 4;
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`unexpected filter ${filter} at row ${y}`);
    raw.copy(px, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return { width, height, at: (x, y) => [...px.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)] };
}

function check(name, path, samples) {
  const img = decode(path);
  console.log(`\n== ${name} (${img.width}x${img.height}) ==`);
  for (const [label, x, y] of samples) {
    console.log(`  ${label} @(${x},${y}):`, img.at(x, y).join(','));
  }
}

const S = 512;
check('icon-512', 'public/icons/icon-512.png', [
  ['左上角(应透明)', 3, 3],
  ['中心(应渐变不透明)', 256, 256],
  ['对勾中心(应白色)', Math.round(0.36 * S), Math.round(0.595 * S)],
  ['对勾上方空隙(应渐变)', Math.round(0.44 * S), Math.round(0.52 * S)],
]);

check('icon-maskable-512', 'public/icons/icon-maskable-512.png', [
  ['角落(应渐变铺满)', 3, 3],
  ['顶部边缘内(应渐变)', 256, 20],
  ['对勾中心(应白色)', Math.round(0.375 * S), Math.round(0.595 * S)],
]);

check('icon-32', 'public/icons/icon-32.png', [
  ['角落(应透明)', 0, 0],
  ['中心(应不透明)', 16, 16],
]);

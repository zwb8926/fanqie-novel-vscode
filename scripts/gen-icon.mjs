// 生成番茄小说扩展图标：128x128 PNG，透明背景 + 番茄 + 绿叶 + 高光（6x6 超采样抗锯齿）。
import fs from 'node:fs';
import zlib from 'node:zlib';

const SIZE = 128;
const SS = 6; // 超采样
const W = SIZE * SS; // 768（采样空间）
const GEO = 512; // 几何空间（与常量一致）
const SCALE = GEO / W; // 采样点 -> 几何空间

// ---------- 基础像素绘制（512 空间） ----------
const TOMATO_CX = 256, TOMATO_CY = 292, TOMATO_R = 186;
const STEM_BASE = { x: 256, y: 132 }; // 叶片/茎的起点
const LEAF_ANGLES = [-144, -117, -90, -63, -36]; // 朝上扇形展开的 5 片叶子（度，屏幕坐标向上为 -90）
const LEAF_LEN = 54, LEAF_W = 24;

function inEllipse(x, y, cx, cy, rx, ry, rotDeg) {
  const cos = Math.cos((-rotDeg * Math.PI) / 180);
  const sin = Math.sin((-rotDeg * Math.PI) / 180);
  const dx = x - cx, dy = y - cy;
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
}

function leafContains(x, y, angleDeg) {
  // 每片叶子：以茎基部为起点，沿 angleDeg 方向伸展的椭圆
  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad), dirY = Math.sin(rad);
  const cx = STEM_BASE.x + dirX * 26;
  const cy = STEM_BASE.y + dirY * 26;
  const rot = angleDeg + 90; // 椭圆长轴沿叶片方向
  return inEllipse(x, y, cx, cy, LEAF_LEN, LEAF_W, rot);
}

// ---------- 每个采样点的颜色 ----------
function sampleColor(x, y) {
  // 茎（最上层）
  if (inEllipse(x, y, STEM_BASE.x, STEM_BASE.y - 20, 15, 26, 0)) {
    return [109, 76, 65, 255];
  }
  // 叶片（覆盖在番茄顶部）
  for (const a of LEAF_ANGLES) {
    if (leafContains(x, y, a)) {
      const t = 1 - Math.min(1, Math.abs(x - STEM_BASE.x) / 160);
      const r = Math.round(67 - 14 * t);
      const g = Math.round(160 - 20 * t);
      const b = Math.round(71 - 14 * t);
      return [r, g, b, 255];
    }
  }
  // 番茄主体：径向渐变（左上亮、右下深）
  const ddx = x - TOMATO_CX, ddy = y - TOMATO_CY;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist <= TOMATO_R) {
    const t = dist / TOMATO_R;
    const u = (x - TOMATO_CX) / TOMATO_R, v = (y - TOMATO_CY) / TOMATO_R;
    const radial = Math.min(1, Math.sqrt((u + 0.55) ** 2 + (v + 0.45) ** 2) / 1.35); // 0..1 左上方更亮
    const r = Math.round(255 - 70 * radial - 12 * t);
    const g = Math.round(76 - 42 * radial - 14 * t);
    const b = Math.round(58 - 40 * radial - 10 * t);
    // 高光：左上小椭圆，半透明白
    if (inEllipse(x, y, TOMATO_CX - 62, TOMATO_CY - 62, 58, 34, -32)) {
      const hr = Math.round(r + (255 - r) * 0.55);
      const hg = Math.round(g + (255 - g) * 0.55);
      const hb = Math.round(b + (255 - b) * 0.55);
      return [hr, hg, hb, 255];
    }
    return [r, g, b, 255];
  }
  return [0, 0, 0, 0]; // 透明
}

// ---------- 超采样合成 ----------
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0;
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px * SS + sx + 0.5) * SCALE;
        const y = (py * SS + sy + 0.5) * SCALE;
        const [cr, cg, cb, ca] = sampleColor(x, y);
        // 预乘合成
        r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
      }
    }
    const n = SS * SS;
    const alpha = a / n;
    const i = py * (SIZE * 4 + 1) + 1 + px * 4;
    if (alpha > 0) {
      raw[i] = Math.round(r / a);
      raw[i + 1] = Math.round(g / a);
      raw[i + 2] = Math.round(b / a);
      raw[i + 3] = Math.round(alpha);
    } else {
      raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 0; raw[i + 3] = 0;
    }
  }
}

// ---------- PNG 编码 ----------
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync('media/icon.png', png);
console.log('icon.png written:', png.length, 'bytes,', SIZE + 'x' + SIZE);

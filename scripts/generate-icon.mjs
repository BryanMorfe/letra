import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const SIZE = 1024;

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function sdRoundedBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blend(dst, sr, sg, sb, sa) {
  const a = sa * (1 - dst[3]) + dst[3];
  if (a <= 0) return;
  const invA = 1 / a;
  dst[0] = (sr * sa + dst[0] * dst[3] * (1 - sa)) * invA;
  dst[1] = (sg * sa + dst[1] * dst[3] * (1 - sa)) * invA;
  dst[2] = (sb * sa + dst[2] * dst[3] * (1 - sa)) * invA;
  dst[3] = a;
}

function over(dst, sr, sg, sb, sa) {
  // Source-over onto dst
  const outA = sa + dst[3] * (1 - sa);
  if (outA <= 0) return;
  dst[0] = (sr * sa + dst[0] * dst[3] * (1 - sa)) / outA;
  dst[1] = (sg * sa + dst[1] * dst[3] * (1 - sa)) / outA;
  dst[2] = (sb * sa + dst[2] * dst[3] * (1 - sa)) / outA;
  dst[3] = outA;
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    const col = [0, 0, 0, 0];

    // 1. Outer squircle container (96..928, r=188)
    const dOuter = sdRoundedBox(px, py, 512, 512, 416, 416, 188);
    const aOuter = 1 - smoothstep(-1.2, 1.2, dOuter);
    if (aOuter > 0) {
      const t = Math.max(0, Math.min(1, (px + py - 220) / 1450));
      let r = 34 + (14 - 34) * t;
      let g = 38 + (17 - 38) * t;
      let b = 60 + (29 - 60) * t;

      // Subtle indigo radial glow near top-left
      const gDist = Math.hypot((px - 310) / 480, (py - 240) / 480);
      const glow = Math.max(0, 1 - gDist) ** 2 * 0.34;
      r += (99 - r) * glow;
      g += (102 - g) * glow;
      b += (241 - b) * glow;

      // Crisp subtle top-edge highlight rim
      const rim = Math.exp(-Math.abs(dOuter + 2.5) * 0.65) * 0.16;
      r += (255 - r) * rim;
      g += (255 - g) * rim;
      b += (255 - b) * rim;

      over(col, r, g, b, aOuter);
    }

    // 2. Drop shadow under paper sheet
    const dSheetShadow = sdRoundedBox(px, py - 20, 494, 516, 218, 284, 40);
    if (dSheetShadow < 64 && aOuter > 0) {
      const sa = (1 - smoothstep(-10, 56, dSheetShadow)) * 0.42 * aOuter;
      over(col, 4, 6, 14, sa);
    }

    // 3. Paper sheet with folded top-right corner
    const dSheetRect = sdRoundedBox(px, py, 494, 516, 218, 284, 40);
    // Cut top-right diagonal from (616, 232) to (712, 328): px - py = 384
    const dDiag = (px - py - 384) / Math.SQRT2;
    const dSheet = Math.max(dSheetRect, dDiag);
    const aSheet = 1 - smoothstep(-1.1, 1.1, dSheet);
    if (aSheet > 0) {
      const st = Math.max(0, Math.min(1, (py - 232) / 568));
      const sr = 255 + (238 - 255) * st;
      const sg = 255 + (242 - 255) * st;
      const sb = 255;
      over(col, sr, sg, sb, aSheet);
    }

    // Folded triangle flap in top-right (616..712, 232..328, below diagonal)
    const dFlap = Math.max(dSheetRect, dDiag, 616 - px, py - 328);
    const aFlap = 1 - smoothstep(-1.1, 1.1, dFlap);
    if (aFlap > 0) {
      over(col, 203, 213, 254, aFlap);
    }

    // 4. Editorial Indigo "L" monogram
    const dLVert = sdRoundedBox(px, py, 411, 508, 33, 164, 16);
    const dLHoriz = sdRoundedBox(px, py, 496, 641, 118, 31, 16);
    const dL = Math.min(dLVert, dLHoriz);
    const aL = 1 - smoothstep(-1.1, 1.1, dL);
    if (aL > 0) {
      const lt = Math.max(0, Math.min(1, (px + py - 700) / 520));
      const lr = 79 + (99 - 79) * lt;
      const lg = 70 + (102 - 70) * lt;
      const lb = 229 + (241 - 229) * lt;
      over(col, lr, lg, lb, aL);
    }

    // 5. Subtle Markdown / Page lines beside the L
    const dLine1 = sdRoundedBox(px, py, 558, 408, 66, 11, 11);
    const aLine1 = 1 - smoothstep(-1.1, 1.1, dLine1);
    if (aLine1 > 0) over(col, 165, 180, 252, aLine1);

    const dLine2 = sdRoundedBox(px, py, 538, 458, 46, 11, 11);
    const aLine2 = 1 - smoothstep(-1.1, 1.1, dLine2);
    if (aLine2 > 0) over(col, 199, 210, 254, aLine2);

    const dDot = Math.hypot(px - 613, py - 458) - 12;
    const aDot = 1 - smoothstep(-1.1, 1.1, dDot);
    if (aDot > 0) over(col, 99, 102, 241, aDot);

    const idx = (y * SIZE + x) * 4;
    rgba[idx] = Math.round(Math.max(0, Math.min(255, col[0])));
    rgba[idx + 1] = Math.round(Math.max(0, Math.min(255, col[1])));
    rgba[idx + 2] = Math.round(Math.max(0, Math.min(255, col[2])));
    rgba[idx + 3] = Math.round(Math.max(0, Math.min(255, col[3] * 255)));
  }
}

fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/icon.png', encodePng(SIZE, SIZE, rgba));
console.log('Generated build/icon.png (1024x1024)');

// Assemble native macOS .icns container with PNG icon chunks
const icnsEntries = [
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic13', 256],
  ['ic08', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024],
];

const tmpDir = 'build/.icns-tmp';
fs.mkdirSync(tmpDir, { recursive: true });
const chunks = [];
for (const [tag, px] of icnsEntries) {
  const outPng = `${tmpDir}/${tag}.png`;
  if (px === 1024) {
    fs.copyFileSync('build/icon.png', outPng);
  } else {
    execFileSync('sips', ['-s', 'format', 'png', '-z', String(px), String(px), 'build/icon.png', '--out', outPng], {
      stdio: 'ignore',
    });
  }
  const pngBytes = fs.readFileSync(outPng);
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'ascii');
  header.writeUInt32BE(pngBytes.length + 8, 4);
  chunks.push(header, pngBytes);
}
const body = Buffer.concat(chunks);
const fileHeader = Buffer.alloc(8);
fileHeader.write('icns', 0, 4, 'ascii');
fileHeader.writeUInt32BE(body.length + 8, 4);
fs.writeFileSync('build/icon.icns', Buffer.concat([fileHeader, body]));
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.rmSync('build/icon.iconset', { recursive: true, force: true });
console.log('Generated build/icon.icns');

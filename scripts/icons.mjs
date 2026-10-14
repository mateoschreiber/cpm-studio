// Deterministic local icon generation; no downloaded imagery or runtime service.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function icon(size, path) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const vertices = [[.29, .5], [.5, .33], [.71, .5], [.5, .67]];
  function distance(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x-a[0])*dx + (y-a[1])*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x+.5)/size, py = (y+.5)/size;
    const node = vertices.some(([nx,ny]) => Math.hypot(px-nx,py-ny)<.049);
    const line = vertices.some((a,i) => distance(px,py,a,vertices[(i+1)%4])<.014);
    const offset = y*(size*4+1)+1+x*4;
    pixels.set(node ? [255,255,255,255] : line ? [209,250,240,255] : [8,127,115,255],offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size,4); header[8]=8; header[9]=6;
  writeFileSync(path, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(pixels)),chunk("IEND",Buffer.alloc(0))]));
}
icon(192, "public/icon-192.png");
icon(512, "public/icon-512.png");
icon(512, "public/maskable-512.png");

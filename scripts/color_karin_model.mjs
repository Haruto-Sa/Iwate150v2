/**
 * 既存カリンモデルの手選択部位をUVへベイクするオフライン素材制作スクリプト。
 * 元の頂点・法線・UV・面は変更しない。投影輪郭は6方向の実モデルを目視して作成。
 * @example node scripts/color_karin_model.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public/models/kappa.obj');
const OUTPUT = path.join(ROOT, 'public/assets/characters/karin');
const SIZE = 2048;
const PADDING = 8;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_DURATION_MS = 60_000;
const PALETTE = {
  skin: [99, 186, 137],
  shell: [0, 147, 74],
  crown: [0, 160, 78],
  plate: [246, 246, 232],
  ink: [37, 39, 36],
};

// 800×900 / orthographic幅2.2の形状確認画像で手選択した輪郭。
// 正面だけの投影が背面へ貫通しないよう、常に別方向の輪郭と交差させる。
const REGIONS = {
  shellRear: [[395,255],[480,270],[524,310],[536,355],[535,407],[535,464],[533,512],[518,562],[488,604],[443,635],[403,640],[354,630],[309,603],[280,565],[263,509],[263,436],[263,370],[264,317],[305,270]],
  // 下向き法線を持つ後頭部の下端は、重なった甲羅の投影から除外する。
  headUndersideSide: [[230,260],[490,260],[490,325],[230,325]],
  shellSide: [[435,270],[490,282],[525,300],[547,320],[560,355],[570,385],[581,420],[585,460],[583,505],[578,540],[565,570],[543,600],[510,620],[455,638],[412,635],[407,593],[406,540],[408,471],[405,416],[403,367],[409,315]],
  crownTop: [[395,371],[423,377],[449,388],[467,415],[472,443],[486,471],[495,499],[486,526],[467,546],[461,575],[450,600],[416,596],[396,584],[341,600],[330,586],[330,556],[308,541],[295,520],[295,494],[301,454],[306,418],[321,394],[351,379]],
  crownSide: [[249,154],[256,132],[286,108],[320,98],[350,90],[379,85],[409,92],[435,107],[457,129],[464,146],[446,139],[426,132],[403,125],[380,119],[351,114],[318,116],[290,124],[268,139]],
  crownFrontLeaf: [[295,98],[352,83],[419,85],[461,94],[497,105],[495,115],[472,116],[463,122],[463,141],[453,160],[435,153],[417,136],[397,135],[373,146],[349,158],[337,156],[329,140],[335,121],[319,117],[296,116]],
  crownRearLeaf: [[306,100],[345,87],[400,86],[456,92],[506,103],[505,116],[482,117],[466,132],[445,148],[413,170],[399,167],[378,148],[355,139],[334,138],[321,123],[306,117]],
  // Front/rear depth envelopes isolate the protruding cap from the opposite head surface.
  capFrontDepth: [[221,77],[402,77],[402,175],[221,175]],
  capRearDepth: [[399,77],[490,77],[490,182],[399,182]],
  faceDepth: [[217,170],[292,170],[292,306],[217,306]],
  leftEye: [[322,198],[332,201],[339,209],[339,222],[335,233],[328,240],[317,240],[309,234],[305,224],[305,213],[310,203]],
  rightEye: [[477,197],[488,200],[495,208],[496,222],[491,234],[483,241],[472,240],[462,233],[459,222],[461,211],[468,202]],
  mouth: [[364,285],[380,288],[397,290],[412,288],[430,282],[434,283],[429,288],[414,294],[398,297],[380,293],[366,289]],
  plateTop: [[361,406],[386,399],[414,401],[437,413],[449,432],[450,456],[441,475],[421,488],[395,490],[370,482],[352,467],[346,445],[350,423]],
};

/**
 * 投影平面上で手選択した多角形の内外を判定する。
 * @param {number} x - 投影X座標
 * @param {number} y - 投影Y座標
 * @param {number[][]} polygon - 手選択輪郭
 * @returns {boolean} 輪郭内ならtrue
 * @example inside(320, 220, REGIONS.leftEye)
 */
function inside(x, y, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/**
 * 実モデル上の点を直交投影の手選択領域で着色する。
 * @param {number} x - 元モデルX
 * @param {number} y - 元モデルY
 * @param {number} z - 元モデルZ
 * @param {number} normalY - 元モデルの補間法線Y
 * @returns {string} パレットキー
 * @example colorAt(0, 0, 0, 1)
 */
function colorAt(x, y, z, normalY) {
  const px = 400 + x * 800 / 2.2;
  const py = 450 - y * 800 / 2.2;
  const sideX = 400 - z * 800 / 2.2;
  const topY = 450 + z * 800 / 2.2;
  const headUnderside = normalY < 0 && inside(sideX, py, REGIONS.headUndersideSide);
  if (!headUnderside && inside(800 - px, py, REGIONS.shellRear) && inside(sideX, py, REGIONS.shellSide)) return 'shell';
  const cap = inside(px, topY, REGIONS.crownTop) && (
    inside(sideX, py, REGIONS.crownSide) ||
    (inside(px, py, REGIONS.crownFrontLeaf) && inside(sideX, py, REGIONS.capFrontDepth)) ||
    (inside(800 - px, py, REGIONS.crownRearLeaf) && inside(sideX, py, REGIONS.capRearDepth))
  );
  if (cap) return inside(px, topY, REGIONS.plateTop) ? 'plate' : 'crown';
  if (inside(sideX, py, REGIONS.faceDepth) && (
    inside(px, py, REGIONS.leftEye) || inside(px, py, REGIONS.rightEye) || inside(px, py, REGIONS.mouth)
  )) return 'ink';
  return 'skin';
}

/**
 * RGB PNGのチャンクに必要なCRC32を計算する。
 * @param {Buffer} data - チャンク種別と内容
 * @returns {number} 符号なしCRC32
 * @example crc32(Buffer.from('IEND'))
 */
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * PNGチャンクを作る。
 * @param {string} type - チャンク名
 * @param {Buffer} body - チャンク内容
 * @returns {Buffer} 長さ・CRCを含むチャンク
 * @example pngChunk('IEND', Buffer.alloc(0))
 */
function pngChunk(type, body) {
  const data = Buffer.concat([Buffer.from(type), body]);
  const length = Buffer.alloc(4); length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(data));
  return Buffer.concat([length, data, crc]);
}

/**
 * 外部画像ライブラリなしでRGB配列をPNGへ保存する。
 * @param {string} filename - 出力先
 * @param {Uint8Array} rgb - SIZE×SIZEのRGB画素
 * @returns {void}
 * @example savePng('/tmp/karin.png', new Uint8Array(SIZE * SIZE * 3))
 */
function savePng(filename, rgb) {
  const header = Buffer.alloc(13); header.writeUInt32BE(SIZE); header.writeUInt32BE(SIZE, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  for (let y = 0; y < SIZE; y++) rows.set(rgb.subarray(y * SIZE * 3, (y + 1) * SIZE * 3), y * (SIZE * 3 + 1) + 1);
  fs.writeFileSync(filename, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]));
}

/**
 * 元OBJを解析し、面内位置をUVへラスタライズして同梱素材を生成する。
 * @returns {void}
 * @example main()
 */
function main() {
  if (fs.statSync(SOURCE).size > MAX_SOURCE_BYTES) throw new Error('入力モデルが32MBの上限を超えています。');
  const deadline = performance.now() + MAX_DURATION_MS;
  const original = fs.readFileSync(SOURCE, 'utf8');
  const vertices = [], uvs = [], normals = [], faces = [];
  for (const line of original.split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') vertices.push(fields.slice(1).map(Number));
    if (fields[0] === 'vn') normals.push(fields.slice(1).map(Number));
    if (fields[0] === 'vt') uvs.push(fields.slice(1).map(Number));
    if (fields[0] === 'f') faces.push(fields.slice(1).map(field => field.split('/').map(value => Number(value) - 1)));
  }
  const rgb = new Uint8Array(SIZE * SIZE * 3), covered = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) rgb.set(PALETTE.skin, p * 3);
  let degenerate = 0, writes = 0, conflictingOverlap = 0;
  const counts = Object.fromEntries(Object.keys(PALETTE).map(key => [key, 0]));
  for (const face of faces) {
    if (performance.now() > deadline) throw new Error('素材生成が60秒の上限に達しました。');
    if (face.length !== 3) throw new Error('三角形以外の面があります。');
    const points = face.map(index => vertices[index[0]]);
    const tri = face.map(index => [uvs[index[1]][0] * SIZE, (1 - uvs[index[1]][1]) * SIZE]);
    const [a,b,c] = tri;
    const determinant = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if (Math.abs(determinant) < 1e-9) { degenerate++; continue; }
    const minX = Math.max(0, Math.floor(Math.min(a[0],b[0],c[0]))), maxX = Math.min(SIZE-1, Math.ceil(Math.max(a[0],b[0],c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1],b[1],c[1]))), maxY = Math.min(SIZE-1, Math.ceil(Math.max(a[1],b[1],c[1])));
    for (let py=minY; py<=maxY; py++) for (let px=minX; px<=maxX; px++) {
      if (px === minX && performance.now() > deadline) throw new Error('素材生成が60秒の上限に達しました。');
      const w0=((b[1]-c[1])*(px+.5-c[0])+(c[0]-b[0])*(py+.5-c[1]))/determinant;
      const w1=((c[1]-a[1])*(px+.5-c[0])+(a[0]-c[0])*(py+.5-c[1]))/determinant;
      const w2=1-w0-w1;
      if (Math.min(w0,w1,w2)<-1e-7) continue;
      const point=[0,1,2].map(k=>w0*points[0][k]+w1*points[1][k]+w2*points[2][k]);
      const normalY = w0 * normals[face[0][2]][1] + w1 * normals[face[1][2]][1] + w2 * normals[face[2][2]][1];
      const key=colorAt(...point, normalY), color=PALETTE[key], p=py*SIZE+px;
      if(covered[p] && color.some((v,k)=>v!==rgb[p*3+k])) conflictingOverlap++;
      covered[p]=1;rgb.set(color,p*3);counts[key]++;writes++;
    }
  }
  const coverage=covered.reduce((sum,value)=>sum+value,0);
  // UVアイランド外へ8texel膨張し、バイリニアフィルタとmipmapの縫い目を防ぐ。
  for(let step=0;step<PADDING;step++) {
    if (performance.now() > deadline) throw new Error('素材生成が60秒の上限に達しました。');
    const next=covered.slice(), nextRgb=rgb.slice();
    for(let y=1;y<SIZE-1;y++) for(let x=1;x<SIZE-1;x++) {
      const p=y*SIZE+x;if(covered[p])continue;
      for(const neighbor of [p-1,p+1,p-SIZE,p+SIZE]) if(covered[neighbor]) {next[p]=1;nextRgb.set(rgb.subarray(neighbor*3,neighbor*3+3),p*3);break;}
    }
    covered.set(next);rgb.set(nextRgb);
  }
  fs.mkdirSync(OUTPUT,{recursive:true});
  savePng(path.join(OUTPUT,'karin-color.png'),rgb);
  fs.writeFileSync(path.join(OUTPUT,'karin.obj'),original.replace(/^mtllib .+$/m,'mtllib karin.mtl'));
  fs.writeFileSync(path.join(OUTPUT,'karin.mtl'),'# Existing Karin mesh: hand-selected anatomical colors baked into its original UVs.\nnewmtl Material_0\nKa 0.2 0.2 0.2\nKd 1 1 1\nKs 0.02 0.02 0.02\nNs 8\nd 1\nillum 2\nmap_Kd karin-color.png\n');
  console.log(JSON.stringify({vertices:vertices.length,uvs:uvs.length,faces:faces.length,textureSize:SIZE,coverage,writes,conflictingOverlap,degenerate,counts},null,2));
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

const fs = require('fs');
const path = require('path');

function align4(n) {
  return (n + 3) & ~3;
}

function parseDataUrl(photo) {
  const value = String(photo || '').trim();
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  try {
    return { mime, buffer: Buffer.from(base64, 'base64') };
  } catch {
    return null;
  }
}

function getImageSize(buffer, mime) {
  if (mime.includes('png') && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    let i = 2;
    while (i < buffer.length - 8) {
      if (buffer[i] !== 0xff) break;
      const marker = buffer[i + 1];
      const size = (buffer[i + 2] << 8) + buffer[i + 3];
      if (
        marker === 0xc0 || marker === 0xc1 || marker === 0xc2 ||
        marker === 0xc3 || marker === 0xc5 || marker === 0xc6 ||
        marker === 0xc7 || marker === 0xc9 || marker === 0xca ||
        marker === 0xcb || marker === 0xcd || marker === 0xce ||
        marker === 0xcf
      ) {
        return {
          height: (buffer[i + 5] << 8) + buffer[i + 6],
          width: (buffer[i + 7] << 8) + buffer[i + 8]
        };
      }
      i += 2 + size;
    }
  }
  return { width: 1, height: 1 };
}

function buildProductPhotoGlb(photoDataUrl, options = {}) {
  const parsed = parseDataUrl(photoDataUrl);
  if (!parsed || !parsed.buffer || !parsed.buffer.length) return null;

  const maxSide = Number(options.maxSideMeters) > 0 ? Number(options.maxSideMeters) : 0.35;
  const thickness = Number(options.thicknessMeters) > 0 ? Number(options.thicknessMeters) : 0.012;
  const size = getImageSize(parsed.buffer, parsed.mime);
  const aspect = size.width / Math.max(size.height, 1);
  let width = maxSide;
  let height = maxSide;
  if (aspect >= 1) height = maxSide / aspect;
  else width = maxSide * aspect;

  const hx = width / 2;
  const hy = height / 2;
  const hz = thickness / 2;

  const positions = new Float32Array([
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
  ]);
  const uvs = new Float32Array([
    0, 1, 1, 1, 1, 0, 0, 0,
    0, 1, 1, 1, 1, 0, 0, 0
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7
  ]);

  const imageBytes = parsed.buffer;
  const posBytes = positions.byteLength;
  const norBytes = normals.byteLength;
  const uvBytes = uvs.byteLength;
  const indBytes = indices.byteLength;

  const posOffset = 0;
  const norOffset = align4(posOffset + posBytes);
  const uvOffset = align4(norOffset + norBytes);
  const indOffset = align4(uvOffset + uvBytes);
  const imgOffset = align4(indOffset + indBytes);
  const binSize = align4(imgOffset + imageBytes.length);

  const bin = Buffer.alloc(binSize);
  Buffer.from(positions.buffer).copy(bin, posOffset);
  Buffer.from(normals.buffer).copy(bin, norOffset);
  Buffer.from(uvs.buffer).copy(bin, uvOffset);
  Buffer.from(indices.buffer).copy(bin, indOffset);
  imageBytes.copy(bin, imgOffset);

  const gltf = {
    asset: { version: '2.0', generator: 'warehouse-product-ar-server' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'ProductPhoto' }],
    meshes: [{
      name: 'ProductPhotoMesh',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0
      }]
    }],
    materials: [{
      name: 'ProductPhotoMaterial',
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.9
      },
      doubleSided: true
    }],
    textures: [{ source: 0 }],
    images: [{ mimeType: parsed.mime, bufferView: 4 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        max: [hx, hy, hz],
        min: [-hx, -hy, -hz]
      },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: uvs.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: indices.length, type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: norOffset, byteLength: norBytes, target: 34962 },
      { buffer: 0, byteOffset: uvOffset, byteLength: uvBytes, target: 34962 },
      { buffer: 0, byteOffset: indOffset, byteLength: indBytes, target: 34963 },
      { buffer: 0, byteOffset: imgOffset, byteLength: imageBytes.length }
    ],
    buffers: [{ byteLength: binSize }]
  };

  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPadding, 0)]);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

function getArCacheDir() {
  return path.join(__dirname, '..', 'public', 'ar-cache');
}

function ensureArCacheDir() {
  const dir = getArCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeProductArModel(item) {
  ensureArCacheDir();
  const fileName = `${item.id}.glb`;
  const filePath = path.join(getArCacheDir(), fileName);
  const defaultBoxPath = path.join(__dirname, '..', 'public', 'models', 'product-box.glb');

  let glb = null;
  let hasPhoto = false;
  if (item.photo) {
    glb = buildProductPhotoGlb(item.photo);
    hasPhoto = Boolean(glb);
  }
  if (!glb) {
    if (!fs.existsSync(defaultBoxPath)) {
      throw new Error('Default AR model is missing');
    }
    glb = fs.readFileSync(defaultBoxPath);
  }

  fs.writeFileSync(filePath, glb);
  return {
    fileName,
    relativeUrl: `/ar-cache/${fileName}`,
    hasPhoto
  };
}

module.exports = {
  buildProductPhotoGlb,
  writeProductArModel,
  ensureArCacheDir
};

const fs = require('fs');
const path = require('path');

function align4(n) {
  return (n + 3) & ~3;
}

function copyBytes(target, offset, source) {
  const view = Buffer.isBuffer(source)
    ? source
    : Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  view.copy(target, offset);
}

function parseDataUrl(photo) {
  const value = String(photo || '').trim();
  if (!value || value === 'null' || value === 'undefined') return null;

  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+)(;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (match) {
    return {
      mime: match[1].toLowerCase(),
      buffer: Buffer.from(match[3].replace(/\s+/g, ''), 'base64')
    };
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length > 100) {
    try {
      const buffer = Buffer.from(value.replace(/\s+/g, ''), 'base64');
      if (buffer.length > 100) {
        const mime = buffer[0] === 0x89 && buffer[1] === 0x50
          ? 'image/png'
          : 'image/jpeg';
        return { mime, buffer };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getImageSize(buffer, mime) {
  if ((mime.includes('png') || (buffer[0] === 0x89 && buffer[1] === 0x50)) && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mime.includes('jpeg') || mime.includes('jpg') || (buffer[0] === 0xff && buffer[1] === 0xd8)) {
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
      if (size < 2) break;
      i += 2 + size;
    }
  }
  return { width: 512, height: 512 };
}

function normalizeImageMime(parsed) {
  if (parsed.buffer[0] === 0xff && parsed.buffer[1] === 0xd8) return 'image/jpeg';
  if (parsed.buffer[0] === 0x89 && parsed.buffer[1] === 0x50) return 'image/png';
  const value = String(parsed.mime || '').toLowerCase();
  if (value.includes('png')) return 'image/png';
  if (value.includes('jpeg') || value.includes('jpg')) return 'image/jpeg';
  return null;
}

function pushFace(positions, normals, uvs, indices, corners, normal, uvRect) {
  const base = positions.length / 3;
  for (let i = 0; i < 4; i += 1) {
    positions.push(corners[i][0], corners[i][1], corners[i][2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
  uvs.push(
    uvRect[0], uvRect[1],
    uvRect[2], uvRect[3],
    uvRect[4], uvRect[5],
    uvRect[6], uvRect[7]
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function buildProductPhotoGlb(photoDataUrl, options = {}) {
  const parsed = parseDataUrl(photoDataUrl);
  if (!parsed || !parsed.buffer || parsed.buffer.length < 32) return null;

  const mime = normalizeImageMime(parsed);
  if (!mime) return null;
  parsed.mime = mime;

  const maxSide = Number(options.maxSideMeters) > 0 ? Number(options.maxSideMeters) : 0.45;
  // Thicker board avoids disappearing when viewed nearly edge-on in AR.
  const thickness = Number(options.thicknessMeters) > 0 ? Number(options.thicknessMeters) : 0.025;
  const size = getImageSize(parsed.buffer, parsed.mime);
  const aspect = Math.max(size.width, 1) / Math.max(size.height, 1);
  let width = maxSide;
  let height = maxSide;
  if (aspect >= 1) height = maxSide / aspect;
  else width = maxSide * aspect;

  const hx = width / 2;
  const hy = height / 2;
  const hz = thickness / 2;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Full photo on front/back; sides use a thin strip of the photo edge (still textured).
  const fullUv = [0, 1, 1, 1, 1, 0, 0, 0];
  const sideUv = [0, 0.98, 1, 0.98, 1, 1, 0, 1];

  // +Z front
  pushFace(positions, normals, uvs, indices, [
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]
  ], [0, 0, 1], fullUv);
  // -Z back
  pushFace(positions, normals, uvs, indices, [
    [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]
  ], [0, 0, -1], fullUv);
  // +Y top
  pushFace(positions, normals, uvs, indices, [
    [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]
  ], [0, 1, 0], sideUv);
  // -Y bottom
  pushFace(positions, normals, uvs, indices, [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]
  ], [0, -1, 0], sideUv);
  // +X right
  pushFace(positions, normals, uvs, indices, [
    [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]
  ], [1, 0, 0], sideUv);
  // -X left
  pushFace(positions, normals, uvs, indices, [
    [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]
  ], [-1, 0, 0], sideUv);

  const pos = new Float32Array(positions);
  const nor = new Float32Array(normals);
  const uv = new Float32Array(uvs);
  const ind = new Uint16Array(indices);
  const imageBytes = parsed.buffer;

  const posBytes = pos.byteLength;
  const norBytes = nor.byteLength;
  const uvBytes = uv.byteLength;
  const indBytes = ind.byteLength;

  const posOffset = 0;
  const norOffset = align4(posOffset + posBytes);
  const uvOffset = align4(norOffset + norBytes);
  const indOffset = align4(uvOffset + uvBytes);
  const imgOffset = align4(indOffset + indBytes);
  const binSize = align4(imgOffset + imageBytes.length);

  const bin = Buffer.alloc(binSize);
  copyBytes(bin, posOffset, pos);
  copyBytes(bin, norOffset, nor);
  copyBytes(bin, uvOffset, uv);
  copyBytes(bin, indOffset, ind);
  copyBytes(bin, imgOffset, imageBytes);

  const gltf = {
    asset: { version: '2.0', generator: 'warehouse-product-ar-server' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'ProductPhotoBoard' }],
    meshes: [{
      name: 'ProductPhotoBoardMesh',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0
      }]
    }],
    materials: [{
      name: 'ProductPhotoUnlit',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: 0, texCoord: 0 },
        metallicFactor: 0,
        roughnessFactor: 1
      },
      alphaMode: 'OPAQUE',
      doubleSided: true,
      extensions: {
        KHR_materials_unlit: {}
      }
    }],
    samplers: [{
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 33071,
      wrapT: 33071
    }],
    textures: [{ sampler: 0, source: 0 }],
    images: [{ mimeType: parsed.mime, bufferView: 4 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: pos.length / 3,
        type: 'VEC3',
        max: [hx, hy, hz],
        min: [-hx, -hy, -hz]
      },
      { bufferView: 1, componentType: 5126, count: nor.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: uv.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: ind.length, type: 'SCALAR' }
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

function writeProductArModel(item, photoOverride = null) {
  ensureArCacheDir();
  const fileName = `${item.id}.glb`;
  const filePath = path.join(getArCacheDir(), fileName);
  const defaultBoxPath = path.join(__dirname, '..', 'public', 'models', 'product-box.glb');

  const photo = photoOverride || item.photo;
  let glb = null;
  let hasPhoto = false;
  let photoError = null;

  if (photo) {
    try {
      glb = buildProductPhotoGlb(photo, {
        maxSideMeters: 0.45,
        thicknessMeters: 0.025
      });
      hasPhoto = Boolean(glb);
      if (!glb) photoError = 'Could not encode product photo into GLB';
    } catch (error) {
      photoError = error.message || 'Photo GLB build failed';
      glb = null;
    }
  } else {
    photoError = 'Product has no photo';
  }

  if (!glb) {
    if (!fs.existsSync(defaultBoxPath)) {
      throw new Error(photoError || 'Default AR model is missing');
    }
    glb = fs.readFileSync(defaultBoxPath);
  }

  fs.writeFileSync(filePath, glb);
  return {
    fileName,
    relativeUrl: `/ar-cache/${fileName}`,
    hasPhoto,
    photoError: hasPhoto ? null : photoError,
    byteLength: glb.length
  };
}

module.exports = {
  buildProductPhotoGlb,
  writeProductArModel,
  ensureArCacheDir,
  parseDataUrl
};

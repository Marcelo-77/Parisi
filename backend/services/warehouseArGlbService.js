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

  const maxSide = Number(options.maxSideMeters) > 0 ? Number(options.maxSideMeters) : 0.42;
  const size = getImageSize(parsed.buffer, parsed.mime);
  const aspect = Math.max(size.width, 1) / Math.max(size.height, 1);
  let width = maxSide;
  let height = maxSide;
  if (aspect >= 1) height = maxSide / aspect;
  else width = maxSide * aspect;

  // Real 3D carton depth (not a flat board). Accept legacy thicknessMeters.
  let depth = Number(options.depthMeters);
  if (!(depth > 0)) depth = Number(options.thicknessMeters);
  if (!(depth > 0)) depth = Math.min(0.18, Math.max(0.12, maxSide * 0.38));

  const hx = width / 2;
  const hz = depth / 2;
  const y0 = 0;
  const y1 = height;

  const photoPos = [];
  const photoNor = [];
  const photoUv = [];
  const photoInd = [];
  const sidePos = [];
  const sideNor = [];
  const sideUv = [];
  const sideInd = [];

  const fullUv = [0, 1, 1, 1, 1, 0, 0, 0];
  const blankUv = [0, 0, 1, 0, 1, 1, 0, 1];

  // Front (+Z) and back (-Z): product photo
  pushFace(photoPos, photoNor, photoUv, photoInd, [
    [-hx, y0, hz], [hx, y0, hz], [hx, y1, hz], [-hx, y1, hz]
  ], [0, 0, 1], fullUv);
  pushFace(photoPos, photoNor, photoUv, photoInd, [
    [hx, y0, -hz], [-hx, y0, -hz], [-hx, y1, -hz], [hx, y1, -hz]
  ], [0, 0, -1], fullUv);

  // Sides: solid carton color so the box reads as 3D under lighting
  pushFace(sidePos, sideNor, sideUv, sideInd, [
    [-hx, y1, hz], [hx, y1, hz], [hx, y1, -hz], [-hx, y1, -hz]
  ], [0, 1, 0], blankUv);
  pushFace(sidePos, sideNor, sideUv, sideInd, [
    [-hx, y0, -hz], [hx, y0, -hz], [hx, y0, hz], [-hx, y0, hz]
  ], [0, -1, 0], blankUv);
  pushFace(sidePos, sideNor, sideUv, sideInd, [
    [hx, y0, hz], [hx, y0, -hz], [hx, y1, -hz], [hx, y1, hz]
  ], [1, 0, 0], blankUv);
  pushFace(sidePos, sideNor, sideUv, sideInd, [
    [-hx, y0, -hz], [-hx, y0, hz], [-hx, y1, hz], [-hx, y1, -hz]
  ], [-1, 0, 0], blankUv);

  const pPos = new Float32Array(photoPos);
  const pNor = new Float32Array(photoNor);
  const pUv = new Float32Array(photoUv);
  const pInd = new Uint16Array(photoInd);
  const sPos = new Float32Array(sidePos);
  const sNor = new Float32Array(sideNor);
  const sUv = new Float32Array(sideUv);
  const sInd = new Uint16Array(sideInd);
  const imageBytes = parsed.buffer;

  const chunks = [
    { data: pPos, target: 34962 },
    { data: pNor, target: 34962 },
    { data: pUv, target: 34962 },
    { data: pInd, target: 34963 },
    { data: sPos, target: 34962 },
    { data: sNor, target: 34962 },
    { data: sUv, target: 34962 },
    { data: sInd, target: 34963 },
    { data: imageBytes, target: null }
  ];

  let offset = 0;
  const views = chunks.map((chunk) => {
    const byteLength = chunk.data.byteLength != null ? chunk.data.byteLength : chunk.data.length;
    offset = align4(offset);
    const view = { byteOffset: offset, byteLength, target: chunk.target };
    offset = align4(offset + byteLength);
    return view;
  });
  const binSize = offset;
  const bin = Buffer.alloc(binSize);
  chunks.forEach((chunk, i) => {
    copyBytes(bin, views[i].byteOffset, chunk.data);
  });

  const gltf = {
    asset: { version: '2.0', generator: 'warehouse-product-ar-server' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'ProductPhotoBox' }],
    meshes: [{
      name: 'ProductPhotoBoxMesh',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0
        },
        {
          attributes: { POSITION: 4, NORMAL: 5, TEXCOORD_0: 6 },
          indices: 7,
          material: 1
        }
      ]
    }],
    materials: [
      {
        name: 'ProductPhotoFace',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          baseColorTexture: { index: 0, texCoord: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.72
        },
        alphaMode: 'OPAQUE',
        doubleSided: false
      },
      {
        name: 'ProductCartonSide',
        pbrMetallicRoughness: {
          baseColorFactor: [0.78, 0.74, 0.68, 1],
          metallicFactor: 0,
          roughnessFactor: 0.9
        },
        alphaMode: 'OPAQUE',
        doubleSided: false
      }
    ],
    samplers: [{
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 33071,
      wrapT: 33071
    }],
    textures: [{ sampler: 0, source: 0 }],
    images: [{ mimeType: parsed.mime, bufferView: 8 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: pPos.length / 3,
        type: 'VEC3',
        max: [hx, y1, hz],
        min: [-hx, y0, -hz]
      },
      { bufferView: 1, componentType: 5126, count: pNor.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: pUv.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: pInd.length, type: 'SCALAR' },
      {
        bufferView: 4,
        componentType: 5126,
        count: sPos.length / 3,
        type: 'VEC3',
        max: [hx, y1, hz],
        min: [-hx, y0, -hz]
      },
      { bufferView: 5, componentType: 5126, count: sNor.length / 3, type: 'VEC3' },
      { bufferView: 6, componentType: 5126, count: sUv.length / 2, type: 'VEC2' },
      { bufferView: 7, componentType: 5123, count: sInd.length, type: 'SCALAR' }
    ],
    bufferViews: views.map((view) => {
      const out = {
        buffer: 0,
        byteOffset: view.byteOffset,
        byteLength: view.byteLength
      };
      if (view.target) out.target = view.target;
      return out;
    }),
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

function findLatestCachedModel(itemId) {
  const id = String(itemId || '').trim();
  if (!id) return null;
  try {
    const dir = ensureArCacheDir();
    const prefix = `${id}-`;
    const matches = fs.readdirSync(dir)
      .filter((name) => name.startsWith(prefix) && name.endsWith('.glb'))
      .map((name) => {
        const full = path.join(dir, name);
        let mtime = 0;
        try {
          mtime = fs.statSync(full).mtimeMs || 0;
        } catch {
          mtime = 0;
        }
        return { name, full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return matches.length ? matches[0] : null;
  } catch {
    return null;
  }
}

function writeProductArModel(item, photoOverride = null, glbBase64 = null) {
  ensureArCacheDir();
  const stamp = Date.now();
  const fileName = `${item.id}-${stamp}.glb`;
  const filePath = path.join(getArCacheDir(), fileName);
  const defaultBoxPath = path.join(__dirname, '..', 'public', 'models', 'product-box.glb');

  let glb = null;
  let hasPhoto = false;
  let photoError = null;

  if (glbBase64) {
    try {
      const raw = String(glbBase64).replace(/^data:model\/gltf-binary;base64,/i, '').replace(/\s+/g, '');
      glb = Buffer.from(raw, 'base64');
      hasPhoto = glb.length > 100 && glb.readUInt32LE(0) === 0x46546c67;
      if (!hasPhoto) {
        glb = null;
        photoError = 'Invalid uploaded GLB';
      }
    } catch (error) {
      photoError = error.message || 'Invalid uploaded GLB';
      glb = null;
    }
  }

  const photo = photoOverride || item.photo;
  if (!glb && photo) {
    try {
      const parsed = parseDataUrl(photo);
      // Huge DB photos make Render time out — prefer client-uploaded compact GLB.
      if (parsed && parsed.buffer && parsed.buffer.length > 750000) {
        photoError = 'Product photo too large for on-demand AR encode';
      } else {
        glb = buildProductPhotoGlb(photo, {
          maxSideMeters: 0.42,
          depthMeters: 0.16
        });
        hasPhoto = Boolean(glb);
        if (!glb) photoError = 'Could not encode product photo into GLB';
      }
    } catch (error) {
      photoError = error.message || 'Photo GLB build failed';
      glb = null;
    }
  } else if (!glb) {
    photoError = 'Product has no photo';
  }

  if (!glb) {
    if (!fs.existsSync(defaultBoxPath)) {
      throw new Error(photoError || 'Default AR model is missing');
    }
    glb = fs.readFileSync(defaultBoxPath);
  }

  // Cleanup older cached models for this product (keep latest only).
  try {
    const prefix = `${item.id}-`;
    fs.readdirSync(getArCacheDir()).forEach((name) => {
      if (name.startsWith(prefix) && name.endsWith('.glb') && name !== fileName) {
        fs.unlinkSync(path.join(getArCacheDir(), name));
      }
    });
  } catch {
    // ignore cleanup errors
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
  findLatestCachedModel,
  parseDataUrl
};

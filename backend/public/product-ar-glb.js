/**
 * Build a minimal textured plane GLB from a product photo data URL.
 * Dimensions are in meters for real-world AR scale.
 */
(function (global) {
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
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { mime, bytes };
    } catch {
      return null;
    }
  }

  function getImageSize(bytes, mime) {
    if (mime.includes('png') && bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (mime.includes('jpeg') || mime.includes('jpg')) {
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] !== 0xff) break;
        const marker = bytes[i + 1];
        const size = (bytes[i + 2] << 8) + bytes[i + 3];
        if (
          marker === 0xc0 || marker === 0xc1 || marker === 0xc2 ||
          marker === 0xc3 || marker === 0xc5 || marker === 0xc6 ||
          marker === 0xc7 || marker === 0xc9 || marker === 0xca ||
          marker === 0xcb || marker === 0xcd || marker === 0xce ||
          marker === 0xcf
        ) {
          return {
            height: (bytes[i + 5] << 8) + bytes[i + 6],
            width: (bytes[i + 7] << 8) + bytes[i + 8]
          };
        }
        i += 2 + size;
      }
    }
    return { width: 1, height: 1 };
  }

  function concatBuffers(parts) {
    const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      out.set(new Uint8Array(part.buffer || part, part.byteOffset || 0, part.byteLength), offset);
      offset += part.byteLength;
    });
    return out;
  }

  function buildProductPhotoGlb(photoDataUrl, options = {}) {
    const parsed = parseDataUrl(photoDataUrl);
    if (!parsed) return null;

    const maxSide = Number(options.maxSideMeters) > 0 ? Number(options.maxSideMeters) : 0.35;
    const thickness = Number(options.thicknessMeters) > 0 ? Number(options.thicknessMeters) : 0.01;
    const size = getImageSize(parsed.bytes, parsed.mime);
    const aspect = size.width / Math.max(size.height, 1);
    let width = maxSide;
    let height = maxSide;
    if (aspect >= 1) {
      height = maxSide / aspect;
    } else {
      width = maxSide * aspect;
    }

    const hx = width / 2;
    const hy = height / 2;
    const hz = thickness / 2;

    // Front face (+Z) with UVs for the product photo.
    const positions = new Float32Array([
      -hx, -hy, hz,
      hx, -hy, hz,
      hx, hy, hz,
      -hx, hy, hz,
      // back face (-Z) same photo mirrored so it is visible from behind
      hx, -hy, -hz,
      -hx, -hy, -hz,
      -hx, hy, -hz,
      hx, hy, -hz
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

    const imageBytes = parsed.bytes;
    const posBytes = positions.byteLength;
    const norBytes = normals.byteLength;
    const uvBytes = uvs.byteLength;
    const indBytes = indices.byteLength;

    const posOffset = 0;
    const norOffset = align4(posOffset + posBytes);
    const uvOffset = align4(norOffset + norBytes);
    const indOffset = align4(uvOffset + uvBytes);
    const imgOffset = align4(indOffset + indBytes);
    const binSize = align4(imgOffset + imageBytes.byteLength);

    const bin = new ArrayBuffer(binSize);
    new Float32Array(bin, posOffset, positions.length).set(positions);
    new Float32Array(bin, norOffset, normals.length).set(normals);
    new Float32Array(bin, uvOffset, uvs.length).set(uvs);
    new Uint16Array(bin, indOffset, indices.length).set(indices);
    new Uint8Array(bin, imgOffset, imageBytes.length).set(imageBytes);

    const gltf = {
      asset: { version: '2.0', generator: 'warehouse-product-ar' },
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
      images: [{
        mimeType: parsed.mime,
        bufferView: 4
      }],
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
        { buffer: 0, byteOffset: imgOffset, byteLength: imageBytes.byteLength }
      ],
      buffers: [{ byteLength: binSize }]
    };

    const json = new TextEncoder().encode(JSON.stringify(gltf));
    const jsonPadding = (4 - (json.byteLength % 4)) % 4;
    const jsonChunk = new Uint8Array(json.byteLength + jsonPadding);
    jsonChunk.set(json, 0);
    for (let i = 0; i < jsonPadding; i += 1) jsonChunk[json.byteLength + i] = 0x20;

    const binBytes = new Uint8Array(bin);
    const binPadding = (4 - (binBytes.byteLength % 4)) % 4;
    const binChunk = new Uint8Array(binBytes.byteLength + binPadding);
    binChunk.set(binBytes, 0);

    const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
    const header = new ArrayBuffer(12);
    const headerView = new DataView(header);
    headerView.setUint32(0, 0x46546c67, true);
    headerView.setUint32(4, 2, true);
    headerView.setUint32(8, totalLength, true);

    const jsonHeader = new ArrayBuffer(8);
    const jsonHeaderView = new DataView(jsonHeader);
    jsonHeaderView.setUint32(0, jsonChunk.byteLength, true);
    jsonHeaderView.setUint32(4, 0x4e4f534a, true);

    const binHeader = new ArrayBuffer(8);
    const binHeaderView = new DataView(binHeader);
    binHeaderView.setUint32(0, binChunk.byteLength, true);
    binHeaderView.setUint32(4, 0x004e4942, true);

    return concatBuffers([
      new Uint8Array(header),
      new Uint8Array(jsonHeader),
      jsonChunk,
      new Uint8Array(binHeader),
      binChunk
    ]);
  }

  function loadImageElement(photoDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load product photo'));
      img.src = photoDataUrl;
    });
  }

  async function resizePhotoDataUrl(photoDataUrl, maxEdge = 512) {
    try {
      const img = await loadImageElement(photoDataUrl);
      const srcW = img.naturalWidth || img.width || 1;
      const srcH = img.naturalHeight || img.height || 1;

      // Power-of-two canvas helps Scene Viewer keep the texture stable.
      let pot = 512;
      if (maxEdge >= 1024) pot = 1024;
      if (maxEdge <= 256) pot = 256;

      const canvas = document.createElement('canvas');
      canvas.width = pot;
      canvas.height = pot;
      const ctx = canvas.getContext('2d');
      if (!ctx) return photoDataUrl;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pot, pot);

      const scale = Math.min(pot / srcW, pot / srcH);
      const drawW = Math.max(1, Math.round(srcW * scale));
      const drawH = Math.max(1, Math.round(srcH * scale));
      const dx = Math.round((pot - drawW) / 2);
      const dy = Math.round((pot - drawH) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, drawW, drawH);

      return canvas.toDataURL('image/jpeg', 0.92);
    } catch {
      return photoDataUrl;
    }
  }

  async function prepareArPhotoDataUrl(photoDataUrl, maxEdge = 512) {
    if (!photoDataUrl) return null;
    return resizePhotoDataUrl(photoDataUrl, maxEdge);
  }

  async function createProductPhotoGlbObjectUrl(photoDataUrl, options) {
    const resized = await resizePhotoDataUrl(photoDataUrl, options && options.maxImageEdge ? options.maxImageEdge : 1024);
    const bytes = buildProductPhotoGlb(resized || photoDataUrl, options);
    if (!bytes) return null;
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    return URL.createObjectURL(blob);
  }

  global.WarehouseProductArGlb = {
    buildProductPhotoGlb,
    createProductPhotoGlbObjectUrl,
    parseDataUrl,
    resizePhotoDataUrl,
    prepareArPhotoDataUrl
  };
})(window);

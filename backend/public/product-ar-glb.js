/**
 * Build a Scene Viewer / ARCore friendly photo board GLB.
 */
(function (global) {
  function align4(n) {
    return (n + 3) & ~3;
  }

  function parseDataUrl(photo) {
    const value = String(photo || '').trim();
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+)(;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const base64 = match[3].replace(/\s+/g, '');
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { mime, bytes };
    } catch {
      return null;
    }
  }

  function normalizeImageMime(parsed) {
    if (parsed.bytes[0] === 0xff && parsed.bytes[1] === 0xd8) return 'image/jpeg';
    if (parsed.bytes[0] === 0x89 && parsed.bytes[1] === 0x50) return 'image/png';
    const value = String(parsed.mime || '').toLowerCase();
    if (value.includes('png')) return 'image/png';
    if (value.includes('jpeg') || value.includes('jpg')) return 'image/jpeg';
    return null;
  }

  function getImageSize(bytes, mime) {
    if ((mime.includes('png') || (bytes[0] === 0x89 && bytes[1] === 0x50)) && bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (mime.includes('jpeg') || mime.includes('jpg') || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
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
        if (size < 2) break;
        i += 2 + size;
      }
    }
    return { width: 512, height: 512 };
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
    if (!parsed || parsed.bytes.length < 32) return null;
    const mime = normalizeImageMime(parsed);
    if (!mime) return null;

    const maxSide = Number(options.maxSideMeters) > 0 ? Number(options.maxSideMeters) : 0.45;
    const thickness = Number(options.thicknessMeters) > 0 ? Number(options.thicknessMeters) : 0.025;
    const size = getImageSize(parsed.bytes, mime);
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
    const fullUv = [0, 1, 1, 1, 1, 0, 0, 0];
    const sideUv = [0, 0.98, 1, 0.98, 1, 1, 0, 1];

    pushFace(positions, normals, uvs, indices, [
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]
    ], [0, 0, 1], fullUv);
    pushFace(positions, normals, uvs, indices, [
      [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]
    ], [0, 0, -1], fullUv);
    pushFace(positions, normals, uvs, indices, [
      [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]
    ], [0, 1, 0], sideUv);
    pushFace(positions, normals, uvs, indices, [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]
    ], [0, -1, 0], sideUv);
    pushFace(positions, normals, uvs, indices, [
      [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]
    ], [1, 0, 0], sideUv);
    pushFace(positions, normals, uvs, indices, [
      [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]
    ], [-1, 0, 0], sideUv);

    const pos = new Float32Array(positions);
    const nor = new Float32Array(normals);
    const uv = new Float32Array(uvs);
    const ind = new Uint16Array(indices);
    const imageBytes = parsed.bytes;

    const posOffset = 0;
    const norOffset = align4(pos.byteLength);
    const uvOffset = align4(norOffset + nor.byteLength);
    const indOffset = align4(uvOffset + uv.byteLength);
    const imgOffset = align4(indOffset + ind.byteLength);
    const binSize = align4(imgOffset + imageBytes.byteLength);
    const bin = new Uint8Array(binSize);
    bin.set(new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength), posOffset);
    bin.set(new Uint8Array(nor.buffer, nor.byteOffset, nor.byteLength), norOffset);
    bin.set(new Uint8Array(uv.buffer, uv.byteOffset, uv.byteLength), uvOffset);
    bin.set(new Uint8Array(ind.buffer, ind.byteOffset, ind.byteLength), indOffset);
    bin.set(imageBytes, imgOffset);

    const gltf = {
      asset: { version: '2.0', generator: 'warehouse-product-ar-client' },
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
        extensions: { KHR_materials_unlit: {} }
      }],
      samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
      textures: [{ sampler: 0, source: 0 }],
      images: [{ mimeType: mime, bufferView: 4 }],
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
        { buffer: 0, byteOffset: posOffset, byteLength: pos.byteLength, target: 34962 },
        { buffer: 0, byteOffset: norOffset, byteLength: nor.byteLength, target: 34962 },
        { buffer: 0, byteOffset: uvOffset, byteLength: uv.byteLength, target: 34962 },
        { buffer: 0, byteOffset: indOffset, byteLength: ind.byteLength, target: 34963 },
        { buffer: 0, byteOffset: imgOffset, byteLength: imageBytes.byteLength }
      ],
      buffers: [{ byteLength: binSize }]
    };

    const json = new TextEncoder().encode(JSON.stringify(gltf));
    const jsonPadding = (4 - (json.byteLength % 4)) % 4;
    const jsonChunk = new Uint8Array(json.byteLength + jsonPadding);
    jsonChunk.set(json, 0);
    for (let i = 0; i < jsonPadding; i += 1) jsonChunk[json.byteLength + i] = 0x20;

    const binPadding = (4 - (bin.byteLength % 4)) % 4;
    const binChunk = new Uint8Array(bin.byteLength + binPadding);
    binChunk.set(bin, 0);

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

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function loadImageElement(photoDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load product photo'));
      img.src = photoDataUrl;
    });
  }

  async function resizePhotoDataUrl(photoDataUrl, maxEdge = 512, quality = 0.82) {
    try {
      const img = await loadImageElement(photoDataUrl);
      const srcW = img.naturalWidth || img.width || 1;
      const srcH = img.naturalHeight || img.height || 1;
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
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, dx, dy, drawW, drawH);
      const q = Math.min(0.92, Math.max(0.55, Number(quality) || 0.82));
      return canvas.toDataURL('image/jpeg', q);
    } catch {
      return photoDataUrl;
    }
  }

  async function prepareArPhotoDataUrl(photoDataUrl, maxEdge = 512) {
    if (!photoDataUrl) return null;
    return resizePhotoDataUrl(photoDataUrl, maxEdge);
  }

  async function createProductPhotoGlbAssets(photoDataUrl, options) {
    const maxEdge = options && options.maxImageEdge ? options.maxImageEdge : 512;
    const quality = options && Number(options.jpegQuality) > 0 ? Number(options.jpegQuality) : 0.82;
    const resized = await resizePhotoDataUrl(photoDataUrl, maxEdge, quality);
    const bytes = buildProductPhotoGlb(resized || photoDataUrl, options);
    if (!bytes) return null;
    return {
      bytes,
      objectUrl: URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' })),
      base64: bytesToBase64(bytes)
    };
  }

  async function createProductPhotoGlbBase64(photoDataUrl, options) {
    const assets = await createProductPhotoGlbAssets(photoDataUrl, options);
    return assets ? assets.base64 : null;
  }

  async function createProductPhotoGlbObjectUrl(photoDataUrl, options) {
    const assets = await createProductPhotoGlbAssets(photoDataUrl, options);
    return assets ? assets.objectUrl : null;
  }

  global.WarehouseProductArGlb = {
    buildProductPhotoGlb,
    createProductPhotoGlbAssets,
    createProductPhotoGlbObjectUrl,
    createProductPhotoGlbBase64,
    parseDataUrl,
    resizePhotoDataUrl,
    prepareArPhotoDataUrl
  };
})(window);

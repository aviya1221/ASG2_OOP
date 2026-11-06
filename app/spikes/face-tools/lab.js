// Shared core of the face-tools spike. Runs in the browser, the same way the real web app would.
// Each tool exposes:
//   detect(canvas, { embed })  -> [{ x, y, w, h, score, emb }]   faces found in the whole picture
//   detectPlain(canvas, opts)  -> same, without any tiling (used for the registration selfie)
//   name, info

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

// ---------- Option 1: OpenCV (YuNet face finder + SFace face-print) ----------

// Returns { cv } and never the module itself: the module has a then() method, and returning or
// awaiting it from an async function makes the browser wait on it forever.
async function cvReady() {
  if (!window.cv) await loadScript('/node_modules/@techstark/opencv-js/dist/opencv.js');
  for (let i = 0; i < 1200; i++) {
    const c = window.cv;
    if (c && c.Mat && typeof c.FaceDetectorYN === 'function') return { cv: c };
    await sleep(50);
  }
  throw new Error('OpenCV did not initialise');
}

async function putFile(cv, name, url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  try { cv.FS_unlink('/' + name); } catch { /* not there yet */ }
  cv.FS_createDataFile('/', name, buf, true, false, false);
}

// Least-squares similarity transform (scale, rotation, shift) that maps the 5 face points onto the template.
function similarity(src, dst) {
  let msx = 0, msy = 0, mdx = 0, mdy = 0;
  for (let i = 0; i < 5; i++) { msx += src[2 * i]; msy += src[2 * i + 1]; mdx += dst[2 * i]; mdy += dst[2 * i + 1]; }
  msx /= 5; msy /= 5; mdx /= 5; mdy /= 5;
  let na = 0, nb = 0, den = 0;
  for (let i = 0; i < 5; i++) {
    const sx = src[2 * i] - msx, sy = src[2 * i + 1] - msy, dx = dst[2 * i] - mdx, dy = dst[2 * i + 1] - mdy;
    na += sx * dx + sy * dy; nb += sx * dy - sy * dx; den += sx * sx + sy * sy;
  }
  const a = na / den, b = nb / den;
  return [a, -b, mdx - (a * msx - b * msy), b, a, mdy - (b * msx + a * msy)];
}

// The standard 112x112 five-point template that SFace (and ArcFace) were trained with.
const TEMPLATE = [38.2946, 51.6963, 73.5318, 51.5014, 56.0252, 71.7366, 41.5493, 92.3655, 70.7299, 92.2041];

// printer: 'ort' runs the face-print model with ONNX Runtime Web (fast);
//          'opencv' runs it with OpenCV.js's own model runner (same model, about 1 s per face).
export async function createOpenCV({ scoreThreshold = 0.3, printer = 'ort' } = {}) {
  const { cv } = await cvReady();
  await putFile(cv, 'yunet.onnx', '/models/face_detection_yunet_2023mar.onnx');
  const finder = new cv.FaceDetectorYN('yunet.onnx', '', new cv.Size(320, 320), scoreThreshold, 0.3, 5000);
  const SFACE = '/models/face_recognition_sface_2021dec.onnx';
  let runPrint, printerInfo;
  if (printer === 'ort') {
    const ort = await import('/node_modules/onnxruntime-web/dist/ort.wasm.min.mjs');
    ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
    ort.env.logLevel = 'error';
    const session = await ort.InferenceSession.create(SFACE, { executionProviders: ['wasm'] });
    const input = session.inputNames[0];
    printerInfo = `ONNX Runtime Web ${ort.env.versions?.web || ''} (${ort.env.wasm.numThreads || 1} threads)`;
    runPrint = async (aligned) => { // aligned: 112x112 BGR -> 1x3x112x112 RGB, 0..255, like blobFromImage(swapRB)
      const px = aligned.data, n = 112 * 112, t = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) { t[i] = px[3 * i + 2]; t[n + i] = px[3 * i + 1]; t[2 * n + i] = px[3 * i]; }
      const res = await session.run({ [input]: new ort.Tensor('float32', t, [1, 3, 112, 112]) });
      return Float32Array.from(res[session.outputNames[0]].data);
    };
  } else {
    await putFile(cv, 'sface.onnx', SFACE);
    const net = cv.readNet('sface.onnx');
    printerInfo = 'OpenCV.js model runner';
    runPrint = async (aligned) => {
      const blob = cv.blobFromImage(aligned, 1.0, { width: 112, height: 112 }, [0, 0, 0, 0], true, false);
      net.setInput(blob); const out = net.forward(); const v = Float32Array.from(out.data32F);
      blob.delete(); out.delete(); return v;
    };
  }

  async function facePrint(bgr, lm) {
    const m = cv.matFromArray(2, 3, cv.CV_64F, similarity(lm, TEMPLATE));
    const aligned = new cv.Mat();
    cv.warpAffine(bgr, aligned, m, new cv.Size(112, 112), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const v = await runPrint(aligned);
    m.delete(); aligned.delete();
    let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }

  async function detectPlain(canvas, { embed = true } = {}) {
    const rgba = cv.imread(canvas);
    const bgr = new cv.Mat();
    cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR);
    finder.setInputSize(new cv.Size(bgr.cols, bgr.rows));
    const out = new cv.Mat();
    finder.detect(bgr, out);
    const faces = [];
    const d = out.data32F;
    for (let i = 0; i < out.rows; i++) {
      const r = d.subarray(i * 15, i * 15 + 15);
      const f = { x: r[0], y: r[1], w: r[2], h: r[3], score: r[14] };
      if (embed) f.emb = await facePrint(bgr, Array.from(r.subarray(4, 14)));
      faces.push(f);
    }
    rgba.delete(); bgr.delete(); out.delete();
    return faces;
  }

  return {
    name: printer === 'ort' ? 'opencv' : 'opencv-runner',
    info: 'OpenCV.js ' + (cv.getBuildInformation ? (cv.getBuildInformation().match(/General configuration for OpenCV ([^\s]+)/) || [])[1] : '') + ', YuNet 2023mar + SFace 2021dec via ' + printerInfo,
    detect: (canvas, opts) => detectPlain(canvas, opts),
    detectPlain: (canvas, opts) => detectPlain(canvas, opts),
    // cosine similarity of two normalised face-prints
    similarity: (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; },
  };
}

// ---------- Option 2: Human (BlazeFace finder + FaceRes face-print), with or without tiling ----------

function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}
function mergeDuplicates(faces, thr = 0.3) {
  const kept = [];
  for (const f of faces.sort((p, q) => q.score - p.score)) if (kept.every((k) => iou(k, f) < thr)) kept.push(f);
  return kept;
}
function starts(total, tile, step) {
  if (total <= tile) return [0];
  const s = []; for (let p = 0; p + tile < total; p += step) s.push(p); s.push(total - tile); return s;
}

export async function createHuman({ tiles = [], backend = 'webgl' } = {}) {
  const mod = await import('/node_modules/@vladmandic/human/dist/human.esm.js');
  const Human = mod.Human || mod.default;
  const human = new Human({
    backend,
    modelBasePath: '/node_modules/@vladmandic/human/models/',
    wasmPath: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/',
    debug: false, async: true, warmup: 'none', cacheSensitivity: 0, skipAllowed: false,
    filter: { enabled: false },
    face: {
      enabled: true,
      detector: { rotation: true, maxDetected: 200, minConfidence: 0.1, minSize: 0, iouThreshold: 0.1, skipFrames: 0, skipTime: 0, return: false },
      mesh: { enabled: true }, iris: { enabled: false }, attention: { enabled: false },
      description: { enabled: true, skipFrames: 0, skipTime: 0 },
      emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false },
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
  });
  await human.load();

  // mesh=false: the fast face finder alone (used to scan tiles); mesh=true: the full check.
  async function detectPlain(canvas, { embed = true, mesh = true, minConfidence = 0.1 } = {}) {
    const res = await human.detect(canvas, {
      face: { detector: { rotation: mesh, minConfidence }, mesh: { enabled: mesh }, description: { enabled: embed && mesh } },
    });
    return res.face.map((f) => ({
      x: f.box[0], y: f.box[1], w: f.box[2], h: f.box[3],
      score: f.score ?? f.boxScore ?? 0,
      emb: embed && f.embedding && f.embedding.length ? Float32Array.from(f.embedding) : undefined,
    })).filter((f) => !embed || f.emb);
  }

  // With tiles: find faces in the whole picture and in overlapping tiles (no face-prints yet),
  // merge duplicates, then compute one face-print per face from a crop around it.
  // Tiles and crops always have the same pixel size: the graphics backend re-prepares itself
  // for every new picture size, which would make this many times slower.
  const CROP = 256;
  const tileCanvas = {};
  const cropCanvas = document.createElement('canvas'); cropCanvas.width = CROP; cropCanvas.height = CROP;
  async function detect(canvas, opts = {}) {
    if (!tiles.length) return detectPlain(canvas, opts);
    const embed = opts.embed !== false;
    const W = canvas.width, H = canvas.height;
    const scan = { embed: false, mesh: false, minConfidence: 0.2 };
    const all = await detectPlain(canvas, scan);
    for (const tile of tiles) {
      const step = Math.round(tile * 0.7);
      const c = tileCanvas[tile] || (tileCanvas[tile] = Object.assign(document.createElement('canvas'), { width: tile, height: tile }));
      const ctx = c.getContext('2d');
      for (const y of starts(H, tile, step)) {
        for (const x of starts(W, tile, step)) {
          const tw = Math.min(tile, W), th = Math.min(tile, H);
          ctx.fillStyle = '#7f7f7f'; ctx.fillRect(0, 0, tile, tile);
          ctx.drawImage(canvas, x, y, tw, th, 0, 0, tw, th);
          for (const f of await detectPlain(c, scan)) { f.x += x; f.y += y; all.push(f); }
        }
      }
    }
    const merged = mergeDuplicates(all);
    const out = []; // keep a candidate only if the full check (with or without face-print) confirms it
    for (const f of merged) {
      const side = Math.max(f.w, f.h) * 2.2, cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const sx = Math.max(0, cx - side / 2), sy = Math.max(0, cy - side / 2);
      const sw = Math.min(side, W - sx), sh = Math.min(side, H - sy);
      const k = CROP / side, cs = CROP;
      const c = cropCanvas;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#7f7f7f'; ctx.fillRect(0, 0, cs, cs);
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
      let best = null, bd = Infinity;
      for (const g of await detectPlain(c, { embed })) {
        const d = Math.hypot(g.x + g.w / 2 - (cx - sx) * k, g.y + g.h / 2 - (cy - sy) * k);
        if (d < bd && d < 0.3 * cs) { bd = d; best = g; }
      }
      if (best) out.push({ ...f, score: best.score, emb: best.emb });
    }
    return out;
  }

  return {
    name: tiles.length ? 'human-tiled' : 'human',
    info: `Human ${human.version}, backend ${human.tf.getBackend()}, BlazeFace + FaceRes` + (tiles.length ? `, tiles ${tiles.join('/')}px` : ''),
    detect, detectPlain,
    // Human's face-print comparison is based on distance; a smaller distance means more alike, so negate it.
    similarity: (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return -Math.sqrt(s); },
  };
}

// ---------- helpers shared by the test pages ----------

export function loadImage(url) {
  return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('image ' + url)); im.src = url; });
}

export function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0); return c;
}

// Shrink in halving steps so a far-away face looks blurred, the way a camera sees it, not jagged.
export function drawShrunk(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  let c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  let w = sw, h = sh;
  while (w / 2 >= dw) {
    const t = document.createElement('canvas'); t.width = Math.round(w / 2); t.height = Math.round(h / 2);
    const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.drawImage(c, 0, 0, t.width, t.height); c = t; w = t.width; h = t.height;
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, w, h, dx, dy, dw, dh);
}

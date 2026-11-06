// Tiny static file server for the face-tools spike (pages, models, datasets).
// Usage: node serve.mjs            -> http://127.0.0.1:8787/
//        HOST=0.0.0.0 node serve.mjs  (to open the test page from a phone on the same Wi-Fi)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export function startServer({ port = 8787, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(ROOT, rel));
      if (!file.startsWith(normalize(ROOT + sep)) && file !== normalize(ROOT)) { res.writeHead(403).end(); return; }
      const st = await stat(file);
      if (!st.isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        // cross-origin isolation lets the model runners use several CPU threads
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8787);
  await startServer({ port, host });
  console.log(`face-tools spike: http://${host}:${port}/`);
}

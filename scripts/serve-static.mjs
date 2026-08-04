import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const root = path.resolve(process.cwd());
const blockedSegments = new Set([
  '.codex-input',
  '.git',
  'node_modules',
  'test-results',
  'playwright-report'
]);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function resolveRequestPath(requestUrl = '/') {
  const rawUrl = String(requestUrl);
  if (!rawUrl.startsWith('/')) return { status: 400 };

  const queryIndex = rawUrl.indexOf('?');
  const fragmentIndex = rawUrl.indexOf('#');
  const endIndexes = [queryIndex, fragmentIndex].filter(index => index >= 0);
  const rawPathname = endIndexes.length ? rawUrl.slice(0, Math.min(...endIndexes)) : rawUrl;

  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch (error) {
    if (error instanceof URIError) return { status: 400 };
    return { status: 400 };
  }

  if (pathname.includes('\\') || pathname.includes('\0')) return { status: 403 };
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some(segment => segment.startsWith('.') || blockedSegments.has(segment.toLowerCase()))) {
    return { status: 403 };
  }

  const relativePath = pathname === '/' ? 'index.html' : segments.join(path.sep);
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return { status: 403 };
  return { filePath };
}

const server = http.createServer((request, response) => {
  const resolved = resolveRequestPath(request.url);
  if (!resolved.filePath) {
    const status = resolved.status || 400;
    response.writeHead(status).end(status === 403 ? 'Forbidden' : 'Bad request');
    return;
  }

  const filePath = resolved.filePath;
  fs.stat(filePath, (statError, stats) => {
    const resolvedPath = !statError && stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.stat(resolvedPath, (error, resolvedStats) => {
      if (error || !resolvedStats.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream'
      });
      const stream = fs.createReadStream(resolvedPath);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    });
  });
});

server.listen(port, host);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

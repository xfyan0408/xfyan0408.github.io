import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Serve only the published pages and stylesheet, never Git metadata or local drafts.
const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/private/', ['private/index.html', 'text/html; charset=utf-8']],
  ['/private/index.html', ['private/index.html', 'text/html; charset=utf-8']],
  ['/assets/site.css', ['assets/site.css', 'text/css; charset=utf-8']],
  ['/assets/hexagon.js', ['assets/hexagon.js', 'text/javascript; charset=utf-8']],
  ['/assets/css/style.css', ['assets/css/style.css', 'text/css; charset=utf-8']],
  ['/assets/images/bg_hr.png', ['assets/images/bg_hr.png', 'image/png']],
  ['/assets/images/blacktocat.png', ['assets/images/blacktocat.png', 'image/png']],
  ['/assets/images/icon_download.png', ['assets/images/icon_download.png', 'image/png']],
  ['/assets/images/sprite_download.png', ['assets/images/sprite_download.png', 'image/png']],
  ['/assets/images/open-hexagon.png', ['assets/images/open-hexagon.png', 'image/png']],
]);
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end();
  }
  if (pathname === '/private') {
    response.writeHead(302, { Location: '/private/' });
    return response.end();
  }
  const route = routes.get(pathname);
  if (!route) { response.writeHead(404); return response.end('Not found'); }
  try {
    const content = await readFile(fileURLToPath(new URL(route[0], root)));
    response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404);
    response.end('Page not built yet. Run npm run lock.');
  }
});
server.listen(4173, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:4173'));

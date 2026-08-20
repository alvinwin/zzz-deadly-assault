import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/markdown'};
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end('not found'); return; }
  response.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1');

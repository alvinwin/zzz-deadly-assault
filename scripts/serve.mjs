import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/markdown'};
http.createServer((request, response) => {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end('not found'); return; }
  response.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1');

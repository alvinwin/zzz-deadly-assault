import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js']) fs.copyFileSync(path.join(root, file), path.join(dist, file));
fs.copyFileSync(path.join(root, 'data/current.json'), path.join(dist, 'data/current.json'));
console.log('✓ built clean dist/ (index.html, styles.css, app.js, data/current.json)');

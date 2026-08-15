import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'dist');
const budget = 16 * 1024;

if (!fs.existsSync(root)) {
  console.error('asset budget: dist/ is missing; run the build first');
  process.exit(1);
}

const bytes = fs.readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);

if (bytes > budget) {
  console.error(`asset budget: ${bytes} bytes exceeds ${budget} byte dist/ budget`);
  process.exit(1);
}

console.log(`✓ dist/ asset budget: ${bytes} / ${budget} bytes`);

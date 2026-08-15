import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const BUDGETS = Object.freeze({
  raw: Object.freeze({ warning: 16 * 1024, hard: 24 * 1024 }),
  gzipProxy: Object.freeze({ warning: 8 * 1024, hard: 10 * 1024 })
});

function filesIn(root) {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  };
  visit(root);
  return files;
}

export function measureDist(root) {
  if (!fs.existsSync(root)) return { missing: true, files: [], rawBytes: 0, gzipProxyBytes: 0 };

  const files = filesIn(root);
  let rawBytes = 0;
  let gzipProxyBytes = 0;
  for (const file of files) {
    const contents = fs.readFileSync(file);
    rawBytes += contents.length;
    gzipProxyBytes += gzipSync(contents, { level: 9 }).length;
  }
  return { missing: false, files, rawBytes, gzipProxyBytes };
}

export function evaluateBudget(bytes, { warning, hard }) {
  if (bytes > hard) return 'hard';
  if (bytes > warning) return 'warning';
  return 'ok';
}

function formatBytes(bytes) {
  return bytes.toLocaleString('en-US');
}

function reportMetric(label, bytes, budget, suffix = '') {
  const status = evaluateBudget(bytes, budget);
  const detail = `${label} total ${formatBytes(bytes)} bytes${suffix} (warning target ${formatBytes(budget.warning)}; hard limit ${formatBytes(budget.hard)})`;
  console.log(`asset budget: ${detail}`);
  if (status === 'warning') {
    console.warn(`::warning file=dist::asset budget warning: ${detail}`);
  } else if (status === 'hard') {
    console.error(`::error file=dist::asset::${label} exceeds hard limit: ${detail}; reduce the built assets`);
  }
  return status;
}

export function run(root = path.join(process.cwd(), 'dist')) {
  const measured = measureDist(root);
  const rawStatus = reportMetric('raw', measured.rawBytes, BUDGETS.raw);
  const gzipStatus = reportMetric(
    'gzip proxy',
    measured.gzipProxyBytes,
    BUDGETS.gzipProxy,
    ' (sum of per-file gzip -9; proxy, not guaranteed wire bytes)'
  );

  if (measured.missing) {
    console.error('::error file=dist::asset budget cannot run: dist/ is missing; run the build first');
    return 1;
  }
  return rawStatus === 'hard' || gzipStatus === 'hard' ? 1 : 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exitCode = run();

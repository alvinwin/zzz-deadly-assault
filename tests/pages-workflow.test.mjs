import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('Pages deployment replays immutable boss trends before build', () => {
  const replay = workflow.indexOf('run: npm run check:da-boss-character-trends');
  const build = workflow.indexOf('run: npm run build');
  const upload = workflow.indexOf('uses: actions/upload-pages-artifact@');
  assert.notEqual(replay, -1, 'Pages workflow must run the immutable boss-trend replay');
  assert.ok(replay < build, 'immutable replay must run before build');
  assert.ok(build < upload, 'build must complete before the Pages artifact upload');
  const replayStep = workflow.slice(workflow.lastIndexOf('- name:', replay), workflow.indexOf('- if:', replay));
  assert.match(replayStep, /if: steps\.publication_gate\.outputs\.publication_due == 'true'/);
});

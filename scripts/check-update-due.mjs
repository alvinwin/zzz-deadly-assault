import fs from 'node:fs/promises';
import path from 'node:path';

export function isUpdateDue(data, now = new Date()) {
  const endsAt = data?.cycle?.endsAt;
  if (typeof endsAt !== 'string' || !endsAt.trim()) {
    throw new Error('cycle.endsAt is missing; expected an ISO date in the JSON data');
  }

  const endsAtMs = Date.parse(endsAt);
  if (!Number.isFinite(endsAtMs)) {
    throw new Error(`cycle.endsAt is not a valid date: ${endsAt}`);
  }

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error('current time is not a valid date');
  }

  return nowMs >= endsAtMs;
}

function parseJson(contents, source) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`invalid JSON in ${source}: ${error.message}`, { cause: error });
  }
}

export async function loadJson(input, fetchImpl = globalThis.fetch) {
  if (!input) throw new Error('missing input; provide a URL or local JSON path');

  let url;
  try {
    url = new URL(input);
  } catch {
    url = null;
  }

  if (url) {
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`unsupported URL protocol ${url.protocol}; use http(s) or a local JSON path`);
    }
    if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable for URL input');

    let response;
    try {
      response = await fetchImpl(url);
    } catch (error) {
      throw new Error(`could not fetch ${input}: ${error.message}`, { cause: error });
    }
    if (!response?.ok) {
      const status = response?.status ? ` (${response.status}${response.statusText ? ` ${response.statusText}` : ''})` : '';
      throw new Error(`could not fetch ${input}${status}`);
    }

    let contents;
    try {
      contents = await response.text();
    } catch (error) {
      throw new Error(`could not read response from ${input}: ${error.message}`, { cause: error });
    }
    return parseJson(contents, input);
  }

  const source = path.resolve(input);
  let contents;
  try {
    contents = await fs.readFile(source, 'utf8');
  } catch (error) {
    throw new Error(`could not read local JSON path ${source}: ${error.message}`, { cause: error });
  }
  return parseJson(contents, source);
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new Error('usage: node scripts/check-update-due.mjs <URL-or-JSON-path>');
  const data = await loadJson(argv[0]);
  process.stdout.write(`${isUpdateDue(data)}\n`);
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  main().catch(error => {
    console.error(`update-due check failed: ${error.message}`);
    process.exitCode = 1;
  });
}

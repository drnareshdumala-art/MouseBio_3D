/** The content-addressed R2 mapping, its build gate and the Pages Function that serves the three large assets. */
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildEntry, checkTable, filesProblems, loadTable, registryEntries, type Table } from '../deploy/cloudflare-pages/r2_assets';

const root = path.resolve('.');
const scratch = mkdtempSync(path.join(tmpdir(), 'r2-assets-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const handler = async () => (await import(pathToFileURL(path.join(root, 'functions/_middleware.js')).href)).onRequest as
  (context: { request: Request; env: Record<string, unknown>; next: () => Promise<Response> }) => Promise<Response>;

/** A copy of the three registries with the paths the table reads, for checks that change a registry. */
function registryCopy() {
  const copy = path.join(scratch, `registry-${Math.random().toString(36).slice(2)}`);
  for (const file of ['public/atlas-living/atlas.json', 'public/atlas-vascular/atlas.json', 'public/atlas-volume/sections/sections.json', 'deploy/cloudflare-pages/_routes.json']) {
    mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(copy, file));
  }
  return copy;
}

test('the committed table agrees with the registries and the routes file', () => {
  assert.deepEqual(checkTable(loadTable()), []);
  const table = loadTable();
  assert.equal(table.bucket, 'drnd-mousebio-3d-assets');
  for (const [url, row] of Object.entries(table.assets)) assert.equal(row.key, `${row.storedSha256}/${path.posix.basename(url)}`);
});

test('the three assets are exactly the files that exceed the Cloudflare Pages limit', () => {
  assert.deepEqual(registryEntries().map((entry) => entry.path).sort(), [
    '/atlas-living/living-mouse.glb', '/atlas-vascular/schmid2021-mvn1-lines.json', '/atlas-volume/sections/cryosection-slices.bin']);
});

test('a registry change that the table does not know about fails the gate', () => {
  const copy = registryCopy(), file = path.join(copy, 'public/atlas-vascular/atlas.json');
  const atlas = JSON.parse(readFileSync(file, 'utf8'));
  atlas.statistics.assetSha256 = 'a'.repeat(64);
  writeFileSync(file, JSON.stringify(atlas));
  const problems = checkTable(loadTable(), copy);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /registry changed since R2 was synchronised/);
});

test('a table key that is not the digest of the stored bytes, or a stray route, fails the gate', () => {
  const table: Table = JSON.parse(JSON.stringify(loadTable()));
  table.assets['/atlas-living/living-mouse.glb'].key = 'wrong/living-mouse.glb';
  assert.match(checkTable(table).join(' '), /key is not <stored sha256>/);
  const copy = registryCopy(), routes = path.join(copy, 'deploy/cloudflare-pages/_routes.json');
  writeFileSync(routes, JSON.stringify({ version: 1, include: ['/atlas-living/living-mouse.glb'], exclude: [] }));
  assert.match(checkTable(loadTable(), copy).join(' '), /_routes\.json include list/);
});

test('files that unpack to the registered bytes pass, and a tampered or missing file is reported', () => {
  const dir = path.join(scratch, 'bundle');
  const entries = registryEntries();
  for (const entry of entries) {
    const file = path.join(dir, ...entry.path.slice(1).split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    cpSync(path.join(root, 'public', ...entry.path.slice(1).split('/')), file);
  }
  assert.deepEqual(filesProblems(dir), []);
  // A gzip living mouse unpacks to the registered bytes, as build:host stores it; the key follows the stored bytes.
  const glb = path.join(dir, 'atlas-living/living-mouse.glb');
  writeFileSync(glb, gzipSync(readFileSync(glb), { level: 6 }));
  assert.deepEqual(filesProblems(dir), []);
  const stored = buildEntry(dir, entries[0]);
  assert.equal(stored.registrySha256, entries[0].sha256);
  assert.equal(stored.key, `${stored.storedSha256}/living-mouse.glb`);
  // The vascular file is never unpacked by the application, so a gzip copy must be rejected.
  const json = path.join(dir, 'atlas-vascular/schmid2021-mvn1-lines.json');
  writeFileSync(json, gzipSync(readFileSync(json)));
  assert.match(filesProblems(dir).join(' '), /schmid2021-mvn1-lines\.json/);
  rmSync(path.join(dir, 'atlas-volume/sections/cryosection-slices.bin'));
  assert.match(filesProblems(dir).join(' '), /cryosection-slices\.bin is missing/);
});

/** A minimal R2 object as the Workers runtime presents it. */
function r2Object(bytes: Uint8Array, etag = '"etag-1"') {
  return { size: bytes.length, httpEtag: etag, body: new Response(bytes as unknown as BodyInit).body, writeHttpMetadata: (headers: Headers) => { headers.set('X-Stored', 'yes'); } };
}
const bucket = (objects: Record<string, ReturnType<typeof r2Object>>) => ({ get: async (key: string) => objects[key] ?? null });
const request = (url: string, init: RequestInit = {}) => new Request(`https://site.example${url}`, init);

test('the Function serves each registered path from its content-addressed key with checked, immutable headers', async () => {
  const onRequest = await handler(), table = loadTable();
  for (const [url, row] of Object.entries(table.assets)) {
    const bytes = new Uint8Array(row.storedBytes).fill(7);
    const response = await onRequest({ request: request(url), env: { R2_ASSETS: bucket({ [row.key]: r2Object(bytes) }) }, next: async () => new Response('static') });
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get('Content-Type'), row.contentType);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Content-Length'), String(row.storedBytes));
    assert.equal(response.headers.get('X-Stored'), 'yes');
    assert.equal((await response.arrayBuffer()).byteLength, row.storedBytes);
  }
});

test('conditional, HEAD and unrelated requests behave', async () => {
  const onRequest = await handler(), [url, row] = Object.entries(loadTable().assets)[0];
  const env = { R2_ASSETS: bucket({ [row.key]: r2Object(new Uint8Array(row.storedBytes)) }) };
  const next = async () => new Response('static');
  assert.equal((await onRequest({ request: request(url, { headers: { 'If-None-Match': '"etag-1"' } }), env, next })).status, 304);
  const head = await onRequest({ request: request(url, { method: 'HEAD' }), env, next });
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  assert.equal(await (await onRequest({ request: request('/atlas-volume/sections/ct-deflate.bin'), env, next })).text(), 'static');
  assert.equal(await (await onRequest({ request: request(url, { method: 'POST' }), env, next })).text(), 'static');
  assert.equal(await (await onRequest({ request: request('/constructor'), env, next })).text(), 'static');
});

test('a missing binding, missing object or wrong stored size fails visibly and is never cached', async () => {
  const onRequest = await handler(), [url, row] = Object.entries(loadTable().assets)[0], next = async () => new Response('static');
  const noBinding = await onRequest({ request: request(url), env: {}, next });
  assert.equal(noBinding.status, 503);
  const missing = await onRequest({ request: request(url), env: { R2_ASSETS: bucket({}) }, next });
  assert.equal(missing.status, 404);
  const wrong = await onRequest({ request: request(url), env: { R2_ASSETS: bucket({ [row.key]: r2Object(new Uint8Array(10)) }) }, next });
  assert.equal(wrong.status, 502);
  for (const response of [noBinding, missing, wrong]) assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

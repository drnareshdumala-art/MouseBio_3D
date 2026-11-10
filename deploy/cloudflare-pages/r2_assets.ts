/**
 * Content-addressed R2 mapping for the three registered assets that exceed Cloudflare Pages' 25 MiB file limit.
 *
 *   tsx deploy/cloudflare-pages/r2_assets.ts check [--files DIR]
 *       Verifies deploy/cloudflare-pages/r2-assets.json against the registries in public/ (and _routes.json). With
 *       --files, also checks that the three files in DIR (a build:host bundle or the stash) unpack to the registered
 *       bytes and SHA-256. Used as a build gate: an upstream change to an asset cannot deploy until R2 is re-synchronised.
 *   tsx deploy/cloudflare-pages/r2_assets.ts sync DIR (--local --persist-to STATE | --remote) [--bucket NAME] [--table FILE]
 *       Uploads each file under the key <sha256 of the stored bytes>/<file name> (an idempotent write: the same key always
 *       holds the same bytes, and nothing is ever overwritten with different content or deleted), then rewrites the table.
 *       --local uses wrangler's local emulator and touches no Cloudflare account. --remote uses the logged-in wrangler.
 *
 * The application re-verifies size and SHA-256 of the unpacked bytes at run time, so a wrong object fails visibly.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const SCHEMA = 'mousebio.r2-assets.v1';
export const DEFAULT_BUCKET = 'drnd-mousebio-3d-assets';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TABLE_FILE = path.join(ROOT, 'deploy/cloudflare-pages/r2-assets.json');

export type RegistryEntry = { path: string; bytes: number; sha256: string; contentType: string; unpackGzip: boolean };
export type TableEntry = { key: string; contentType: string; storedBytes: number; storedSha256: string; registryBytes: number; registrySha256: string };
export type Table = { schema: typeof SCHEMA; bucket: string; assets: Record<string, TableEntry> };

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const HEX64 = /^[a-f0-9]{64}$/;
const readJson = (file: string): any => JSON.parse(readFileSync(file, 'utf8'));
const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** The three assets as the application's own registries describe them (size and digest of the unpacked bytes). */
export function registryEntries(root = ROOT): RegistryEntry[] {
  const living = readJson(path.join(root, 'public/atlas-living/atlas.json'));
  const vascular = readJson(path.join(root, 'public/atlas-vascular/atlas.json'));
  const sections = readJson(path.join(root, 'public/atlas-volume/sections/sections.json'));
  const cryosection = (sections.layers as any[]).find((layer) => layer.id === 'cryosection');
  const entries: RegistryEntry[] = [
    { path: living.assetUrl, bytes: living.statistics?.glbBytes, sha256: living.statistics?.glbSha256, contentType: 'model/gltf-binary', unpackGzip: true },
    { path: vascular.assetUrl, bytes: vascular.statistics?.assetBytes, sha256: vascular.statistics?.assetSha256, contentType: 'application/json', unpackGzip: false },
    { path: cryosection?.assetUrl, bytes: cryosection?.assetBytes, sha256: cryosection?.assetSha256, contentType: 'application/octet-stream', unpackGzip: false },
  ];
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || !/^\/[A-Za-z0-9_./-]+$/.test(entry.path) || !isSize(entry.bytes) || !HEX64.test(entry.sha256)) {
      throw new Error(`The registry entry for ${String(entry.path)} is not valid.`);
    }
  }
  return entries;
}

export function loadTable(file = TABLE_FILE): Table {
  return readJson(file) as Table;
}

/** Problems that would make the table serve the wrong thing; an empty list means it is consistent with the repository. */
export function checkTable(table: Table, root = ROOT): string[] {
  const problems: string[] = [];
  if (!table || table.schema !== SCHEMA) return [`Unsupported table schema (expected ${SCHEMA}).`];
  if (typeof table.bucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(table.bucket)) problems.push('The bucket name is not valid.');
  const registry = registryEntries(root), expected = new Set(registry.map((entry) => entry.path)), listed = Object.keys(table.assets ?? {});
  for (const missing of expected) if (!listed.includes(missing)) problems.push(`${missing} is not in the table.`);
  for (const extra of listed) if (!expected.has(extra)) problems.push(`${extra} is in the table but is not a registered large asset.`);
  for (const entry of registry) {
    const row = table.assets?.[entry.path];
    if (!row) continue;
    if (row.registryBytes !== entry.bytes || row.registrySha256 !== entry.sha256) {
      problems.push(`${entry.path}: the registry changed since R2 was synchronised. Re-run the sync and commit the table.`);
    }
    if (!HEX64.test(row.storedSha256) || !isSize(row.storedBytes)) problems.push(`${entry.path}: stored size or digest is not valid.`);
    else if (row.key !== `${row.storedSha256}/${path.posix.basename(entry.path)}`) problems.push(`${entry.path}: the key is not <stored sha256>/<file name>.`);
    if (row.contentType !== entry.contentType) problems.push(`${entry.path}: unexpected content type ${row.contentType}.`);
  }
  const routesFile = path.join(root, 'deploy/cloudflare-pages/_routes.json');
  if (existsSync(routesFile)) {
    const include: unknown = readJson(routesFile).include;
    const same = Array.isArray(include) && include.length === expected.size && include.every((route) => expected.has(route as string));
    if (!same) problems.push('_routes.json include list does not match the three registered large assets.');
  }
  return problems;
}

/** Read a file as the application would: a gzip .glb is unpacked, other files are taken as they are. */
export function inspectFile(file: string, entry: RegistryEntry): { stored: Buffer; ok: boolean; reason: string } {
  const stored = readFileSync(file);
  const plain = entry.unpackGzip && stored[0] === 0x1f && stored[1] === 0x8b ? gunzipSync(stored) : stored;
  if (plain.length !== entry.bytes) return { stored, ok: false, reason: `${entry.path}: ${plain.length} bytes, registry says ${entry.bytes}.` };
  if (sha256(plain) !== entry.sha256) return { stored, ok: false, reason: `${entry.path}: SHA-256 differs from the registry.` };
  return { stored, ok: true, reason: '' };
}

export function filesProblems(dir: string, root = ROOT): string[] {
  const problems: string[] = [];
  for (const entry of registryEntries(root)) {
    const file = path.join(dir, ...entry.path.slice(1).split('/'));
    if (!existsSync(file) || !statSync(file).isFile()) { problems.push(`${entry.path} is missing from ${dir}.`); continue; }
    const result = inspectFile(file, entry);
    if (!result.ok) problems.push(result.reason);
  }
  return problems;
}

export function buildEntry(dir: string, entry: RegistryEntry): TableEntry {
  const file = path.join(dir, ...entry.path.slice(1).split('/'));
  const result = inspectFile(file, entry);
  if (!result.ok) throw new Error(result.reason);
  const storedSha256 = sha256(result.stored);
  return { key: `${storedSha256}/${path.posix.basename(entry.path)}`, contentType: entry.contentType, storedBytes: result.stored.length,
    storedSha256, registryBytes: entry.bytes, registrySha256: entry.sha256 };
}

export const serializeTable = (table: Table) => `${JSON.stringify(table, null, 2)}\n`;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(args: string[]): number {
  const [command, ...rest] = args;
  if (command === 'check') {
    const problems = checkTable(loadTable());
    const dir = flag(rest, '--files');
    if (dir) problems.push(...filesProblems(path.resolve(dir)));
    if (problems.length) { for (const problem of problems) console.error(`R2 asset table: ${problem}`); return 1; }
    console.log(`R2 asset table matches the registries${dir ? ' and the files in ' + dir : ''}.`);
    return 0;
  }
  if (command === 'sync') {
    const dir = rest[0] && !rest[0].startsWith('--') ? path.resolve(rest[0]) : '';
    const local = rest.includes('--local'), remote = rest.includes('--remote');
    if (!dir || local === remote) { console.error('Usage: sync DIR (--local --persist-to STATE | --remote) [--bucket NAME] [--table FILE]'); return 2; }
    const state = flag(rest, '--persist-to');
    if (local && !state) { console.error('--local needs --persist-to STATE.'); return 2; }
    const bucket = flag(rest, '--bucket') ?? DEFAULT_BUCKET, tableFile = path.resolve(flag(rest, '--table') ?? TABLE_FILE);
    const wrangler = process.env.WRANGLER_BIN ?? 'wrangler';
    const table: Table = { schema: SCHEMA, bucket, assets: {} };
    for (const entry of registryEntries()) table.assets[entry.path] = buildEntry(dir, entry);
    for (const [url, row] of Object.entries(table.assets)) {
      const file = path.join(dir, ...url.slice(1).split('/'));
      const put = ['r2', 'object', 'put', `${bucket}/${row.key}`, '--file', file, '--content-type', row.contentType, ...(local ? ['--local', '--persist-to', state!] : ['--remote'])];
      console.log(`${local ? 'local' : 'remote'} put ${bucket}/${row.key} (${row.storedBytes} bytes)`);
      const result = spawnSync(wrangler, put, { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
      if (result.status !== 0) { console.error(`Upload of ${url} failed; the table was not written.`); return 1; }
    }
    const problems = checkTable(table);
    if (problems.length) { for (const problem of problems) console.error(problem); return 1; }
    writeFileSync(tableFile, serializeTable(table));
    console.log(`Wrote ${tableFile}`);
    return 0;
  }
  console.error('Usage: r2_assets.ts check [--files DIR] | sync DIR (--local --persist-to STATE | --remote) [--bucket NAME] [--table FILE]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exit(main(process.argv.slice(2)));

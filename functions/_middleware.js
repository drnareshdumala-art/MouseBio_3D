// Serves the three oversized, checksum-registered MouseBio_3D assets from R2 on the Pages origin.
// Each deployment carries its own asset table (deploy/cloudflare-pages/r2-assets.json), which maps a URL path to an
// immutable, content-addressed R2 key, so rolling back a deployment also rolls back the assets it serves.
// Every other request is passed to the static site. The application still verifies size and SHA-256 of what it receives.
import table from '../deploy/cloudflare-pages/r2-assets.json';

const ENTRIES = table.assets;
const PLAIN_ERROR = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const entry = Object.hasOwn(ENTRIES, url.pathname) ? ENTRIES[url.pathname] : undefined;
  if (!entry || (request.method !== 'GET' && request.method !== 'HEAD')) return next();
  if (!env.R2_ASSETS) return new Response('Asset storage is not configured.', { status: 503, headers: PLAIN_ERROR });
  const object = await env.R2_ASSETS.get(entry.key);
  if (!object) return new Response('Asset not found.', { status: 404, headers: PLAIN_ERROR });
  if (object.size !== entry.storedBytes) return new Response('The stored asset does not match its registered version.', { status: 502, headers: PLAIN_ERROR });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', entry.contentType);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (request.headers.get('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers });
  if (!headers.get('Content-Encoding')) headers.set('Content-Length', String(object.size));
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

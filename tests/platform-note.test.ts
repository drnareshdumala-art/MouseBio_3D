/** The DrND's KnowledgeHub hosting note must never displace the original developer's attribution or the licence notices. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ORIGINAL_DEVELOPER, PLATFORM_HOSTING, PLATFORM_SCOPE, UPSTREAM_REPOSITORY } from '../src/platform-note';

const read = (file: string) => readFileSync(file, 'utf8');

test('the approved wording is used and credits Qasim Hussain as developer and maintainer', () => {
  assert.equal(PLATFORM_HOSTING, "MouseBio_3D – Hosted by DrND's KnowledgeHub – Virtual Biology Lab");
  assert.equal(ORIGINAL_DEVELOPER, 'Original application developed and maintained by Qasim Hussain.');
  assert.match(PLATFORM_SCOPE, /did not develop the application/);
  assert.equal(UPSTREAM_REPOSITORY, 'https://github.com/Qasim-Hussain-Code/MouseBio_3D');
});

test('no KnowledgeHub address is invented anywhere in the note', () => {
  const source = read('src/platform-note.ts') + read('index.html') + read('src/components/SourcesPage.tsx');
  assert.doesNotMatch(source, /drndsknowledgehub|knowledgehub\.(com|org|io)/i);
});

test('the upstream "maintained by Qasim Hussain" sentence in the sources dialog is unchanged and the note follows it', () => {
  const page = read('src/components/SourcesPage.tsx');
  assert.ok(page.includes('MouseBio_3D is a digital laboratory mouse maintained by Qasim Hussain. Each reference keeps its own source identifiers'));
  const upstream = page.indexOf('maintained by Qasim Hussain'), note = page.indexOf('{PLATFORM_HOSTING}');
  assert.ok(upstream >= 0 && note > upstream);
});

test('the footer line, browser metadata and README carry the approved text', () => {
  assert.match(read('src/App.tsx'), /<p className="platform-note">\{PLATFORM_HOSTING\}\. \{ORIGINAL_DEVELOPER\}<\/p>/);
  const html = read('index.html');
  assert.match(html, /<title>MouseBio_3D \| Digital mouse laboratory \| Hosted by DrND's KnowledgeHub<\/title>/);
  assert.ok(html.includes("Hosted by DrND's KnowledgeHub – Virtual Biology Lab. Original application developed and maintained by Qasim Hussain."));
  const readme = read('README.md');
  assert.ok(readme.includes("## Independent deployment by DrND's KnowledgeHub"));
  assert.ok(readme.includes('**Original application developed and maintained by Qasim Hussain.**'));
});

test('licence files and the third-party notices still name the original owner', () => {
  assert.match(read('LICENSE'), /Copyright \(c\) 2026 Qasim Hussain/);
  assert.match(read('LICENSES.md'), /Copyright in original project work is held by Qasim Hussain/);
  assert.match(read('public/THIRD_PARTY_NOTICES.txt'), /Original application code is copyright 2026 Qasim Hussain/);
});

// index.html: every script from another site is pinned to an exact
// version and carries a Subresource Integrity hash, so a changed or
// compromised file on the CDN is refused instead of run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const external = [...html.matchAll(/<script\b[^>]*\bsrc="(https?:[^"]+)"[^>]*>/g)];

test('index.html loads its libraries from a CDN', () => {
  assert.equal(external.length, 3);
});

for (const [tag, src] of external) {
  test(`${src} is pinned and has an integrity hash`, () => {
    assert.match(src, /@\d+\.\d+\.\d+\//, 'an exact version in the URL');
    assert.match(tag, /\bintegrity="sha(256|384|512)-[A-Za-z0-9+/]+=*"/, 'an integrity hash');
    assert.match(tag, /\bcrossorigin="anonymous"/, 'crossorigin="anonymous", which integrity checks need');
  });
}

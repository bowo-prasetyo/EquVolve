// The READMEs, which the About page shows in the interface's language:
// every in-page link must reach a heading in the same file, in English
// and in each translation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const READMES = fs.readdirSync(ROOT).filter(f => /^README(\.[\w-]+)?\.md$/.test(f));

// The anchor GitHub gives a heading; the About page gives the same one
// (headingSlug in app.js): lowercase, punctuation removed, spaces as
// hyphens, -1, -2, ... on repeats.
function anchors(markdown) {
  const used = new Set();
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');

  for (const [, heading] of withoutCode.matchAll(/^#{1,6} (.+)$/gm)) {
    const text = heading.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const base = text.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
    let slug = base;
    for (let k = 1; used.has(slug); k++) slug = `${base}-${k}`;
    used.add(slug);
  }

  return used;
}

test('there is an English README and at least one translation', () => {
  assert.ok(READMES.includes('README.md'));
  assert.ok(READMES.includes('README.id.md'));
});

for (const file of READMES) {
  test(`every in-page link in ${file} reaches a heading`, () => {
    const markdown = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const known = anchors(markdown);
    const links = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map(m => decodeURIComponent(m[1]));

    assert.ok(links.length > 0, 'the README links to its own sections');
    assert.deepEqual(links.filter(l => !known.has(l)), []);
  });
}

test('a translated README links to other files by full address, as the About page needs', () => {
  // the About page shows the README on the app's own site, where a
  // relative link such as docs/DEVELOPMENT.md would not exist
  for (const file of READMES.filter(f => f !== 'README.md')) {
    const markdown = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const relative = [...markdown.matchAll(/\]\(([^)#][^)]*)\)/g)]
      .map(m => m[1])
      .filter(href => !/^(https?:|mailto:)/.test(href));

    assert.deepEqual(relative, [], file);
  }
});

test('the English README links to each translation', () => {
  const english = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  for (const file of READMES.filter(f => f !== 'README.md')) {
    assert.ok(english.includes(`/blob/main/${file}`), `README.md links to ${file}`);
  }
});

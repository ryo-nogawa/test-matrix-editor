// 名前を付けて保存するデータ入りHTML（要件定義書 5.5.2）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const S = require('../src/core/savefile.js');
const { build } = require('../scripts/build.js');
const { loginMatrix } = require('./helpers.js');

const dist = fs.readFileSync(build(), 'utf8');
const data = (overrides = {}) =>
  S.createData({
    fileId: 'f-0001',
    name: 'ログインAPI試験',
    matrix: loginMatrix([['○'], ['○'], [''], ['−'], ['']], { withIds: true }),
    toolVersion: '0.2.0',
    savedAt: '2026-10-28T10:00:00.000Z',
    ...overrides,
  });

test('配布物には、空のデータの埋め込み場所が1つだけある', () => {
  assert.equal((dist.match(/<script type="application\/json" id="matrix-data">/g) || []).length, 1);
  assert.equal(S.extract(dist), null);
});

test('データを埋め込んだHTMLから、同じデータを取り出せる', () => {
  const html = S.embed(dist, data());
  assert.deepEqual(S.extract(html), data());
});

test('保存し直しても、データの部分だけが差し替わり、ファイルが大きくなり続けない', () => {
  const first = S.embed(dist, data());
  const second = S.embed(first, data({ name: '別の名前' }));
  const third = S.embed(second, data({ name: 'ログインAPI試験' }));
  assert.equal(S.extract(second).name, '別の名前');
  assert.equal(third, first);
  assert.equal(third.replace(/<script type="application\/json" id="matrix-data">[\s\S]*?<\/script>/, ''), dist.replace(/<script type="application\/json" id="matrix-data"><\/script>/, ''));
});

test('データの中に </script> があっても、HTMLが途中で切れない', () => {
  const d = data();
  d.matrix.rows[0].value = '</script><b>';
  const html = S.embed(dist, d);
  assert.ok(!html.includes('</script><b>'));
  assert.equal(S.extract(html).matrix.rows[0].value, '</script><b>');
});

test('形式の違うデータや壊れたデータは取り出さない', () => {
  assert.equal(S.parseData(''), null);
  assert.equal(S.parseData('{壊れたJSON'), null);
  assert.equal(S.parseData(JSON.stringify({ ...data(), format: 'other' })), null);
  assert.equal(S.parseData(JSON.stringify({ ...data(), version: 99 })), null, '新しすぎる版のデータ');
  assert.equal(S.parseData(JSON.stringify({ ...data(), matrix: { rows: [] } })), null);
  assert.throws(() => S.embed('<html></html>', data()), /埋め込む場所/);
});

test('ファイル名：使えない文字は全角に置き換え、空なら既定の名前', () => {
  assert.equal(S.fileName('ログインAPI試験'), 'ログインAPI試験.html');
  assert.equal(S.fileName('A/B:C?'), 'A／B：C？.html');
  assert.equal(S.fileName('  '), '無題の試験マトリクス.html');
});

test('ファイルのID：毎回違うIDを作る', () => {
  const ids = new Set(Array.from({ length: 50 }, S.newFileId));
  assert.equal(ids.size, 50);
  assert.match([...ids][0], /^f-[0-9a-f]{16}$/);
});

test('開いたとき：自動保存が新しく内容も違うときだけ、どちらを使うか選ぶ', () => {
  const file = data();
  const later = '2026-10-28T11:00:00.000Z';
  const edited = { ...file, savedAt: later, matrix: { ...file.matrix, testCount: 0, rows: file.matrix.rows.map((r) => ({ ...r, marks: [] })) } };
  assert.equal(S.chooseOnOpen(file, null), 'file');
  assert.equal(S.chooseOnOpen(file, edited), 'ask');
  assert.equal(S.chooseOnOpen(file, { ...edited, savedAt: '2026-10-28T09:00:00.000Z' }), 'file', '自動保存が古い');
  assert.equal(S.chooseOnOpen(file, { ...file, savedAt: later }), 'file', '内容が同じ');
  assert.equal(S.chooseOnOpen(file, { ...file, savedAt: later, name: '改名' }), 'ask', '名前だけ変わった');
});

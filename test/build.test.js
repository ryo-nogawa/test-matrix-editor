// ビルドの結果が「1ファイルで、外部に依存しない」ことを確かめる（要件定義書 6章）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const { build } = require('../scripts/build.js');

const html = fs.readFileSync(build(), 'utf8');

test('まとめたスクリプトが、ブラウザと同じく1つのスクリプトとして動く', () => {
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  // ブラウザには module が無いので、各ファイルは互いをグローバル変数として参照する
  const context = vm.createContext({ document: { getElementById: () => ({}) } });
  vm.runInContext(`${script}\nthis.core = { MarkdownFormat, Matrix, Checks, History };`, context);
  const { MarkdownFormat, Matrix, Checks, History } = context.core;
  const result = MarkdownFormat.parse('| 種類 | 具体値 | 001 |\n| --- | --- | --- |\n| 入力 | x | ◯ |');
  assert.equal(result.ok, true);
  assert.equal(result.matrix.rows[0].marks[0], '○');
  const m = Matrix.duplicateTest(Matrix.withIds(result.matrix), 0);
  // vm の中で作った配列は別の Array になり、deepEqual で比べられないため JSON にして比べる
  assert.equal(JSON.stringify(Checks.coverage(m)), '{"rows":[],"tests":[]}');
  assert.equal(History.push(History.create(result.matrix), m).present, m);
});

test('CSSとJavaScriptの埋め込み位置がすべて置き換わっている', () => {
  assert.ok(!html.includes('/* @STYLES */'));
  assert.ok(!html.includes('/* @SCRIPTS */'));
});

test('外部のスクリプトを読み込んでいない', () => {
  assert.doesNotMatch(html, /<script[^>]*\ssrc\s*=/i);
});

test('外部のスタイルシートを読み込んでいない', () => {
  assert.doesNotMatch(html, /<link[^>]*rel\s*=\s*["']?stylesheet/i);
  assert.doesNotMatch(html, /@import/i);
});

test('インターネット上のURLを参照していない', () => {
  assert.doesNotMatch(html, /(src|href)\s*=\s*["']?https?:/i);
  assert.doesNotMatch(html, /url\(\s*["']?https?:/i);
});

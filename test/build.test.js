// ビルドの結果が「1ファイルで、外部に依存しない」ことを確かめる（要件定義書 6章）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { build } = require('../scripts/build.js');

const html = fs.readFileSync(build(), 'utf8');

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

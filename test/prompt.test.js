// AIへの指示文（要件定義書 5.7）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, extract, PLACEHOLDER } = require('../src/core/prompt.js');
const { loginMatrix } = require('./helpers.js');

const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ai-prompt.md'), 'utf8');

test('docs/ai-prompt.md から指示文を取り出せる', () => {
  const template = extract(doc);
  assert.ok(template.startsWith('あなたはソフトウェアテストの設計者です。'));
  assert.ok(template.includes('# 出力の書式（厳守）'));
  assert.ok(template.trimEnd().endsWith(PLACEHOLDER));
});

test('指示文が見つからないときはエラーにする', () => {
  assert.throws(() => extract('# 指示文なし'), /指示文がありません/);
  assert.throws(() => extract('````text\n表なし\n````'), /\{\{MATRIX\}\} がありません/);
});

test('{{MATRIX}} を左側の条件だけの表に置き換える（試験の列は渡さない）', () => {
  const text = build('前置き\n{{MATRIX}}', loginMatrix([['○'], ['○'], [''], ['−'], ['']]));
  const lines = text.split('\n');
  assert.equal(lines[0], '前置き');
  assert.equal(lines[1], '| 種類 | 対象 | 項目 | パターン | 具体値 |');
  assert.equal(lines.length, 1 + 2 + 5); // 前置き・見出しと区切り行・データ行
  assert.ok(!text.includes('001'));
});

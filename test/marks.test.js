// 印の正規化（書式仕様書 5章）
const test = require('node:test');
const assert = require('node:assert/strict');
const { CIRCLE, DASH, BLANK, normalizeMark } = require('../src/core/marks.js');

test('○ の表記揺れをそろえる', () => {
  for (const ch of ['○', '◯', '〇', 'O', 'o', ' ○ ']) {
    assert.deepEqual(normalizeMark(ch), { mark: CIRCLE, known: true }, ch);
  }
});

test('− の表記揺れをそろえる', () => {
  for (const ch of ['−', '-', '‐', '–', '—', '―', 'ー', 'ｰ', '－']) {
    assert.deepEqual(normalizeMark(ch), { mark: DASH, known: true }, ch);
  }
});

test('空欄・空白だけのセルは空欄にする', () => {
  for (const ch of ['', ' ', '　', ' 　 ']) {
    assert.deepEqual(normalizeMark(ch), { mark: BLANK, known: true }, JSON.stringify(ch));
  }
});

test('どれにも当てはまらない文字は変換せずに残す', () => {
  for (const ch of ['×', '●', '✓', '0', '○○']) {
    assert.deepEqual(normalizeMark(ch), { mark: ch, known: false }, ch);
  }
});

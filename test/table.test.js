// 表のHTML（書式仕様書 8章、要件定義書 5.8・5.9）
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml, highlightsFromWarnings } = require('../src/ui/table.js');
const { loginMatrix } = require('./helpers.js');

const marked = () => loginMatrix([['○', '○', ''], ['', '○', ''], ['○', '', ''], ['−', '○', ''], ['', '', '']]);

// 指定した文字が入ったセルのタグを取り出す
const cellTag = (html, text) => html.match(new RegExp(`<t[hd][^>]*>${text}</t[hd]>`))?.[0];

test('見出し：左側の見出しと、試験項番のまとめ見出し・項番', () => {
  const html = buildHtml(marked());
  assert.match(html, /<th class="left level" rowspan="2" data-col="0"[^>]*><span class="text">種類<\/span><\/th>/);
  assert.match(cellTag(html, '試験項番'), /colspan="3"/);
  assert.ok(['001', '002', '003'].every((no) => cellTag(html, no)));
});

test('＋ボタン：階層の列の右端の見出しと、試験の列の右端', () => {
  const html = buildHtml(marked());
  assert.match(html, /<th class="left level last-level" [^>]*data-col="3"[^>]*><span class="text">パターン<\/span><button [^>]*class="add-level"/);
  assert.equal((html.match(/class="add-level"/g) || []).length, 1);
  assert.match(html, /<th class="add-test" rowspan="2"[^>]*>\+<\/th>/);
});

test('階層の列：同じ値が続くセルを結合する', () => {
  const html = buildHtml(marked());
  assert.match(cellTag(html, '機能'), /rowspan="3"/);
  assert.match(cellTag(html, '会員確認'), /rowspan="2"/);
  assert.equal((html.match(/>機能</g) || []).length, 1, '結合したセルは1つだけ出力する');
  assert.doesNotMatch(cellTag(html, '見つかる'), /rowspan/);
});

test('試験の列が0列のときは「なし」と表示する', () => {
  const html = buildHtml(loginMatrix());
  assert.match(cellTag(html, '試験項番'), /colspan="1"/);
  assert.ok(cellTag(html, 'なし'));
});

test('セルの文字はHTMLとして解釈しない', () => {
  const m = loginMatrix();
  m.rows[0].value = '<b>&"';
  assert.ok(buildHtml(m).includes('&lt;b&gt;&amp;&quot;'));
});

test('網羅チェック：○ が無い行と試験の列に印を付ける', () => {
  const html = buildHtml(marked(), { uncoveredRows: new Set([4]), uncoveredTests: new Set([2]) });
  assert.match(html, /<tr data-row="4" class="uncovered">/);
  assert.match(html, /<th class="test-no uncovered" data-test="2">003<\/th>/);
});

test('警告：セル単位と行単位で色を付ける', () => {
  const warnings = [
    { code: 'W1', cells: [{ row: 0, col: 5 }] }, // 1行目の 001 の列（階層4列＋具体値1列の右）
    { code: 'W5', cells: [{ row: 2, col: null }] },
  ];
  const highlights = highlightsFromWarnings(warnings);
  assert.deepEqual([...highlights.warnCells], ['0:5']);
  assert.deepEqual([...highlights.warnRows], [2]);

  const html = buildHtml(marked(), highlights);
  assert.match(html, /<td class="mark warn" data-test="0">○<\/td>/);
  assert.match(html, /<tr data-row="2" class="warn-row">/);
});

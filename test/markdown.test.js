// Markdownの出力・読み込み（書式仕様書 1〜6章）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { serialize, parse, testNumbers } = require('../src/core/markdown.js');
const { LOGIN_ROWS, loginMatrix } = require('./helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const codes = (list) => list.map((x) => x.code);

// 左側の5列だけの見出しと区切り行に、試験の列の見出しを足して表を作る
function table(testHeaders, ...rows) {
  const header = ['種類', '対象', '項目', 'パターン', '具体値', ...testHeaders];
  return [header, header.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}
const LEFT = ['入力', 'ログインAPI', 'リクエスト', '必須項目あり', 'login()'];

// ---------- 出力 ----------

test('出力：試験の列が0列の表（AIに渡す前）', () => {
  assert.equal(serialize(loginMatrix()), fixture('login-input.md'));
});

test('出力：試験項番は 001 からの3桁の連番', () => {
  const md = serialize(loginMatrix(LOGIN_ROWS.map(() => ['○', '', '−'])));
  assert.match(md.split('\n')[0], /\| 具体値 \| 001 \| 002 \| 003 \|$/);
  assert.match(md.split('\n')[2], /\| login\(\) \| ○ \|  \| − \|$/);
});

test('出力：999列を超えたら試験項番の桁を増やす', () => {
  assert.deepEqual(testNumbers(3), ['001', '002', '003']);
  const nums = testNumbers(1000);
  assert.equal(nums[0], '0001');
  assert.equal(nums[999], '1000');
});

test('出力：セルの中の | は \\| にする', () => {
  const m = loginMatrix();
  m.rows[0].value = 'a|b';
  assert.match(serialize(m), /\| a\\\|b \|/);
});

// ---------- 読み込み（正常） ----------

test('読み込み：AIの返答（前後の文章とコードブロック付き）から表を読み込む', () => {
  const result = parse(fixture('login-ai-response.md'));
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.matrix, loginMatrix([
    ['○', '○'], ['', '○'], ['○', ''], ['−', '○'], ['', ''],
  ]));
});

test('読み込み：出力した表を読み込むと元に戻る', () => {
  for (const m of [loginMatrix(), loginMatrix(LOGIN_ROWS.map(() => ['○', '', '−']))]) {
    const result = parse(serialize(m));
    assert.deepEqual(result.matrix, m);
    assert.deepEqual(result.warnings, []);
  }
});

test('読み込み：\\| は文字の | として読み込む', () => {
  const m = loginMatrix();
  m.rows[0].value = 'a|b';
  assert.equal(parse(serialize(m)).matrix.rows[0].value, 'a|b');
});

test('読み込み：行末の | が無い表や、寄せ指定のある区切り行も読み込める', () => {
  const md = '| 種類 | 具体値 | 001\n| :--- | :---: | ---: \n| 入力 | x | ○';
  const result = parse(md);
  assert.equal(result.ok, true);
  assert.deepEqual(result.matrix.rows[0], { levels: ['入力'], value: 'x', marks: ['○'] });
});

test('読み込み：改行コードが CRLF でも読み込める', () => {
  const result = parse(fixture('login-input.md').replace(/\n/g, '\r\n'));
  assert.deepEqual(result.matrix, loginMatrix());
});

test('読み込み：記号の表記揺れをそろえる（試験の列だけ）', () => {
  const result = parse(table(['001', '002', '003'], [...LEFT.slice(0, 4), 'O', '◯', 'ー', 'O']));
  assert.deepEqual(result.matrix.rows[0].marks, ['○', '−', '○']);
  assert.equal(result.matrix.rows[0].value, 'O', '具体値は変換しない');
  assert.deepEqual(result.warnings, []);
});

// ---------- 読み込み（エラー） ----------

test('E1：表が無い', () => {
  const result = parse('表を作れませんでした。');
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result.errors), ['E1']);
});

test('E2：2行目が区切り行ではない', () => {
  const result = parse('| 種類 | 具体値 | 001 |\n| 入力 | x | ○ |');
  assert.deepEqual(codes(result.errors), ['E2']);
  assert.deepEqual(result.errors[0].lines, [2]);
});

test('E3：数字の見出しの右に、数字でない見出しがある', () => {
  const result = parse(table(['001', '備考'], [...LEFT, '○', 'x']));
  assert.deepEqual(codes(result.errors), ['E3']);
});

test('E4：試験項番より左の列が2列未満', () => {
  const result = parse('| 種類 | 001 |\n| --- | --- |\n| 入力 | ○ |');
  assert.deepEqual(codes(result.errors), ['E4']);
});

test('E5：見出し行より列が多い行がある', () => {
  const result = parse(table(['001'], [...LEFT, '○'], [...LEFT, '○', '○']));
  assert.deepEqual(codes(result.errors), ['E5']);
  assert.deepEqual(result.errors[0].lines, [4]);
});

test('E6：データ行が無い', () => {
  const result = parse(table(['001']));
  assert.deepEqual(codes(result.errors), ['E6']);
});

// ---------- 読み込み（警告） ----------

test('W1：不明な記号は残して、セルの位置を知らせる', () => {
  const result = parse(table(['001', '002'], [...LEFT, '○', '×'], [...LEFT, '✓', '']));
  assert.equal(result.ok, true);
  assert.deepEqual(codes(result.warnings), ['W1']);
  assert.deepEqual(result.warnings[0].cells, [{ row: 0, col: 6 }, { row: 1, col: 5 }]);
  assert.deepEqual(result.matrix.rows[0].marks, ['○', '×']);
});

test('W2：列が足りない行は空欄で補う', () => {
  const result = parse(table(['001', '002', '003'], [...LEFT, '○', '○', '○'], [...LEFT, '○']));
  assert.deepEqual(codes(result.warnings), ['W2']);
  assert.deepEqual(result.warnings[0].cells, [{ row: 1, col: null }]);
  assert.deepEqual(result.matrix.rows[1].marks, ['○', '', '']);
});

test('W3：試験項番が連番でなければ警告する（項番はデータに持たないので、振り直しになる）', () => {
  for (const nums of [['001', '003'], ['002', '001'], ['001', '001'], ['1', '2']]) {
    const result = parse(table(nums, [...LEFT, '○', '○']));
    assert.deepEqual(codes(result.warnings), ['W3'], nums.join(','));
    assert.equal(result.matrix.testCount, 2);
  }
});

test('W4：表が複数あるときは、試験項番の列を持つ最初の表を読み込む', () => {
  const md = ['| 説明 | 内容 |', '| --- | --- |', '| a | b |', '', table(['001'], [...LEFT, '○'])].join('\n');
  const result = parse(md);
  assert.deepEqual(codes(result.warnings), ['W4']);
  assert.equal(result.matrix.testCount, 1);
  assert.equal(result.matrix.valueHeader, '具体値');
});

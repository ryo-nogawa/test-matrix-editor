// データ操作（要件定義書 5.1・5.8・5.10）
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/core/matrix.js');
const { loginMatrix, deepFreeze } = require('./helpers.js');

// 凍結したデータを渡すので、元のデータを書き換えるとエラーになる
const base = () => deepFreeze(loginMatrix([['○', ''], ['', '○'], ['○', ''], ['−', '○'], ['', '']], { withIds: true }));
const column = (m, t) => m.rows.map((row) => row.marks[t]);
const ids = (m) => m.rows.map((row) => row.id);

// ---------- 作成・ID ----------

test('初期状態：デフォルトの5列と、種類の初期分類の3行', () => {
  const m = M.createDefault();
  assert.deepEqual(m.headers, ['種類', '対象', '項目', 'パターン']);
  assert.equal(m.valueHeader, '具体値');
  assert.equal(m.testCount, 0);
  assert.deepEqual(m.rows.map((r) => r.levels[0]), ['入力', '機能', '出力']);
});

test('ID：読み込んだデータの行に、重ならない ID を付ける', () => {
  const m = M.withIds(loginMatrix());
  assert.deepEqual(ids(m), ['r1', 'r2', 'r3', 'r4', 'r5']);
  const partial = { ...m, rows: [{ ...m.rows[0], id: 'r7' }, { ...m.rows[1], id: undefined }] };
  assert.deepEqual(ids(M.withIds(partial)), ['r7', 'r8']);
});

// ---------- 行 ----------

test('行の挿入：上の行から、階層の最下段の1つ手前までを引き継ぐ', () => {
  const m = M.insertRow(base(), 2);
  assert.equal(m.rows.length, 6);
  assert.deepEqual(m.rows[2].levels, ['機能', '会員確認', '会員情報の検索', '']);
  assert.equal(m.rows[2].value, '');
  assert.deepEqual(m.rows[2].marks, ['', '']);
  assert.equal(m.rows[2].id, 'r6');
});

test('行の挿入：先頭に挿入するときは、すべて空にする', () => {
  const m = M.insertRow(base(), 0);
  assert.deepEqual(m.rows[0].levels, ['', '', '', '']);
});

test('行の削除', () => {
  const m = M.deleteRow(base(), 1);
  assert.deepEqual(ids(m), ['r1', 'r3', 'r4', 'r5']);
});

// ---------- 試験の列 ----------

test('試験の列の挿入：各行に空欄が入る', () => {
  const m = M.insertTest(base(), 1);
  assert.equal(m.testCount, 3);
  assert.deepEqual(column(m, 0), ['○', '', '○', '−', '']);
  assert.deepEqual(column(m, 1), ['', '', '', '', '']);
  assert.deepEqual(column(m, 2), ['', '○', '', '○', '']);
});

test('試験の列の複製：すぐ右に同じ印の列が入る', () => {
  const m = M.duplicateTest(base(), 0);
  assert.equal(m.testCount, 3);
  assert.deepEqual(column(m, 1), column(m, 0));
  assert.deepEqual(column(m, 2), column(base(), 1));
});

test('試験の列の削除', () => {
  const m = M.deleteTest(base(), 0);
  assert.equal(m.testCount, 1);
  assert.deepEqual(column(m, 0), column(base(), 1));
});

// ---------- 階層の列・見出し ----------

test('階層の列の追加：具体値の列の左に空の列が入る', () => {
  const m = M.addLevel(base());
  assert.deepEqual(m.headers, ['種類', '対象', '項目', 'パターン', '新しい階層']);
  assert.ok(m.rows.every((row) => row.levels.length === 5 && row.levels[4] === ''));
});

test('階層の列の削除：最低1列は残す', () => {
  let m = M.deleteLevel(base(), 1);
  assert.deepEqual(m.headers, ['種類', '項目', 'パターン']);
  assert.deepEqual(m.rows[0].levels, ['入力', 'リクエスト', '必須項目あり']);
  m = M.deleteLevel(M.deleteLevel(m, 0), 0);
  assert.equal(M.deleteLevel(m, 0), m);
});

test('見出し名の変更', () => {
  assert.deepEqual(M.renameLevel(base(), 1, '画面').headers, ['種類', '画面', '項目', 'パターン']);
  assert.equal(M.renameValueHeader(base(), '値').valueHeader, '値');
});

// ---------- セル ----------

test('結合したセルの編集：結合している行をまとめて書き換える', () => {
  const m = M.setLevelRange(base(), 1, 3, 0, '処理');
  assert.deepEqual(m.rows.map((r) => r.levels[0]), ['入力', '処理', '処理', '処理', '出力']);
});

test('セルの編集：変えた行以外は元のデータを共有する', () => {
  const before = base();
  const m = M.setMark(M.setValue(M.setLevel(before, 1, 3, '一致'), 1, 'yes'), 1, 0, '○');
  assert.deepEqual(m.rows[1].levels, ['機能', '会員確認', '会員情報の検索', '一致']);
  assert.equal(m.rows[1].value, 'yes');
  assert.deepEqual(m.rows[1].marks, ['○', '○']);
  assert.equal(m.rows[0], before.rows[0]);
});

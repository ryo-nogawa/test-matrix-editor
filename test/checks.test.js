// 改変チェック（書式仕様書 7章）、網羅チェック（要件定義書 5.8）、セル結合（書式仕様書 8章）
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareLeft, coverage, mergeSpans } = require('../src/core/checks.js');
const Matrix = require('../src/core/matrix.js');
const { loginMatrix } = require('./helpers.js');

const rowCells = (w) => w.cells.map((c) => c.row);

// ---------- 改変チェック ----------

test('改変チェック：左側が同じなら差分なし（試験の列が増えるのは正常）', () => {
  const imported = loginMatrix([['○'], ['○'], [''], ['−'], ['○']]);
  assert.equal(compareLeft(loginMatrix(), imported), null);
});

test('W6：画面が空なら改変チェックを省略する', () => {
  const empty = { ...loginMatrix(), rows: [] };
  assert.equal(compareLeft(empty, loginMatrix()).code, 'W6');
});

test('W6：「種類」だけの初期状態も、条件が無いものとして省略する', () => {
  assert.equal(compareLeft(Matrix.createDefault(), loginMatrix()).code, 'W6');
});

test('W5：書き換えられた行', () => {
  const imported = loginMatrix();
  imported.rows[2].levels[3] = '該当なし';
  const w = compareLeft(loginMatrix(), imported);
  assert.equal(w.code, 'W5');
  assert.deepEqual(w.details, { headerChanged: false, added: [], changed: [2], deleted: 0 });
  assert.deepEqual(rowCells(w), [2]);
});

test('W5：追加された行と削除された行', () => {
  const imported = loginMatrix();
  imported.rows.splice(1, 1);
  imported.rows.push({ levels: ['出力', 'レスポンス', '結果コード', '正常'], value: 'OK', marks: [] });
  const w = compareLeft(loginMatrix(), imported);
  // 削除は「会員情報 見つかる」、追加は末尾の「正常」。末尾の行は直前に削除が無いので書き換えではなく追加
  assert.deepEqual(w.details, { headerChanged: false, added: [4], changed: [], deleted: 1 });
  assert.match(w.message, /追加1行、削除1行/);
});

test('W5：見出しの変更', () => {
  const imported = loginMatrix();
  imported.headers[1] = '画面';
  const w = compareLeft(loginMatrix(), imported);
  assert.equal(w.details.headerChanged, true);
  assert.deepEqual(w.cells, []);
});

// ---------- 網羅チェック ----------

test('網羅チェック：○ が1つも無い行と列（出力の行は対象外）', () => {
  // 5行目は出力の行。○ が無くても数えない
  const m = loginMatrix([['○', '', '−'], ['', '○', ''], ['○', '', ''], ['−', '', ''], ['', '', '']]);
  assert.deepEqual(coverage(m), { rows: [3], tests: [2] });
});

test('網羅チェック：出力の行にだけ ○ がある試験の列は、○ が無いものとして数える', () => {
  const m = loginMatrix([['○', ''], ['○', ''], [''], [''], ['', '○']].map((r) => [...r, ''].slice(0, 2)));
  assert.deepEqual(coverage(m).tests, [1]);
});

test('網羅チェック：試験の列がまだ無いうちは調べない', () => {
  assert.deepEqual(coverage(loginMatrix()), { rows: [], tests: [] });
});

test('網羅チェック：「出力（結果）」のような表記も出力の行とみなす', () => {
  const m = loginMatrix([[''], ['○'], ['○'], ['○'], ['']]);
  m.rows[0].levels[0] = '入力（事前条件）';
  m.rows[4].levels[0] = '出力（結果）';
  assert.deepEqual(coverage(m).rows, [0]);
});

// ---------- セル結合 ----------

test('セル結合：同じ値が続くセルを結合する（ログインAPIの例）', () => {
  const spans = mergeSpans(loginMatrix());
  assert.deepEqual(spans[0], [1, 3, 0, 0, 1]); // 種類：「機能」が3行
  assert.deepEqual(spans[1], [1, 2, 0, 1, 1]); // 対象：「会員確認」が2行
  assert.deepEqual(spans[2], [1, 2, 0, 1, 1]); // 項目：「会員情報の検索」が2行
  assert.deepEqual(spans[3], [1, 1, 1, 1, 1]); // パターン：結合なし
});

test('セル結合：親が変わったら、子の値が同じでも結合しない', () => {
  const m = {
    headers: ['種類', '対象'],
    rows: [
      { levels: ['入力', '共通'] },
      { levels: ['機能', '共通'] },
      { levels: ['機能', '共通'] },
    ],
  };
  assert.deepEqual(mergeSpans(m), [[1, 2, 0], [1, 2, 0]]);
});

test('セル結合：空欄は結合せず、空欄の親の下の子も結合しない', () => {
  const m = {
    headers: ['種類', '対象'],
    rows: [
      { levels: ['', 'A'] },
      { levels: ['', 'A'] },
    ],
  };
  assert.deepEqual(mergeSpans(m), [[1, 1], [1, 1]]);
});

// マトリクスのデータ操作。どの関数も元のデータを変えず、新しいデータを返す
//
// データの形は markdown.js と同じで、行に画面で行を追うための id が付く：
//   { headers, valueHeader, testCount, rows: [{ id, levels, value, marks }] }
// 試験項番は「左から何番目か」で決まるため、データには持たない
const Matrix = (() => {
  const DEFAULT_HEADERS = ['種類', '対象', '項目', 'パターン'];
  const DEFAULT_VALUE_HEADER = '具体値';
  const DEFAULT_KINDS = ['入力', '機能', '出力'];
  const NEW_LEVEL_HEADER = '新しい階層';

  // ---------- 作成・ID ----------

  // まだ id が無い行に、他の行と重ならない id を付ける
  function withIds(matrix) {
    let next = nextIdNumber(matrix.rows);
    return { ...matrix, rows: matrix.rows.map((row) => (row.id ? row : { ...row, id: `r${next++}` })) };
  }

  function nextIdNumber(rows) {
    const numbers = rows.map((r) => Number(/^r(\d+)$/.exec(r.id || '')?.[1] || 0));
    return Math.max(0, ...numbers) + 1;
  }

  function emptyRow(id, levelCount, testCount) {
    return { id, levels: Array(levelCount).fill(''), value: '', marks: Array(testCount).fill('') };
  }

  // 新しく作るときの初期状態。「種類」の初期分類を1行ずつ用意する
  function createDefault() {
    return {
      headers: [...DEFAULT_HEADERS],
      valueHeader: DEFAULT_VALUE_HEADER,
      testCount: 0,
      rows: DEFAULT_KINDS.map((kind, i) => {
        const row = emptyRow(`r${i + 1}`, DEFAULT_HEADERS.length, 0);
        row.levels[0] = kind;
        return row;
      }),
    };
  }

  // ---------- 行 ----------

  // index の位置に行を挿入する。上の行から、階層の最下段の1つ手前までの値を引き継ぐ
  function insertRow(matrix, index) {
    const row = emptyRow(`r${nextIdNumber(matrix.rows)}`, matrix.headers.length, matrix.testCount);
    const above = matrix.rows[index - 1];
    if (above) {
      for (let i = 0; i < matrix.headers.length - 1; i++) row.levels[i] = above.levels[i];
    }
    const rows = [...matrix.rows];
    rows.splice(index, 0, row);
    return { ...matrix, rows };
  }

  function deleteRow(matrix, index) {
    return { ...matrix, rows: matrix.rows.filter((_, i) => i !== index) };
  }

  // ---------- 試験の列 ----------

  function mapMarks(matrix, testCount, fn) {
    return { ...matrix, testCount, rows: matrix.rows.map((row) => ({ ...row, marks: fn([...row.marks]) })) };
  }

  // index の位置（0 なら先頭）に空の試験の列を挿入する
  function insertTest(matrix, index) {
    return mapMarks(matrix, matrix.testCount + 1, (marks) => {
      marks.splice(index, 0, '');
      return marks;
    });
  }

  // index の試験の列を複製し、すぐ右に挿入する
  function duplicateTest(matrix, index) {
    return mapMarks(matrix, matrix.testCount + 1, (marks) => {
      marks.splice(index + 1, 0, marks[index]);
      return marks;
    });
  }

  function deleteTest(matrix, index) {
    return mapMarks(matrix, matrix.testCount - 1, (marks) => marks.filter((_, i) => i !== index));
  }

  // ---------- 階層の列・見出し ----------

  // 階層の列の右端（具体値の列の左）に列を追加する
  function addLevel(matrix) {
    return {
      ...matrix,
      headers: [...matrix.headers, NEW_LEVEL_HEADER],
      rows: matrix.rows.map((row) => ({ ...row, levels: [...row.levels, ''] })),
    };
  }

  // 階層の列を削除する。階層の列は最低1列残す
  function deleteLevel(matrix, index) {
    if (matrix.headers.length <= 1) return matrix;
    return {
      ...matrix,
      headers: matrix.headers.filter((_, i) => i !== index),
      rows: matrix.rows.map((row) => ({ ...row, levels: row.levels.filter((_, i) => i !== index) })),
    };
  }

  function renameLevel(matrix, index, name) {
    return { ...matrix, headers: matrix.headers.map((h, i) => (i === index ? name : h)) };
  }

  function renameValueHeader(matrix, name) {
    return { ...matrix, valueHeader: name };
  }

  // ---------- セル ----------

  function updateRow(matrix, rowIndex, fn) {
    return { ...matrix, rows: matrix.rows.map((row, i) => (i === rowIndex ? fn(row) : row)) };
  }

  function setLevel(matrix, rowIndex, levelIndex, text) {
    return updateRow(matrix, rowIndex, (row) => ({ ...row, levels: row.levels.map((v, i) => (i === levelIndex ? text : v)) }));
  }

  // 結合して表示しているセルの編集。結合している行（start から count 行）をまとめて書き換える
  function setLevelRange(matrix, start, count, levelIndex, text) {
    let next = matrix;
    for (let r = start; r < start + count; r++) next = setLevel(next, r, levelIndex, text);
    return next;
  }

  function setValue(matrix, rowIndex, text) {
    return updateRow(matrix, rowIndex, (row) => ({ ...row, value: text }));
  }

  function setMark(matrix, rowIndex, testIndex, mark) {
    return updateRow(matrix, rowIndex, (row) => ({ ...row, marks: row.marks.map((m, i) => (i === testIndex ? mark : m)) }));
  }

  return {
    createDefault, withIds,
    insertRow, deleteRow,
    insertTest, duplicateTest, deleteTest,
    addLevel, deleteLevel, renameLevel, renameValueHeader,
    setLevel, setLevelRange, setValue, setMark,
  };
})();

if (typeof module !== 'undefined') module.exports = Matrix;

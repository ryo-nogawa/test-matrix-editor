// 改変チェック（書式仕様書 7章）、網羅チェック、セル結合の範囲の計算（書式仕様書 8章）
const Checks = (() => {
  const marks = typeof module !== 'undefined' ? require('./marks.js') : Marks;

  // ---------- 改変チェック ----------

  const rowKey = (row) => JSON.stringify([...row.levels, row.value]);

  // 2つの並びで、順番を保ったまま一致する組を最も多く取る（最長共通部分列）
  function matchInOrder(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) pairs.push([i++, j++]);
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return pairs;
  }

  // 「種類」だけが入った初期状態の行は、条件を入力したことにならない
  const hasCondition = (row) => row.levels.slice(1).some((v) => v !== '') || row.value !== '';

  // 読み込む直前の画面（current）と、読み込んだ表（imported）の左側の条件を比べる。
  // 差分が無ければ null、あれば W5、比較元に条件が無ければ W6 を返す
  function compareLeft(current, imported) {
    if (!current.rows.some(hasCondition)) {
      return { code: 'W6', message: '画面に条件が無いため、改変チェックを省略しました', cells: [] };
    }

    const headerChanged =
      current.valueHeader !== imported.valueHeader ||
      current.headers.length !== imported.headers.length ||
      current.headers.some((h, i) => h !== imported.headers[i]);

    const a = current.rows.map(rowKey);
    const b = imported.rows.map(rowKey);
    const added = [];
    const changed = [];
    let deleted = 0;
    // 一致した行と行の間に残った行は、上から順に「書き換え」として対応付け、余りを追加・削除とする
    const pairs = [...matchInOrder(a, b), [a.length, b.length]];
    let prevA = 0;
    let prevB = 0;
    for (const [ia, ib] of pairs) {
      const restA = ia - prevA;
      const restB = ib - prevB;
      for (let k = 0; k < restB; k++) (k < restA ? changed : added).push(prevB + k);
      deleted += Math.max(0, restA - restB);
      prevA = ia + 1;
      prevB = ib + 1;
    }

    if (!headerChanged && added.length === 0 && changed.length === 0 && deleted === 0) return null;

    const parts = [];
    if (headerChanged) parts.push('見出しの変更');
    if (added.length) parts.push(`追加${added.length}行`);
    if (changed.length) parts.push(`書き換え${changed.length}行`);
    if (deleted) parts.push(`削除${deleted}行`);
    return {
      code: 'W5',
      message: `左側の条件が、読み込む前から変わっています（${parts.join('、')}）`,
      cells: [...changed, ...added].sort((x, y) => x - y).map((row) => ({ row, col: null })),
      details: { headerChanged, added, changed, deleted },
    };
  }

  // ---------- 網羅チェック ----------

  // 「種類」が出力（結果）の行。期待値は参考資料が無いと空欄で返るため、網羅チェックの対象から外す
  const isOutputRow = (row) => row.levels[0].startsWith('出力');

  // ○ が1つも無い行と、○ が1つも無い試験の列の番号（0始まり）を返す。出力の行は数えない
  function coverage(matrix) {
    if (matrix.testCount === 0) return { rows: [], tests: [] }; // 試験がまだ無いうちは調べない
    const has = (m) => m === marks.CIRCLE;
    const targets = matrix.rows.filter((row) => !isOutputRow(row));
    const rows = [];
    matrix.rows.forEach((row, r) => {
      if (!isOutputRow(row) && !row.marks.some(has)) rows.push(r);
    });
    const tests = [];
    for (let t = 0; t < matrix.testCount; t++) {
      if (!targets.some((row) => has(row.marks[t]))) tests.push(t);
    }
    return { rows, tests };
  }

  // ---------- セル結合 ----------

  // 階層の列ごとに、各行のセルの縦の結合数を返す。spans[列][行]
  //   1以上：その行から始まるセルが何行分を占めるか
  //   0    ：上のセルに結合されて表示しない
  // 同じ値が上下に続き、かつ親の列でも同じセルに結合されているときだけ結合する。空欄は結合しない
  function mergeSpans(matrix) {
    const spans = [];
    let parentGroup = matrix.rows.map(() => 0); // 親の列での「結合のまとまり」の番号
    matrix.headers.forEach((_, c) => {
      const group = [];
      const span = [];
      let start = -1;
      matrix.rows.forEach((row, r) => {
        const value = row.levels[c];
        const joins = r > 0 && value !== '' && value === matrix.rows[r - 1].levels[c] && parentGroup[r] === parentGroup[r - 1];
        if (joins) {
          group.push(group[r - 1]);
          span.push(0);
          span[start]++;
        } else {
          group.push(r);
          span.push(1);
          start = r;
        }
      });
      spans.push(span);
      parentGroup = group;
    });
    return spans;
  }

  return { compareLeft, coverage, mergeSpans };
})();

if (typeof module !== 'undefined') module.exports = Checks;

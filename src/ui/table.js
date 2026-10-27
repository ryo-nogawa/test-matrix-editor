// 表の描画。マトリクスのデータから表のHTMLを作る（書式仕様書 8章、要件定義書 5.10）
//
// HTMLを作る buildHtml は画面に依存しないので、Node.js でもテストできる
const TableView = (() => {
  const checks = typeof module !== 'undefined' ? require('../core/checks.js') : Checks;
  const format = typeof module !== 'undefined' ? require('../core/markdown.js') : MarkdownFormat;

  // 左側の列は幅を固定する。固定表示の位置（left）は、描画後に実際の位置を測って設定する
  const LEVEL_WIDTH = 120;
  const VALUE_WIDTH = 110;

  const escape = (text) =>
    String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  // 表の列番号（col）：階層の列 0〜L-1、具体値の列 L、試験の列 L+1〜（書式仕様書の警告のセル位置と同じ）
  //
  // highlights（どれも省略可）：
  //   warnCells       … 色を付けるセル。"行:列" の Set（W1 など）
  //   warnRows        … 左側の条件に色を付ける行の Set（W2・W5 など）
  //   uncoveredRows   … ○ が1つも無い行の Set（網羅チェック）
  //   uncoveredTests  … ○ が1つも無い試験の列の Set（網羅チェック）
  function buildHtml(matrix, highlights = {}) {
    const { warnCells = new Set(), warnRows = new Set(), uncoveredRows = new Set(), uncoveredTests = new Set() } = highlights;
    const levelCount = matrix.headers.length;
    const testCount = matrix.testCount;
    const spans = checks.mergeSpans(matrix);
    const numbers = format.testNumbers(testCount);
    const leftStyle = (c, width) => `style="min-width:${width}px;max-width:${width}px"`;

    const out = [];
    out.push('<table class="matrix"><thead><tr class="head-1">');
    matrix.headers.forEach((h, c) => {
      // 階層の列の右端の見出しに、階層の列を追加する＋を付ける
      const isLast = c === levelCount - 1;
      const addLevel = isLast ? '<button type="button" class="add-level" title="階層の列を追加">+</button>' : '';
      out.push(`<th class="left level${isLast ? ' last-level' : ''}" rowspan="2" data-col="${c}" ${leftStyle(c, LEVEL_WIDTH)}><span class="text">${escape(h)}</span>${addLevel}</th>`);
    });
    out.push(`<th class="left value" rowspan="2" data-col="${levelCount}" ${leftStyle(levelCount, VALUE_WIDTH)}>${escape(matrix.valueHeader)}</th>`);
    out.push(`<th class="test-group" colspan="${Math.max(testCount, 1)}">試験項番</th>`);
    out.push('<th class="add-test" rowspan="2" title="試験の列を右端に追加">+</th>');
    out.push('</tr><tr class="head-2">');
    if (testCount === 0) out.push('<th class="test-no empty">なし</th>');
    numbers.forEach((no, t) => {
      const cls = uncoveredTests.has(t) ? ' uncovered' : '';
      out.push(`<th class="test-no${cls}" data-test="${t}">${no}</th>`);
    });
    out.push('</tr></thead><tbody>');

    matrix.rows.forEach((row, r) => {
      const rowCls = [warnRows.has(r) && 'warn-row', uncoveredRows.has(r) && 'uncovered'].filter(Boolean).join(' ');
      out.push(`<tr data-row="${r}"${rowCls ? ` class="${rowCls}"` : ''}>`);
      row.levels.forEach((text, c) => {
        if (spans[c][r] === 0) return; // 上のセルに結合されている
        const span = spans[c][r] > 1 ? ` rowspan="${spans[c][r]}"` : '';
        const warn = warnCells.has(`${r}:${c}`) ? ' warn' : '';
        out.push(`<td class="left level${warn}"${span} data-col="${c}" ${leftStyle(c, LEVEL_WIDTH)}>${escape(text)}</td>`);
      });
      const valueWarn = warnCells.has(`${r}:${levelCount}`) ? ' warn' : '';
      out.push(`<td class="left value${valueWarn}" data-col="${levelCount}" ${leftStyle(levelCount, VALUE_WIDTH)}>${escape(row.value)}</td>`);
      if (testCount === 0) out.push('<td class="mark empty"></td>');
      row.marks.forEach((mark, t) => {
        const warn = warnCells.has(`${r}:${levelCount + 1 + t}`) ? ' warn' : '';
        out.push(`<td class="mark${warn}" data-test="${t}">${escape(mark)}</td>`);
      });
      out.push('</tr>');
    });

    out.push('</tbody></table>');
    return out.join('');
  }

  // 書式仕様書の警告（cells の row・col）を、buildHtml の highlights に変換する
  function highlightsFromWarnings(warnings) {
    const warnCells = new Set();
    const warnRows = new Set();
    for (const w of warnings) {
      for (const { row, col } of w.cells || []) {
        if (col === null) warnRows.add(row);
        else warnCells.add(`${row}:${col}`);
      }
    }
    return { warnCells, warnRows };
  }

  function render(container, matrix, highlights) {
    container.innerHTML = buildHtml(matrix, highlights);
    const table = container.querySelector('table');
    // 左側の列：見出しのセルの位置を測り、同じ列のセルをその位置で固定する
    const lefts = {};
    table.querySelectorAll('thead th.left').forEach((th) => {
      lefts[th.dataset.col] = th.offsetLeft;
    });
    table.querySelectorAll('.left').forEach((cell) => {
      cell.style.left = `${lefts[cell.dataset.col]}px`;
    });
    // 見出しの2行目：1行目の高さの分だけ下で固定する
    const firstRowHeight = table.querySelector('tr.head-1').offsetHeight;
    table.querySelectorAll('tr.head-2 th').forEach((th) => {
      th.style.top = `${firstRowHeight}px`;
    });
  }

  return { buildHtml, highlightsFromWarnings, render, LEVEL_WIDTH, VALUE_WIDTH };
})();

if (typeof module !== 'undefined') module.exports = TableView;

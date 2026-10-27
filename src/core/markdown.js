// Markdownの出力（serialize）と読み込み（parse）。書式は docs/markdown-format.md に従う
//
// マトリクスのデータ：
//   { headers: [階層の列の見出し...], valueHeader: 具体値の列の見出し, testCount: 試験の列の数,
//     rows: [{ levels: [階層の値...], value: 具体値, marks: [印...] }] }
const MarkdownFormat = (() => {
  const marks = typeof module !== 'undefined' ? require('./marks.js') : Marks;

  // ---------- 出力 ----------

  // 試験項番の見出し。3桁のゼロ埋めで、999列を超えたら桁を増やす
  function testNumbers(count) {
    const width = Math.max(3, String(count).length);
    return Array.from({ length: count }, (_, i) => String(i + 1).padStart(width, '0'));
  }

  function escapeCell(text) {
    return String(text).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  }

  function formatRow(cells) {
    return `| ${cells.map(escapeCell).join(' | ')} |`;
  }

  function serialize(matrix) {
    const header = [...matrix.headers, matrix.valueHeader, ...testNumbers(matrix.testCount)];
    const lines = [formatRow(header), formatRow(header.map(() => '---'))];
    for (const row of matrix.rows) {
      lines.push(formatRow([...row.levels, row.value, ...row.marks]));
    }
    return lines.join('\n') + '\n';
  }

  // ---------- 読み込み ----------

  // 行をセルに分ける。\| はセルの区切りではなく文字の | として扱う
  function splitRow(line) {
    let body = line.trim();
    if (body.startsWith('|')) body = body.slice(1);
    if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);
    const cells = [];
    let current = '';
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '\\' && body[i + 1] === '|') {
        current += '|';
        i++;
      } else if (body[i] === '|') {
        cells.push(current.trim());
        current = '';
      } else {
        current += body[i];
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
  }

  const isTestHeader = (text) => /^[0-9]+$/.test(text);

  // 「|」で始まる行が続くまとまりを1つの表とみなす。前後の文章やコードブロックの記号は無視される
  function findTables(lines) {
    const tables = [];
    let current = null;
    lines.forEach((line, i) => {
      if (line.trim().startsWith('|')) {
        if (!current) tables.push((current = []));
        current.push({ text: line, lineNo: i + 1 });
      } else {
        current = null;
      }
    });
    return tables;
  }

  function parse(text) {
    const errors = [];
    const warnings = [];
    const fail = (code, message, lines = []) => {
      errors.push({ code, message, lines });
      return { ok: false, matrix: null, errors, warnings };
    };

    const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
    const tables = findTables(lines);
    if (tables.length === 0) return fail('E1', '表が見つかりません');

    // 試験項番の列を持つ最初の表を採用する。無ければ最初の表
    const hasTestColumn = (t) => splitRow(t[0].text).some(isTestHeader);
    const table = tables.find(hasTestColumn) || tables[0];
    if (tables.length > 1) {
      warnings.push({ code: 'W4', message: `表が${tables.length}個あります。${table[0].lineNo}行目からの表を読み込みました`, cells: [] });
    }

    const header = splitRow(table[0].text);
    if (table.length < 2 || !isSeparatorRow(splitRow(table[1].text))) {
      return fail('E2', '見出し行の次の行が区切り行（| --- | --- |）になっていません', [table[0].lineNo + 1]);
    }

    // 列の境界：最初の数字の見出しから右が試験項番、その直前の1列が具体値
    const firstTest = header.findIndex(isTestHeader);
    const leftCount = firstTest === -1 ? header.length : firstTest;
    if (firstTest !== -1 && !header.slice(firstTest).every(isTestHeader)) {
      return fail('E3', '試験項番（数字の見出し）の列の右に、数字でない見出しの列があります', [table[0].lineNo]);
    }
    if (leftCount < 2) {
      return fail('E4', '試験項番より左の列が2列未満です（階層の列と具体値の列が最低1列ずつ必要です）', [table[0].lineNo]);
    }

    const dataLines = table.slice(2);
    if (dataLines.length === 0) return fail('E6', 'データ行が1行もありません', [table[1].lineNo]);

    const tooLong = dataLines.filter((l) => splitRow(l.text).length > header.length);
    if (tooLong.length > 0) {
      return fail('E5', `見出し行より列が多い行が${tooLong.length}行あります`, tooLong.map((l) => l.lineNo));
    }

    const testCount = header.length - leftCount;
    const shortRows = [];
    const unknownCells = [];
    const rows = dataLines.map((line, r) => {
      const cells = splitRow(line.text);
      if (cells.length < header.length) {
        shortRows.push(r);
        while (cells.length < header.length) cells.push('');
      }
      const rowMarks = cells.slice(leftCount).map((raw, t) => {
        const { mark, known } = marks.normalizeMark(raw);
        if (!known) unknownCells.push({ row: r, col: leftCount + t });
        return mark;
      });
      return { levels: cells.slice(0, leftCount - 1), value: cells[leftCount - 1], marks: rowMarks };
    });

    if (unknownCells.length > 0) {
      warnings.push({ code: 'W1', message: `印の列に、○・−・空欄のどれにも当てはまらない文字が${unknownCells.length}か所あります`, cells: unknownCells });
    }
    if (shortRows.length > 0) {
      warnings.push({ code: 'W2', message: `見出し行より列が少ない行が${shortRows.length}行あります。足りないセルは空欄にしました`, cells: shortRows.map((row) => ({ row, col: null })) });
    }
    const expected = testNumbers(testCount);
    if (header.slice(leftCount).some((h, i) => h !== expected[i])) {
      warnings.push({ code: 'W3', message: '試験項番が 001 からの連番になっていません。左から振り直しました', cells: [] });
    }

    const matrix = {
      headers: header.slice(0, leftCount - 1),
      valueHeader: header[leftCount - 1],
      testCount,
      rows,
    };
    return { ok: true, matrix, errors, warnings };
  }

  return { serialize, parse, testNumbers };
})();

if (typeof module !== 'undefined') module.exports = MarkdownFormat;

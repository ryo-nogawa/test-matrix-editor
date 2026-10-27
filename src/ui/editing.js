// 表の編集操作（要件定義書 5.10）
//   - セルや見出しをクリックすると、その場で編集する
//   - 印のセルをクリックすると、そのセルにだけプルダウン（○ / − / 空欄）を出す
//   - 行・列の間にマウスを乗せると、破線と＋を出して挿入できる
//   - 右クリックで「挿入・複製・削除」のメニューを出す
//   - Ctrl+Z で元に戻し、Ctrl+Y（Ctrl+Shift+Z）でやり直す
//
// データの変更はすべて update(関数) を通して行い、app.js が履歴に積んで描き直す
const Editing = (() => {
  const EDGE = 6; // 行・列の境目とみなす範囲（px）

  const MARK_OPTIONS = [
    { mark: Marks.CIRCLE, label: '○ 確認する' },
    { mark: Marks.DASH, label: '− 到達しない' },
    { mark: Marks.BLANK, label: '空欄 該当なし' },
  ];

  function attach({ container, getMatrix, update, undo, redo, refresh }) {
    let editing = false;
    let insertAt = null; // { kind: 'row' | 'test', index }

    // ---------- 画面の上に重ねる部品 ----------

    const line = element('div', 'insert-line');
    const plus = element('button', 'insert-plus', '+');
    const popup = element('div', 'popup');
    plus.type = 'button';
    document.body.append(line, plus, popup);

    function element(tag, className, text = '') {
      const el = document.createElement(tag);
      el.className = className;
      el.textContent = text;
      el.hidden = true;
      return el;
    }

    function hideInsert() {
      line.hidden = true;
      plus.hidden = true;
      insertAt = null;
    }

    function hidePopup() {
      popup.hidden = true;
      container.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    }

    // items：[{ label, action, disabled }] または '-'（区切り線）
    function showPopup(items, x, y) {
      popup.innerHTML = '';
      for (const item of items) {
        if (item === '-') {
          popup.append(Object.assign(document.createElement('hr')));
          continue;
        }
        const button = Object.assign(document.createElement('button'), { type: 'button', textContent: item.label, disabled: !!item.disabled });
        button.addEventListener('click', () => {
          hidePopup();
          item.action();
        });
        popup.append(button);
      }
      popup.hidden = false;
      // 画面の外にはみ出さないように位置を調整する
      const { width, height } = popup.getBoundingClientRect();
      popup.style.left = `${Math.min(x, window.innerWidth - width - 8)}px`;
      popup.style.top = `${Math.min(y, window.innerHeight - height - 8)}px`;
    }

    // ---------- 行・列の間の挿入 ----------

    function onMouseMove(e) {
      if (editing || !popup.hidden) return;
      const cell = e.target.closest('td, th.test-no');
      if (!cell || !container.contains(cell)) return hideInsert();
      const rect = cell.getBoundingClientRect();
      const box = visibleBox();

      // 行の境目（td の上端・下端）
      if (cell.tagName === 'TD') {
        const row = Number(cell.closest('tr').dataset.row);
        const nearTop = e.clientY - rect.top < EDGE;
        const nearBottom = rect.bottom - e.clientY < EDGE;
        if (nearTop || nearBottom) {
          const index = nearTop ? row : row + cell.rowSpan;
          const y = nearTop ? rect.top : rect.bottom;
          return showInsert({ kind: 'row', index }, box.left, y - 1, box.right - box.left, 2, box.right - 14, y);
        }
      }
      // 試験の列の境目（印のセル・項番の見出しの左端・右端）
      if (cell.dataset.test !== undefined) {
        const test = Number(cell.dataset.test);
        const nearLeft = e.clientX - rect.left < EDGE;
        const nearRight = rect.right - e.clientX < EDGE;
        if (nearLeft || nearRight) {
          const x = nearLeft ? rect.left : rect.right;
          return showInsert({ kind: 'test', index: nearLeft ? test : test + 1 }, x - 1, box.top, 2, box.bottom - box.top, x, box.top + 14);
        }
      }
      hideInsert();
    }

    // 表のうち、いま画面に見えている範囲
    function visibleBox() {
      const c = container.getBoundingClientRect();
      const t = container.querySelector('table').getBoundingClientRect();
      return { left: c.left, right: Math.min(c.right, t.right), top: t.top < c.top ? c.top : t.top, bottom: Math.min(c.bottom, t.bottom) };
    }

    function showInsert(target, lineX, lineY, lineW, lineH, plusX, plusY) {
      insertAt = target;
      Object.assign(line.style, { left: `${lineX}px`, top: `${lineY}px`, width: `${lineW}px`, height: `${lineH}px` });
      line.classList.toggle('vertical', target.kind === 'test');
      Object.assign(plus.style, { left: `${plusX}px`, top: `${plusY}px` });
      plus.title = target.kind === 'row' ? 'ここに行を挿入' : 'ここに試験の列を挿入';
      line.hidden = false;
      plus.hidden = false;
    }

    plus.addEventListener('click', () => {
      const target = insertAt;
      hideInsert();
      if (target?.kind === 'row') update((m) => Matrix.insertRow(m, target.index));
      if (target?.kind === 'test') update((m) => Matrix.insertTest(m, target.index));
    });

    // ＋ボタンに移るときは、表から出ても＋を消さない
    container.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget !== plus) hideInsert();
    });
    plus.addEventListener('mouseleave', (e) => {
      if (!container.contains(e.relatedTarget)) hideInsert();
    });

    // ---------- クリック ----------

    function onClick(e) {
      if (editing) return;
      const target = e.target;
      if (target.closest('.add-level')) return update((m) => Matrix.addLevel(m));
      if (target.closest('.add-test')) return update((m) => Matrix.insertTest(m, m.testCount));
      if (target.closest('th.test-no.empty')) return update((m) => Matrix.insertTest(m, 0));

      const mark = target.closest('td.mark[data-test]');
      if (mark) return openMarkMenu(mark);

      const left = target.closest('.left');
      if (left) startEdit(left);
    }

    function openMarkMenu(cell) {
      hideInsert();
      hidePopup();
      const row = Number(cell.closest('tr').dataset.row);
      const test = Number(cell.dataset.test);
      cell.classList.add('selected');
      const rect = cell.getBoundingClientRect();
      showPopup(
        MARK_OPTIONS.map(({ mark, label }) => ({ label, action: () => update((m) => Matrix.setMark(m, row, test, mark)) })),
        rect.left,
        rect.bottom + 2,
      );
    }

    // ---------- その場での編集 ----------

    // セルが表すデータ（どの値を、どう書き換えるか）
    function editTarget(cell) {
      const m = getMatrix();
      const col = Number(cell.dataset.col);
      const isValue = col === m.headers.length;
      if (cell.tagName === 'TH') {
        return isValue
          ? { text: m.valueHeader, apply: (t) => (x) => Matrix.renameValueHeader(x, t) }
          : { text: m.headers[col], apply: (t) => (x) => Matrix.renameLevel(x, col, t) };
      }
      const row = Number(cell.closest('tr').dataset.row);
      return isValue
        ? { text: m.rows[row].value, apply: (t) => (x) => Matrix.setValue(x, row, t) }
        : { text: m.rows[row].levels[col], apply: (t) => (x) => Matrix.setLevelRange(x, row, cell.rowSpan, col, t) };
    }

    function startEdit(cell) {
      hideInsert();
      hidePopup();
      const target = editTarget(cell);
      const input = Object.assign(document.createElement('input'), { type: 'text', value: target.text, className: 'cell-input' });
      cell.replaceChildren(input);
      editing = true;
      input.focus();
      input.select();

      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        editing = false;
        // セル内の改行は使えない（書式仕様書 4.4）
        const text = input.value.replace(/[\r\n]+/g, ' ').trim();
        if (save && text !== target.text) update(target.apply(text));
        else refresh();
      };
      input.addEventListener('keydown', (e) => {
        if (e.isComposing) return; // 日本語の変換を確定する Enter は無視する
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
    }

    // ---------- 右クリックメニュー ----------

    function onContextMenu(e) {
      if (editing) return;
      const cell = e.target.closest('td, th');
      if (!cell || !container.contains(cell)) return;
      const items = menuItems(cell);
      if (!items) return;
      e.preventDefault();
      hideInsert();
      hidePopup();
      cell.classList.add('selected');
      showPopup(items, e.clientX, e.clientY);
    }

    function menuItems(cell) {
      const m = getMatrix();
      if (cell.dataset.test !== undefined) {
        const t = Number(cell.dataset.test);
        return [
          { label: '左に試験の列を挿入', action: () => update((x) => Matrix.insertTest(x, t)) },
          { label: '右に試験の列を挿入', action: () => update((x) => Matrix.insertTest(x, t + 1)) },
          { label: 'この試験の列を複製', action: () => update((x) => Matrix.duplicateTest(x, t)) },
          '-',
          { label: 'この試験の列を削除', action: () => update((x) => Matrix.deleteTest(x, t)) },
        ];
      }
      if (cell.tagName === 'TH' && cell.classList.contains('level')) {
        const c = Number(cell.dataset.col);
        return [
          { label: '階層の列を右端に追加', action: () => update((x) => Matrix.addLevel(x)) },
          '-',
          { label: 'この階層の列を削除', disabled: m.headers.length <= 1, action: () => update((x) => Matrix.deleteLevel(x, c)) },
        ];
      }
      if (cell.tagName === 'TD' && cell.classList.contains('left')) {
        const r = Number(cell.closest('tr').dataset.row);
        return [
          { label: '上に行を挿入', action: () => update((x) => Matrix.insertRow(x, r)) },
          { label: '下に行を挿入', action: () => update((x) => Matrix.insertRow(x, r + 1)) },
          '-',
          { label: 'この行を削除', action: () => update((x) => Matrix.deleteRow(x, r)) },
        ];
      }
      return null;
    }

    // ---------- キーボード ----------

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        hidePopup();
        hideInsert();
        return;
      }
      if (editing || e.target.closest?.('input, textarea')) return; // 入力欄の中では、入力欄の元に戻すを使う
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);
    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('scroll', () => {
      hideInsert();
      hidePopup();
    });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', (e) => {
      if (!popup.hidden && !popup.contains(e.target)) hidePopup();
    });

    // 描き直したときは、表の上に出していた部品を消す
    return {
      reset() {
        hideInsert();
        hidePopup();
      },
    };
  }

  return { attach };
})();

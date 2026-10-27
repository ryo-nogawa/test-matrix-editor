// 画面の起動処理。各モジュールを組み合わせて画面を動かす
const App = (() => {
  const container = document.getElementById('app');
  const status = document.getElementById('status');
  const buttons = {
    undo: document.querySelector('[data-action="undo"]'),
    redo: document.querySelector('[data-action="redo"]'),
  };

  // 履歴には、データと「そのデータを読み込んだときの警告」を組にして積む。
  // 読み込んだ直後の状態に戻したときは、警告の強調表示も元に戻る。
  // 起動時は、ブラウザに保存しておいたデータがあればそれを使う
  const saved = AutoSave.load();
  let history = History.create({ matrix: saved || Matrix.createDefault(), warnings: [] });
  let savedAt = saved ? new Date() : null;

  const editing = Editing.attach({
    container,
    getMatrix: () => history.present.matrix,
    update,
    undo,
    redo,
    refresh: render,
  });

  Toolbar.attach({ getMatrix: () => history.present.matrix, importMarkdown });

  function render() {
    const { matrix, warnings } = history.present;
    const coverage = Checks.coverage(matrix);
    editing.reset();
    TableView.render(container, matrix, {
      ...TableView.highlightsFromWarnings(warnings),
      uncoveredRows: new Set(coverage.rows),
      uncoveredTests: new Set(coverage.tests),
    });
    buttons.undo.disabled = !History.canUndo(history);
    buttons.redo.disabled = !History.canRedo(history);
    renderStatus();
  }

  function renderStatus() {
    const { matrix } = history.present;
    const time = savedAt && savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    status.textContent = [
      `条件 ${matrix.rows.length}行・試験 ${matrix.testCount}列`,
      savedAt ? `ブラウザ内に保存しました（${time}）` : 'ブラウザ内に保存できません。Markdown出力でバックアップしてください',
    ].join('　｜　');
  }

  // 変更のたびにブラウザ内へ保存する
  function save() {
    savedAt = AutoSave.save(history.present.matrix) ? new Date() : null;
  }

  // データを変える操作。変わらなければ履歴に積まない。編集すると警告の強調表示は消える
  function update(operation) {
    const matrix = operation(history.present.matrix);
    if (matrix === history.present.matrix) return render();
    history = History.push(history, { matrix, warnings: [] });
    save();
    render();
  }

  function undo() {
    history = History.undo(history);
    save();
    render();
  }

  function redo() {
    history = History.redo(history);
    save();
    render();
  }

  // Markdownを読み込む。読み込めたら1回の操作として履歴に積む
  function importMarkdown(text) {
    const result = MarkdownFormat.parse(text);
    if (!result.ok) return result;
    const matrix = Matrix.withIds(result.matrix);
    const changed = Checks.compareLeft(history.present.matrix, matrix);
    if (changed) result.warnings.push(changed);
    history = History.push(history, { matrix, warnings: result.warnings });
    save();
    render();
    return result;
  }

  buttons.undo.addEventListener('click', undo);
  buttons.redo.addEventListener('click', redo);

  render();
  return { importMarkdown };
})();

// 画面の起動処理。各モジュールを組み合わせて画面を動かす
const App = (() => {
  const container = document.getElementById('app');
  const status = document.getElementById('status');

  let history = History.create(Matrix.createDefault());
  let warnings = []; // 直前の読み込みで出た警告。セルの強調表示に使う

  function render() {
    const matrix = history.present;
    const coverage = Checks.coverage(matrix);
    TableView.render(container, matrix, {
      ...TableView.highlightsFromWarnings(warnings),
      uncoveredRows: new Set(coverage.rows),
      uncoveredTests: new Set(coverage.tests),
    });
    status.textContent = [
      `条件 ${matrix.rows.length}行・試験 ${matrix.testCount}列`,
      `ブラウザ内の保存：${canUseStorage() ? '利用可能' : '利用不可（Markdownの出力でバックアップしてください）'}`,
    ].join('　｜　');
  }

  // Markdownを読み込む。読み込めたら1回の操作として履歴に積む（ダイアログはM5で作る）
  function importMarkdown(text) {
    const result = MarkdownFormat.parse(text);
    if (!result.ok) return result;
    const matrix = Matrix.withIds(result.matrix);
    const changed = Checks.compareLeft(history.present, matrix);
    if (changed) result.warnings.push(changed);
    history = History.push(history, matrix);
    warnings = result.warnings;
    render();
    return result;
  }

  function canUseStorage() {
    try {
      const key = '__tme_check__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  render();
  return { importMarkdown };
})();

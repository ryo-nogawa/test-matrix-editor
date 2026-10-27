// 画面の起動処理。各モジュールを組み合わせて画面を動かす
const App = (() => {
  const container = document.getElementById('app');
  const status = document.getElementById('status');
  const nameInput = document.getElementById('matrix-name');
  const buttons = {
    undo: document.querySelector('[data-action="undo"]'),
    redo: document.querySelector('[data-action="redo"]'),
  };
  const BASE_TITLE = '試験マトリクス作成支援ツール';

  // このHTMLが表すファイル（要件定義書 5.5.2）。元のツールなら fileId は null。
  // saved は、最後にファイルへ保存した（または開いた）ときの内容。未保存の変更があるかを調べるのに使う
  const doc = { fileId: null, name: '', saved: null, savedAt: null };
  let storageOk = AutoSave.available();
  let autoSavedAt = null;
  let pendingChoice = null; // 開いたときに「続きから開くか」を聞く自動保存のデータ

  // 履歴には、データと「そのデータを読み込んだときの警告」を組にして積む。
  // 読み込んだ直後の状態に戻したときは、警告の強調表示も元に戻る。
  // 起動時は、保存したHTMLならそのデータ、元のツールならブラウザ内の自動保存を使う
  let history;
  const embedded = Files.embeddedData();
  if (embedded) {
    Object.assign(doc, { fileId: embedded.fileId, name: embedded.name, savedAt: new Date(embedded.savedAt) });
    doc.saved = { matrix: embedded.matrix, name: embedded.name };
    history = History.create({ matrix: embedded.matrix, warnings: [] });
    const auto = AutoSave.load(embedded.fileId);
    if (SaveFile.chooseOnOpen(embedded, auto) === 'ask') pendingChoice = auto;
  } else {
    const auto = AutoSave.load(null);
    doc.name = auto?.name || '';
    history = History.create({ matrix: auto?.matrix || Matrix.createDefault(), warnings: [] });
    autoSavedAt = auto ? new Date(auto.savedAt) : null;
  }

  const editing = Editing.attach({
    container,
    getMatrix: () => history.present.matrix,
    update,
    undo,
    redo,
    refresh: render,
  });

  Toolbar.attach({
    getMatrix: () => history.present.matrix,
    importMarkdown,
    importSaved,
    save: () => saveToFile({ asNew: false }),
    saveAs: () => saveToFile({ asNew: true }),
  });

  // ---------- 描画 ----------

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
    status.textContent = [
      `条件 ${matrix.rows.length}行・試験 ${matrix.testCount}列`,
      coverageText(matrix, Checks.coverage(matrix)),
      doc.fileId && (isDirty() ? 'ファイル：未保存の変更あり' : `ファイル：保存済み（${formatTime(doc.savedAt)}）`),
      storageOk
        ? autoSavedAt && `ブラウザ内に自動保存しました（${formatTime(autoSavedAt)}）`
        : 'ブラウザ内に保存できません。「保存」でファイルに残してください',
    ].filter(Boolean).join('　｜　');
    // タブの名前。未保存の変更があれば先頭に「*」を付ける
    document.title = doc.name || doc.fileId ? `${isDirty() ? '* ' : ''}${doc.name || SaveFile.DEFAULT_NAME} - ${BASE_TITLE}` : BASE_TITLE;
  }

  function coverageText(matrix, { rows, tests }) {
    if (matrix.testCount === 0) return '網羅チェック：試験の列を追加すると確認します';
    if (rows.length === 0 && tests.length === 0) return '網羅チェック：問題なし';
    return `網羅チェック：○が無い条件 ${rows.length}行・試験 ${tests.length}列`;
  }

  const formatTime = (date) => date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // 最後にファイルへ保存した後に、変更があるか（データは操作のたびに新しく作られるので、同じものかで比べられる）
  function isDirty() {
    return !!doc.fileId && (history.present.matrix !== doc.saved.matrix || doc.name !== doc.saved.name);
  }

  // ---------- 変更の操作 ----------

  // 変更のたびにブラウザ内へ保存する。保存したHTMLなら、そのファイル専用の枠に保存する
  function autoSave() {
    const at = AutoSave.save(doc.fileId, { name: doc.name, matrix: history.present.matrix });
    storageOk = !!at;
    if (at) autoSavedAt = new Date(at);
  }

  // データを変える操作。変わらなければ履歴に積まない。編集すると警告の強調表示は消える
  function update(operation) {
    const matrix = operation(history.present.matrix);
    if (matrix === history.present.matrix) return render();
    history = History.push(history, { matrix, warnings: [] });
    autoSave();
    render();
  }

  function undo() {
    history = History.undo(history);
    autoSave();
    render();
  }

  function redo() {
    history = History.redo(history);
    autoSave();
    render();
  }

  // 名前の変更は、元に戻す・やり直しの対象にしない（表の内容の操作ではないため）
  nameInput.value = doc.name;
  nameInput.addEventListener('input', () => {
    doc.name = nameInput.value.trim();
    autoSave();
    renderStatus();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) nameInput.blur();
  });

  // ---------- 読み込み ----------

  // Markdownを読み込む。読み込めたら1回の操作として履歴に積む
  function importMarkdown(text) {
    const result = MarkdownFormat.parse(text);
    if (!result.ok) return result;
    const matrix = Matrix.withIds(result.matrix);
    const changed = Checks.compareLeft(history.present.matrix, matrix);
    if (changed) result.warnings.push(changed);
    history = History.push(history, { matrix, warnings: result.warnings });
    autoSave();
    render();
    return result;
  }

  // 保存したHTML（古い版のツールで保存したものを含む）から取り出したデータを読み込む。
  // 名前は取り込むが、ファイルのIDは取り込まない（読み込んだファイルと今の画面は別物として扱う）
  function importSaved(data) {
    history = History.push(history, { matrix: data.matrix, warnings: [] });
    doc.name = data.name;
    nameInput.value = data.name;
    autoSave();
    render();
  }

  // ---------- ファイルへの保存 ----------

  // asNew：「名前を付けて保存」。新しいファイル（新しいID）として保存する
  async function saveToFile({ asNew }) {
    const isNewFile = asNew || !doc.fileId;
    const fileId = isNewFile ? SaveFile.newFileId() : doc.fileId;
    const { matrix } = history.present;
    const name = doc.name;
    const data = SaveFile.createData({ fileId, name, matrix, toolVersion: TOOL_VERSION });
    const html = SaveFile.embed(Files.source(), data);
    const suggestedName = SaveFile.fileName(name);

    const result = isNewFile ? await Files.saveAs(html, suggestedName) : await Files.save(html, suggestedName);
    if (result.method === 'cancel') return;

    if (isNewFile) {
      // 元のツールから初めて保存したときは、名前の無い枠を空に戻す（元のツールを次に開くと新規の状態になる）
      if (!doc.fileId) AutoSave.clear(null);
      doc.fileId = fileId;
    }
    doc.saved = { matrix, name };
    doc.savedAt = new Date(data.savedAt);
    autoSave();
    renderStatus();
    Dialogs.toast(result.method === 'download'
      ? `${result.fileName} をダウンロードフォルダに保存しました`
      : `${result.fileName} に保存しました`);
  }

  // ---------- 起動 ----------

  buttons.undo.addEventListener('click', undo);
  buttons.redo.addEventListener('click', redo);

  render();

  // 保存した後に保存していない編集が残っていれば、どちらで開くかを選んでもらう
  if (pendingChoice) {
    const lead = Object.assign(document.createElement('p'), {
      textContent: `このファイルを保存した後に、保存していない編集があります（${formatTime(new Date(pendingChoice.savedAt))}）。続きから開きますか？`,
    });
    Dialogs.open({
      title: '保存していない編集があります',
      body: [lead],
      buttons: [
        { label: '保存した内容で開く', action: () => autoSave() },
        {
          label: '続きから開く',
          primary: true,
          action: () => {
            history = History.create({ matrix: pendingChoice.matrix, warnings: [] });
            doc.name = pendingChoice.name;
            nameInput.value = doc.name;
            autoSave();
            render();
          },
        },
      ],
    });
  }

  return { importMarkdown };
})();

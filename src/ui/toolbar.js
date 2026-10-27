// ツールバーの「Markdown出力」「読み込み」「指示文コピー」（要件定義書 5.4・5.7・5.9）
const Toolbar = (() => {
  function attach({ getMatrix, importMarkdown, importSaved, save, saveAs }) {
    const on = (action, handler) => document.querySelector(`[data-action="${action}"]`).addEventListener('click', handler);
    on('save', save);
    on('save-as', saveAs);
    on('export', () => openExport(getMatrix()));
    on('import', () => openImport(importMarkdown, importSaved));
    on('copy-prompt', () => copyPrompt(getMatrix()));
  }

  // ---------- Markdown出力 ----------

  function openExport(matrix) {
    const text = MarkdownFormat.serialize(matrix);
    const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true, className: 'markdown-area' });
    Dialogs.open({
      title: 'Markdown出力',
      wide: true,
      body: [area],
      buttons: [
        { label: '閉じる' },
        { label: '.md ファイルとして保存', action: () => saveFile(text) },
        { label: 'コピー', primary: true, action: () => copyAndNotify(text, 'Markdownをコピーしました') },
      ],
    });
  }

  function saveFile(text) {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const name = `test-matrix-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Dialogs.toast(`${name} を保存しました`);
  }

  // ---------- 読み込み ----------

  function openImport(importMarkdown, importSaved) {
    const area = Object.assign(document.createElement('textarea'), {
      className: 'markdown-area',
      placeholder: 'AIが返したMarkdownを、説明文ごと貼り付けてください。',
    });
    const file = Object.assign(document.createElement('input'), { type: 'file', accept: '.md,.txt,.html,text/markdown,text/plain,text/html' });
    file.addEventListener('change', async () => {
      const picked = file.files[0];
      if (!picked) return;
      const text = await picked.text();
      if (!/\.html?$/i.test(picked.name)) {
        area.value = text;
        return;
      }
      // 名前を付けて保存したHTML（古い版のツールで保存したものを含む）から、データだけを取り出す
      const data = SaveFile.extract(text);
      if (!data) {
        Dialogs.message('読み込めませんでした', `${picked.name} には、このツールで保存したマトリクスのデータがありません。`, [], 'error');
        file.value = '';
        return;
      }
      close();
      importSaved(data);
      Dialogs.toast(`${picked.name} から「${data.name || SaveFile.DEFAULT_NAME}」を読み込みました`);
    });
    const fileRow = document.createElement('label');
    fileRow.className = 'file-row';
    fileRow.append('ファイルから読み込む（.md または保存したHTML）：', file);

    const { close } = Dialogs.open({
      title: '読み込み',
      wide: true,
      body: [fileRow, area],
      buttons: [
        { label: 'キャンセル' },
        { label: '読み込む', primary: true, action: () => submit() },
      ],
    });
    area.focus();

    function submit() {
      if (!area.value.trim()) return false;
      const result = importMarkdown(area.value);
      if (!result.ok) {
        showErrors(result.errors);
        return false; // 直して読み込み直せるよう、読み込みのダイアログは閉じない
      }
      if (result.warnings.length) showWarnings(result.warnings);
      else Dialogs.toast('読み込みました');
      return true;
    }
  }

  function showErrors(errors) {
    const items = errors.map((e) => `${e.code}：${e.message}${e.lines.length ? `（${e.lines.join('・')}行目）` : ''}`);
    Dialogs.message('読み込めませんでした', '表の形が崩れているため、読み込みを中止しました。', items, 'error');
  }

  function showWarnings(warnings) {
    const items = warnings.map((w) => `${w.code}：${w.message}`);
    const lead = `読み込みましたが、確認が必要な点が${warnings.length}件あります。色の付いたセルを確認してください。`;
    Dialogs.message('読み込みました（警告あり）', lead, items, 'warning');
  }

  // ---------- 指示文コピー ----------

  function copyPrompt(matrix) {
    copyAndNotify(Prompt.build(PROMPT_TEMPLATE, matrix), 'AIへの指示文と条件の表をコピーしました');
  }

  // ---------- クリップボード ----------

  async function copyAndNotify(text, done) {
    if (await copyText(text)) {
      Dialogs.toast(done);
      return;
    }
    // コピーできない環境では、表示して手でコピーしてもらう
    const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true, className: 'markdown-area' });
    Dialogs.open({ title: 'コピーできませんでした', wide: true, body: [area], buttons: [{ label: '閉じる', primary: true }] });
    area.select();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 古い方法で試す
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  return { attach };
})();

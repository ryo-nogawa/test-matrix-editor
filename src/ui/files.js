// データ入りHTMLのファイルへの書き出し（要件定義書 5.5.2）
//   - 保存の画面（showSaveFilePicker）で、保存先とファイル名を選ぶ
//   - 一度保存したファイルは覚えておき、「保存」で上書きする
//   - 保存の画面が使えない環境では、通常のダウンロードで保存する
const Files = (() => {
  // 表を描く前の、ツール自身のHTML。保存するときは、ここにデータを埋め込む。
  // （ブラウザは file:// で開いた自分のファイルを読み直せないため、起動直後の内容を控えておく）
  const source = `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;

  let handle = null; // 最後に保存したファイル。開き直すと消える（ブラウザの制約）

  // 結果は { method: 'picker' | 'download' | 'cancel', fileName }
  async function saveAs(html, suggestedName) {
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const picked = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'HTMLファイル', accept: { 'text/html': ['.html'] } }],
        });
        await write(picked, html);
        handle = picked;
        return { method: 'picker', fileName: picked.name };
      } catch (e) {
        if (e.name === 'AbortError') return { method: 'cancel', fileName: null }; // 利用者がキャンセルした
        // 会社の設定などで保存の画面が使えないときは、ダウンロードに切り替える
      }
    }
    download(html, suggestedName);
    return { method: 'download', fileName: suggestedName };
  }

  // 覚えているファイルに上書きする。覚えていなければ saveAs と同じ
  async function save(html, suggestedName) {
    if (!handle) return saveAs(html, suggestedName);
    try {
      await write(handle, html);
      return { method: 'picker', fileName: handle.name };
    } catch (e) {
      handle = null; // ファイルが移動・削除された、上書きが許可されなかった、など
      return saveAs(html, suggestedName);
    }
  }

  async function write(fileHandle, html) {
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([html], { type: 'text/html' }));
    await writable.close();
  }

  function download(html, fileName) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // このHTMLに埋め込まれているデータ。元のツールなら null
  function embeddedData() {
    return SaveFile.parseData(document.getElementById('matrix-data')?.textContent);
  }

  return { source: () => source, saveAs, save, embeddedData };
})();

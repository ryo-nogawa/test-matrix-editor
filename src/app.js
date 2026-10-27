// 画面の起動処理。各モジュールを組み合わせて画面を動かす（M3以降で実装）
(() => {
  const status = document.getElementById('status');
  status.textContent = `ブラウザ内の保存：${canUseStorage() ? '利用可能' : '利用不可（Markdownの出力でバックアップしてください）'}`;

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
})();

// ブラウザ内への一時保存（要件定義書 5.5）
//
// file:// で開いたページは、同じPCのほかの file:// のページと保存領域を共有するため、
// このツール専用の名前（KEY）で保存する。キャッシュを消すと消えるので、バックアップはMarkdownの出力で行う
const AutoSave = (() => {
  const KEY = 'test-matrix-editor/matrix';
  const VERSION = 1;

  function available() {
    try {
      const probe = `${KEY}/probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 保存できたら true。容量不足などで保存できなければ false
  function save(matrix) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: new Date().toISOString(), matrix }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 保存されたデータが無い・壊れている場合は null
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return data?.version === VERSION && Matrix.isValid(data.matrix) ? data.matrix : null;
    } catch (e) {
      return null;
    }
  }

  return { available, save, load };
})();

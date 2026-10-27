// ブラウザ内への一時保存（要件定義書 5.5.1）
//
// file:// で開いたページは、同じPCのほかの file:// のページと保存領域を共有するため、
// このツール専用の名前で保存する。さらに、名前を付けて保存したHTMLはファイルごとに別の枠を使い、
// ほかのマトリクスの自動保存と混ざらないようにする。
// キャッシュを消すと消えるので、バックアップは名前を付けて保存、またはMarkdownの出力で行う
const AutoSave = (() => {
  const UNNAMED_KEY = 'test-matrix-editor/matrix';
  const FILE_KEY_PREFIX = 'test-matrix-editor/file/';
  const VERSION = 1;

  // fileId が無い（元のツール）ときは、名前の無いマトリクス用の枠を使う
  const keyOf = (fileId) => (fileId ? `${FILE_KEY_PREFIX}${fileId}` : UNNAMED_KEY);

  function available() {
    try {
      const probe = 'test-matrix-editor/probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 保存できたら保存した日時（ISO形式の文字列）、容量不足などで保存できなければ null
  function save(fileId, { name, matrix }) {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(keyOf(fileId), JSON.stringify({ version: VERSION, savedAt, name, matrix }));
      return savedAt;
    } catch (e) {
      return null;
    }
  }

  // { name, matrix, savedAt } を返す。保存されたデータが無い・壊れている場合は null
  function load(fileId) {
    try {
      const data = JSON.parse(localStorage.getItem(keyOf(fileId)));
      if (data?.version !== VERSION || !Matrix.isValid(data.matrix)) return null;
      return { name: typeof data.name === 'string' ? data.name : '', matrix: data.matrix, savedAt: data.savedAt };
    } catch (e) {
      return null;
    }
  }

  function clear(fileId) {
    try {
      localStorage.removeItem(keyOf(fileId));
    } catch (e) {
      // 保存領域が使えない環境では、消すものも無い
    }
  }

  return { available, save, load, clear };
})();

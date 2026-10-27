// 名前を付けて保存するデータ入りHTML（要件定義書 5.5.2）
//
// ツールのHTMLの head にある、id が matrix-data の script 要素（src/index.html）に、
// マトリクスのデータをJSONで埋め込む。開いたときは、そこからデータを取り出して復元する。
// （このファイルには、その要素のタグをそのまま書かない。埋め込み場所と見分けがつかなくなるため）
const SaveFile = (() => {
  const matrixOps = typeof module !== 'undefined' ? require('./matrix.js') : Matrix;

  const FORMAT = 'test-matrix-editor';
  const VERSION = 1;
  const DEFAULT_NAME = '無題の試験マトリクス';
  // データを埋め込む要素。この正規表現自体はスクリプトの中では「application\/json」と書かれているため、
  // ツールのスクリプトの文字に誤って一致することはない
  const DATA_ELEMENT = /(<script type="application\/json" id="matrix-data">)([\s\S]*?)(<\/script>)/;

  function newFileId() {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return `f-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  function createData({ fileId, name, matrix, toolVersion, savedAt = new Date().toISOString() }) {
    return { format: FORMAT, version: VERSION, toolVersion, fileId, name, savedAt, matrix };
  }

  function isValidData(data) {
    return (
      !!data &&
      data.format === FORMAT &&
      Number.isInteger(data.version) && data.version <= VERSION &&
      typeof data.fileId === 'string' && data.fileId !== '' &&
      typeof data.name === 'string' &&
      typeof data.savedAt === 'string' &&
      matrixOps.isValid(data.matrix)
    );
  }

  // ツールのHTML（source）にデータを埋め込んだHTMLを返す。すでにデータがあれば差し替える
  function embed(source, data) {
    if (!DATA_ELEMENT.test(source)) throw new Error('データを埋め込む場所が見つかりません');
    // データの中に script の終了タグの文字があっても途中で終わらないよう、< をエスケープする
    // （このコメントにも終了タグそのものは書けない。HTMLに埋め込むとスクリプトがそこで終わるため）
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return source.replace(DATA_ELEMENT, (_, open, __, close) => `${open}${json}${close}`);
  }

  // 埋め込まれた要素の中身（JSON）からデータを取り出す。無い・壊れているときは null
  function parseData(text) {
    if (!text || !text.trim()) return null;
    try {
      const data = JSON.parse(text);
      return isValidData(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  // HTMLの文字列からデータを取り出す（古い版で保存したHTMLの読み込みに使う）
  function extract(html) {
    const match = String(html).match(DATA_ELEMENT);
    return match ? parseData(match[2]) : null;
  }

  // ファイル名に使えない文字は全角に置き換える
  function fileName(name) {
    const half = '\\/:*?"<>|';
    const full = '＼／：＊？＂＜＞｜';
    const safe = String(name).trim().replace(/[\\/:*?"<>|]/g, (ch) => full[half.indexOf(ch)]);
    return `${safe || DEFAULT_NAME}.html`;
  }

  // 保存したHTMLを開いたとき、ファイルの内容（embedded）と自動保存（autosaved）のどちらを使うか。
  // 自動保存のほうが新しく、内容も違うときだけ 'ask'（利用者に選んでもらう）
  function chooseOnOpen(embedded, autosaved) {
    if (!autosaved || autosaved.savedAt <= embedded.savedAt) return 'file';
    const same = autosaved.name === embedded.name && JSON.stringify(autosaved.matrix) === JSON.stringify(embedded.matrix);
    return same ? 'file' : 'ask';
  }

  return { createData, embed, parseData, extract, fileName, chooseOnOpen, newFileId, DEFAULT_NAME };
})();

if (typeof module !== 'undefined') module.exports = SaveFile;

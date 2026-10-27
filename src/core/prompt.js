// AIへの指示文（要件定義書 5.7）。指示文の本文は docs/ai-prompt.md から、ビルド時に埋め込む
const Prompt = (() => {
  const format = typeof module !== 'undefined' ? require('./markdown.js') : MarkdownFormat;
  const PLACEHOLDER = '{{MATRIX}}';

  // 指示文の {{MATRIX}} を、左側の条件だけの表（試験の列は0列）に置き換える。
  // AIが試験の列を作るため、画面に試験の列があっても渡さない
  function build(template, matrix) {
    const conditions = { ...matrix, testCount: 0, rows: matrix.rows.map((row) => ({ ...row, marks: [] })) };
    return template.replace(PLACEHOLDER, () => format.serialize(conditions).trimEnd());
  }

  // docs/ai-prompt.md の「````text」で囲まれた部分を指示文として取り出す
  function extract(markdown) {
    const match = markdown.match(/^````text\r?\n([\s\S]*?)\r?\n````$/m);
    if (!match) throw new Error('ai-prompt.md に ````text で囲まれた指示文がありません');
    if (!match[1].includes(PLACEHOLDER)) throw new Error(`指示文に ${PLACEHOLDER} がありません`);
    return match[1];
  }

  return { build, extract, PLACEHOLDER };
})();

if (typeof module !== 'undefined') module.exports = Prompt;

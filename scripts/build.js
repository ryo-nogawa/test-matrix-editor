// src/ のファイルを1つのHTMLにまとめて dist/ に出力する
// 使い方：node scripts/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist', 'test-matrix-editor.html');

// 読み込む順番が意味を持つため、ファイルはここに順番どおりに並べる
const STYLES = ['styles.css'];
const SCRIPTS = [
  'core/marks.js',
  'core/markdown.js',
  'core/matrix.js',
  'core/checks.js',
  'core/history.js',
  'ui/table.js',
  'ui/editing.js',
  'app.js',
];

const STYLES_MARK = '/* @STYLES */';
const SCRIPTS_MARK = '/* @SCRIPTS */';

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

function build() {
  const template = read('index.html');
  for (const mark of [STYLES_MARK, SCRIPTS_MARK]) {
    if (!template.includes(mark)) throw new Error(`index.html に ${mark} がありません`);
  }

  const css = STYLES.map((f) => `/* ---- ${f} ---- */\n${read(f)}`).join('\n');
  const js = SCRIPTS.map((f) => `// ---- ${f} ----\n${read(f)}`).join('\n');
  // スクリプトの中に </script> があると、そこでHTMLのscriptタグが終わってしまう
  if (/<\/script/i.test(js)) throw new Error('スクリプトの中に </script> が含まれています');

  // 置き換え後の文字列に $ が含まれても壊れないよう、関数で置き換える
  const html = template.replace(STYLES_MARK, () => css).replace(SCRIPTS_MARK, () => js);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) {
  const out = build();
  console.log(`ビルド完了：${path.relative(ROOT, out)}`);
}

module.exports = { build, OUT };

// 印の定義と、読み込み時の表記揺れの正規化（書式仕様書 4.3・5章）
const Marks = (() => {
  const CIRCLE = '○'; // U+25CB
  const DASH = '−'; // U+2212 マイナス記号
  const BLANK = '';

  // 正規化後の印 → 読み込みで受け付ける文字
  const VARIANTS = {
    [CIRCLE]: ['○', '◯', '〇', 'O', 'o'],
    [DASH]: ['−', '-', '‐', '–', '—', '―', 'ー', 'ｰ', '－'],
  };

  const LOOKUP = new Map();
  for (const [mark, chars] of Object.entries(VARIANTS)) {
    for (const ch of chars) LOOKUP.set(ch, mark);
  }

  // セルの文字を印に変換する。どれにも当てはまらない文字は変換せず known: false を返す
  function normalizeMark(raw) {
    const text = String(raw).trim(); // trim は全角の空白も取り除く
    if (text === '') return { mark: BLANK, known: true };
    if (LOOKUP.has(text)) return { mark: LOOKUP.get(text), known: true };
    return { mark: text, known: false };
  }

  return { CIRCLE, DASH, BLANK, normalizeMark };
})();

if (typeof module !== 'undefined') module.exports = Marks;

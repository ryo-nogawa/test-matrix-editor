// テストで共通に使うデータ（公開リポジトリのため、架空のログインAPIの例を使う）
const HEADERS = ['種類', '対象', '項目', 'パターン'];
const LOGIN_ROWS = [
  [['入力', 'ログインAPI', 'リクエスト', '必須項目あり'], 'login()'],
  [['機能', '会員確認', '会員情報の検索', '見つかる'], 'true'],
  [['機能', '会員確認', '会員情報の検索', '見つからない'], 'false'],
  [['機能', '状態確認', 'アカウント状態', 'ロック中'], 'locked'],
  [['出力', 'レスポンス', '結果コード', 'エラー'], 'ERR'],
];

// ログインAPIの例のマトリクス。marksByRow を省略すると試験の列は0列
function loginMatrix(marksByRow = LOGIN_ROWS.map(() => []), { withIds = false } = {}) {
  return {
    headers: [...HEADERS],
    valueHeader: '具体値',
    testCount: marksByRow[0].length,
    rows: LOGIN_ROWS.map(([levels, value], i) => ({
      ...(withIds ? { id: `r${i + 1}` } : {}),
      levels: [...levels],
      value,
      marks: [...marksByRow[i]],
    })),
  };
}

// 関数が元のデータを書き換えていないことを確かめるため、データを凍結する
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(obj);
}

module.exports = { HEADERS, LOGIN_ROWS, loginMatrix, deepFreeze };

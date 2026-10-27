# CLAUDE.md

試験マトリクス作成支援ツール。ブラウザで試験マトリクスの条件を編集し、外部のAIとMarkdownでやり取りする1ファイルのHTMLツール。

## ドキュメント

- 要件：[docs/requirements.md](docs/requirements.md)
- Markdownの書式：[docs/markdown-format.md](docs/markdown-format.md)
- AIへの指示文：[docs/ai-prompt.md](docs/ai-prompt.md)
- 実装計画：[docs/implementation-plan.md](docs/implementation-plan.md)

## コマンド

```bash
npm run build   # src/ を dist/test-matrix-editor.html にまとめる
npm test        # node:test で test/**/*.test.js を実行
```

- 配布物は `dist/test-matrix-editor.html` の1ファイル。外部ライブラリ・CDN・npmパッケージは使わない
- `src/` を変更したら、ビルドして `dist/` も一緒にコミットする

## 動作確認

- 本番の動作環境は Microsoft Edge だが、**動作確認は Chrome で行い、問題がなければOKと判断してよい**（EdgeとChromeは同じChromiumエンジンのため）。Edgeの実機確認は不要
- `file://` で開いたときの挙動（localStorage など）は、ヘッドレスChromeで確認する。`--user-data-dir` を変えなければ、起動をまたいだ保存も確認できる

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=<一時フォルダ> --dump-dom file:///<絶対パス>/dist/test-matrix-editor.html
```

- アプリ内のブラウザペインは `data:` URLとして開くため、localStorage が使えない。見た目の確認だけに使う

## 公開リポジトリの注意

- このリポジトリはパブリック。ドキュメント・テストデータ・サンプルには、**架空の例（ログインAPIなど）だけ**を使う
- 実在の業務システムの名前、処理名、社内の情報を書かない

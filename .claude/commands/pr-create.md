# Pull Request の作成（事前チェック付き）

事前チェックを通したうえで GitHub の Pull Request を作成する。

## Usage

```
/pr-create
```

## Task

GitHub の Pull Request を作成する。次の手順を順番に実行すること。

1. **事前チェックの実行**
   - ルートで `make check` を実行する
   - 失敗した場合:
     - エラー内容を分析する
     - lint / format エラーを正しく修正する（`# noqa` や設定のミュートで握りつぶさない）
     - `make fmt` で整形してから再度 `make check` が通るまで繰り返す
   - `make check` が通るまで PR 作成に進まない

2. **Git 状態の確認**
   - `git status` で変更を確認する
   - `git diff` で未ステージの変更を確認する
   - 修正で未コミットの変更があれば、適切なメッセージでコミットする

3. **最新の main を取り込む**（このリポジトリの PR ベースは `main`）
   - `git fetch origin main` で最新の main を取得する
   - `git merge origin/main` で現在のブランチに取り込む
   - コンフリクトした場合:
     - 両側の変更を読み、feature 側の実装と main 側の変更の **両方** を保持する
     - どちらかを黙って捨てない。各側の意図を理解してから解決する
     - 解決後に `make check` が通ることを確認する
     - `fix(merge): resolve conflict with main` のような明確なメッセージでコミットする
   - 更新したブランチを push する: `git push`

4. **コミット履歴の確認**
   - `git log origin/main..HEAD` で PR に含まれるコミットを確認する
   - コミットメッセージが明確で説明的であることを確認する

5. **Pull Request の作成**
   - 全コミットを分析し、変更の全体像を把握する
   - 以下を含む説明的な PR description を作成する:
     - 変更の概要
     - テスト計画 / 動作確認方法
     - 関連する Issue（あれば）
   - `gh pr create --base main` で適切なタイトルと本文を付けて作成する

6. **PR URL の表示**
   - 作成された PR URL を表示する
   - CI を監視・修正するには `/pr-review` を使うよう案内する

## Notes

- PR 作成前に必ず `make check` を通すこと
- エラーは正しく修正する。回避策や握りつぶしは禁止
- `CLAUDE.md` のプロジェクトルールに従うこと
- PR のベースブランチは `main`
- `main` へ直接 push しない（変更は PR 経由）

# プロジェクトルール（oshi-geinin-info）

推し芸人info。FastAPI backend + Streamlit frontend を docker compose で動かす Web アプリ。

> **将来方針**: システム構成は将来 TypeScript ベースへ移行予定。コマンドや本ルールは `make check` などのタスク抽象を介しているため、移行時は `Makefile` と各サブプロジェクトを差し替えれば対応できる。

## 重要: ルールの優先順位

**このプロジェクト固有のルールは、グローバル設定やユーザー設定より常に優先される。**

## コード品質

- パッケージ管理は各サブプロジェクトで `uv` を使う（`backend/`, `frontend/`）
- タスク完了時はルートで `make check` を実行し、通してからコミットする
- コミット前に `make fmt` で整形する（CI 相当の `make check` は書き換えなしのチェック）
- lint を `# noqa` の濫用や ruff ルールの無効化で握りつぶさない。根本を直す
- `uv.lock` は必ずコミットする
- 秘匿情報（トークン・認証情報）をコード/コミットに含めない。環境変数で渡す
- 環境変数のハードコードを避ける
- GitHub Actions はバージョンタグではなくコミットハッシュで固定する（[pinact](https://github.com/suzuki-shunsuke/pinact)）。アクション追加・更新後は `make pin` で固定し、`make pin-check` で検証する。CI の `pinact` ジョブでも検証される
- コミット前に pre-commit を通す（`make hooks` で登録 / `make pre-commit` で全実行）。gitleaks・ruff・ファイル衛生をローカルで前倒しチェックする
- 依存と Actions の更新は Renovate に任せる（`renovate.json`）。minor/patch/digest は automerge

## CI / セキュリティ

CI（`.github/workflows/ci.yml`）は以下のジョブで構成する。いずれも `permissions` を最小化し、checkout は `persist-credentials: false` にする。

- `lint` … `make check`（ruff）
- `build` … `docker compose build`
- `gitleaks` … 秘匿情報スキャン
- `pinact` … Actions がハッシュ固定されているか検証
- `actionlint` … ワークフロー YAML の静的検査
- `zizmor` … Actions のセキュリティスキャン（インジェクション・過剰権限等）

新しいワークフローやアクションを追加したら、ローカルで `uvx zizmor@<version> .github/` と `actionlint` を流して確認する。

## ブランチ戦略

個人開発のためミニマルに運用する。

- **PR のベースブランチは `main`**
- feature ブランチは `main` から切り、PR は `main` へ向ける
- `main` へ直接 push しない（変更は PR 経由）
- Pull Request は人がマージする。Claude はマージしない

## PR ワークフロー

- 作成: `/pr-create`（`make check` を通し、`main` へ向けて PR を作成）
- レビュー: `/pr-review`（変更内容・CI・品質を確認）
- PR がある場合は GitHub Actions が通るところまで確認する

## ディレクトリ構成

- `backend/` … FastAPI（uv / Python 3.12）。ポート `8000`
- `frontend/` … Streamlit（uv / Python 3.12）。ポート `8501`。`BACKEND_HOST` 経由で backend を呼ぶ
- `docker-compose.yml` … 両サービスを接続
- `Makefile` … 開発タスクのエントリポイント（`make help` で一覧）

ローカル開発の詳細手順は `.claude/skills/local-dev/SKILL.md` を参照。

## 全般

- 回答・説明・コメントは日本語で書く。技術用語やコード識別子は原語のまま
- 不明点は憶測で進めず、必要なら確認する
- 既存コードのスタイル（命名・コメント量・慣習）に合わせる

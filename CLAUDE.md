# プロジェクトルール（oshi-geinin-info）

推し芸人ライブ通知アプリ。お笑いチケットサイトをクロールし、お気に入り芸人の新着ライブを LINE で通知する Web アプリ。

Turborepo monorepo（pnpm）で構成する。

- `apps/web` … Next.js（App Router）フロント + API ルート
- `packages/crawler` … Crawlee / cheerio クローラー（AWS Lambda）
- `packages/db` … Prisma スキーマ + PrismaClient
- `packages/shared` … 共通ユーティリティ
- `infra` … SST（AWS Lambda + EventBridge）

## 重要: ルールの優先順位

**このプロジェクト固有のルールは、グローバル設定やユーザー設定より常に優先される。**

## コード品質

- パッケージ管理は `pnpm`（workspace）。タスク実行は `turbo` 経由
- タスク完了時はルートで `make check`（= `lint` + `fmt-check` + `knip`）を通してからコミットする
- コミット前に `make fmt` で整形する（oxfmt + oxlint --fix）。CI 相当の `make check` は書き換えなしのチェック
- lint（oxlint）をルール無効化や安易な disable コメントで握りつぶさない。根本を直す
- 未使用のファイル / 依存 / export は `knip` で検出し放置しない。実行時のみ必要な依存は `knip.json` の `ignoreDependencies` に理由付きで登録する
- `pnpm-lock.yaml` は必ずコミットする
- 秘匿情報（トークン・認証情報）をコード/コミットに含めない。環境変数で渡す
- 環境変数のハードコードを避ける
- ツールのバージョンは `package.json` の devDependencies で固定する（oxlint / oxfmt / knip）
- GitHub Actions はバージョンタグではなくコミットハッシュで固定する（[pinact](https://github.com/suzuki-shunsuke/pinact)）。アクション追加・更新後は `make pin` で固定し、`make pin-check` で検証する。CI の `pinact` ジョブでも検証される
- コミット前に pre-commit を通す（`make hooks` で登録 / `make pre-commit` で全実行）。gitleaks・oxlint/oxfmt・ファイル衛生をローカルで前倒しチェックする
- 依存（npm）と GitHub Actions の更新は Dependabot に任せる（`.github/dependabot.yml`、weekly）。pre-commit フックは対象外なので `make update-hooks` で更新する

## CI / セキュリティ

CI（`.github/workflows/ci.yml`）は以下のジョブで構成する。いずれも `permissions` を最小化し、checkout は `persist-credentials: false` にする。必須チェックは集約 gate（`ci` / `security`）のみで、個別ジョブはどちらかの `needs` に必ず加える。

- `lint` … `make check`（oxlint + oxfmt + knip）
- `build` … `pnpm build`（turbo）
- `test` … `pnpm test`（turbo / vitest）
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

## 開発タスク

`Makefile` が開発タスクのエントリポイント（`make help` で一覧）。

- `make install` … 依存インストール（`pnpm install`）
- `make dev` … **ワンコマンド起動**: ローカル Postgres(Docker) 起動 → スキーマ反映 → 開発サーバ（turbo）
- `make db-up` / `make db-down` / `make db-reset` / `make db-seed` … ローカル DB 操作
- `make build` / `make test` … ビルド / テスト（turbo）
- `make check` … PR 前ゲート（lint + fmt-check + knip）
- `make fmt` … 整形（oxfmt + oxlint --fix）

ローカル DB は `compose.yaml` の Postgres（`localhost:55432`）。web（Next.js）が **フロント + API** を兼ねるため別の backend サーバは無く、クローラーは Lambda バッチ。本番 DB は Supabase。詳細は `.claude/skills/local-dev/SKILL.md` を参照。

## 全般

- 回答・説明・コメントは日本語で書く。技術用語やコード識別子は原語のまま
- 不明点は憶測で進めず、必要なら確認する
- 既存コードのスタイル（命名・コメント量・慣習）に合わせる

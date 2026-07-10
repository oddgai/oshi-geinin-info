---
name: local-dev
description: oshi-geinin-info のローカル開発手順。pnpm + turbo の Turborepo monorepo（Next.js / Crawlee / Prisma / SST）を起動し、依存追加・lint/format・未使用検出・PR 前チェックを行う方法。アプリの起動・動作確認・依存追加・コード整形を行うときに使用する。
---

# Local Development

Turborepo monorepo（pnpm + turbo）のローカル開発手順。

## When to Apply

- アプリを起動して動作確認する
- 依存パッケージを追加・更新する
- lint / format / 未使用検出を実行する、または PR 前にチェックする

## 構成

- `apps/web` … Next.js（App Router）フロント + API ルート
- `packages/crawler` … Crawlee / cheerio クローラー（AWS Lambda ハンドラ）
- `packages/db` … Prisma スキーマ + PrismaClient（Supabase / PostgreSQL）
- `packages/shared` … 共通ユーティリティ（日時・料金パース等）
- `infra` … SST（AWS Lambda + EventBridge）
- ルートの `Makefile` … 開発タスクのエントリポイント

パッケージマネージャは `pnpm`（`packageManager` フィールドで固定）。`pnpm-workspace.yaml` で workspace を定義する。

## セットアップ・起動（ワンコマンド）

前提: Docker が起動していること。`.env` を用意する（`cp .env.example .env` して LINE 認証情報を設定）。

```bash
make install   # 依存インストール（初回のみ。allowBuilds は pnpm-workspace.yaml で制御）
make dev       # DB 起動(Docker) → スキーマ反映 → 開発サーバ を一括で起動
```

`make dev` は内部で `db-up`（Docker Compose で Postgres 起動 + healthy 待機）→ `prisma db push` → `turbo dev` を順に実行する。

- web: http://localhost:3000 （Next.js が **フロント + API** の両方を担う。別の backend サーバは無い）
- クローラー（`packages/crawler`）は AWS Lambda のバッチ処理で、ローカルで常駐起動するものではない

初回や空データ時はテスト用の芸人データを投入する:

```bash
make db-seed   # 芸人のシードデータ投入
```

## DB（Prisma / ローカル Postgres）

ローカル DB は `compose.yaml` の Postgres（`localhost:55432`）。`make dev` が自動で起動する。

```bash
make db-up     # Postgres だけ起動（Docker Compose）
make db-down   # 停止（データは名前付きボリュームに保持）
make db-reset  # ボリューム削除 → 起動 → schema 反映 → seed（作り直し）
make db-seed   # テスト用芸人データ投入

# Prisma 個別操作
pnpm --filter @oshi-geinin/db db:push      # スキーマ反映
pnpm --filter @oshi-geinin/db db:generate  # Client 生成（build でも自動実行）
```

スキーマは `packages/db/prisma/schema.prisma`。`turbo build` は `@oshi-geinin/db#build`（= `prisma generate`）に依存するため、build/test 前に Client が生成される。本番の DB は Supabase を使う。

## 依存の追加

```bash
pnpm --filter @oshi-geinin/web add <package>        # 特定 workspace に追加
pnpm --filter @oshi-geinin/web add -D <package>     # 開発用依存
pnpm add -Dw <package>                              # ルート（リポ全体のツール）に追加
```

`pnpm-lock.yaml` は必ずコミットする。

## lint / format / 未使用検出

oxlint（lint）+ oxfmt（format）+ knip（未使用検出）を `make` 経由で実行する。

```bash
make lint   # oxlint --max-warnings=0
make fmt    # oxfmt --write + oxlint --fix（コミット前に実行）
make knip   # 未使用のファイル / 依存 / export を検出
make check  # lint + fmt-check + knip（PR 前のゲート・書き換えなし）
make build  # turbo build
make test   # turbo test（vitest）
```

設定: `.oxlintrc.json` / `.oxfmtrc.json` / `knip.json`。ツールのバージョンは `package.json` の devDependencies で固定する。実行時のみ必要で静的 import されない依存（例: `@sparticuz/chromium`、SST の `aws-cdk-lib`）は `knip.json` の `ignoreDependencies` に登録する。

## pre-commit

コミット前に gitleaks・oxlint/oxfmt・ファイル衛生（末尾空白 / EOF / 巨大ファイル禁止 / 改行コード）を実行する。

```bash
make hooks       # フックを登録（初回のみ。内部は uvx pre-commit install）
make pre-commit  # 全ファイルに対して手動実行
```

設定は `.pre-commit-config.yaml`。`rev` はコミットハッシュ固定。oxlint/oxfmt は `repo: local` で pnpm の devDependencies を使う。フレームワーク側フックの更新は `make update-hooks`（`pre-commit autoupdate --freeze`）で行う（Dependabot は pre-commit 対象外）。

## GitHub Actions のセキュリティ検査

ワークフローを追加・変更したら、push 前にローカルで検査できる（CI の `actionlint` / `zizmor` ジョブと同等）。

```bash
uvx zizmor@1.26.1 .github/   # セキュリティスキャン（GH_TOKEN を渡すと精度向上）
actionlint                   # YAML 静的検査（brew install actionlint）
```

## 依存・Actions の更新（Dependabot）

`.github/dependabot.yml` で GitHub Actions と npm 依存（pnpm workspace 全体）の更新 PR を weekly で自動生成する。
GitHub 純正なのでアプリのインストールは不要。pre-commit フレームワークのフックは Dependabot の対象外なので `make update-hooks` で更新する。

## GitHub Actions の固定（pinact）

Actions はサプライチェーン対策としてコミットハッシュで固定する（[pinact](https://github.com/suzuki-shunsuke/pinact)）。

```bash
brew install suzuki-shunsuke/pinact/pinact  # 初回のみ
make pin        # .github/workflows/* のアクションをハッシュに固定
make pin-check  # 固定済みか検証（CI の pinact ジョブと同等）
```

`make pin` は GitHub API を叩くため、レート制限に当たる場合は `GITHUB_TOKEN=$(gh auth token) make pin` のようにトークンを渡す。

## PR を出すとき

`/pr-create` コマンドを使う（内部で `make check` を通し、`main` へ向けて PR を作成する）。
レビューは `/pr-review`。詳細は `CLAUDE.md` のブランチ戦略を参照。

# oshi-geinin-info

推し芸人ライブ通知アプリ。お笑いチケットサイトをクロールし、お気に入り芸人の新着ライブを LINE で通知する Web アプリ。

## 構成

Turborepo monorepo（pnpm + turbo）。

| パッケージ | 役割 |
|-----------|------|
| `apps/web` | Next.js（App Router）フロント + API ルート |
| `packages/crawler` | Crawlee / cheerio クローラー（AWS Lambda ハンドラ。fany / yoshimoto / zaiko / tiget / eplus の 5 サイト対応） |
| `packages/db` | Prisma スキーマ + PrismaClient（Supabase / PostgreSQL） |
| `packages/shared` | 共通ユーティリティ（日時・料金パース等） |
| `infra` | SST（AWS Lambda + EventBridge スケジュール） |

**技術スタック**: TypeScript / Next.js / Prisma / Crawlee / Supabase / SST / NextAuth.js (LINE) / LINE Messaging API

設計・実装計画は [`docs/`](./docs) を参照。

## セットアップ

前提: Node.js 20+、pnpm（`packageManager` フィールドで固定）。

```bash
make install                       # 依存インストール（= pnpm install）
cp .env.example .env               # 環境変数を設定（DATABASE_URL / LINE / NextAuth）
pnpm --filter @oshi-geinin/db db:push    # スキーマを Supabase に反映
pnpm --filter @oshi-geinin/db db:seed    # テスト用芸人データ投入（任意）
```

## 開発

```bash
make dev      # 開発サーバ起動（turbo dev）。web: http://localhost:3000
make build    # ビルド（turbo）
make test     # テスト（turbo / vitest）
make check    # PR 前ゲート: lint(oxlint) + fmt-check(oxfmt) + knip
make fmt      # 整形（oxfmt + oxlint --fix）
make help     # タスク一覧
```

詳細な開発手順は [`.claude/skills/local-dev/SKILL.md`](./.claude/skills/local-dev/SKILL.md)、開発ルールは [`CLAUDE.md`](./CLAUDE.md) を参照。

## CI / デプロイ

- **CI**（`.github/workflows/ci.yml`）: `lint` / `build` / `test` と security 群（gitleaks / pinact / actionlint / zizmor）を集約 gate（`ci` / `security`）で束ねる。
- **デプロイ**（`.github/workflows/deploy.yml`、`main` への push）: web を Vercel、クローラー / スケジュールを SST で AWS にデプロイ。

クローラーは EventBridge により毎朝 JST 9:00 に各サイトを巡回し、新着ライブを検知して LINE 通知する。オンライン配信は終了前日にリマインドを送る。

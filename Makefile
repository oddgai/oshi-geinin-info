.DEFAULT_GOAL := help

# TS monorepo（pnpm + turbo）。lint/format は oxlint / oxfmt、未使用検出は knip。
# ツールのバージョンは package.json の devDependencies で固定する
# （非固定だと新リリースで「無変更なのに CI が落ちる」事故が起きるため）。
PNPM := pnpm

# docker compose（プラグイン）か docker-compose（スタンドアロン）を自動選択する
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: help
help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## 依存をインストール
	$(PNPM) install

.PHONY: db-up
db-up: ## ローカル Postgres を起動（Docker Compose、healthy まで待機）
	$(COMPOSE) up -d --wait

.PHONY: db-down
db-down: ## ローカル Postgres を停止（データは保持）
	$(COMPOSE) down

.PHONY: db-reset
db-reset: ## DB を作り直す（ボリューム削除 → 起動 → スキーマ反映 → seed）
	$(COMPOSE) down -v
	$(COMPOSE) up -d --wait
	$(PNPM) --filter @oshi-geinin/db db:push
	$(PNPM) --filter @oshi-geinin/db db:seed

.PHONY: db-seed
db-seed: ## テスト用データ（芸人）を投入
	$(PNPM) --filter @oshi-geinin/db db:seed

.PHONY: check
check: lint fmt-check knip ## PR 前のゲート（lint + format チェック + 未使用検出）

.PHONY: lint
lint: ## oxlint で lint（警告も許容しない）
	$(PNPM) lint

.PHONY: fmt
fmt: ## oxfmt で整形 + oxlint --fix（コミット前に実行）
	$(PNPM) format
	$(PNPM) lint:fix

.PHONY: fmt-check
fmt-check: ## 整形済みかチェック（CI 相当・書き換えなし）
	$(PNPM) format:check

.PHONY: knip
knip: ## 未使用のファイル / 依存 / export を検出
	$(PNPM) knip

.PHONY: build
build: ## ビルド（turbo）
	$(PNPM) build

.PHONY: test
test: ## テスト（turbo）
	$(PNPM) test

.PHONY: dev
dev: db-up ## ワンコマンド起動: DB 起動 → スキーマ反映 → 開発サーバ（turbo）
	$(PNPM) --filter @oshi-geinin/db db:push
	$(PNPM) dev

.PHONY: hooks
hooks: ## pre-commit フックを登録（初回のみ）
	uvx pre-commit install

.PHONY: pre-commit
pre-commit: ## pre-commit を全ファイルに実行
	uvx pre-commit run --all-files

.PHONY: update-hooks
update-hooks: ## pre-commit フックの rev を更新（ハッシュ固定を維持）
	uvx pre-commit autoupdate --freeze

.PHONY: pin
pin: ## GitHub Actions をコミットハッシュに固定（pinact）
	pinact run

.PHONY: pin-check
pin-check: ## Actions が固定済みか検証（書き換えなし・CI 相当）
	pinact run --check --verify

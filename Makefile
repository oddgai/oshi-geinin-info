.DEFAULT_GOAL := help

# TS monorepo（pnpm + turbo）。lint/format は oxlint / oxfmt、未使用検出は knip。
# ツールのバージョンは package.json の devDependencies で固定する
# （非固定だと新リリースで「無変更なのに CI が落ちる」事故が起きるため）。
PNPM := pnpm

.PHONY: help
help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## 依存をインストール
	$(PNPM) install

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
dev: ## 開発サーバを起動（turbo）
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

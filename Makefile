.DEFAULT_GOAL := help

# ruff は uvx でオンデマンド取得・実行する（ローカルへの追加インストール不要）。
# バージョンは .pre-commit-config.yaml の ruff-pre-commit と揃えて固定する
# （非固定だと ruff の新リリースで「無変更なのに CI が落ちる」事故が起きるため）。
RUFF := uvx ruff@0.15.19

.PHONY: help
help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: check
check: lint fmt-check ## PR 前のゲート（lint + format チェック）

.PHONY: lint
lint: ## ruff で lint
	$(RUFF) check .

.PHONY: fmt
fmt: ## ruff で自動整形（コミット前に実行）
	$(RUFF) format .
	$(RUFF) check --fix .

.PHONY: fmt-check
fmt-check: ## 整形済みかチェック（CI 相当・書き換えなし）
	$(RUFF) format --check .

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

.PHONY: up
up: ## docker compose で起動
	docker compose up

.PHONY: down
down: ## docker compose を停止・削除
	docker compose down --rmi all --volumes --remove-orphans

.DEFAULT_GOAL := help

# ruff はネットワーク経由で uvx により取得・実行する（ローカルへの追加インストール不要）
RUFF := uvx ruff

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

.PHONY: up
up: ## docker compose で起動
	docker compose up

.PHONY: down
down: ## docker compose を停止・削除
	docker compose down --rmi all --volumes --remove-orphans

---
name: local-dev
description: oshi-geinin-info のローカル開発手順。FastAPI backend と Streamlit frontend を docker compose で起動し、依存追加・lint/format・PR 前チェックを行う方法。アプリの起動・動作確認・依存追加・コード整形を行うときに使用する。
---

# Local Development

FastAPI backend + Streamlit frontend を docker compose で動かすプロジェクトのローカル開発手順。

## When to Apply

- アプリを起動して動作確認する
- 依存パッケージを追加・更新する
- lint / format を実行する、または PR 前にチェックする

## 構成

- `backend/` … FastAPI（uv 管理、Python 3.12）。ポート `8000`
- `frontend/` … Streamlit（uv 管理、Python 3.12）。ポート `8501`。`BACKEND_HOST` 経由で backend を呼ぶ
- `docker-compose.yml` … 両サービスを `fastapi_streamlit_network` で接続
- ルートの `Makefile` … 開発タスクのエントリポイント

> 将来的に TypeScript への移行を予定。コマンド/CLAUDE.md は `make check` などのタスク抽象を介しているため、移行時は Makefile と各サブプロジェクトのみ差し替えれば済む設計。

## 起動・停止

```bash
make up    # docker compose up
make down  # コンテナ・イメージ・ボリュームを削除して停止
```

起動後:

- backend: http://localhost:8000 （`/`, `/hello`、docs は `/docs`）
- frontend: http://localhost:8501

## 依存の追加

各サブプロジェクトで uv を使う（ルートではなく `backend/` か `frontend/` で実行）。

```bash
cd backend  && uv add <package>   # 本体依存
cd frontend && uv add <package>
uv add --dev <package>            # 開発用依存
```

`uv.lock` は必ずコミットする。

## lint / format

ruff を `make` 経由で実行する（ruff 本体は `uvx` でオンデマンド取得）。

```bash
make lint       # ruff check
make fmt        # ruff format + check --fix（コミット前に実行）
make check      # lint + format チェック（PR 前のゲート・書き換えなし）
```

## pre-commit

コミット前に gitleaks・ruff・ファイル衛生（末尾空白 / EOF / 巨大ファイル禁止 / 改行コード）を実行する。

```bash
make hooks       # フックを登録（初回のみ。内部は uvx pre-commit install）
make pre-commit  # 全ファイルに対して手動実行
```

設定は `.pre-commit-config.yaml`。`rev` はコミットハッシュ固定で、更新は Renovate が PR を出す。

## GitHub Actions のセキュリティ検査

ワークフローを追加・変更したら、push 前にローカルで検査できる（CI の `actionlint` / `zizmor` ジョブと同等）。

```bash
uvx zizmor@1.26.1 .github/   # セキュリティスキャン（GH_TOKEN を渡すと精度向上）
actionlint                   # YAML 静的検査（brew install actionlint）
```

## 依存・Actions の更新（Renovate）

`renovate.json` で GitHub Actions と pre-commit フックの更新 PR を自動生成する（minor/patch/digest は automerge）。
有効化には対象リポジトリに [Mend Renovate](https://github.com/apps/renovate) アプリのインストールが必要。

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

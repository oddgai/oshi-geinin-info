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

## PR を出すとき

`/pr-create` コマンドを使う（内部で `make check` を通し、`main` へ向けて PR を作成する）。
レビューは `/pr-review`。詳細は `CLAUDE.md` のブランチ戦略を参照。

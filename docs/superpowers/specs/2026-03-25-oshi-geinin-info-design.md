# 推し芸人ライブ通知アプリ 設計書

## 概要

特定のお笑いチケットサイトからライブ情報をクローリングして収集し、ユーザーのお気に入り芸人の新着ライブをLINEで通知するWebアプリケーション。

## 要件

- 5サイトからお笑いライブ情報を1日1回クローリング
- 取得情報：ライブ名、日時、出演者、会場、チケット料金、販売状況、購入リンク
- オンライン/現地ライブは別レコードとして管理
- オンラインライブの見逃し配信終了リマインド通知
- Web画面でお気に入り芸人を登録
- LINE通知で新着ライブをお知らせ
- まず個人用、将来パブリック化・スマホアプリ化の可能性あり

## クローリング対象サイト

1. https://ticket.fany.lol/
2. https://online-ticket.yoshimoto.co.jp/
3. https://zaiko.io/
4. https://tiget.net/
5. https://eplus.jp/sf/play/comedy

## アーキテクチャ

```
[EventBridge (1日1回)]
        │
        ▼
[クローラー Lambda] ──→ 5サイトをスクレイピング
        │
        ▼
[Supabase (PostgreSQL)] ←──→ [Next.js API Routes (Vercel)]
        │                              ▲
        │ 新着あり？                     │
        ▼                              │
[通知 Lambda] ──→ LINE Messaging API   │
                                       │
                              [Next.js フロント (Vercel)]
                              お気に入り登録UI

[EventBridge (1日1回)] ──→ [配信終了リマインドLambda]
```

### 処理フロー

1. EventBridgeが毎朝クローラーLambdaを起動
2. 5サイトからライブ情報を取得 → DBに保存（新規/更新を判定）
3. 新着ライブがお気に入り芸人に該当 → LINE通知
4. 別のEventBridgeスケジュールで配信終了リマインドを1日1回チェック
5. ユーザーはWeb画面でお気に入り芸人の登録・ライブ一覧の確認ができる

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| 言語 | TypeScript（全レイヤー統一） |
| フロント + API | Next.js (App Router) on Vercel |
| DB | Supabase (PostgreSQL) |
| ORM | Prisma |
| クローラー | Crawlee (CheerioCrawler / PlaywrightCrawler をサイトごとに選択) on AWS Lambda |
| スケジューラー | EventBridge (1日1回クロール + 1日1回配信終了リマインド) |
| 通知 | LINE Messaging API |
| 認証 | LINEログイン (NextAuth.js) |
| IaC | SST (AWS CDKベース、Lambda + EventBridgeの管理に最適) |
| monorepo管理 | Turborepo |

### Lambda上でのPlaywright

- `@sparticuz/chromium` パッケージでChromiumをLambda Layer経由で使用
- メモリ1024MB〜に設定
- JSレンダリングが不要なサイトはCheerioCrawlerで軽量に処理
- サイトごとに個別のLambda関数として実行（タイムアウトリスク回避・並列実行可能）

### LINE Messaging API

- LINE公式アカウントのMessaging API（push message）を使用
- ユーザーは公式アカウントを友だち追加 → LINEログインでWeb画面と連携
- LINE Notifyは廃止予定のため使用しない

## データモデル

### artists (芸人)

| カラム | 型 | 説明 |
|-------|-----|------|
| id | UUID | PK |
| name | TEXT | 芸人名 |
| aliases | TEXT[] | 表記揺れ対応（例: ["サンド", "サンドイッチマン"]） |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### lives (ライブ情報)

| カラム | 型 | 説明 |
|-------|-----|------|
| id | UUID | PK |
| title | TEXT | ライブ名 |
| venue | TEXT | 会場名 |
| start_at | TIMESTAMPTZ (nullable) | パースできた場合の開始日時 |
| end_at | TIMESTAMPTZ (nullable) | パースできた場合の終了日時 |
| datetime_text | TEXT | 元の日時表記（例: "開場18:00 / 開演18:30"） |
| type | TEXT | "online" or "offline" |
| streaming_end_at | TIMESTAMPTZ (nullable) | 見逃し配信終了日時（onlineのみ） |
| streaming_end_text | TEXT (nullable) | 配信終了の元表記 |
| related_live_id | UUID (nullable, FK → lives) | 同イベントのオンライン/現地を紐付け |
| ticket_price | TEXT | 元の料金表記 |
| ticket_price_min | INTEGER (nullable) | パースできた場合の最安値（円） |
| ticket_status | TEXT | 販売状況（例: "販売中", "売切", "先行受付中"） |
| ticket_url | TEXT | チケット購入ページURL |
| source_site | TEXT | クロール元サイト（例: "ticket.fany.lol"） |
| source_url | TEXT | 元ページURL（重複判定にも使用） |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### live_artists (ライブ×芸人の中間テーブル)

| カラム | 型 | 説明 |
|-------|-----|------|
| live_id | UUID | FK → lives |
| artist_id | UUID | FK → artists |

### users (ユーザー)

| カラム | 型 | 説明 |
|-------|-----|------|
| id | UUID | PK |
| line_user_id | TEXT | LINE通知用ユーザーID |
| created_at | TIMESTAMPTZ | |

### user_favorite_artists (お気に入り)

| カラム | 型 | 説明 |
|-------|-----|------|
| user_id | UUID | FK → users |
| artist_id | UUID | FK → artists |

### notifications (通知履歴)

| カラム | 型 | 説明 |
|-------|-----|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| live_id | UUID | FK → lives |
| type | TEXT | "new_live" or "streaming_end_reminder" |
| sent_at | TIMESTAMPTZ | |

## クローラー設計

### 共通インターフェース

各スクレイパーが返す共通の型：

```typescript
type LiveData = {
  title: string;
  venue: string;
  datetimeText: string;
  startAt: Date | null;
  endAt: Date | null;
  type: "online" | "offline";
  streamingEndAt: Date | null;
  streamingEndText: string | null;
  ticketPrice: string;
  ticketPriceMin: number | null;
  ticketStatus: string;
  ticketUrl: string;
  sourceUrl: string;
  artistNames: string[];
};
```

### 処理フロー

1. サイトごとのスクレイパーが `LiveData[]` を返す
2. `source_url` で既存データと照合（新規 or 更新）
3. `artistNames` を `artists.name` / `artists.aliases` とマッチングして `live_artists` に紐付け
4. 新規ライブがお気に入り芸人に該当 → 通知対象としてマーク

### 芸人名マッチング

- 完全一致 + aliases一致で対応
- マッチしなかった名前はログに残す
- 将来的にあいまい検索（部分一致等）を追加可能

## API設計

### 認証

- LINEログイン（NextAuth.js）

### エンドポイント

```
# 認証
POST   /auth/line/callback       LINEログインのコールバック

# 芸人
GET    /artists                   芸人一覧（検索・ページネーション付き）
GET    /artists/:id               芸人詳細

# お気に入り
GET    /favorites                  自分のお気に入り芸人一覧
POST   /favorites                  お気に入り追加 { artist_id }
DELETE /favorites/:artist_id       お気に入り解除

# ライブ
GET    /lives                      ライブ一覧（フィルター: artist_id, 日付範囲, type, ソート）
GET    /lives/:id                  ライブ詳細（出演者一覧付き）

# 通知設定（将来拡張用）
GET    /notification-settings
PUT    /notification-settings
```

## フロント画面構成

```
/ (トップ)
├ ログイン前 → LINEログインボタン
├ ログイン後 → お気に入り芸人の新着ライブ一覧（メイン画面）

/lives
├ 全ライブ一覧（検索・フィルター）
├ フィルター: 日付、芸人名、会場、販売状況、オンライン/現地

/lives/:id
├ ライブ詳細（出演者、料金、購入リンク）

/artists
├ 芸人一覧（検索）
├ 各芸人の横にお気に入りトグル

/artists/:id
├ 芸人詳細 + その芸人の今後のライブ一覧

/settings
├ 通知ON/OFF
├ LINE連携状態の確認
```

### メイン画面（ログイン後トップ）

- お気に入り芸人に関するライブが新しい順に並ぶ
- 各ライブカードに：タイトル、日時、会場、出演者、販売状況、オンライン/現地ラベル、購入リンク
- 未通知のものには「NEW」バッジ
- オンラインライブは配信終了日を表示

## 通知設計

| タイミング | 内容 |
|-----------|------|
| 新着ライブ発見時 | 「◯◯が出演するライブが追加されました」+ ライブ詳細 + 購入リンク |
| 見逃し配信終了前（24時間前） | 「◯◯出演の△△の配信が明日終了します」|

重複通知は `notifications` テーブルで防止。

## ディレクトリ構成

```
/
├ apps/
│  └ web/              Next.js (フロント + API Routes)
├ packages/
│  ├ crawler/          クローラー (Lambda用)
│  ├ db/               Prisma schema + 型定義
│  └ shared/           共通型・ユーティリティ
├ infra/               SST
├ turbo.json
└ package.json
```

## 将来の拡張

- パブリック化：認証周りの強化、利用規約等
- スマホアプリ：React Nativeで開発、API Routesをそのままバックエンドとして使用
- 通知手段の追加：メール、プッシュ通知等
- 芸人名のあいまいマッチング強化

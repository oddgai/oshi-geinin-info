# 推し芸人ライブ通知アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** お笑いチケットサイトからライブ情報をクローリングし、お気に入り芸人の新着ライブをLINEで通知するWebアプリを構築する。

**Architecture:** Turborepo monorepoで、Next.js (App Router) フロント+API、Crawlee クローラー (AWS Lambda)、Supabase (PostgreSQL)、LINE Messaging APIを統合。SSTでインフラ管理。

**Tech Stack:** TypeScript, Next.js, Prisma, Crawlee, Supabase, SST, NextAuth.js, LINE Messaging API

**Spec:** `docs/2026-03-25-oshi-geinin-info-design.md`

---

## File Structure

```
/
├ package.json                          # Workspace root
├ turbo.json                            # Turborepo config
├ .gitignore
├ .env.example                          # 環境変数テンプレート
├ apps/
│  └ web/
│     ├ package.json
│     ├ next.config.ts
│     ├ tsconfig.json
│     ├ src/
│     │  ├ app/
│     │  │  ├ layout.tsx                # Root layout
│     │  │  ├ page.tsx                  # トップ（お気に入りライブ一覧）
│     │  │  ├ lives/
│     │  │  │  ├ page.tsx              # ライブ一覧
│     │  │  │  └ [id]/page.tsx         # ライブ詳細
│     │  │  ├ artists/
│     │  │  │  ├ page.tsx              # 芸人一覧
│     │  │  │  └ [id]/page.tsx         # 芸人詳細
│     │  │  ├ settings/
│     │  │  │  └ page.tsx              # 通知設定
│     │  │  └ api/
│     │  │     ├ auth/[...nextauth]/route.ts  # NextAuth handler
│     │  │     ├ artists/
│     │  │     │  ├ route.ts            # GET /api/artists
│     │  │     │  └ [id]/route.ts       # GET /api/artists/:id
│     │  │     ├ favorites/
│     │  │     │  ├ route.ts            # GET, POST /api/favorites
│     │  │     │  └ [artistId]/route.ts # DELETE /api/favorites/:artistId
│     │  │     ├ lives/
│     │  │     │  ├ route.ts            # GET /api/lives
│     │  │     │  └ [id]/route.ts       # GET /api/lives/:id
│     │  │     └ notification-settings/
│     │  │        └ route.ts            # GET, PUT
│     │  ├ lib/
│     │  │  ├ auth.ts                   # NextAuth config (LINE provider)
│     │  │  └ line.ts                   # LINE Messaging API client
│     │  └ components/
│     │     ├ LiveCard.tsx              # ライブカードコンポーネント
│     │     ├ ArtistCard.tsx            # 芸人カードコンポーネント
│     │     ├ FavoriteButton.tsx        # お気に入りトグル
│     │     ├ LiveFilter.tsx            # フィルターUI
│     │     └ Header.tsx               # ヘッダー（ナビ + ログイン）
│     └ __tests__/
│        ├ api/
│        │  ├ artists.test.ts
│        │  ├ favorites.test.ts
│        │  └ lives.test.ts
│        └ components/
│           ├ LiveCard.test.tsx
│           └ FavoriteButton.test.tsx
├ packages/
│  ├ db/
│  │  ├ package.json
│  │  ├ tsconfig.json
│  │  ├ prisma/
│  │  │  ├ schema.prisma              # DB schema
│  │  │  └ seed.ts                     # Seed data (テスト用芸人データ)
│  │  └ src/
│  │     └ index.ts                    # PrismaClient export
│  ├ crawler/
│  │  ├ package.json
│  │  ├ tsconfig.json
│  │  ├ src/
│  │  │  ├ types.ts                    # LiveData type
│  │  │  ├ scrapers/
│  │  │  │  ├ base.ts                 # 共通インターフェース
│  │  │  │  ├ fany.ts                 # ticket.fany.lol
│  │  │  │  ├ yoshimoto.ts           # online-ticket.yoshimoto.co.jp
│  │  │  │  ├ zaiko.ts               # zaiko.io
│  │  │  │  ├ tiget.ts               # tiget.net
│  │  │  │  └ eplus.ts               # eplus.jp
│  │  │  ├ store.ts                   # DB保存ロジック（upsert + 芸人マッチング）
│  │  │  ├ notify.ts                  # 新着通知判定 + LINE送信
│  │  │  ├ handler.ts                 # クローラーLambda handler
│  │  │  └ reminder.ts                # 配信終了リマインドLambda handler
│  │  └ __tests__/
│  │     ├ store.test.ts
│  │     ├ notify.test.ts
│  │     └ scrapers/
│  │        └ fany.test.ts            # 最初のスクレイパーのテスト
│  └ shared/
│     ├ package.json
│     ├ tsconfig.json
│     └ src/
│        └ index.ts                    # 共通ユーティリティ（日時パース等）
├ infra/
│  ├ package.json
│  ├ sst.config.ts                     # SST config
│  └ stacks/
│     └ CrawlerStack.ts               # Lambda + EventBridge定義
└ .github/
   └ workflows/
      └ deploy.yml                     # CI/CD (Vercel + SST deploy)
```

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`, `turbo.json`, `.gitignore`, `.env.example`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`
- Create: `packages/crawler/package.json`, `packages/crawler/tsconfig.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`

- [ ] **Step 1: Initialize root package.json with workspaces**

```json
{
  "name": "oshi-geinin-info",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create packages/db package**

`packages/db/package.json`:
```json
{
  "name": "@oshi-geinin/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6"
  },
  "devDependencies": {
    "prisma": "^6",
    "tsx": "^4"
  }
}
```

- [ ] **Step 4: Create packages/shared package**

`packages/shared/package.json`:
```json
{
  "name": "@oshi-geinin/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 5: Create packages/crawler package**

`packages/crawler/package.json`:
```json
{
  "name": "@oshi-geinin/crawler",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@oshi-geinin/db": "workspace:*",
    "@oshi-geinin/shared": "workspace:*",
    "crawlee": "^3",
    "playwright": "^1",
    "@sparticuz/chromium": "^131"
  },
  "devDependencies": {
    "vitest": "^3"
  }
}
```

- [ ] **Step 6: Create apps/web package**

`apps/web/package.json`:
```json
{
  "name": "@oshi-geinin/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "lint": "next lint"
  },
  "dependencies": {
    "@oshi-geinin/db": "workspace:*",
    "@oshi-geinin/shared": "workspace:*",
    "next": "^15",
    "next-auth": "^4",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6",
    "vitest": "^3",
    "@vitejs/plugin-react": "^4"
  }
}
```

- [ ] **Step 7: Create tsconfig files for each package**

Root `tsconfig.json` and per-package tsconfigs with appropriate `references`.

- [ ] **Step 8: Create .gitignore and .env.example**

`.env.example`:
```
# Supabase
DATABASE_URL=postgresql://...

# LINE
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
```

- [ ] **Step 9: Install dependencies and verify workspace resolution**

Run: `npm install`
Expected: All workspaces resolved, no errors.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: initialize Turborepo monorepo with web, db, crawler, shared packages"
```

---

### Task 2: Database schema (Prisma + Supabase)

**Files:**
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Write Prisma schema**

`packages/db/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Artist {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  aliases   String[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  lives          LiveArtist[]
  favoritedBy    UserFavoriteArtist[]

  @@unique([name])
  @@map("artists")
}

model Live {
  id               String    @id @default(uuid()) @db.Uuid
  title            String
  venue            String
  startAt          DateTime? @map("start_at")
  endAt            DateTime? @map("end_at")
  datetimeText     String    @map("datetime_text")
  type             String    // "online" | "offline"
  streamingEndAt   DateTime? @map("streaming_end_at")
  streamingEndText String?   @map("streaming_end_text")
  relatedLiveId    String?   @map("related_live_id") @db.Uuid
  ticketPrice      String    @map("ticket_price")
  ticketPriceMin   Int?      @map("ticket_price_min")
  ticketStatus     String    @map("ticket_status")
  ticketUrl        String    @map("ticket_url")
  sourceSite       String    @map("source_site")
  sourceUrl        String    @unique @map("source_url")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  relatedLive   Live?          @relation("RelatedLives", fields: [relatedLiveId], references: [id])
  relatedFrom   Live[]         @relation("RelatedLives")
  artists       LiveArtist[]
  notifications Notification[]

  @@map("lives")
}

model LiveArtist {
  liveId   String @map("live_id") @db.Uuid
  artistId String @map("artist_id") @db.Uuid

  live   Live   @relation(fields: [liveId], references: [id], onDelete: Cascade)
  artist Artist @relation(fields: [artistId], references: [id], onDelete: Cascade)

  @@id([liveId, artistId])
  @@map("live_artists")
}

model User {
  id         String   @id @default(uuid()) @db.Uuid
  lineUserId String   @unique @map("line_user_id")
  createdAt  DateTime @default(now()) @map("created_at")

  favorites     UserFavoriteArtist[]
  notifications Notification[]

  @@map("users")
}

model UserFavoriteArtist {
  userId   String @map("user_id") @db.Uuid
  artistId String @map("artist_id") @db.Uuid

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  artist Artist @relation(fields: [artistId], references: [id], onDelete: Cascade)

  @@id([userId, artistId])
  @@map("user_favorite_artists")
}

model Notification {
  id     String   @id @default(uuid()) @db.Uuid
  userId String   @map("user_id") @db.Uuid
  liveId String   @map("live_id") @db.Uuid
  type   String   // "new_live" | "streaming_end_reminder"
  sentAt DateTime @default(now()) @map("sent_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  live Live @relation(fields: [liveId], references: [id], onDelete: Cascade)

  @@map("notifications")
}
```

- [ ] **Step 2: Create PrismaClient export**

`packages/db/src/index.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
```

- [ ] **Step 3: Create seed data**

`packages/db/prisma/seed.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const artists = [
    { name: "サンドウィッチマン", aliases: ["サンド", "サンドイッチマン"] },
    { name: "千鳥", aliases: [] },
    { name: "かまいたち", aliases: [] },
    { name: "ダウンタウン", aliases: ["DT"] },
    { name: "ナイツ", aliases: [] },
  ];

  for (const artist of artists) {
    await prisma.artist.upsert({
      where: { name: artist.name },
      update: { aliases: artist.aliases },
      create: artist,
    });
  }

  console.log("Seed data created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Generate Prisma client and push schema to Supabase**

Run: `cd packages/db && npx prisma generate && npx prisma db push`
Expected: Schema synced to database, client generated.

- [ ] **Step 5: Commit**

```bash
git add packages/db/
git commit -m "feat: add Prisma schema with artists, lives, users, favorites, notifications"
```

---

### Task 3: Shared types and utilities

**Files:**
- Create: `packages/crawler/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create LiveData type**

`packages/crawler/src/types.ts`:
```typescript
export type LiveData = {
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

- [ ] **Step 2: Create shared utilities (date parsing, price parsing)**

`packages/shared/src/index.ts`:
```typescript
/**
 * 日時テキストからDateをパースする。パースできない場合はnullを返す。
 * 例: "2026年4月1日(水) 開場18:00 開演18:30" → Date
 */
export function parseDatetime(text: string): Date | null {
  const match = text.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}

/**
 * 料金テキストから最安値（円）を抽出する。抽出できない場合はnullを返す。
 * 例: "前売3,500円 / 当日4,000円" → 3500
 */
export function parseMinPrice(text: string): number | null {
  const matches = text.match(/[\d,]+(?=円)/g);
  if (!matches || matches.length === 0) return null;
  const prices = matches.map((m) => Number(m.replace(/,/g, "")));
  return Math.min(...prices);
}
```

- [ ] **Step 3: Write tests for shared utilities**

`packages/shared/src/index.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseDatetime, parseMinPrice } from "./index";

describe("parseDatetime", () => {
  it("parses standard format", () => {
    const result = parseDatetime("2026年4月1日(水) 開場18:00 開演18:30");
    expect(result).toEqual(new Date(2026, 3, 1, 18, 0));
  });

  it("returns null for unparseable text", () => {
    expect(parseDatetime("日時未定")).toBeNull();
  });
});

describe("parseMinPrice", () => {
  it("extracts minimum price", () => {
    expect(parseMinPrice("前売3,500円 / 当日4,000円")).toBe(3500);
  });

  it("handles single price", () => {
    expect(parseMinPrice("5,000円")).toBe(5000);
  });

  it("returns null for no price", () => {
    expect(parseMinPrice("料金未定")).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/crawler/src/types.ts packages/shared/
git commit -m "feat: add LiveData type and shared date/price parsing utilities"
```

---

### Task 4: Crawler core - DB store logic

**Files:**
- Create: `packages/crawler/src/store.ts`
- Create: `packages/crawler/__tests__/store.test.ts`

- [ ] **Step 1: Write failing test for store logic**

`packages/crawler/__tests__/store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@oshi-geinin/db";
import { storeLives } from "../src/store";
import type { LiveData } from "../src/types";

describe("storeLives", () => {
  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.liveArtist.deleteMany();
    await prisma.live.deleteMany();
    await prisma.artist.deleteMany();
  });

  it("inserts new lives and returns them as new", async () => {
    await prisma.artist.create({
      data: { name: "サンドウィッチマン", aliases: ["サンド"] },
    });

    const liveData: LiveData[] = [
      {
        title: "お笑いライブ2026",
        venue: "ルミネtheよしもと",
        datetimeText: "2026年4月1日(水) 開演18:30",
        startAt: new Date(2026, 3, 1, 18, 30),
        endAt: null,
        type: "offline",
        streamingEndAt: null,
        streamingEndText: null,
        ticketPrice: "前売3,500円",
        ticketPriceMin: 3500,
        ticketStatus: "販売中",
        ticketUrl: "https://example.com/ticket/1",
        sourceUrl: "https://example.com/live/1",
        artistNames: ["サンドウィッチマン", "千鳥"],
      },
    ];

    const result = await storeLives(liveData, "example.com");
    expect(result.newLives).toHaveLength(1);
    expect(result.newLives[0].title).toBe("お笑いライブ2026");
  });

  it("skips existing lives by source_url", async () => {
    await prisma.live.create({
      data: {
        title: "既存ライブ",
        venue: "会場",
        datetimeText: "日時",
        type: "offline",
        ticketPrice: "無料",
        ticketStatus: "販売中",
        ticketUrl: "https://example.com/ticket/1",
        sourceSite: "example.com",
        sourceUrl: "https://example.com/live/1",
      },
    });

    const liveData: LiveData[] = [
      {
        title: "既存ライブ",
        venue: "会場",
        datetimeText: "日時",
        startAt: null,
        endAt: null,
        type: "offline",
        streamingEndAt: null,
        streamingEndText: null,
        ticketPrice: "無料",
        ticketPriceMin: null,
        ticketStatus: "販売中",
        ticketUrl: "https://example.com/ticket/1",
        sourceUrl: "https://example.com/live/1",
        artistNames: [],
      },
    ];

    const result = await storeLives(liveData, "example.com");
    expect(result.newLives).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/crawler && npx vitest run`
Expected: FAIL - `storeLives` not found.

- [ ] **Step 3: Implement storeLives**

`packages/crawler/src/store.ts`:
```typescript
import { prisma } from "@oshi-geinin/db";
import type { Live } from "@oshi-geinin/db";
import type { LiveData } from "./types";

export async function storeLives(
  livesData: LiveData[],
  sourceSite: string
): Promise<{ newLives: Live[] }> {
  const newLives: Live[] = [];

  for (const data of livesData) {
    const existing = await prisma.live.findUnique({
      where: { sourceUrl: data.sourceUrl },
    });

    if (existing) continue;

    const live = await prisma.live.create({
      data: {
        title: data.title,
        venue: data.venue,
        startAt: data.startAt,
        endAt: data.endAt,
        datetimeText: data.datetimeText,
        type: data.type,
        streamingEndAt: data.streamingEndAt,
        streamingEndText: data.streamingEndText,
        ticketPrice: data.ticketPrice,
        ticketPriceMin: data.ticketPriceMin,
        ticketStatus: data.ticketStatus,
        ticketUrl: data.ticketUrl,
        sourceSite: sourceSite,
        sourceUrl: data.sourceUrl,
      },
    });

    // Match artist names against DB
    await matchAndLinkArtists(live.id, data.artistNames);

    newLives.push(live);
  }

  return { newLives };
}

async function matchAndLinkArtists(
  liveId: string,
  artistNames: string[]
): Promise<void> {
  const allArtists = await prisma.artist.findMany();

  for (const name of artistNames) {
    const matched = allArtists.find(
      (a) =>
        a.name === name || a.aliases.includes(name)
    );

    if (matched) {
      await prisma.liveArtist.create({
        data: { liveId, artistId: matched.id },
      });
    } else {
      console.warn(`Unmatched artist: "${name}"`);
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/crawler && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/crawler/src/store.ts packages/crawler/__tests__/store.test.ts
git commit -m "feat: add storeLives with upsert logic and artist name matching"
```

---

### Task 5: Notification logic

**Files:**
- Create: `packages/crawler/src/notify.ts`
- Create: `packages/crawler/__tests__/notify.test.ts`
- Create: `apps/web/src/lib/line.ts`

- [ ] **Step 1: Write failing test for notification logic**

`packages/crawler/__tests__/notify.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@oshi-geinin/db";
import { findUsersToNotify } from "../src/notify";

describe("findUsersToNotify", () => {
  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.userFavoriteArtist.deleteMany();
    await prisma.liveArtist.deleteMany();
    await prisma.live.deleteMany();
    await prisma.user.deleteMany();
    await prisma.artist.deleteMany();
  });

  it("finds users who favorited artists in a new live", async () => {
    const artist = await prisma.artist.create({
      data: { name: "サンドウィッチマン", aliases: [] },
    });
    const user = await prisma.user.create({
      data: { lineUserId: "U123" },
    });
    await prisma.userFavoriteArtist.create({
      data: { userId: user.id, artistId: artist.id },
    });
    const live = await prisma.live.create({
      data: {
        title: "テストライブ",
        venue: "会場",
        datetimeText: "日時",
        type: "offline",
        ticketPrice: "無料",
        ticketStatus: "販売中",
        ticketUrl: "https://example.com",
        sourceSite: "example.com",
        sourceUrl: "https://example.com/live/1",
      },
    });
    await prisma.liveArtist.create({
      data: { liveId: live.id, artistId: artist.id },
    });

    const result = await findUsersToNotify(live.id);
    expect(result).toHaveLength(1);
    expect(result[0].lineUserId).toBe("U123");
  });

  it("skips already notified users", async () => {
    const artist = await prisma.artist.create({
      data: { name: "千鳥", aliases: [] },
    });
    const user = await prisma.user.create({
      data: { lineUserId: "U456" },
    });
    await prisma.userFavoriteArtist.create({
      data: { userId: user.id, artistId: artist.id },
    });
    const live = await prisma.live.create({
      data: {
        title: "テストライブ2",
        venue: "会場",
        datetimeText: "日時",
        type: "offline",
        ticketPrice: "無料",
        ticketStatus: "販売中",
        ticketUrl: "https://example.com",
        sourceSite: "example.com",
        sourceUrl: "https://example.com/live/2",
      },
    });
    await prisma.liveArtist.create({
      data: { liveId: live.id, artistId: artist.id },
    });
    await prisma.notification.create({
      data: { userId: user.id, liveId: live.id, type: "new_live" },
    });

    const result = await findUsersToNotify(live.id);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/crawler && npx vitest run`
Expected: FAIL - `findUsersToNotify` not found.

- [ ] **Step 3: Implement notification logic**

`packages/crawler/src/notify.ts`:
```typescript
import { prisma } from "@oshi-geinin/db";
import type { User, Live } from "@oshi-geinin/db";

export async function findUsersToNotify(
  liveId: string
): Promise<User[]> {
  const liveArtists = await prisma.liveArtist.findMany({
    where: { liveId },
    select: { artistId: true },
  });
  const artistIds = liveArtists.map((la) => la.artistId);

  if (artistIds.length === 0) return [];

  const alreadyNotified = await prisma.notification.findMany({
    where: { liveId, type: "new_live" },
    select: { userId: true },
  });
  const notifiedUserIds = new Set(alreadyNotified.map((n) => n.userId));

  const favorites = await prisma.userFavoriteArtist.findMany({
    where: { artistId: { in: artistIds } },
    include: { user: true },
  });

  const uniqueUsers = new Map<string, User>();
  for (const fav of favorites) {
    if (!notifiedUserIds.has(fav.userId)) {
      uniqueUsers.set(fav.userId, fav.user);
    }
  }

  return Array.from(uniqueUsers.values());
}

export async function sendNewLiveNotification(
  user: User,
  live: Live
): Promise<void> {
  const message = [
    `お気に入り芸人の新着ライブ！`,
    ``,
    `📌 ${live.title}`,
    `📍 ${live.venue}`,
    `📅 ${live.datetimeText}`,
    `💴 ${live.ticketPrice}`,
    `🎫 ${live.ticketStatus}`,
    live.type === "online" ? `🖥 オンライン` : `📍 現地`,
    ``,
    `チケット: ${live.ticketUrl}`,
  ].join("\n");

  await pushLineMessage(user.lineUserId, message);

  await prisma.notification.create({
    data: { userId: user.id, liveId: live.id, type: "new_live" },
  });
}

async function pushLineMessage(
  lineUserId: string,
  message: string
): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!res.ok) {
    console.error(`LINE push failed: ${res.status} ${await res.text()}`);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/crawler && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/crawler/src/notify.ts packages/crawler/__tests__/notify.test.ts
git commit -m "feat: add notification logic with LINE push and dedup"
```

---

### Task 6: First crawler - ticket.fany.lol

**Files:**
- Create: `packages/crawler/src/scrapers/base.ts`
- Create: `packages/crawler/src/scrapers/fany.ts`
- Create: `packages/crawler/__tests__/scrapers/fany.test.ts`
- Create: `packages/crawler/src/handler.ts`

- [ ] **Step 1: Create base scraper interface**

`packages/crawler/src/scrapers/base.ts`:
```typescript
import type { LiveData } from "../types";

export interface Scraper {
  readonly siteName: string;
  readonly siteUrl: string;
  scrape(): Promise<LiveData[]>;
}
```

- [ ] **Step 2: Investigate ticket.fany.lol page structure**

Open https://ticket.fany.lol/ in a browser and inspect the DOM structure.
Document: list page URL pattern, live detail page URL, HTML selectors for title/date/venue/artists/price/status.

- [ ] **Step 3: Implement fany scraper**

`packages/crawler/src/scrapers/fany.ts`:
```typescript
import { PlaywrightCrawler, Dataset } from "crawlee";
import type { Scraper } from "./base";
import type { LiveData } from "../types";
import { parseDatetime, parseMinPrice } from "@oshi-geinin/shared";

export class FanyScraper implements Scraper {
  readonly siteName = "ticket.fany.lol";
  readonly siteUrl = "https://ticket.fany.lol/";

  async scrape(): Promise<LiveData[]> {
    const results: LiveData[] = [];

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 200,
      async requestHandler({ page, request, enqueueLinks }) {
        // Implementation depends on actual site structure
        // This is a skeleton — fill in after Step 2 investigation

        if (request.url === "https://ticket.fany.lol/") {
          // List page: enqueue individual live pages
          await enqueueLinks({
            // selector and pattern TBD from investigation
          });
          return;
        }

        // Detail page: extract live data
        const title = await page.locator("h1").textContent() ?? "";
        const venue = ""; // TBD: actual selector
        const datetimeText = ""; // TBD: actual selector
        const artistText = ""; // TBD: actual selector
        const priceText = ""; // TBD: actual selector
        const status = ""; // TBD: actual selector
        const ticketUrl = request.url;

        results.push({
          title: title.trim(),
          venue,
          datetimeText,
          startAt: parseDatetime(datetimeText),
          endAt: null,
          type: "offline", // TBD: detect online/offline
          streamingEndAt: null,
          streamingEndText: null,
          ticketPrice: priceText,
          ticketPriceMin: parseMinPrice(priceText),
          ticketStatus: status,
          ticketUrl,
          sourceUrl: request.url,
          artistNames: artistText.split(/[、,／\/]/).map((s) => s.trim()).filter(Boolean),
        });
      },
    });

    await crawler.run([this.siteUrl]);
    return results;
  }
}
```

Note: セレクターはStep 2の調査結果に基づいて埋める。サイト構造が変わる可能性があるため、実装時に最新のDOMを確認すること。

- [ ] **Step 4: Write test with snapshot of real page data**

`packages/crawler/__tests__/scrapers/fany.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { FanyScraper } from "../../src/scrapers/fany";

describe("FanyScraper", () => {
  it("scrapes live data from ticket.fany.lol", async () => {
    const scraper = new FanyScraper();
    const results = await scraper.scrape();

    expect(results.length).toBeGreaterThan(0);
    for (const live of results) {
      expect(live.title).toBeTruthy();
      expect(live.sourceUrl).toContain("ticket.fany.lol");
      expect(live.ticketUrl).toBeTruthy();
    }
  }, 60_000); // 60s timeout for real scraping
});
```

- [ ] **Step 5: Create Lambda handler**

`packages/crawler/src/handler.ts`:
```typescript
import type { LiveData } from "./types";
import type { Scraper } from "./scrapers/base";
import { FanyScraper } from "./scrapers/fany";
import { storeLives } from "./store";
import { findUsersToNotify, sendNewLiveNotification } from "./notify";
import { prisma } from "@oshi-geinin/db";

const scrapers: Record<string, () => Scraper> = {
  fany: () => new FanyScraper(),
  // yoshimoto, zaiko, tiget, eplus will be added later
};

export async function handler() {
  const site = process.env.CRAWL_SITE;
  if (!site) throw new Error("CRAWL_SITE env var is required");

  const createScraper = scrapers[site];
  if (!createScraper) {
    throw new Error(`Unknown site: ${site}`);
  }

  const scraper = createScraper();
  console.log(`Scraping ${scraper.siteName}...`);

  const liveDataList = await scraper.scrape();
  console.log(`Found ${liveDataList.length} lives`);

  const { newLives } = await storeLives(liveDataList, scraper.siteName);
  console.log(`${newLives.length} new lives stored`);

  // Notify users for each new live
  for (const live of newLives) {
    const liveWithArtists = await prisma.live.findUnique({
      where: { id: live.id },
      include: { artists: { include: { artist: true } } },
    });
    if (!liveWithArtists) continue;

    const users = await findUsersToNotify(live.id);
    for (const user of users) {
      await sendNewLiveNotification(user, liveWithArtists);
    }
    console.log(`Notified ${users.length} users for "${live.title}"`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      site,
      total: liveDataList.length,
      new: newLives.length,
    }),
  };
}
```

- [ ] **Step 6: Run integration test against real site**

Run: `cd packages/crawler && npx vitest run __tests__/scrapers/fany.test.ts`
Expected: PASS (at least some lives scraped).

- [ ] **Step 7: Commit**

```bash
git add packages/crawler/src/scrapers/ packages/crawler/src/handler.ts packages/crawler/__tests__/
git commit -m "feat: add fany.lol crawler with Lambda handler"
```

---

### Task 7: Remaining 4 crawlers

**Files:**
- Create: `packages/crawler/src/scrapers/yoshimoto.ts`
- Create: `packages/crawler/src/scrapers/zaiko.ts`
- Create: `packages/crawler/src/scrapers/tiget.ts`
- Create: `packages/crawler/src/scrapers/eplus.ts`

Each crawler follows the same pattern as fany.ts. For each:

- [ ] **Step 1: Investigate site structure for yoshimoto**

Open https://online-ticket.yoshimoto.co.jp/ and document DOM selectors.

- [ ] **Step 2: Implement yoshimoto scraper**

Same pattern as FanyScraper. Register in handler.ts scrapers map.

- [ ] **Step 3: Test yoshimoto scraper**

- [ ] **Step 4: Commit yoshimoto**

```bash
git commit -m "feat: add yoshimoto online-ticket crawler"
```

- [ ] **Step 5: Investigate + implement + test zaiko scraper**
- [ ] **Step 6: Commit zaiko**

```bash
git commit -m "feat: add zaiko.io crawler"
```

- [ ] **Step 7: Investigate + implement + test tiget scraper**
- [ ] **Step 8: Commit tiget**

```bash
git commit -m "feat: add tiget.net crawler"
```

- [ ] **Step 9: Investigate + implement + test eplus scraper**
- [ ] **Step 10: Commit eplus**

```bash
git commit -m "feat: add eplus.jp comedy crawler"
```

---

### Task 8: Next.js API routes

**Files:**
- Create: `apps/web/src/app/api/artists/route.ts`
- Create: `apps/web/src/app/api/artists/[id]/route.ts`
- Create: `apps/web/src/app/api/favorites/route.ts`
- Create: `apps/web/src/app/api/favorites/[artistId]/route.ts`
- Create: `apps/web/src/app/api/lives/route.ts`
- Create: `apps/web/src/app/api/lives/[id]/route.ts`
- Create: `apps/web/__tests__/api/artists.test.ts`
- Create: `apps/web/__tests__/api/favorites.test.ts`
- Create: `apps/web/__tests__/api/lives.test.ts`

- [ ] **Step 1: Write failing test for GET /api/artists**

```typescript
import { describe, it, expect } from "vitest";
import { GET } from "../../src/app/api/artists/route";
import { prisma } from "@oshi-geinin/db";

describe("GET /api/artists", () => {
  it("returns artists list", async () => {
    await prisma.artist.create({
      data: { name: "テスト芸人", aliases: [] },
    });

    const req = new Request("http://localhost/api/artists");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.artists.length).toBeGreaterThan(0);
  });

  it("supports search query", async () => {
    await prisma.artist.create({
      data: { name: "サンドウィッチマン", aliases: [] },
    });

    const req = new Request("http://localhost/api/artists?q=サンド");
    const res = await GET(req);
    const body = await res.json();

    expect(body.artists).toHaveLength(1);
    expect(body.artists[0].name).toBe("サンドウィッチマン");
  });
});
```

- [ ] **Step 2: Implement GET /api/artists**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@oshi-geinin/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { aliases: { has: q } },
        ],
      }
    : {};

  const [artists, total] = await Promise.all([
    prisma.artist.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.artist.count({ where }),
  ]);

  return NextResponse.json({ artists, total, page, limit });
}
```

- [ ] **Step 3: Implement remaining API routes (favorites, lives)**

Follow same test-first pattern for each endpoint:
- `GET /api/favorites` — return current user's favorites (requires auth session)
- `POST /api/favorites` — add favorite `{ artistId }`
- `DELETE /api/favorites/:artistId` — remove favorite
- `GET /api/lives` — list with filters (artistId, type, date range)
- `GET /api/lives/:id` — detail with artists

- [ ] **Step 4: Run all API tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/ apps/web/__tests__/
git commit -m "feat: add API routes for artists, favorites, lives"
```

---

### Task 9: LINE authentication (NextAuth.js)

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Install NextAuth and configure LINE provider**

`apps/web/src/lib/auth.ts`:
```typescript
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@oshi-geinin/db";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "line",
      name: "LINE",
      type: "oauth",
      authorization: {
        url: "https://access.line.me/oauth2/v2.1/authorize",
        params: { scope: "profile openid" },
      },
      token: "https://api.line.me/oauth2/v2.1/token",
      userinfo: "https://api.line.me/v2/profile",
      clientId: process.env.LINE_CHANNEL_ID,
      clientSecret: process.env.LINE_CHANNEL_SECRET,
      profile(profile) {
        return {
          id: profile.userId,
          name: profile.displayName,
          image: profile.pictureUrl,
        };
      },
    },
  ],
  callbacks: {
    async signIn({ user }) {
      // Upsert user in our DB
      await prisma.user.upsert({
        where: { lineUserId: user.id },
        update: {},
        create: { lineUserId: user.id },
      });
      return true;
    },
    async session({ session, token }) {
      const dbUser = await prisma.user.findUnique({
        where: { lineUserId: token.sub! },
      });
      if (dbUser) {
        (session as any).userId = dbUser.id;
      }
      return session;
    },
  },
};
```

- [ ] **Step 2: Create NextAuth route handler**

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Test login flow manually**

1. Set LINE_CHANNEL_ID and LINE_CHANNEL_SECRET in .env
2. Run: `cd apps/web && npm run dev`
3. Navigate to http://localhost:3000/api/auth/signin
4. Click LINE login, verify redirect and session creation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/app/api/auth/
git commit -m "feat: add LINE login with NextAuth.js"
```

---

### Task 10: Frontend pages

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/lives/page.tsx`
- Create: `apps/web/src/app/lives/[id]/page.tsx`
- Create: `apps/web/src/app/artists/page.tsx`
- Create: `apps/web/src/app/artists/[id]/page.tsx`
- Create: `apps/web/src/app/settings/page.tsx`
- Create: `apps/web/src/components/LiveCard.tsx`
- Create: `apps/web/src/components/ArtistCard.tsx`
- Create: `apps/web/src/components/FavoriteButton.tsx`
- Create: `apps/web/src/components/LiveFilter.tsx`
- Create: `apps/web/src/components/Header.tsx`

- [ ] **Step 1: Create root layout with Header**

`apps/web/src/app/layout.tsx` — HTML shell, Header with nav links + login/logout.

- [ ] **Step 2: Create shared components**

`LiveCard.tsx`:
- タイトル、日時、会場、出演者、販売状況、オンライン/現地ラベル、購入リンク
- NEWバッジ（未通知の場合）
- オンラインの場合は配信終了日表示

`ArtistCard.tsx`:
- 芸人名 + お気に入りトグルボタン

`FavoriteButton.tsx`:
- POST/DELETE /api/favorites を呼ぶトグルボタン

`LiveFilter.tsx`:
- 日付、芸人名、会場、販売状況、オンライン/現地のフィルターUI

`Header.tsx`:
- ナビゲーションリンク（トップ、ライブ一覧、芸人一覧、設定）
- ログイン/ログアウトボタン

- [ ] **Step 3: Write component tests for LiveCard and FavoriteButton**

```typescript
// apps/web/__tests__/components/LiveCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveCard } from "../../src/components/LiveCard";

describe("LiveCard", () => {
  it("renders live info", () => {
    render(
      <LiveCard
        live={{
          id: "1",
          title: "お笑いライブ",
          venue: "ルミネ",
          datetimeText: "4/1 18:30",
          type: "offline",
          ticketStatus: "販売中",
          ticketUrl: "https://example.com",
          ticketPrice: "3,500円",
        }}
      />
    );
    expect(screen.getByText("お笑いライブ")).toBeDefined();
    expect(screen.getByText("ルミネ")).toBeDefined();
    expect(screen.getByText("販売中")).toBeDefined();
  });
});
```

- [ ] **Step 4: Implement top page (お気に入りライブ一覧)**

`apps/web/src/app/page.tsx`:
- ログイン前: LINEログインボタン
- ログイン後: GET /api/lives?favorites=true → LiveCardリスト

- [ ] **Step 5: Implement /lives page (全ライブ一覧)**

`apps/web/src/app/lives/page.tsx`:
- LiveFilter + LiveCardリスト
- ページネーション

- [ ] **Step 6: Implement /lives/[id] page (ライブ詳細)**

- [ ] **Step 7: Implement /artists page (芸人一覧)**

`apps/web/src/app/artists/page.tsx`:
- 検索バー + ArtistCardリスト（各カードにFavoriteButton）

- [ ] **Step 8: Implement /artists/[id] page (芸人詳細)**

- 芸人情報 + その芸人の今後のライブ一覧

- [ ] **Step 9: Implement /settings page**

- 通知ON/OFF、LINE連携状態表示

- [ ] **Step 10: Run component tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 11: Manual E2E check**

Run: `cd apps/web && npm run dev`
Navigate through all pages, verify rendering and interactions.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/ apps/web/__tests__/
git commit -m "feat: add frontend pages - home, lives, artists, settings"
```

---

### Task 11: SST Infrastructure

**Files:**
- Create: `infra/package.json`
- Create: `infra/sst.config.ts`
- Create: `infra/stacks/CrawlerStack.ts`
- Create: `packages/crawler/src/reminder.ts`

- [ ] **Step 1: Initialize SST project**

`infra/sst.config.ts`:
```typescript
import type { SSTConfig } from "sst";
import { CrawlerStack } from "./stacks/CrawlerStack";

export default {
  config() {
    return {
      name: "oshi-geinin-info",
      region: "ap-northeast-1",
    };
  },
  stacks(app) {
    app.stack(CrawlerStack);
  },
} satisfies SSTConfig;
```

- [ ] **Step 2: Define crawler Lambdas and EventBridge schedule**

`infra/stacks/CrawlerStack.ts`:
```typescript
import { StackContext, Function, Cron } from "sst/constructs";

export function CrawlerStack({ stack }: StackContext) {
  const sites = ["fany", "yoshimoto", "zaiko", "tiget", "eplus"];

  const commonEnv = {
    DATABASE_URL: process.env.DATABASE_URL!,
    LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  };

  // サイトごとに個別のLambda + Cronを作成（並列実行・タイムアウト回避）
  for (const site of sites) {
    const fn = new Function(stack, `Crawler-${site}`, {
      handler: "packages/crawler/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memorySize: 1024,
      environment: {
        ...commonEnv,
        CRAWL_SITE: site, // Lambda内でprocess.env.CRAWL_SITEから取得
      },
    });

    // 毎朝9:00 JST (0:00 UTC) に各サイトを個別にクロール
    new Cron(stack, `DailyCrawl-${site}`, {
      schedule: "cron(0 0 * * ? *)",
      job: fn,
    });
  }

  // Streaming end reminder at 9:00 JST
  const reminder = new Function(stack, "StreamingReminder", {
    handler: "packages/crawler/src/reminder.handler",
    runtime: "nodejs20.x",
    timeout: "1 minute",
    environment: commonEnv,
  });

  new Cron(stack, "DailyReminder", {
    schedule: "cron(0 0 * * ? *)",
    job: reminder,
  });
}
```

- [ ] **Step 3: Create streaming end reminder handler**

`packages/crawler/src/reminder.ts`:
```typescript
import { prisma } from "@oshi-geinin/db";

export async function handler() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  const expiringLives = await prisma.live.findMany({
    where: {
      type: "online",
      streamingEndAt: {
        gte: startOfTomorrow,
        lte: endOfTomorrow,
      },
    },
    include: {
      artists: { include: { artist: true } },
    },
  });

  for (const live of expiringLives) {
    const artistIds = live.artists.map((la) => la.artistId);

    const favorites = await prisma.userFavoriteArtist.findMany({
      where: { artistId: { in: artistIds } },
      include: { user: true },
    });

    const alreadyNotified = await prisma.notification.findMany({
      where: { liveId: live.id, type: "streaming_end_reminder" },
      select: { userId: true },
    });
    const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));

    for (const fav of favorites) {
      if (notifiedIds.has(fav.userId)) continue;

      const message = [
        `⏰ 配信終了リマインド`,
        ``,
        `「${live.title}」の配信が明日終了します`,
        `📅 配信終了: ${live.streamingEndText ?? live.streamingEndAt?.toLocaleDateString("ja-JP")}`,
        ``,
        `視聴: ${live.ticketUrl}`,
      ].join("\n");

      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: fav.user.lineUserId,
          messages: [{ type: "text", text: message }],
        }),
      });

      await prisma.notification.create({
        data: {
          userId: fav.userId,
          liveId: live.id,
          type: "streaming_end_reminder",
        },
      });
    }
  }

  return { statusCode: 200, body: `Processed ${expiringLives.length} expiring lives` };
}
```

- [ ] **Step 4: Deploy with SST**

Run: `cd infra && npx sst deploy --stage prod`
Expected: Lambdas and EventBridge rules created.

- [ ] **Step 5: Commit**

```bash
git add infra/ packages/crawler/src/reminder.ts
git commit -m "feat: add SST infra with crawler Lambdas, EventBridge schedules, and streaming reminder"
```

---

### Task 12: CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run test

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: --prod

  deploy-infra:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      - run: cd infra && npx sst deploy --stage prod
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add CI/CD with GitHub Actions for Vercel + SST deploy"
```

---

## Task Dependency Graph

```
Task 1 (monorepo)
  ├→ Task 2 (DB schema)
  │    ├→ Task 3 (shared types)
  │    │    ├→ Task 4 (store logic)
  │    │    │    ├→ Task 5 (notification)
  │    │    │    │    ├→ Task 6 (first crawler)
  │    │    │    │    │    └→ Task 7 (remaining crawlers)
  │    │    │    │    └→ Task 11 (SST infra)
  │    │    │    └→ Task 8 (API routes)
  │    │    │         └→ Task 10 (frontend)
  │    │    └→ Task 9 (LINE auth)
  │    │         └→ Task 10 (frontend)
  └→ Task 12 (CI/CD) — can start after Task 1
```

Tasks 8-9 and Tasks 6-7 can be worked on in parallel after Task 5.

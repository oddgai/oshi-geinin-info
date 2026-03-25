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
        CRAWL_SITE: site,
      },
    });

    new Cron(stack, `DailyCrawl-${site}`, {
      schedule: "cron(0 0 * * ? *)",
      job: fn,
    });
  }

  // Streaming end reminder
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

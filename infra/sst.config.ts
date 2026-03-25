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

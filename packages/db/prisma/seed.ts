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

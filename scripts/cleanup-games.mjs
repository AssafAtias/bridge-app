import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const result = await db.game.updateMany({
  where: { status: { not: "FINISHED" } },
  data: { status: "FINISHED" },
});

console.log(`Finished ${result.count} stale games.`);
await db.$disconnect();

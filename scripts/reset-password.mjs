import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findUnique({ where: { email: "assaf.atias@gmail.com" } });

const stuck = await prisma.gamePlayer.findMany({
  where: { userId: user.id, game: { status: { not: "FINISHED" } } },
  include: { game: { select: { id: true, status: true } } },
});

console.log("Stuck games:", stuck.map(p => ({ gameId: p.gameId, status: p.game.status })));

for (const p of stuck) {
  await prisma.game.update({ where: { id: p.gameId }, data: { status: "FINISHED" } });
  console.log(`✅ Closed game ${p.gameId}`);
}

if (stuck.length === 0) console.log("No stuck games found.");
await prisma.$disconnect();

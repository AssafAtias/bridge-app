-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'BIDDING', 'PLAYING', 'FINISHED');

-- CreateEnum
CREATE TYPE "Seat" AS ENUM ('NORTH', 'EAST', 'SOUTH', 'WEST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "dealer" "Seat" NOT NULL DEFAULT 'NORTH',
    "vulnerability" TEXT NOT NULL DEFAULT 'NONE',
    "currentSeat" "Seat",
    "contract" TEXT,
    "declarer" "Seat",
    "dummy" "Seat",
    "dummyRevealed" BOOLEAN NOT NULL DEFAULT false,
    "nsScore" INTEGER NOT NULL DEFAULT 0,
    "ewScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seat" "Seat" NOT NULL,
    "hand" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seat" "Seat" NOT NULL,
    "call" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPlay" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seat" "Seat" NOT NULL,
    "card" TEXT NOT NULL,
    "trickNum" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CardPlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_seat_key" ON "GamePlayer"("gameId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPlay" ADD CONSTRAINT "CardPlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

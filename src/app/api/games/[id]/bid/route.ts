import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import {
  AuctionState,
  validateBid,
  updateAuction,
} from "@/lib/bridge/bidding";
import { nextSeat } from "@/lib/bridge/deck";
import { executeBotTurnsIfNeeded } from "@/lib/bridge/aiActions";
import { Seat } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: gameId } = await params;
    const { call } = await req.json();

    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: { include: { user: true } },
        bids: { orderBy: { order: "asc" } },
      },
    });

    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "BIDDING") {
      return NextResponse.json({ error: "Not in bidding phase" }, { status: 400 });
    }

    const player = game.players.find((p) => p.userId === session.user!.id);
    if (!player) return NextResponse.json({ error: "Not in this game" }, { status: 403 });

    if (game.currentSeat !== player.seat) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    // Build auction state
    const auctionState: AuctionState = {
      calls: game.bids.map((b) => ({ seat: b.seat as Seat, call: b.call })),
      currentSeat: game.currentSeat as Seat,
      dealer: game.dealer as Seat,
      contract: game.contract,
      declarer: game.declarer as Seat | null,
      doubled: game.bids.some(
        (b) => b.call === "X" && b.order === game.bids.length - 1
      ),
      redoubled: game.bids.some(
        (b) => b.call === "XX" && b.order === game.bids.length - 1
      ),
      complete: false,
    };

    const validation = validateBid(call, auctionState);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const newState = updateAuction(auctionState, player.seat as Seat, call);

    // Save bid
    await db.bid.create({
      data: {
        gameId,
        seat: player.seat,
        call,
        order: game.bids.length,
      },
    });

    // Trigger bid-made event
    await pusherServer.trigger(`private-game-${gameId}`, "bid-made", {
      seat: player.seat,
      call,
      nextSeat: newState.currentSeat,
    });

    if (newState.complete) {
      // Auction complete
      if (!newState.contract || newState.contract.replace(/XX?$/, "") === "") {
        // Passed out
        await db.game.update({
          where: { id: gameId },
          data: { status: "FINISHED", contract: "PASSED", currentSeat: null },
        });
        await pusherServer.trigger(`private-game-${gameId}`, "auction-complete", {
          contract: "PASSED",
          declarer: null,
          passedOut: true,
        });
      } else {
        const openingLeader = nextSeat(newState.declarer!);
        const SEATS: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
        const dummySeat = SEATS[(SEATS.indexOf(newState.declarer! as Seat) + 2) % 4];

        await db.game.update({
          where: { id: gameId },
          data: {
            status: "PLAYING",
            contract: newState.contract,
            declarer: newState.declarer,
            dummy: dummySeat,
            currentSeat: openingLeader,
          },
        });

        await pusherServer.trigger(`private-game-${gameId}`, "auction-complete", {
          contract: newState.contract,
          declarer: newState.declarer,
          openingLeader,
          passedOut: false,
        });
      }
    } else {
      await db.game.update({
        where: { id: gameId },
        data: { currentSeat: newState.currentSeat },
      });
    }

    // Await bot turns — Vercel serverless kills background tasks after response
    await executeBotTurnsIfNeeded(gameId);

    return NextResponse.json({ success: true, call, nextSeat: newState.currentSeat });
  } catch (error) {
    console.error("Error processing bid:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

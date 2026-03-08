import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LobbyClient from "@/components/lobby/LobbyClient";

export default async function LobbyPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <LobbyClient
      userId={session.user.id!}
      username={session.user.name!}
    />
  );
}

export type Lang = "en" | "he";

const SEATS_HE: Record<string, string> = {
  NORTH: "צפון", EAST: "מזרח", SOUTH: "דרום", WEST: "מערב",
};

export const T = {
  en: {
    appName: "Bridge",
    contract: "Contract",
    by: "by",
    ns: "NS",
    ew: "EW",
    waitingStatus: (n: number) => `Waiting (${n}/4)`,
    biddingStatus: (seat: string) => `Bidding — ${seat}'s turn`,
    playingStatus: (seat: string) => `Playing — ${seat}'s turn`,
    // Menu
    zoomIn: "A+",
    zoomOut: "A−",
    newGame: "New Game",
    exitGame: "Exit",
    // Lobby
    bridgeLobby: "Bridge Lobby",
    welcome: (name: string) => `Welcome, ${name}`,
    newGameBtn: "+ New Game",
    creating: "Creating...",
    signOut: "Sign Out",
    openGames: "Open Games",
    loadingGames: "Loading games...",
    noGames: "No games waiting",
    noGamesHint: "Create a new game to get started",
    players: (n: number) => `${n}/4 players`,
    rejoin: "Rejoin",
    join: "Join",
    joining: "Joining...",
    full: "Full",
    // Game waiting panel
    waitingForPlayers: "Waiting for players",
    playersJoined: (n: number) => `${n}/4 players have joined`,
    fillWithAI: "🤖 Fill empty seats with AI",
    // Bidding box
    biddingBox: "Bidding Box",
    yourTurnBid: "Your turn",
    turnOf: (seat: string) => `${seat}'s turn`,
    // Turn indicator
    yourTurnPlay: "🎯 Your turn! Double-click a card to play",
    waitingFor: (seat: string) => `⏳ Waiting for ${seat}`,
    // Trick / bid history
    tricks: (ns: number, ew: number) => `Tricks (${ns} NS / ${ew} EW)`,
    bidHistory: "Bid History",
    // Hand hint
    doubleClickHint: "Double-click a card to play",
    // Seat labels
    seats: { NORTH: "North", EAST: "East", SOUTH: "South", WEST: "West" } as Record<string, string>,
    // Score sheet
    passedOut: "Passed Out",
    gameOver: "Game Over",
    finalContract: "Final Contract",
    declarerLabel: "Declarer",
    northSouth: "North–South",
    eastWest: "East–West",
    winner: "Winner!",
    backToLobby: "Back to Lobby",
  },
  he: {
    appName: "ברידג'",
    contract: "חוזה",
    by: "על ידי",
    ns: "צ-ד",
    ew: "מ-ע",
    waitingStatus: (n: number) => `ממתין (${n}/4)`,
    biddingStatus: (seat: string) => `הצעות — תור ${SEATS_HE[seat] ?? seat}`,
    playingStatus: (seat: string) => `משחק — תור ${SEATS_HE[seat] ?? seat}`,
    // Menu
    zoomIn: "A+",
    zoomOut: "A−",
    newGame: "משחק חדש",
    exitGame: "יציאה",
    // Lobby
    bridgeLobby: "לובי ברידג'",
    welcome: (name: string) => `ברוך הבא, ${name}`,
    newGameBtn: "+ משחק חדש",
    creating: "יוצר...",
    signOut: "התנתקות",
    openGames: "משחקים פתוחים",
    loadingGames: "טוען משחקים...",
    noGames: "אין משחקים ממתינים",
    noGamesHint: "צור משחק חדש להתחיל",
    players: (n: number) => `${n}/4 שחקנים`,
    rejoin: "חזור למשחק",
    join: "הצטרף",
    joining: "מצטרף...",
    full: "מלא",
    // Game waiting panel
    waitingForPlayers: "ממתין לשחקנים",
    playersJoined: (n: number) => `${n}/4 שחקנים הצטרפו`,
    fillWithAI: "🤖 מלא מקומות עם בינה מלאכותית",
    // Bidding box
    biddingBox: "קופסת הצעות",
    yourTurnBid: "תורך",
    turnOf: (seat: string) => `תור ${SEATS_HE[seat] ?? seat}`,
    // Turn indicator
    yourTurnPlay: "🎯 תורך! לחץ פעמיים על קלף לשחק",
    waitingFor: (seat: string) => `⏳ ממתין ל${SEATS_HE[seat] ?? seat}`,
    // Trick / bid history
    tricks: (ns: number, ew: number) => `לקיחות (${ns} צ-ד / ${ew} מ-ע)`,
    bidHistory: "היסטוריית הצעות",
    // Hand hint
    doubleClickHint: "לחץ פעמיים על קלף לשחק",
    // Seat labels
    seats: { NORTH: "צפון", EAST: "מזרח", SOUTH: "דרום", WEST: "מערב" } as Record<string, string>,
    // Score sheet
    passedOut: "פאס",
    gameOver: "סיום משחק",
    finalContract: "חוזה סופי",
    declarerLabel: "מכריז",
    northSouth: "צפון–דרום",
    eastWest: "מזרח–מערב",
    winner: "מנצח!",
    backToLobby: "חזרה ללובי",
  },
};

export type Translations = typeof T.en;

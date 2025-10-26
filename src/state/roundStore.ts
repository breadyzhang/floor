import { create } from "zustand";

export type PlayerRole = "challenger" | "challengee";

export interface TopicSelection {
  id: string;
  name: string;
  filePath: string; // e.g. /topics/math.pdf
  answerPath?: string;
}

export interface PlayerState {
  name: string;
  remainingMs: number;
  switchesUsed: number;
}

export type RoundPhase = "idle" | "ready" | "running" | "passDelay" | "complete";

export interface RoundState {
  topic: TopicSelection | null;
  players: Record<PlayerRole, PlayerState>;
  activePlayer: PlayerRole | null;
  phase: RoundPhase;
  currentPageIndex: number;
  totalPages: number;
  resumeAt: number | null;
  lastTickAt: number | null;
  answerKey: string[];
  winner: PlayerRole | null;
}

export interface RoundActions {
  configureRound: (config: {
    challengerName: string;
    challengeeName: string;
    topic: TopicSelection;
  }) => void;
  setAnswerKey: (answers: string[]) => void;
  startRound: () => void;
  setTotalPages: (pages: number) => void;
  markCorrect: () => void;
  passQuestion: () => void;
  resumeAfterDelay: () => void;
  switchTurn: () => void;
  tick: (now: number) => void;
  hydrateFromSnapshot: (snapshot: RoundSnapshot) => void;
  resetRound: () => void;
}

export const ROUND_DURATION_MS = 45_000;
export const PASS_PENALTY_MS = 3_000;
export const MAX_SWITCHES_PER_PLAYER = 3;

const initialPlayers = (): Record<PlayerRole, PlayerState> => ({
  challenger: {
    name: "",
    remainingMs: ROUND_DURATION_MS,
    switchesUsed: 0,
  },
  challengee: {
    name: "",
    remainingMs: ROUND_DURATION_MS,
    switchesUsed: 0,
  },
});

const initialState: RoundState = {
  topic: null,
  players: initialPlayers(),
  activePlayer: null,
  phase: "idle",
  currentPageIndex: 0,
  totalPages: 0,
  resumeAt: null,
  lastTickAt: null,
  answerKey: [],
  winner: null,
};

const applyTimeDeduction = (
  state: RoundState,
  now: number
): RoundState => {
  if (!state.activePlayer || state.phase !== "running") {
    return { ...state, lastTickAt: now };
  }

  const lastTickAt = state.lastTickAt ?? now;
  const delta = Math.max(0, now - lastTickAt);
  if (delta === 0) {
    return { ...state, lastTickAt: now };
  }

  const role = state.activePlayer;
  const active = state.players[role];
  const remaining = Math.max(0, active.remainingMs - delta);

  const players: RoundState["players"] = {
    ...state.players,
    [role]: {
      ...active,
      remainingMs: remaining,
    },
  };

  let phase: RoundPhase = state.phase;
  let winner: PlayerRole | null = state.winner;
  let activePlayer: PlayerRole | null = role;

  if (remaining <= 0) {
    phase = "complete";
    winner = role === "challenger" ? "challengee" : "challenger";
    activePlayer = null;
  }

  return {
    ...state,
    players,
    phase,
    winner,
    activePlayer,
    lastTickAt: now,
  };
};

export type RoundSnapshot = RoundState;

const clonePlayers = (players: Record<PlayerRole, PlayerState>) => ({
  challenger: { ...players.challenger },
  challengee: { ...players.challengee },
});

export const selectRoundSnapshot = (
  state: RoundState & RoundActions
): RoundSnapshot => ({
  topic: state.topic,
  players: clonePlayers(state.players),
  activePlayer: state.activePlayer,
  phase: state.phase,
  currentPageIndex: state.currentPageIndex,
  totalPages: state.totalPages,
  resumeAt: state.resumeAt,
  lastTickAt: state.lastTickAt,
  answerKey: [...state.answerKey],
  winner: state.winner,
});

export const useRoundStore = create<RoundState & RoundActions>()((set, get) => ({
  ...initialState,
  configureRound: ({ challengerName, challengeeName, topic }) => {
    set(() => ({
      topic,
      players: {
          challenger: {
            name: challengerName,
            remainingMs: ROUND_DURATION_MS,
            switchesUsed: 0,
          },
          challengee: {
            name: challengeeName,
            remainingMs: ROUND_DURATION_MS,
            switchesUsed: 0,
        },
      },
      activePlayer: "challenger",
      phase: "ready",
      currentPageIndex: 0,
      totalPages: 0,
      resumeAt: null,
      lastTickAt: null,
      answerKey: [],
      winner: null,
    }));
  },
  setAnswerKey: (answers) => {
    set(() => ({
      answerKey: [...answers],
    }));
  },
  startRound: () => {
    set((state) => {
      if (state.phase !== "ready") {
        return state;
      }
        const now = Date.now();
        return {
          ...state,
          phase: "running",
          activePlayer: "challenger",
          lastTickAt: now,
        };
      });
    },
    setTotalPages: (pages) => {
      set((state) => ({
        ...state,
        totalPages: pages,
      }));
    },
    markCorrect: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);

        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return afterTick;
        }

        const currentRole = afterTick.activePlayer;
        const nextRole: PlayerRole =
          currentRole === "challenger" ? "challengee" : "challenger";

        return {
          ...afterTick,
          activePlayer: nextRole,
          currentPageIndex:
            afterTick.totalPages === 0
              ? afterTick.currentPageIndex
              : Math.min(
                  afterTick.currentPageIndex + 1,
                  Math.max(afterTick.totalPages - 1, 0)
                ),
          lastTickAt: now,
        };
      });
    },
    passQuestion: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);
        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return afterTick;
        }

        const role = afterTick.activePlayer;
        const active = afterTick.players[role];
        const penalizedRemaining = Math.max(
          0,
          active.remainingMs - PASS_PENALTY_MS
        );

        const players = {
          ...afterTick.players,
          [role]: { ...active, remainingMs: penalizedRemaining },
        };

        let phase: RoundPhase = afterTick.phase;
        let winner: PlayerRole | null = afterTick.winner;
        let activePlayer: PlayerRole | null = role;

        if (penalizedRemaining <= 0) {
          phase = "complete";
          winner = role === "challenger" ? "challengee" : "challenger";
          activePlayer = null;
        } else {
          phase = "passDelay";
        }

        const newIndex =
          afterTick.totalPages === 0
            ? afterTick.currentPageIndex
            : Math.min(
                afterTick.currentPageIndex + 1,
                Math.max(afterTick.totalPages - 1, 0)
              );

        return {
          ...afterTick,
          players,
          phase,
          activePlayer,
          winner,
          resumeAt: phase === "passDelay" ? now + PASS_PENALTY_MS : null,
          lastTickAt: null,
          currentPageIndex: newIndex,
        };
      });
    },
    resumeAfterDelay: () => {
      set((state) => {
        if (state.phase !== "passDelay" || !state.activePlayer) {
          return state;
        }
        const now = Date.now();
        return {
          ...state,
          phase: "running",
          resumeAt: null,
          lastTickAt: now,
        };
      });
    },
    switchTurn: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);
        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return afterTick;
        }

        const triggeringRole = afterTick.activePlayer;
        const triggeringPlayer = afterTick.players[triggeringRole];

        if (triggeringPlayer.switchesUsed >= MAX_SWITCHES_PER_PLAYER) {
          return afterTick;
        }

        const nextRole: PlayerRole =
          triggeringRole === "challenger" ? "challengee" : "challenger";

        return {
          ...afterTick,
          players: {
            ...afterTick.players,
            [triggeringRole]: {
              ...triggeringPlayer,
              switchesUsed: triggeringPlayer.switchesUsed + 1,
            },
          },
          activePlayer: nextRole,
          lastTickAt: now,
        };
      });
    },
    tick: (now) => {
      set((state) => {
        if (state.phase === "passDelay" && state.resumeAt) {
          if (now >= state.resumeAt) {
            return {
              ...state,
              phase: "running",
              resumeAt: null,
              lastTickAt: now,
            };
          }
          return state;
        }

        if (state.phase !== "running" || !state.activePlayer) {
          return state.lastTickAt ? { ...state, lastTickAt: now } : state;
        }

        const lastTickAt = state.lastTickAt ?? now;
        const delta = Math.max(0, now - lastTickAt);
        if (delta < 50) {
          return state;
        }

        const role = state.activePlayer;
        const active = state.players[role];
        const remaining = Math.max(0, active.remainingMs - delta);

        const players = {
          ...state.players,
          [role]: { ...active, remainingMs: remaining },
        };

        if (remaining <= 0) {
          return {
            ...state,
            players,
            phase: "complete",
            winner: role === "challenger" ? "challengee" : "challenger",
            activePlayer: null,
            lastTickAt: now,
          };
        }

        return {
          ...state,
          players,
          lastTickAt: now,
        };
      });
    },
    resetRound: () => {
      set(() => ({
        ...initialState,
        players: initialPlayers(),
      }));
    },
    hydrateFromSnapshot: (snapshot) => {
      const current = get();
      set(() => ({
        topic: snapshot.topic,
        players: clonePlayers(snapshot.players),
        activePlayer: snapshot.activePlayer,
        phase: snapshot.phase,
        currentPageIndex: snapshot.currentPageIndex,
        totalPages: snapshot.totalPages,
        resumeAt: snapshot.resumeAt,
        lastTickAt: snapshot.lastTickAt,
        answerKey: current.answerKey.length > 0 ? current.answerKey : [...snapshot.answerKey],
        winner: snapshot.winner,
      }));
    },
}));

export const getRoundSnapshot = (): RoundSnapshot =>
  selectRoundSnapshot(useRoundStore.getState());

import type { Analysis } from "../analysis";
import { evaluate, findCharacter, type Answer } from "../engine";
import type { AnyTheme } from "../theme.types";

/**
 * Machine à états d'une partie, commune au solo (B = IA serveur) et au PvP.
 * Fonctions pures : aucune I/O, aucun hasard caché. Le Route Handler charge
 * la partie, appelle `applyAction` dans une transaction, persiste, puis diffuse
 * les `events` (qui ne contiennent jamais de secret avant la fin).
 */

export type PlayerSlot = "A" | "B";
export type AnswerMode = "ai_referee" | "classic";
export type FinishReason = "correct_guess" | "forfeit" | "timeout";

export const MAX_QUESTIONS_PER_PLAYER = 30;
export const other = (slot: PlayerSlot): PlayerSlot => (slot === "A" ? "B" : "A");

export interface QuestionEntry {
  readonly id: string;
  readonly by: PlayerSlot;
  readonly text: string;
  /** Interne au serveur (jamais envoyé au client). `null` en mode classique. */
  readonly analysis: Analysis | null;
  /** `null` tant que l'adversaire n'a pas répondu (mode classique). */
  readonly answer: Answer | null;
  readonly auto: boolean;
}

export interface PlayerState {
  readonly secretId: string;
  readonly questionsAsked: number;
  readonly wrongGuesses: readonly string[];
}

export interface Game {
  readonly id: string;
  readonly themeId: string;
  readonly answerMode: AnswerMode;
  /** Verrou optimiste : incrémenté à chaque action réussie. */
  readonly version: number;
  readonly status: "PLAYING" | "FINISHED";
  readonly turn: PlayerSlot;
  /** Mode classique : question en attente de réponse de l'adversaire. */
  readonly pendingQuestionId: string | null;
  readonly players: Readonly<Record<PlayerSlot, PlayerState>>;
  readonly log: readonly QuestionEntry[];
  readonly result: { readonly winner: PlayerSlot; readonly reason: FinishReason } | null;
}

export type GameAction =
  | { type: "ask"; by: PlayerSlot; questionId: string; text: string; analysis: Analysis | null }
  | { type: "answer"; by: PlayerSlot; questionId: string; answer: Answer }
  | { type: "guess"; by: PlayerSlot; characterId: string }
  | { type: "forfeit"; by: PlayerSlot }
  /** Envoyé par le serveur (job/cron) pour le joueur dont le délai a expiré. */
  | { type: "timeout"; by: PlayerSlot };

export type GameError =
  | "VERSION_CONFLICT"
  | "GAME_FINISHED"
  | "NOT_YOUR_TURN"
  | "AWAITING_ANSWER"
  | "NO_PENDING_QUESTION"
  | "QUESTION_LIMIT_REACHED"
  | "ANALYSIS_REQUIRED"
  | "UNKNOWN_CHARACTER"
  | "ALREADY_GUESSED"
  | "INVALID_ACTION";

/** Événements diffusés sur le canal temps réel. Aucun secret, sauf `reveal` en fin de partie. */
export type PublicEvent =
  | { type: "question_asked"; by: PlayerSlot; questionId: string; text: string }
  | { type: "question_answered"; questionId: string; answer: Answer; auto: boolean }
  | { type: "turn_changed"; turn: PlayerSlot }
  | { type: "guess_made"; by: PlayerSlot; characterId: string; correct: boolean }
  | {
      type: "game_finished";
      winner: PlayerSlot;
      reason: FinishReason;
      reveal: Readonly<Record<PlayerSlot, string>>;
    };

export type ApplyResult =
  | { ok: true; game: Game; events: PublicEvent[] }
  | { ok: false; error: GameError };

// ───────────────────────────── Création ─────────────────────────────

export function createGame(
  params: { id: string; theme: AnyTheme; answerMode: AnswerMode; firstTurn: PlayerSlot },
  /** En production : `crypto.randomInt`. Injecté pour des tests déterministes. */
  randomInt: (maxExclusive: number) => number,
): Game {
  const { theme } = params;
  const draw = (): PlayerState => {
    const character = theme.characters[randomInt(theme.characters.length)];
    if (!character) throw new Error("Tirage hors limites");
    return { secretId: character.id, questionsAsked: 0, wrongGuesses: [] };
  };
  return {
    id: params.id,
    themeId: theme.id,
    answerMode: params.answerMode,
    version: 0,
    status: "PLAYING",
    turn: params.firstTurn,
    pendingQuestionId: null,
    players: { A: draw(), B: draw() },
    log: [],
    result: null,
  };
}

// ───────────────────────────── Actions ─────────────────────────────

const ok = (game: Game, events: PublicEvent[]): ApplyResult => ({ ok: true, game, events });
const fail = (error: GameError): ApplyResult => ({ ok: false, error });

const bump = (game: Game, patch: Partial<Omit<Game, "version">>): Game => ({
  ...game,
  ...patch,
  version: game.version + 1,
});

const withPlayer = (
  players: Game["players"],
  slot: PlayerSlot,
  patch: Partial<PlayerState>,
): Game["players"] => {
  const updated = { ...players[slot], ...patch };
  return slot === "A" ? { A: updated, B: players.B } : { A: players.A, B: updated };
};

const reveal = (game: Game) => ({ A: game.players.A.secretId, B: game.players.B.secretId });

function finish(
  game: Game,
  winner: PlayerSlot,
  reason: FinishReason,
  patch: Partial<Omit<Game, "version">>,
  events: PublicEvent[],
): ApplyResult {
  const finished = bump(game, { ...patch, status: "FINISHED", pendingQuestionId: null, result: { winner, reason } });
  return ok(finished, [...events, { type: "game_finished", winner, reason, reveal: reveal(finished) }]);
}

function applyGuess(game: Game, theme: AnyTheme, by: PlayerSlot, characterId: string): ApplyResult {
  if (!theme.characters.some((c) => c.id === characterId)) return fail("UNKNOWN_CHARACTER");
  const me = game.players[by];
  if (me.wrongGuesses.includes(characterId)) return fail("ALREADY_GUESSED");

  const correct = game.players[other(by)].secretId === characterId;
  const guessEvent: PublicEvent = { type: "guess_made", by, characterId, correct };

  if (correct) return finish(game, by, "correct_guess", {}, [guessEvent]);

  // Règle choisie : mauvaise tentative = perte du tour (pas de défaite).
  const next = other(by);
  return ok(
    bump(game, {
      players: withPlayer(game.players, by, { wrongGuesses: [...me.wrongGuesses, characterId] }),
      turn: next,
    }),
    [guessEvent, { type: "turn_changed", turn: next }],
  );
}

export function applyAction(game: Game, theme: AnyTheme, action: GameAction, expectedVersion: number): ApplyResult {
  if (theme.id !== game.themeId) throw new Error("Thème incohérent avec la partie");
  if (expectedVersion !== game.version) return fail("VERSION_CONFLICT");
  if (game.status === "FINISHED") return fail("GAME_FINISHED");

  switch (action.type) {
    case "ask": {
      if (action.by !== game.turn) return fail("NOT_YOUR_TURN");
      if (game.pendingQuestionId) return fail("AWAITING_ANSWER");
      // « C'est Kaito ? » est traité comme une tentative (règle officielle).
      if (action.analysis?.type === "identity") return applyGuess(game, theme, action.by, action.analysis.characterId);

      const me = game.players[action.by];
      if (me.questionsAsked >= MAX_QUESTIONS_PER_PLAYER) return fail("QUESTION_LIMIT_REACHED");
      if (game.log.some((q) => q.id === action.questionId)) return fail("INVALID_ACTION");

      const players = withPlayer(game.players, action.by, { questionsAsked: me.questionsAsked + 1 });
      const asked: PublicEvent = {
        type: "question_asked",
        by: action.by,
        questionId: action.questionId,
        text: action.text,
      };

      if (game.answerMode === "classic") {
        const entry: QuestionEntry = {
          id: action.questionId,
          by: action.by,
          text: action.text,
          analysis: action.analysis,
          answer: null,
          auto: false,
        };
        return ok(bump(game, { players, log: [...game.log, entry], pendingQuestionId: action.questionId }), [asked]);
      }

      if (!action.analysis) return fail("ANALYSIS_REQUIRED");
      const target = findCharacter(theme, game.players[other(action.by)].secretId);
      const answer = evaluate(action.analysis, target, theme);
      const entry: QuestionEntry = {
        id: action.questionId,
        by: action.by,
        text: action.text,
        analysis: action.analysis,
        answer,
        auto: true,
      };
      const next = other(action.by);
      return ok(bump(game, { players, log: [...game.log, entry], turn: next }), [
        asked,
        { type: "question_answered", questionId: action.questionId, answer, auto: true },
        { type: "turn_changed", turn: next },
      ]);
    }

    case "answer": {
      if (game.answerMode !== "classic") return fail("INVALID_ACTION");
      if (!game.pendingQuestionId || game.pendingQuestionId !== action.questionId) return fail("NO_PENDING_QUESTION");
      // C'est l'adversaire de celui qui a posé la question qui répond.
      if (action.by !== other(game.turn)) return fail("NOT_YOUR_TURN");

      const log = game.log.map((q) => (q.id === action.questionId ? { ...q, answer: action.answer } : q));
      const next = other(game.turn);
      return ok(bump(game, { log, pendingQuestionId: null, turn: next }), [
        { type: "question_answered", questionId: action.questionId, answer: action.answer, auto: false },
        { type: "turn_changed", turn: next },
      ]);
    }

    case "guess": {
      if (action.by !== game.turn) return fail("NOT_YOUR_TURN");
      if (game.pendingQuestionId) return fail("AWAITING_ANSWER");
      return applyGuess(game, theme, action.by, action.characterId);
    }

    case "forfeit":
      return finish(game, other(action.by), "forfeit", {}, []);

    case "timeout": {
      // En attente de réponse (classique), c'est le répondant qui est en retard.
      const late = game.pendingQuestionId ? other(game.turn) : game.turn;
      if (action.by !== late) return fail("INVALID_ACTION");
      return finish(game, other(late), "timeout", {}, []);
    }
  }
}

// ───────────────────────────── Vue joueur ─────────────────────────────

export interface PlayerView {
  readonly gameId: string;
  readonly themeId: string;
  readonly answerMode: AnswerMode;
  readonly version: number;
  readonly status: Game["status"];
  readonly you: PlayerSlot;
  readonly yourSecretId: string;
  readonly turn: PlayerSlot;
  readonly pendingQuestionId: string | null;
  readonly questionsRemaining: number;
  readonly log: readonly { id: string; by: PlayerSlot; text: string; answer: Answer | null }[];
  readonly wrongGuesses: Readonly<Record<PlayerSlot, readonly string[]>>;
  readonly result: Game["result"];
  /** Présent uniquement en fin de partie. */
  readonly reveal?: Readonly<Record<PlayerSlot, string>>;
}

/** Seule projection de l'état envoyée à un client (GET /api/games/[id]/me). */
export function toPlayerView(game: Game, you: PlayerSlot): PlayerView {
  const view: PlayerView = {
    gameId: game.id,
    themeId: game.themeId,
    answerMode: game.answerMode,
    version: game.version,
    status: game.status,
    you,
    yourSecretId: game.players[you].secretId,
    turn: game.turn,
    pendingQuestionId: game.pendingQuestionId,
    questionsRemaining: MAX_QUESTIONS_PER_PLAYER - game.players[you].questionsAsked,
    log: game.log.map(({ id, by, text, answer }) => ({ id, by, text, answer })),
    wrongGuesses: { A: game.players.A.wrongGuesses, B: game.players.B.wrongGuesses },
    result: game.result,
  };
  return game.status === "FINISHED" ? { ...view, reveal: reveal(game) } : view;
}

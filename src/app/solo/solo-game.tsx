"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Analysis } from "@/domain/analysis";
import { findCharacter, type Answer } from "@/domain/engine";
import {
  chooseMove,
  questionText,
  type AskedQuestion,
  type Difficulty,
} from "@/domain/game/ai-opponent";
import {
  applyAction,
  createGame,
  MAX_QUESTIONS_PER_PLAYER,
  type Game,
  type GameAction,
  type GameError,
} from "@/domain/game/game";
import type { AnyTheme } from "@/domain/theme.types";
import { shonenTheme } from "@/themes/shonen";

/**
 * Prototype jouable 100 % client : moteur et IA du domaine, questions
 * structurées (le texte libre arbitré par LLM arrive avec le backend).
 */

const theme: AnyTheme = shonenTheme;

function randomInt(maxExclusive: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % maxExclusive;
}

const random01 = () => randomInt(0x100000000) / 0x100000000;

const ANSWER_LABEL: Record<Answer, string> = {
  OUI: "Oui",
  NON: "Non",
  JE_NE_SAIS_PAS: "Je ne sais pas",
};

const ERROR_LABEL: Record<GameError, string> = {
  VERSION_CONFLICT: "Action déjà jouée, réessaie.",
  GAME_FINISHED: "La partie est terminée.",
  NOT_YOUR_TURN: "Ce n'est pas ton tour.",
  AWAITING_ANSWER: "Une question attend encore sa réponse.",
  NO_PENDING_QUESTION: "Aucune question en attente.",
  QUESTION_LIMIT_REACHED: "Plus de questions disponibles : à toi de deviner !",
  ANALYSIS_REQUIRED: "Question impossible à analyser.",
  UNKNOWN_CHARACTER: "Personnage inconnu.",
  ALREADY_GUESSED: "Tu as déjà tenté ce personnage.",
  INVALID_ACTION: "Action impossible.",
};

const attributeKeys = Object.keys(theme.attributes);

export function SoloGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [game, setGame] = useState<Game | null>(null);
  const [eliminated, setEliminated] = useState<ReadonlySet<string>>(new Set());
  const [guessArmed, setGuessArmed] = useState(false);
  const [selectedAttr, setSelectedAttr] = useState<string>(attributeKeys[0] ?? "gender");
  const [message, setMessage] = useState("");

  function start() {
    const first = randomInt(2) === 0 ? "A" : "B";
    const fresh = createGame({ id: crypto.randomUUID(), theme, answerMode: "ai_referee", firstTurn: first }, randomInt);
    setGame(fresh);
    setEliminated(new Set());
    setGuessArmed(false);
    setMessage(first === "A" ? "À toi de jouer !" : "L'IA commence…");
  }

  // Tour de l'IA : un coup par rendu, tant que c'est à elle de jouer.
  useEffect(() => {
    if (!game || game.status !== "PLAYING" || game.turn !== "B") return;
    const timer = setTimeout(() => {
      const history: AskedQuestion[] = game.log.flatMap((q) =>
        q.by === "B" && q.analysis && q.answer ? [{ analysis: q.analysis, answer: q.answer }] : [],
      );
      const move = chooseMove({
        theme,
        history,
        wrongGuesses: game.players.B.wrongGuesses,
        difficulty,
        canAsk: game.players.B.questionsAsked < MAX_QUESTIONS_PER_PLAYER,
        random: random01,
      });
      const action: GameAction =
        move.type === "ask"
          ? { type: "ask", by: "B", questionId: crypto.randomUUID(), text: move.text, analysis: move.analysis }
          : { type: "guess", by: "B", characterId: move.characterId };
      const result = applyAction(game, theme, action, game.version);
      if (!result.ok) return;
      if (move.type === "ask") {
        const answered = result.events.find((e) => e.type === "question_answered");
        const label = answered?.type === "question_answered" ? ANSWER_LABEL[answered.answer] : "…";
        setMessage(`IA : « ${move.text} » → ${label}`);
      } else {
        const name = findCharacter(theme, move.characterId).name;
        const correct = result.events.some((e) => e.type === "guess_made" && e.correct);
        setMessage(correct ? `L'IA a trouvé ton personnage : ${name} !` : `L'IA propose ${name}… raté !`);
      }
      setGame(result.game);
    }, 900);
    return () => clearTimeout(timer);
  }, [game, difficulty]);

  function ask(attribute: string, value: string) {
    if (!game) return;
    const def = theme.attributes[attribute];
    if (!def) return;
    const analysis: Analysis = { type: "predicate", attribute, value, negated: false };
    const action: GameAction = {
      type: "ask",
      by: "A",
      questionId: crypto.randomUUID(),
      text: questionText(def, value),
      analysis,
    };
    const result = applyAction(game, theme, action, game.version);
    if (!result.ok) {
      setMessage(ERROR_LABEL[result.error]);
      return;
    }
    const answered = result.events.find((e) => e.type === "question_answered");
    if (answered?.type === "question_answered") {
      setMessage(`Réponse : ${ANSWER_LABEL[answered.answer]}`);
    }
    setGame(result.game);
  }

  function onCardClick(characterId: string) {
    if (!game || game.status !== "PLAYING") return;
    if (!guessArmed) {
      setEliminated((current) => {
        const next = new Set(current);
        if (next.has(characterId)) next.delete(characterId);
        else next.add(characterId);
        return next;
      });
      return;
    }
    const result = applyAction(game, theme, { type: "guess", by: "A", characterId }, game.version);
    setGuessArmed(false);
    if (!result.ok) {
      setMessage(ERROR_LABEL[result.error]);
      return;
    }
    const name = findCharacter(theme, characterId).name;
    const correct = result.events.some((e) => e.type === "guess_made" && e.correct);
    setMessage(correct ? `Bravo, c'était bien ${name} !` : `Raté, ce n'était pas ${name}. L'IA joue…`);
    setGame(result.game);
  }

  // ── Écran d'accueil ────────────────────────────────────────────────────────
  if (!game) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-3xl font-bold">Qui est-ce ? — Solo</h1>
        <p className="text-muted-foreground">
          Thème « {theme.title} ». Pose des questions, élimine des suspects, et devine le personnage
          secret de l&apos;IA avant qu&apos;elle ne trouve le tien.
        </p>
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">Difficulté</legend>
          {(["easy", "hard"] as const).map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="difficulty"
                checked={difficulty === level}
                onChange={() => setDifficulty(level)}
              />
              {level === "easy" ? "Facile" : "Difficile"}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={start}
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Commencer la partie
        </button>
        <Link href="/" className="text-sm underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  const yourSecret = findCharacter(theme, game.players.A.secretId);
  const yourTurn = game.status === "PLAYING" && game.turn === "A";
  const questionsLeft = MAX_QUESTIONS_PER_PLAYER - game.players.A.questionsAsked;
  const selectedDef = theme.attributes[selectedAttr];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Qui est-ce ? — Solo ({difficulty === "easy" ? "facile" : "difficile"})</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-md bg-muted px-2 py-1">Questions restantes : {questionsLeft}</span>
          <span
            className={`rounded-md px-2 py-1 font-semibold ${yourTurn ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"}`}
          >
            {game.status === "FINISHED" ? "Partie terminée" : yourTurn ? "À toi !" : "L'IA réfléchit…"}
          </span>
        </div>
      </header>

      <p aria-live="polite" className="min-h-6 rounded-md bg-muted px-3 py-2 text-sm">
        {message}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Colonne de gauche : secret + questions */}
        <aside className="flex w-full flex-col gap-4 lg:w-72">
          <section className="rounded-xl border p-3">
            <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Ton personnage secret</h2>
            <div className="flex items-center gap-3">
              <Image src={yourSecret.image.src} alt={yourSecret.image.alt} width={60} height={75} unoptimized />
              <p className="font-semibold">{yourSecret.name}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">L&apos;IA doit le deviner : ne lui facilite pas la tâche !</p>
          </section>

          <section className="rounded-xl border p-3">
            <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Poser une question</h2>
            <label className="mb-2 block text-sm">
              Caractéristique
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={selectedAttr}
                onChange={(event) => setSelectedAttr(event.target.value)}
              >
                {attributeKeys.map((key) => (
                  <option key={key} value={key}>
                    {theme.attributes[key]?.label ?? key}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedDef?.kind === "boolean" ? (
                <button
                  type="button"
                  disabled={!yourTurn}
                  onClick={() => ask(selectedAttr, "true")}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
                >
                  {questionText(selectedDef, "true")}
                </button>
              ) : (
                selectedDef?.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!yourTurn}
                    onClick={() => ask(selectedAttr, value)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
                  >
                    {value}
                  </button>
                ))
              )}
            </div>
          </section>

          <button
            type="button"
            disabled={!yourTurn}
            onClick={() => setGuessArmed((armed) => !armed)}
            aria-pressed={guessArmed}
            className={`rounded-lg border-2 px-4 py-2 font-semibold disabled:opacity-40 ${guessArmed ? "border-red-500 bg-red-100 text-red-900" : "border-primary"}`}
          >
            {guessArmed ? "Clique le personnage à accuser !" : "🎯 Deviner le personnage"}
          </button>

          <section className="rounded-xl border p-3">
            <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Historique</h2>
            <ol className="flex max-h-64 flex-col-reverse gap-1 overflow-y-auto text-sm">
              {game.log.map((entry) => (
                <li key={entry.id} className="rounded bg-muted/60 px-2 py-1">
                  <span className="font-semibold">{entry.by === "A" ? "Toi" : "IA"}</span> : {entry.text}{" "}
                  <span className="font-semibold">
                    → {entry.answer ? ANSWER_LABEL[entry.answer] : "…"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        {/* Plateau */}
        <section className="flex-1">
          <h2 className="sr-only">Plateau des personnages</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {theme.characters.map((character) => {
              const isEliminated = eliminated.has(character.id);
              const wronglyGuessed = game.players.A.wrongGuesses.includes(character.id);
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    onClick={() => onCardClick(character.id)}
                    aria-pressed={isEliminated}
                    aria-label={`${character.name}${isEliminated ? " (éliminé)" : ""}${wronglyGuessed ? " (déjà tenté)" : ""}`}
                    className={`w-full rounded-lg border p-1 text-center transition hover:border-primary ${isEliminated ? "opacity-30 grayscale" : ""} ${guessArmed ? "ring-2 ring-red-400" : ""}`}
                  >
                    <Image
                      src={character.image.src}
                      alt={character.image.alt}
                      width={120}
                      height={150}
                      unoptimized
                      className="mx-auto"
                    />
                    <span className="block truncate text-xs font-medium">
                      {wronglyGuessed ? "✗ " : ""}
                      {character.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Fin de partie */}
      {game.status === "FINISHED" && game.result && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 text-center shadow-xl">
            <h2 className="text-2xl font-bold">
              {game.result.winner === "A" ? "🎉 Victoire !" : "😅 L'IA a gagné…"}
            </h2>
            <p className="mt-3">
              Ton secret : <strong>{findCharacter(theme, game.players.A.secretId).name}</strong>
              <br />
              Secret de l&apos;IA : <strong>{findCharacter(theme, game.players.B.secretId).name}</strong>
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={start}
                className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground hover:opacity-90"
              >
                Rejouer
              </button>
              <button type="button" onClick={() => setGame(null)} className="rounded-lg border px-5 py-2">
                Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

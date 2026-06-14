"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  makeCode,
  selectLobbyQuestions,
  openLobbyChannel,
  TOTAL_QUESTIONS,
  BUZZ_WINDOW_SEC,
  ANSWER_WINDOW_SEC,
  BLANK_GAME,
  type PlayerPresence,
  type GameState,
} from "@/lib/lobby";
import { CATEGORY_HEX, CATEGORY_LABEL, type Category } from "@/lib/types";
import type { Question } from "@/lib/types";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { shuffled } from "@/lib/rng";

export default function LobbyGame({
  pool,
  hasBackend,
}: {
  pool: Question[];
  hasBackend: boolean;
}) {
  // ── entry form ──────────────────────────────────────────────────
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [entryError, setEntryError] = useState("");

  // ── session ─────────────────────────────────────────────────────
  const [myName, setMyName] = useState("");
  const [amHost, setAmHost] = useState(false);
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState<PlayerPresence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── game state: ref for sync access, state for re-renders ───────
  const gsRef = useRef<GameState>({ ...BLANK_GAME });
  const [gs, setGsRender] = useState<GameState>({ ...BLANK_GAME });

  // ── host-only refs ───────────────────────────────────────────────
  const questionsRef = useRef<Question[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buzzLockedRef = useRef(false);

  // ── client-side visual timer ─────────────────────────────────────
  const [timeProgress, setTimeProgress] = useState(100);

  useEffect(() => {
    if (gs.phase !== "question" && gs.phase !== "answering") {
      setTimeProgress(100);
      return;
    }
    const tick = setInterval(() => {
      const elapsed = (Date.now() - gs.startedAt) / 1000;
      setTimeProgress(Math.max(0, (1 - elapsed / gs.windowSec) * 100));
    }, 80);
    return () => clearInterval(tick);
  }, [gs.phase, gs.startedAt, gs.windowSec]);

  // ── buzzer guard for non-host players ────────────────────────────
  const [buzzedThisRound, setBuzzedThisRound] = useState(false);
  const prevQIdx = useRef(-1);
  useEffect(() => {
    if (gs.questionIdx !== prevQIdx.current) {
      prevQIdx.current = gs.questionIdx;
      setBuzzedThisRound(false);
    }
  }, [gs.questionIdx]);

  // ── cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      channelRef.current?.unsubscribe();
    };
  }, []);

  // ── core setter: keeps ref in sync, optionally broadcasts ────────
  const setGs = useCallback((next: GameState, broadcast = false) => {
    gsRef.current = next;
    setGsRender(next);
    if (broadcast && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "host:state",
        payload: next,
      });
    }
  }, []);

  // ── host: start a question ───────────────────────────────────────
  const hostQuestion = useCallback(
    (idx: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      buzzLockedRef.current = false;
      const q = questionsRef.current[idx];
      if (!q) return;
      const choices = shuffled(q.choices ?? [], () => Math.random());
      const next: GameState = {
        ...gsRef.current,
        phase: "question",
        questionIdx: idx,
        totalQuestions: questionsRef.current.length,
        prompt: q.prompt,
        choices,
        category: q.category,
        buzzedBy: null,
        correct: null,
        wasCorrect: null,
        startedAt: Date.now(),
        windowSec: BUZZ_WINDOW_SEC,
      };
      setGs(next, true);
      sfx.select();

      timerRef.current = setTimeout(() => {
        const reveal: GameState = {
          ...gsRef.current,
          phase: "reveal",
          correct: q.correct,
          wasCorrect: null,
        };
        setGs(reveal, true);
        sfx.wrong();
      }, BUZZ_WINDOW_SEC * 1000);
    },
    [setGs],
  );

  // ── host: handle a buzz-in ───────────────────────────────────────
  const hostBuzz = useCallback(
    (playerName: string) => {
      if (buzzLockedRef.current || gsRef.current.phase !== "question") return;
      buzzLockedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);

      const answering: GameState = {
        ...gsRef.current,
        phase: "answering",
        buzzedBy: playerName,
        startedAt: Date.now(),
        windowSec: ANSWER_WINDOW_SEC,
      };
      setGs(answering, true);
      sfx.countdown();

      timerRef.current = setTimeout(() => {
        const q = questionsRef.current[gsRef.current.questionIdx];
        const reveal: GameState = {
          ...gsRef.current,
          phase: "reveal",
          correct: q?.correct ?? "",
          wasCorrect: false,
        };
        setGs(reveal, true);
        sfx.wrong();
      }, ANSWER_WINDOW_SEC * 1000);
    },
    [setGs],
  );

  // ── host: handle a player answer ────────────────────────────────
  const hostAnswer = useCallback(
    (playerName: string, choice: string) => {
      const cur = gsRef.current;
      if (cur.phase !== "answering" || cur.buzzedBy !== playerName) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      const q = questionsRef.current[cur.questionIdx];
      const correct = q?.correct ?? "";
      const wasCorrect = choice === correct;
      const newScores = { ...cur.scores };
      if (wasCorrect) newScores[playerName] = (newScores[playerName] ?? 0) + 1000;

      const reveal: GameState = { ...cur, phase: "reveal", correct, wasCorrect, scores: newScores };
      setGs(reveal, true);
      if (wasCorrect) { sfx.correct(); haptic.tap(); }
      else { sfx.wrong(); haptic.wrong(); }
    },
    [setGs],
  );

  // ── join channel (shared by host + players) ──────────────────────
  const joinChannel = useCallback(
    (roomCode: string, name: string, isHost: boolean, questions: Question[]) => {
      const ch = openLobbyChannel(roomCode);
      if (!ch) {
        setEntryError("Could not open Realtime channel — check Supabase config.");
        return;
      }
      channelRef.current = ch;

      if (!isHost) {
        ch.on(
          "broadcast",
          { event: "host:state" },
          ({ payload }: { payload: GameState }) => {
            const prev = gsRef.current;
            setGs(payload);
            // Sound cues for players
            if (payload.phase === "question" && prev.phase !== "question") sfx.select();
            if (payload.phase === "answering" && prev.phase !== "answering") sfx.countdown();
            if (payload.phase === "reveal") {
              if (payload.buzzedBy === name) {
                payload.wasCorrect ? sfx.correct() : sfx.wrong();
                payload.wasCorrect ? haptic.tap() : haptic.wrong();
              }
            }
            if (payload.phase === "podium" && prev.phase !== "podium") { sfx.win(); haptic.win(); }
          },
        );
      }

      if (isHost) {
        ch.on(
          "broadcast",
          { event: "player:buzz" },
          ({ payload }: { payload: { name: string } }) => {
            hostBuzz(payload.name);
          },
        );
        ch.on(
          "broadcast",
          { event: "player:answer" },
          ({ payload }: { payload: { name: string; choice: string } }) => {
            hostAnswer(payload.name, payload.choice);
          },
        );
      }

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<PlayerPresence>();
        setPlayers(Object.values(state).flat());
      });

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ name, isHost });
          if (isHost) {
            questionsRef.current = questions;
            setGs({ ...BLANK_GAME, phase: "waiting" });
          }
        }
      });
    },
    [setGs, hostBuzz, hostAnswer],
  );

  // ── entry actions ────────────────────────────────────────────────
  function createRoom() {
    const name = nameInput.trim();
    if (!name) { setEntryError("Enter your name first."); return; }
    const qs = selectLobbyQuestions(pool, TOTAL_QUESTIONS);
    if (qs.length === 0) { setEntryError("Question bank is empty — run the pipeline first."); return; }
    const roomCode = makeCode();
    setMyName(name);
    setAmHost(true);
    setCode(roomCode);
    joinChannel(roomCode, name, true, qs);
  }

  function joinRoom() {
    const name = nameInput.trim();
    const roomCode = codeInput.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!name) { setEntryError("Enter your name."); return; }
    if (roomCode.length !== 4) { setEntryError("Enter the 4-letter room code."); return; }
    setMyName(name);
    setAmHost(false);
    setCode(roomCode);
    joinChannel(roomCode, name, false, []);
  }

  // ── player: buzz in ─────────────────────────────────────────────
  function playerBuzz() {
    if (gs.phase !== "question" || buzzedThisRound) return;
    setBuzzedThisRound(true);
    if (amHost) {
      hostBuzz(myName);
    } else {
      channelRef.current?.send({
        type: "broadcast",
        event: "player:buzz",
        payload: { name: myName },
      });
    }
    sfx.countdown();
    haptic.tap();
  }

  // ── player: submit answer ────────────────────────────────────────
  function playerAnswer(choice: string) {
    if (gs.phase !== "answering" || gs.buzzedBy !== myName) return;
    if (amHost) {
      hostAnswer(myName, choice);
    } else {
      channelRef.current?.send({
        type: "broadcast",
        event: "player:answer",
        payload: { name: myName, choice },
      });
    }
  }

  // ── host: advance to next question or podium ─────────────────────
  function hostAdvance() {
    const nextIdx = gs.questionIdx + 1;
    if (nextIdx >= questionsRef.current.length) {
      const podium: GameState = { ...gsRef.current, phase: "podium" };
      setGs(podium, true);
      sfx.win();
      haptic.win();
    } else {
      hostQuestion(nextIdx);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  if (!hasBackend) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="display text-5xl sm:text-6xl">The Lobby</h1>
        <p className="mt-4 max-w-md text-muted">
          Live multiplayer requires a Supabase backend. Add{" "}
          <code className="rounded bg-surface px-1 text-sm">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="rounded bg-surface px-1 text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          to your deployment to unlock this room.
        </p>
        <p className="mt-3 text-sm text-muted">All nine other rooms work offline.</p>
      </div>
    );
  }

  // ── Entry ────────────────────────────────────────────────────────
  if (gs.phase === "entry") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="display text-5xl sm:text-6xl">The Lobby</h1>
        <p className="max-w-sm text-muted">
          Live multiplayer trivia. First to buzz in answers the question.
        </p>

        <input
          className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-3 text-center text-lg outline-none focus:border-ink"
          placeholder="your name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
          maxLength={12}
          autoFocus
        />

        {entryError && <p className="text-sm text-music">{entryError}</p>}

        <button
          onClick={createRoom}
          className="microlabel rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
        >
          create room
        </button>

        <div className="flex items-center gap-3">
          <input
            className="w-28 rounded-xl border border-line bg-surface px-3 py-3 text-center text-lg font-bold uppercase tracking-widest outline-none focus:border-ink"
            placeholder="CODE"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            maxLength={4}
          />
          <button
            onClick={joinRoom}
            className="microlabel rounded-full border border-line px-6 py-3 transition hover:border-ink"
          >
            join →
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting ──────────────────────────────────────────────────────
  if (gs.phase === "waiting") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="display text-5xl sm:text-6xl">The Lobby</h1>
        <p className="microlabel">
          {amHost ? "share this code — others type it to join" : "connected · waiting for the host"}
        </p>

        <div className="display text-7xl tracking-[0.25em] text-wildcard sm:text-9xl">{code}</div>

        <div className="flex flex-wrap justify-center gap-2">
          {players.length === 0 ? (
            <span className="text-sm text-muted">waiting for players…</span>
          ) : (
            players.map((p) => (
              <span
                key={p.name}
                className={`microlabel rounded-full border px-3 py-1 ${
                  p.name === myName ? "border-wildcard text-wildcard" : "border-line"
                }`}
              >
                {p.name}
                {p.isHost ? " ★" : ""}
              </span>
            ))
          )}
        </div>

        {amHost && (
          <button
            onClick={() => hostQuestion(0)}
            className="microlabel mt-2 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
          >
            start game · {questionsRef.current.length} questions
          </button>
        )}
      </div>
    );
  }

  // ── Podium ───────────────────────────────────────────────────────
  if (gs.phase === "podium") {
    const sorted = Object.entries(gs.scores).sort((a, b) => b[1] - a[1]);
    const myRank = sorted.findIndex(([n]) => n === myName);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <p className="microlabel">game over · room {code}</p>
        <h1 className="display text-5xl">Final Scores</h1>
        {myRank === 0 && sorted.length > 1 && (
          <p className="font-bold text-wildcard">You won! 🏆</p>
        )}
        <div className="flex w-full max-w-sm flex-col gap-3">
          {sorted.map(([name, score], i) => (
            <div
              key={name}
              className={`flex items-center justify-between rounded-xl border bg-surface px-5 py-3 ${
                name === myName ? "border-wildcard" : "border-line"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="microlabel text-muted">{i + 1}</span>
                <span className="font-bold">{name}</span>
                {name === myName && <span className="microlabel text-wildcard">you</span>}
              </span>
              <span className="tabular text-xl font-black text-wildcard">{score}</span>
            </div>
          ))}
          {sorted.length === 0 && <p className="text-muted">No one scored.</p>}
        </div>
        {amHost && (
          <button
            onClick={() => {
              const qs = selectLobbyQuestions(pool, TOTAL_QUESTIONS);
              questionsRef.current = qs;
              setGs({ ...BLANK_GAME, phase: "waiting" }, true);
            }}
            className="microlabel mt-2 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
          >
            play again
          </button>
        )}
      </div>
    );
  }

  // ── Active game (question / answering / reveal) ──────────────────
  const hex = CATEGORY_HEX[(gs.category as Category)] ?? CATEGORY_HEX.wildcard;
  const amBuzzed = gs.buzzedBy === myName;
  const someoneElseBuzzed = gs.phase === "answering" && !amBuzzed;
  const canAnswer = gs.phase === "answering" && amBuzzed;
  const showChoices = gs.phase === "answering" || gs.phase === "reveal";

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="display text-4xl sm:text-5xl">The Lobby</h1>
          <p className="microlabel mt-1">
            {code} · Q{gs.questionIdx + 1}&thinsp;/&thinsp;{gs.totalQuestions}
          </p>
        </div>
        <div className="text-right">
          <div className="microlabel">your score</div>
          <div className="tabular text-3xl font-black text-wildcard">{gs.scores[myName] ?? 0}</div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full"
          style={{ background: hex }}
          animate={{
            width: gs.phase === "reveal" ? "0%" : `${timeProgress}%`,
          }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      {/* Question card */}
      <div
        className={`rounded-2xl border bg-surface p-6 transition-colors sm:p-8 ${
          gs.phase === "reveal"
            ? gs.wasCorrect
              ? "border-sports"
              : gs.wasCorrect === false
                ? "border-music"
                : "border-line"
            : "border-line"
        }`}
      >
        <span className="microlabel" style={{ color: hex }}>
          {CATEGORY_LABEL[(gs.category as Category)] ?? gs.category}
        </span>
        <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{gs.prompt}</p>

        {/* Buzz phase — big button */}
        {gs.phase === "question" && (
          <div className="mt-8 flex justify-center">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={playerBuzz}
              disabled={buzzedThisRound}
              className="microlabel rounded-full border-2 border-wildcard px-12 py-5 text-xl text-wildcard transition hover:bg-wildcard hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⚡ Buzz In!
            </motion.button>
          </div>
        )}

        {/* Answering + reveal — choices grid */}
        {showChoices && (
          <div className="mt-6">
            {gs.phase === "answering" && (
              <p className="microlabel mb-4">
                {amBuzzed
                  ? "⚡ You have the buzzer — pick fast!"
                  : `⚡ ${gs.buzzedBy} is answering…`}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {gs.choices.map((choice) => {
                const isCorrect = gs.phase === "reveal" && choice === gs.correct;
                return (
                  <button
                    key={choice}
                    onClick={() => canAnswer && playerAnswer(choice)}
                    disabled={!canAnswer && gs.phase !== "reveal"}
                    className={[
                      "flex items-center gap-3 rounded-xl border p-4 text-left font-bold transition",
                      isCorrect ? "border-sports text-sports" : "border-line",
                      canAnswer ? "cursor-pointer hover:border-ink active:scale-[0.98]" : "cursor-default",
                      someoneElseBuzzed ? "opacity-40" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {isCorrect && <span className="shrink-0 text-sports">✓</span>}
                    {choice}
                  </button>
                );
              })}
            </div>

            {gs.phase === "reveal" && (
              <p
                className={`mt-4 text-center font-bold ${
                  gs.wasCorrect === null
                    ? "text-muted"
                    : gs.wasCorrect
                      ? "text-sports"
                      : "text-music"
                }`}
              >
                {gs.wasCorrect === null
                  ? "Nobody buzzed in time."
                  : gs.wasCorrect
                    ? `✓ ${gs.buzzedBy} got it!`
                    : `✗ ${gs.buzzedBy} missed — the answer was ${gs.correct}.`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Live scores sidebar */}
      {Object.keys(gs.scores).length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {Object.entries(gs.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([name, score]) => (
              <div
                key={name}
                className={`rounded-xl border bg-surface px-4 py-2 ${
                  name === myName ? "border-wildcard" : "border-line"
                }`}
              >
                <p className="text-xs text-muted">
                  {name}
                  {name === myName ? " · you" : ""}
                </p>
                <p className="tabular font-black text-wildcard">{score}</p>
              </div>
            ))}
        </div>
      )}

      {/* Host-only: next question / podium button */}
      {amHost && gs.phase === "reveal" && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={hostAdvance}
            className="microlabel rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
          >
            {gs.questionIdx + 1 >= gs.totalQuestions ? "see final scores →" : "next question →"}
          </button>
        </div>
      )}
    </div>
  );
}

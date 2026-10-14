"use client";

import { useEffect, useRef, useState } from "react";
import {
  RANKS,
  SUITS,
  autoFoundation,
  canMove,
  draw,
  isRed,
  isWon,
  move,
  newGame,
  type Card,
  type GameState,
  type Source,
  type Target,
} from "../lib/solitaire";

function CardView({
  card,
  selected,
  style,
  onClick,
  onDoubleClick,
  onPointerDown,
}: {
  card: Card;
  selected?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const base =
    "absolute left-0 w-full aspect-[5/7] rounded-md border shadow select-none cursor-pointer";
  if (!card.up)
    return (
      <div
        className={`${base} border-white bg-blue-800`}
        style={{
          ...style,
          backgroundImage:
            "repeating-linear-gradient(45deg, #1e40af 0 6px, #1d4ed8 6px 12px)",
        }}
        onClick={onClick}
      />
    );
  return (
    <div
      className={`${base} bg-white ${isRed(card.suit) ? "text-red-600" : "text-zinc-900"} ${
        selected ? "border-yellow-400 ring-4 ring-yellow-400" : "border-zinc-400"
      }`}
      style={{ ...style, touchAction: "none" }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      <div className="absolute left-1 top-0.5 text-xs font-bold leading-tight sm:text-base">
        {RANKS[card.rank]}
        {card.suit}
      </div>
      <div className="absolute inset-0 flex items-center justify-center text-2xl sm:text-5xl">
        {card.suit}
      </div>
    </div>
  );
}

function Slot({
  label,
  drop,
  onClick,
  children,
}: {
  label?: string;
  drop?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-drop={drop}
      className="relative aspect-[5/7] w-full rounded-md border-2 border-dashed border-white/30"
      onClick={onClick}
    >
      <span className="absolute inset-0 flex items-center justify-center text-2xl text-white/30 sm:text-4xl">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function Solitaire() {
  const [game, setGame] = useState<GameState | null>(null);
  const [history, setHistory] = useState<GameState[]>([]);
  const [sel, setSel] = useState<Source | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [drag, setDrag] = useState<{ src: Source; cards: Card[]; x: number; y: number; w: number } | null>(null);
  const suppressClick = useRef(false);

  const won = game ? isWon(game) : false;

  useEffect(() => {
    // Gera o baralho só no cliente (evita divergência de hidratação)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGame(newGame());
  }, []);

  useEffect(() => {
    if (!game || won) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [game, won]);

  if (!game) return null;

  const apply = (next: GameState) => {
    if (next === game) return;
    setHistory((h) => [...h, game]);
    setGame(next);
    setSel(null);
  };

  const restart = () => {
    setGame(newGame());
    setHistory([]);
    setSel(null);
    setSeconds(0);
  };

  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setGame(prev);
    setHistory(history.slice(0, -1));
    setSel(null);
  };

  const sameSel = (a: Source, b: Source) =>
    a.kind === b.kind &&
    (a.kind === "waste" || (a as { pile: number }).pile === (b as { pile: number }).pile) &&
    (a.kind !== "tableau" || a.index === (b as { index: number }).index);

  const clickCard = (src: Source, card: Card, dst: Target) => {
    if (suppressClick.current) return;
    if (sel && !sameSel(sel, src) && canMove(game, sel, dst)) return apply(move(game, sel, dst));
    if (!card.up) {
      setSel(null);
      return;
    }
    setSel(sel && sameSel(sel, src) ? null : src);
  };

  const clickPile = (dst: Target) => {
    if (sel && canMove(game, sel, dst)) apply(move(game, sel, dst));
    else setSel(null);
  };

  const startDrag = (e: React.PointerEvent, src: Source, cards: Card[]) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const offX = sx - rect.left;
    const offY = sy - rect.top;
    const w = rect.width;
    let started = false;
    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        started = true;
      }
      setDrag({ src, cards, x: ev.clientX - offX, y: ev.clientY - offY, w });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!started) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      setDrag(null);
      const id = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-drop]")?.getAttribute("data-drop");
      if (!id) return;
      const [k, n] = id.split(":");
      const dst: Target = k === "f" ? { kind: "foundation", pile: +n } : { kind: "tableau", pile: +n };
      apply(move(game, src, dst));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const isDragged = (src: Source) =>
    !!drag &&
    drag.src.kind === src.kind &&
    (src.kind === "waste" ||
      ((drag.src as { pile: number }).pile === (src as { pile: number }).pile &&
        (src.kind !== "tableau" || (drag.src as { index: number }).index <= src.index)));

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const isSel = (src: Source) => !!sel && sameSel(sel, src);
  const selTableau = (p: number, i: number) =>
    sel?.kind === "tableau" && sel.pile === p && i >= sel.index;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 text-white">
        <h1 className="text-xl font-bold sm:text-2xl">♠ Paciência ♥</h1>
        <div className="flex items-center gap-4 text-sm sm:text-base">
          <span>Movimentos: {game.moves}</span>
          <span>
            Tempo: {mm}:{ss}
          </span>
          <button
            onClick={undo}
            disabled={!history.length}
            className="rounded bg-white/20 px-3 py-1 hover:bg-white/30 disabled:opacity-40"
          >
            Desfazer
          </button>
          <button onClick={restart} className="rounded bg-white/20 px-3 py-1 hover:bg-white/30">
            Novo jogo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {/* Estoque e descarte */}
        <Slot label="↻" onClick={() => apply(draw(game))}>
          {game.stock.length > 0 && (
            <CardView card={{ ...game.stock[0], up: false }} onClick={() => apply(draw(game))} />
          )}
        </Slot>
        <Slot>
          {game.waste.length > 0 && (
            <CardView
              card={game.waste.at(-1)!}
              selected={isSel({ kind: "waste" })}
              style={isDragged({ kind: "waste" }) ? { visibility: "hidden" } : undefined}
              onPointerDown={(e) => startDrag(e, { kind: "waste" }, [game.waste.at(-1)!])}
              onClick={() => clickCard({ kind: "waste" }, game.waste.at(-1)!, { kind: "foundation", pile: 0 })}
              onDoubleClick={() => apply(autoFoundation(game, { kind: "waste" }))}
            />
          )}
        </Slot>
        <div />
        {/* Fundações */}
        {SUITS.map((suit, p) => {
          const pile = game.foundations[p];
          const top = pile.at(-1);
          const src: Source = { kind: "foundation", pile: p };
          return (
            <Slot key={suit} label={suit} drop={`f:${p}`} onClick={() => clickPile({ kind: "foundation", pile: p })}>
              {top && (
                <CardView
                  card={top}
                  selected={isSel(src)}
                  style={isDragged(src) ? { visibility: "hidden" } : undefined}
                  onPointerDown={(e) => startDrag(e, src, [top])}
                  onClick={() => clickCard(src, top, { kind: "foundation", pile: p })}
                />
              )}
            </Slot>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="grid grid-cols-7 items-start gap-1.5 sm:gap-3">
        {game.tableau.map((col, p) => (
          <div key={p} className="relative" data-drop={`t:${p}`}>
            <Slot label={col.length ? undefined : "K"} onClick={() => clickPile({ kind: "tableau", pile: p })} />
            {col.map((card, i) => {
              const src: Source = { kind: "tableau", pile: p, index: i };
              const dst: Target = { kind: "tableau", pile: p };
              return (
                <CardView
                  key={card.id}
                  card={card}
                  selected={selTableau(p, i)}
                  style={{
                    top: `calc(${i} * var(--step))`,
                    ...(isDragged(src) ? { visibility: "hidden" as const } : {}),
                  }}
                  onPointerDown={(e) => startDrag(e, src, col.slice(i))}
                  onClick={() => clickCard(src, card, dst)}
                  onDoubleClick={() => i === col.length - 1 && apply(autoFoundation(game, src))}
                />
              );
            })}
            {/* reserva a altura da coluna */}
            <div style={{ height: `calc(${Math.max(col.length - 1, 0)} * var(--step))` }} />
          </div>
        ))}
      </div>

      {drag && (
        <div className="pointer-events-none fixed z-40" style={{ left: drag.x, top: drag.y, width: drag.w }}>
          {drag.cards.map((c, i) => (
            <CardView key={c.id} card={c} style={{ top: `calc(${i} * var(--step))` }} />
          ))}
        </div>
      )}

      {won && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="rounded-xl bg-white p-8 text-center text-zinc-900 shadow-2xl">
            <h2 className="mb-2 text-3xl font-bold">🎉 Você venceu!</h2>
            <p className="mb-4">
              {game.moves} movimentos em {mm}:{ss}
            </p>
            <button onClick={restart} className="rounded bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700">
              Jogar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

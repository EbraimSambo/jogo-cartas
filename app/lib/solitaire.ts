export type Suit = "♠" | "♥" | "♦" | "♣";
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export type Card = { id: string; suit: Suit; rank: number; up: boolean };

export type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 pilhas, uma por naipe (índice de SUITS)
  tableau: Card[][]; // 7 colunas
  moves: number;
};

export type Source =
  | { kind: "waste" }
  | { kind: "foundation"; pile: number }
  | { kind: "tableau"; pile: number; index: number };

export type Target = { kind: "foundation"; pile: number } | { kind: "tableau"; pile: number };

export const isRed = (s: Suit) => s === "♥" || s === "♦";

export function newGame(): GameState {
  const deck: Card[] = SUITS.flatMap((suit) =>
    RANKS.map((_, r) => ({ id: `${suit}${r}`, suit, rank: r, up: false })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: Card[][] = [];
  for (let c = 0; c < 7; c++) {
    const col = deck.splice(0, c + 1);
    col[col.length - 1].up = true;
    tableau.push(col);
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, moves: 0 };
}

const clone = (s: GameState): GameState => structuredClone(s);

export function draw(s: GameState): GameState {
  const n = clone(s);
  if (n.stock.length) {
    const c = n.stock.pop()!;
    c.up = true;
    n.waste.push(c);
  } else if (n.waste.length) {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
  } else return s;
  n.moves++;
  return n;
}

function cardsAt(s: GameState, src: Source): Card[] {
  if (src.kind === "waste") return s.waste.slice(-1);
  if (src.kind === "foundation") return s.foundations[src.pile].slice(-1);
  return s.tableau[src.pile].slice(src.index);
}

export function canMove(s: GameState, src: Source, dst: Target): boolean {
  const cards = cardsAt(s, src);
  if (!cards.length || !cards[0].up) return false;
  const first = cards[0];
  if (dst.kind === "foundation") {
    if (cards.length !== 1 || SUITS[dst.pile] !== first.suit) return false;
    return s.foundations[dst.pile].length === first.rank;
  }
  if (src.kind === "tableau" && src.pile === dst.pile) return false;
  const top = s.tableau[dst.pile].at(-1);
  if (!top) return first.rank === 12;
  return top.up && isRed(top.suit) !== isRed(first.suit) && top.rank === first.rank + 1;
}

export function move(s: GameState, src: Source, dst: Target): GameState {
  if (!canMove(s, src, dst)) return s;
  const n = clone(s);
  let cards: Card[];
  if (src.kind === "waste") cards = n.waste.splice(-1);
  else if (src.kind === "foundation") cards = n.foundations[src.pile].splice(-1);
  else {
    cards = n.tableau[src.pile].splice(src.index);
    const left = n.tableau[src.pile].at(-1);
    if (left) left.up = true;
  }
  if (dst.kind === "foundation") n.foundations[dst.pile].push(...cards);
  else n.tableau[dst.pile].push(...cards);
  n.moves++;
  return n;
}

/** Tenta enviar a carta para uma fundação. */
export function autoFoundation(s: GameState, src: Source): GameState {
  for (let p = 0; p < 4; p++) {
    const r = move(s, src, { kind: "foundation", pile: p });
    if (r !== s) return r;
  }
  return s;
}

export const isWon = (s: GameState) => s.foundations.every((f) => f.length === 13);

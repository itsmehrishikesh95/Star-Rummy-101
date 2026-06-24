// =============================================================================
// 101 POOL RUMMY — SERVER-SIDE RULES (authoritative)
// Ported from the client's proven solo-mode logic (GameScreen.evalGroup etc.).
// Card shape: { id, rank, suit }  — suit in S/H/D/C, rank in 'A'..'K'.
// Wild joker: any card whose rank === wildRank acts as a joker; it can also be
// used as its natural card inside a pure sequence. No printed jokers.
// =============================================================================

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TEN_PT = new Set(['A', 'J', 'Q', 'K', '10']);

export function rankIndex(rank) {
  return RANKS.indexOf(rank);
}

export function cardPoints(card) {
  return TEN_PT.has(card.rank) ? 10 : (parseInt(card.rank, 10) || 0);
}

export function isWild(card, wildRank) {
  return !!wildRank && card.rank === wildRank;
}

// Evaluate a single group of cards → { valid, type, pts }
export function evalGroup(group, wildRank) {
  if (!group || group.length === 0) return { valid: false, type: 'empty', pts: 0 };

  const wildJokers = group.filter((c) => isWild(c, wildRank));
  const natural = group.filter((c) => !isWild(c, wildRank));
  const pts = natural.reduce((s, c) => s + cardPoints(c), 0);

  // ── PURE SEQUENCE ── wild jokers used as their natural card value
  {
    const allAsNatural = [...natural, ...wildJokers];
    if (allAsNatural.length >= 3) {
      const sameSuit = allAsNatural.every((c) => c.suit === allAsNatural[0].suit);
      if (sameSuit) {
        const idx = allAsNatural.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
        const noDups = idx.every((v, i) => i === 0 || v !== idx[i - 1]);
        const isConsec = noDups && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
        if (isConsec) return { valid: true, type: 'pureSeq', pts: 0 };
      }
    }
  }

  // ── IMPURE SEQUENCE ── natural cards same suit + consecutive, gaps filled by jokers
  if (natural.length >= 1 && natural.length + wildJokers.length >= 3) {
    const sameSuit = natural.every((c) => c.suit === natural[0].suit);
    if (sameSuit) {
      const idx = natural.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
      const noDups = idx.every((v, i) => i === 0 || v !== idx[i - 1]);
      if (noDups) {
        const gaps = idx.reduce((acc, v, i) => (i === 0 ? 0 : acc + (v - idx[i - 1] - 1)), 0);
        if (gaps <= wildJokers.length) return { valid: true, type: 'seq', pts: 0 };
      }
    }
  }

  // ── SET ── 3-4 cards same rank, different suits, jokers allowed
  if (natural.length >= 2) {
    const sameRank = natural.every((c) => c.rank === natural[0].rank);
    const uniqueSuits = new Set(natural.map((c) => c.suit)).size;
    const total = natural.length + wildJokers.length;
    if (sameRank && uniqueSuits === natural.length && total >= 3 && total <= 4) {
      return { valid: true, type: 'set', pts: 0 };
    }
  }

  return { valid: false, type: 'invalid', pts };
}

// Group a hand by suit (wild jokers in their own bucket) — for scoring best layout.
export function getHandGroups(hand, wildRank) {
  if (!hand || hand.length === 0) return [[]];
  const bySuit = {};
  hand.forEach((card) => {
    const key = isWild(card, wildRank) ? 'joker' : card.suit;
    if (!bySuit[key]) bySuit[key] = [];
    bySuit[key].push(card);
  });
  Object.keys(bySuit).forEach((suit) => {
    if (suit !== 'joker') {
      bySuit[suit].sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));
    }
  });
  return Object.values(bySuit).filter((g) => g.length > 0);
}

// Unmatched-card score for a hand (capped at 80) — used for losers at round end.
export function calcScore(hand, wildRank) {
  const groups = getHandGroups(hand, wildRank);
  const raw = groups.reduce((s, g) => s + evalGroup(g, wildRank).pts, 0);
  return Math.min(raw, 80);
}

// All combinations of `chooseCount` items.
export function buildCombinations(items, chooseCount) {
  const out = [];
  const acc = [];
  (function rec(start) {
    if (acc.length === chooseCount) { out.push([...acc]); return; }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1);
      acc.pop();
    }
  })(0);
  return out;
}

// Backtracking solver — find ANY arrangement of cards into all-valid groups.
export function findValidGrouping(hand, wildRank) {
  const byId = new Map(hand.map((c) => [c.id, c]));
  const memo = new Map();

  function isGroupValid(ids) {
    const cards = ids.map((id) => byId.get(id)).filter(Boolean);
    return evalGroup(cards, wildRank).valid;
  }

  function search(remainingIds) {
    const key = remainingIds.join('|');
    if (memo.has(key)) return memo.get(key);
    if (remainingIds.length === 0) return [];
    if (remainingIds.length < 3) { memo.set(key, null); return null; }

    const fixedId = remainingIds[0];
    const otherIds = remainingIds.slice(1);

    for (let size = 3; size <= Math.min(5, remainingIds.length); size++) {
      const combos = buildCombinations(otherIds, size - 1);
      for (const combo of combos) {
        const groupIds = [fixedId, ...combo];
        if (!isGroupValid(groupIds)) continue;
        const rest = remainingIds.filter((id) => !groupIds.includes(id));
        const tail = search(rest);
        if (tail !== null) {
          const solved = [groupIds.map((id) => byId.get(id)), ...tail];
          memo.set(key, solved);
          return solved;
        }
      }
    }
    memo.set(key, null);
    return null;
  }

  return search(hand.map((c) => c.id));
}

// Verdict: a 13-card hand is a valid declaration if it can be arranged into
// all-valid groups with >=1 pure sequence and >=2 total sequences.
export function getDeclarationVerdict(hand, wildRank) {
  // Try suit grouping first (fast path)
  const suitGroups = getHandGroups(hand, wildRank);
  const suitEvals = suitGroups.map((g) => evalGroup(g, wildRank));
  const suitPure = suitEvals.some((e) => e.type === 'pureSeq');
  const suitSeqs = suitEvals.filter((e) => e.type === 'pureSeq' || e.type === 'seq').length;
  const suitValid = suitEvals.every((e) => e.valid);
  if (suitPure && suitSeqs >= 2 && suitValid) return { valid: true };

  // Backtracking solver
  const solved = findValidGrouping(hand, wildRank);
  if (solved) {
    const evals = solved.map((g) => evalGroup(g, wildRank));
    const pure = evals.some((e) => e.type === 'pureSeq');
    const seqs = evals.filter((e) => e.type === 'pureSeq' || e.type === 'seq').length;
    const allValid = evals.every((e) => e.valid);
    if (pure && seqs >= 2 && allValid) return { valid: true };
  }

  const reason = !suitPure
    ? 'Need at least 1 pure sequence'
    : suitSeqs < 2
      ? 'Need at least 2 sequences'
      : 'Not all cards are in valid groups';
  return { valid: false, reason };
}

// =============================================
// 101 POOL RUMMY GAME ENGINE
// =============================================

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_VALUES = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 }

export function createDeck() {
  const deck = []
  let id = 0
  // Two full decks
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${suit}${rank}_${d}`,
          suit,
          rank,
          value: RANK_VALUES[rank],
          isJoker: false,
          isWildJoker: false,
          color: (suit === '♥' || suit === '♦') ? 'red' : 'black'
        })
        id++
      }
    }
    // Printed joker
    deck.push({ id: `JOKER_${d}`, suit: '🃏', rank: 'JKR', value: 0, isJoker: true, isWildJoker: false, color: 'black' })
  }
  return deck
}

export function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function initGame(playerCount) {
  let deck = shuffle(createDeck())
  
  // Pick wild joker
  const wildJokerCard = deck[Math.floor(Math.random() * deck.length)]
  deck = deck.map(c => ({
    ...c,
    isWildJoker: !c.isJoker && c.rank === wildJokerCard.rank
  }))

  // Deal 13 cards to each player
  const hands = []
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, 13))
  }

  // Open discard pile
  const discardPile = [deck.splice(0, 1)[0]]
  const drawPile = deck

  return {
    hands,
    drawPile,
    discardPile,
    wildJoker: wildJokerCard,
    currentTurn: 0,
    scores: new Array(playerCount).fill(0),
    round: 1,
    phase: 'play', // play | declare | results
    declared: false,
    declaringPlayer: null,
    maxScore: 101,
    dropPenalty: 20,
    middleDropPenalty: 40,
  }
}

export function drawFromPile(game, playerIdx) {
  const g = deepCopy(game)
  if (g.drawPile.length === 0) {
    // Reshuffle discard except top
    const top = g.discardPile.pop()
    g.drawPile = shuffle(g.discardPile)
    g.discardPile = [top]
  }
  const card = g.drawPile.splice(0, 1)[0]
  g.hands[playerIdx].push(card)
  return g
}

export function drawFromDiscard(game, playerIdx) {
  const g = deepCopy(game)
  if (g.discardPile.length === 0) return game
  const card = g.discardPile.pop()
  g.hands[playerIdx].push(card)
  return g
}

export function discardCard(game, playerIdx, cardId) {
  const g = deepCopy(game)
  const idx = g.hands[playerIdx].findIndex(c => c.id === cardId)
  if (idx === -1) return game
  const [card] = g.hands[playerIdx].splice(idx, 1)
  g.discardPile.push(card)
  g.currentTurn = (g.currentTurn + 1) % g.hands.length
  return g
}

export function calculateHandPoints(hand, wildJoker) {
  return hand.reduce((sum, card) => {
    if (card.isJoker || card.isWildJoker || (wildJoker && card.rank === wildJoker.rank)) return sum
    return sum + card.value
  }, 0)
}

// Validate if a group of cards forms a valid set or sequence
export function isValidGroup(cards, wildJoker) {
  if (cards.length < 3) return false
  const jokers = cards.filter(c => c.isJoker || c.isWildJoker || (wildJoker && c.rank === wildJoker.rank))
  const realCards = cards.filter(c => !c.isJoker && !c.isWildJoker && !(wildJoker && c.rank === wildJoker.rank))

  return isValidSequence(realCards, jokers, wildJoker) || isValidSet(realCards, jokers)
}

function isValidSet(realCards, jokers) {
  if (realCards.length + jokers.length < 3 || realCards.length + jokers.length > 4) return false
  if (realCards.length === 0) return false
  const rank = realCards[0].rank
  const suits = new Set(realCards.map(c => c.suit))
  return realCards.every(c => c.rank === rank) && suits.size === realCards.length
}

function isValidSequence(realCards, jokers, wildJoker) {
  if (realCards.length === 0) return jokers.length >= 3
  const suit = realCards[0].suit
  if (!realCards.every(c => c.suit === suit)) return false

  const sortedReal = [...realCards].sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank))
  let needed = 0
  for (let i = 1; i < sortedReal.length; i++) {
    const gap = rankIndex(sortedReal[i].rank) - rankIndex(sortedReal[i-1].rank) - 1
    if (gap < 0) return false
    needed += gap
  }
  return needed <= jokers.length
}

function rankIndex(rank) {
  return RANKS.indexOf(rank)
}

// Validate complete declaration
export function validateDeclaration(hand, groups, wildJoker) {
  // All 13 cards must be in groups
  const allGroupCardIds = groups.flat().map(c => c.id)
  const handIds = hand.map(c => c.id)
  if (allGroupCardIds.length !== 13) return { valid: false, reason: 'Must have exactly 13 cards in groups' }
  if (!handIds.every(id => allGroupCardIds.includes(id))) return { valid: false, reason: 'All cards must be in groups' }

  // Must have at least 2 sequences, one of which must be pure
  const pureSeqs = groups.filter(g => isPureSequence(g, wildJoker))
  const allSeqs = groups.filter(g => isSequenceGroup(g, wildJoker))

  if (pureSeqs.length < 1) return { valid: false, reason: 'Need at least 1 pure sequence' }
  if (allSeqs.length < 2) return { valid: false, reason: 'Need at least 2 sequences' }

  const allValid = groups.every(g => isValidGroup(g, wildJoker))
  if (!allValid) return { valid: false, reason: 'One or more invalid groups' }

  return { valid: true }
}

function isPureSequence(cards, wildJoker) {
  // Wild joker CAN be used as its natural card in a pure sequence
  // e.g. 4♥ 5♥(WJ) 6♥ is pure if 5♥ is wild joker used as 5♥
  const printedJokers = cards.filter(c => c.isJoker)
  if (printedJokers.length > 0) return false  // printed jokers never allowed in pure seq

  // Treat wild jokers as their natural card
  const allAsNatural = cards  // wild jokers already have suit/rank
  if (allAsNatural.length < 3) return false
  const suit = allAsNatural[0].suit
  if (!allAsNatural.every(c => c.suit === suit)) return false

  const idx = allAsNatural.map(c => rankIndex(c.rank)).sort((a, b) => a - b)
  // No duplicates
  if (idx.some((v, i) => i > 0 && v === idx[i - 1])) return false
  // Consecutive
  return idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
}

function isSequenceGroup(cards, wildJoker) {
  const jokers = cards.filter(c => c.isJoker || c.isWildJoker || (wildJoker && c.rank === wildJoker.rank))
  const real = cards.filter(c => !c.isJoker && !c.isWildJoker && !(wildJoker && c.rank === wildJoker.rank))
  return isValidSequence(real, jokers, wildJoker)
}

// AI Player logic
export function aiMakeMove(game, playerIdx) {
  // Simple AI: draw from discard if useful, otherwise draw from pile
  const hand = game.hands[playerIdx]
  const topDiscard = game.discardPile[game.discardPile.length - 1]
  
  let g = game
  if (topDiscard && isCardUseful(hand, topDiscard, game.wildJoker)) {
    g = drawFromDiscard(game, playerIdx)
  } else {
    g = drawFromPile(game, playerIdx)
  }

  // Discard the least useful card
  const newHand = g.hands[playerIdx]
  const cardToDiscard = findLeastUsefulCard(newHand, g.wildJoker)
  g = discardCard(g, playerIdx, cardToDiscard.id)
  
  return g
}

function isCardUseful(hand, card, wildJoker) {
  if (card.isJoker || (wildJoker && card.rank === wildJoker.rank)) return true
  // Check if card connects with existing cards
  const sameSuit = hand.filter(c => c.suit === card.suit)
  const sameRank = hand.filter(c => c.rank === card.rank)
  if (sameRank.length >= 2) return true
  if (sameSuit.some(c => Math.abs(rankIndex(c.rank) - rankIndex(card.rank)) <= 2)) return true
  return false
}

function findLeastUsefulCard(hand, wildJoker) {
  // Don't discard jokers
  const nonJokers = hand.filter(c => !c.isJoker && !(wildJoker && c.rank === wildJoker.rank))
  if (nonJokers.length === 0) return hand[hand.length - 1]
  // Discard highest value isolated card
  return nonJokers.sort((a, b) => b.value - a.value)[0]
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export { SUITS, RANKS, RANK_VALUES }

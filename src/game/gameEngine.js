export const SUITS = ['S', 'H', 'D', 'C']
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const GAME_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
}
export const TURN_STAGE = {
  DRAW: 'draw',
  DISCARD: 'discard',
}

const MAX_POOL_SCORE = 101
const MAX_HAND_PENALTY = 80
const DEAL_SIZE = 13
const PRINTED_JOKERS_PER_DECK = 2

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function cardValue(rank) {
  if (rank === 'A' || rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank) || 0
}

function rankIndex(rank) {
  return RANKS.indexOf(rank)
}

function normalizePlayers(playersOrCount) {
  const count = Array.isArray(playersOrCount) ? playersOrCount.length : playersOrCount
  if (count < 2 || count > 6) {
    throw new Error('101 Pool Rummy requires 2 to 6 players')
  }

  if (Array.isArray(playersOrCount)) {
    return playersOrCount.map((player, index) => ({
      id: player.id ?? player.userId ?? `player-${index}`,
      name: player.name ?? (index === 0 ? 'You' : `Player ${index + 1}`),
      isBot: Boolean(player.isBot),
      eliminated: Boolean(player.eliminated),
    }))
  }

  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? 'player-0' : `player-${index}`,
    name: index === 0 ? 'You' : `Player ${index + 1}`,
    isBot: index !== 0,
    eliminated: false,
  }))
}

export function createDeck() {
  const deck = []

  for (let deckIndex = 0; deckIndex < 2; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${deckIndex}-${suit}-${rank}`,
          deckIndex,
          suit,
          rank,
          value: cardValue(rank),
          isPrintedJoker: false,
          isJoker: false,
        })
      }
    }

    for (let jokerIndex = 0; jokerIndex < PRINTED_JOKERS_PER_DECK; jokerIndex += 1) {
      deck.push({
        id: `${deckIndex}-PJ-${jokerIndex}`,
        deckIndex,
        suit: 'JOKER',
        rank: 'JOKER',
        value: 0,
        isPrintedJoker: true,
        isJoker: true,
      })
    }
  }

  return deck
}

export function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function applyWildJoker(deck, joker) {
  return deck.map(card => ({
    ...card,
    isWildJoker: !card.isPrintedJoker && card.rank === joker.rank,
    isJoker: card.isPrintedJoker || (!card.isPrintedJoker && card.rank === joker.rank),
  }))
}

export function dealCards(playersOrCount, existingScores = {}) {
  const players = normalizePlayers(playersOrCount)
  const shuffled = shuffleDeck(createDeck())
  const jokerSeed = shuffled.find(card => !card.isPrintedJoker) || shuffled[0]
  const joker = { ...jokerSeed, isWildJoker: true, isJoker: true }
  const deck = applyWildJoker(shuffled, joker)
  const hands = {}
  let cursor = 0

  players.forEach(player => {
    hands[player.id] = deck.slice(cursor, cursor + DEAL_SIZE)
    cursor += DEAL_SIZE
  })

  const discardPile = [deck[cursor]].filter(Boolean)
  cursor += discardPile.length
  const remainingDeck = deck.slice(cursor)
  const scores = {}

  players.forEach(player => {
    scores[player.id] = existingScores[player.id] || 0
  })

  return {
    players,
    currentTurn: players.find(player => !player.eliminated)?.id || players[0].id,
    deck: remainingDeck,
    discardPile,
    hands,
    scores,
    joker,
    gameStatus: GAME_STATUS.PLAYING,
    turnStage: TURN_STAGE.DRAW,
    round: 1,
    winnerId: null,
    lastAction: null,
  }
}

function activePlayers(state) {
  return state.players.filter(player => !player.eliminated && (state.scores[player.id] || 0) < MAX_POOL_SCORE)
}

function fail(state, error) {
  return { ok: false, state, error }
}

function ok(state, extra = {}) {
  return { ok: true, state, ...extra }
}

function assertPlayable(state, playerId) {
  if (!state || state.gameStatus !== GAME_STATUS.PLAYING) return 'Game is not playing'
  if (state.currentTurn !== playerId) return 'Not your turn'
  const player = state.players.find(p => p.id === playerId)
  if (!player || player.eliminated || (state.scores[playerId] || 0) >= MAX_POOL_SCORE) return 'Player is eliminated'
  return null
}

function refillDeckIfNeeded(state) {
  if (state.deck.length > 0 || state.discardPile.length <= 1) return state

  const topDiscard = state.discardPile[state.discardPile.length - 1]
  const refill = shuffleDeck(state.discardPile.slice(0, -1))
  return {
    ...state,
    deck: refill,
    discardPile: [topDiscard],
  }
}

export function drawCard(state, playerId, source = 'closed') {
  const error = assertPlayable(state, playerId)
  if (error) return fail(state, error)
  if (state.turnStage !== TURN_STAGE.DRAW) return fail(state, 'You have already drawn this turn')

  let next = refillDeckIfNeeded(clone(state))
  const hand = next.hands[playerId] || []
  let drawnCard = null

  if (source === 'closed') {
    if (next.deck.length === 0) return fail(state, 'Closed deck is empty')
    drawnCard = next.deck.shift()
  } else if (source === 'open') {
    if (next.discardPile.length === 0) return fail(state, 'Open pile is empty')
    drawnCard = next.discardPile.pop()
  } else {
    return fail(state, 'Draw source must be closed or open')
  }

  next.hands[playerId] = [...hand, drawnCard]
  next.turnStage = TURN_STAGE.DISCARD
  next.lastAction = { type: 'draw', playerId, source, cardId: drawnCard.id }
  return ok(next, { card: drawnCard })
}

function findCardIndex(hand, cardOrId) {
  if (typeof cardOrId === 'number') return cardOrId
  const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id
  return hand.findIndex(card => card.id === cardId)
}

export function discardCard(state, playerId, cardOrId) {
  const error = assertPlayable(state, playerId)
  if (error) return fail(state, error)
  if (state.turnStage !== TURN_STAGE.DISCARD) return fail(state, 'Draw before discarding')

  const next = clone(state)
  const hand = next.hands[playerId] || []
  const cardIndex = findCardIndex(hand, cardOrId)

  if (cardIndex < 0 || cardIndex >= hand.length) return fail(state, 'Invalid discard index')
  if (hand.length !== DEAL_SIZE + 1) return fail(state, 'Player must have 14 cards before discarding')

  const [discarded] = hand.splice(cardIndex, 1)
  next.hands[playerId] = hand
  next.discardPile = [...next.discardPile, discarded]
  next.lastAction = { type: 'discard', playerId, cardId: discarded.id }
  return nextTurn(next)
}

export function nextTurn(state) {
  const next = clone(state)
  const remaining = activePlayers(next)
  if (remaining.length <= 1) {
    next.gameStatus = GAME_STATUS.FINISHED
    next.winnerId = remaining[0]?.id || null
    return ok(next)
  }

  const currentIndex = next.players.findIndex(player => player.id === next.currentTurn)
  for (let offset = 1; offset <= next.players.length; offset += 1) {
    const candidate = next.players[(currentIndex + offset) % next.players.length]
    if (remaining.some(player => player.id === candidate.id)) {
      next.currentTurn = candidate.id
      next.turnStage = TURN_STAGE.DRAW
      return ok(next)
    }
  }

  next.gameStatus = GAME_STATUS.FINISHED
  next.winnerId = remaining[0]?.id || null
  return ok(next)
}

function isJoker(card, joker) {
  return Boolean(card?.isPrintedJoker || card?.isWildJoker || card?.isJoker || (!card?.isPrintedJoker && joker && card.rank === joker.rank))
}

function naturalCards(cards, joker) {
  return cards.filter(card => !isJoker(card, joker))
}

function cardKey(card) {
  return card.id
}

export function checkSequence(cards, joker, { pure = false } = {}) {
  const group = cards.filter(Boolean)
  if (group.length < 3) return false
  const naturals = naturalCards(group, joker)
  const jokerCount = group.length - naturals.length
  if (pure && jokerCount > 0) return false
  if (naturals.length === 0) return !pure && jokerCount >= 3

  const suit = naturals[0].suit
  if (!naturals.every(card => card.suit === suit)) return false

  const ranks = naturals
    .map(card => rankIndex(card.rank))
    .sort((a, b) => a - b)

  if (ranks.some(rank => rank < 0)) return false
  if (new Set(ranks).size !== ranks.length) return false

  let gaps = 0
  for (let i = 1; i < ranks.length; i += 1) {
    gaps += ranks[i] - ranks[i - 1] - 1
  }

  return pure ? gaps === 0 : gaps <= jokerCount
}

export function checkSet(cards, joker) {
  const group = cards.filter(Boolean)
  if (group.length < 3 || group.length > 4) return false
  const naturals = naturalCards(group, joker)
  if (naturals.length === 0) return false

  const rank = naturals[0].rank
  const suits = new Set(naturals.map(card => card.suit))
  return naturals.every(card => card.rank === rank) && suits.size === naturals.length
}

function isValidMeld(cards, joker) {
  return checkSequence(cards, joker) || checkSet(cards, joker)
}

function combinations(cards, minSize = 3, maxSize = 13) {
  const result = []
  const limit = Math.min(maxSize, cards.length)

  function walk(start, combo) {
    if (combo.length >= minSize) result.push(combo)
    if (combo.length === limit) return

    for (let i = start; i < cards.length; i += 1) {
      walk(i + 1, [...combo, cards[i]])
    }
  }

  walk(0, [])
  return result
}

function findValidPartition(hand, joker) {
  const cards = hand.filter(Boolean)
  const melds = combinations(cards, 3, 5).filter(group => isValidMeld(group, joker))
  const memo = new Set()

  function search(remaining, groups) {
    if (remaining.length === 0) return groups
    const signature = remaining.map(cardKey).sort().join('|')
    if (memo.has(signature)) return null
    memo.add(signature)

    const first = remaining[0]
    const viable = melds.filter(group => group.some(card => card.id === first.id)
      && group.every(card => remaining.some(item => item.id === card.id)))

    for (const group of viable) {
      const ids = new Set(group.map(card => card.id))
      const nextRemaining = remaining.filter(card => !ids.has(card.id))
      const found = search(nextRemaining, [...groups, group])
      if (found) return found
    }

    return null
  }

  return search(cards, [])
}

export function validateHand(hand, joker, groups = null) {
  const cards = hand.filter(Boolean)
  if (cards.length !== DEAL_SIZE) {
    return { valid: false, reason: 'Declaration must use exactly 13 cards', groups: [] }
  }

  const candidateGroups = groups && groups.length ? groups : findValidPartition(cards, joker)
  if (!candidateGroups) {
    return { valid: false, reason: 'Cards cannot be fully arranged into valid groups', groups: [] }
  }

  const usedIds = candidateGroups.flat().map(card => card.id)
  const handIds = cards.map(card => card.id)
  if (usedIds.length !== handIds.length || !handIds.every(id => usedIds.includes(id))) {
    return { valid: false, reason: 'All 13 cards must be used exactly once', groups: candidateGroups }
  }

  const sequenceCount = candidateGroups.filter(group => checkSequence(group, joker)).length
  const pureSequenceCount = candidateGroups.filter(group => checkSequence(group, joker, { pure: true })).length
  const allValid = candidateGroups.every(group => isValidMeld(group, joker))

  if (!allValid) return { valid: false, reason: 'One or more groups are invalid', groups: candidateGroups }
  if (pureSequenceCount < 1) return { valid: false, reason: 'At least 1 pure sequence is required', groups: candidateGroups }
  if (sequenceCount < 2) return { valid: false, reason: 'At least 2 sequences are required', groups: candidateGroups }

  return {
    valid: true,
    reason: '',
    groups: candidateGroups,
    sequenceCount,
    pureSequenceCount,
  }
}

export function calculateScore(hand, joker = null) {
  const score = hand.reduce((sum, card) => {
    if (isJoker(card, joker)) return sum
    return sum + (card.value ?? card.pts ?? cardValue(card.rank))
  }, 0)
  return Math.min(score, MAX_HAND_PENALTY)
}

function declarationCardsFromHand(hand, finishCard = null) {
  if (hand.length === DEAL_SIZE) return hand
  if (hand.length !== DEAL_SIZE + 1) return null
  if (!finishCard) return null

  const finishIndex = findCardIndex(hand, finishCard)
  if (finishIndex < 0) return null

  return hand.filter((_, index) => index !== finishIndex)
}

export function handleDeclare(state, playerId, groups = null, finishCard = null) {
  const error = assertPlayable(state, playerId)
  if (error) return fail(state, error)
  if (state.turnStage !== TURN_STAGE.DISCARD) return fail(state, 'Draw before declaring')

  const next = clone(state)
  const playerHand = next.hands[playerId] || []
  const declarationHand = declarationCardsFromHand(playerHand, finishCard)
  if (!declarationHand) return fail(state, 'Select exactly one finish card before declaring')

  const validation = validateHand(declarationHand, next.joker, groups)

  if (!validation.valid) {
    const penalty = Math.min(calculateScore(playerHand, next.joker) || MAX_HAND_PENALTY, MAX_HAND_PENALTY)
    next.scores[playerId] = (next.scores[playerId] || 0) + penalty
    next.players = next.players.map(player => (
      player.id === playerId && next.scores[playerId] >= MAX_POOL_SCORE
        ? { ...player, eliminated: true }
        : player
    ))
    next.lastAction = { type: 'invalidDeclare', playerId, penalty, reason: validation.reason }
    return ok(nextTurn(next).state, {
      declared: false,
      valid: false,
      penalty,
      validation,
    })
  }

  next.players.forEach(player => {
    if (player.id === playerId || player.eliminated) return
    const points = calculateScore(next.hands[player.id] || [], next.joker)
    next.scores[player.id] = (next.scores[player.id] || 0) + points
  })

  next.players = next.players.map(player => (
    (next.scores[player.id] || 0) >= MAX_POOL_SCORE
      ? { ...player, eliminated: true }
      : player
  ))

  const remaining = activePlayers(next)
  next.lastAction = { type: 'validDeclare', playerId }

  if (remaining.length <= 1) {
    next.gameStatus = GAME_STATUS.FINISHED
    next.winnerId = remaining[0]?.id || playerId
  } else {
    const freshRound = dealCards(next.players, next.scores)
    freshRound.round = (next.round || 1) + 1
    return ok(freshRound, {
      declared: true,
      valid: true,
      validation,
    })
  }

  return ok(next, {
    declared: true,
    valid: true,
    validation,
  })
}

export function canDraw(state, playerId) {
  return !assertPlayable(state, playerId) && state.turnStage === TURN_STAGE.DRAW
}

export function canDiscard(state, playerId, cardOrId) {
  if (assertPlayable(state, playerId) || state.turnStage !== TURN_STAGE.DISCARD) return false
  if (cardOrId == null) return false
  const hand = state.hands[playerId] || []
  return hand.length === DEAL_SIZE + 1 && findCardIndex(hand, cardOrId) !== -1
}

export function canDeclare(state, playerId, finishCard = null) {
  if (assertPlayable(state, playerId) || state.turnStage !== TURN_STAGE.DISCARD) return false
  const hand = state.hands[playerId] || []
  const declarationHand = declarationCardsFromHand(hand, finishCard)
  if (!declarationHand) return false
  return validateHand(declarationHand, state.joker).valid
}

export function makeBotMove(state, playerId) {
  const draw = drawCard(state, playerId, 'closed')
  if (!draw.ok) return draw

  const hand = draw.state.hands[playerId] || []
  const discard = [...hand]
    .filter(card => !isJoker(card, draw.state.joker))
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0] || hand[hand.length - 1]

  return discardCard(draw.state, playerId, discard.id)
}

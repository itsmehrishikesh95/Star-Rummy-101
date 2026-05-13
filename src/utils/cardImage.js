const suitMap = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }

// Pre-build all 52 URLs at module load time for instant access
const cardImages = {}
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

for (const suit of SUITS) {
  for (const rank of RANKS) {
    const s = suitMap[suit]
    const key = `${suit}${rank}`
    cardImages[key] = new URL(`../assets/52_cards_png/${s}${rank}.png`, import.meta.url).href
  }
}

export function getCardImage(rank, suit) {
  // Wild jokers: use their natural card image (they are real cards)
  // Printed jokers: fallback to a neutral image
  if (!suit || !suitMap[suit]) {
    // Printed joker or unknown — return a placeholder
    return cardImages['♠A'] // fallback
  }
  const key = `${suit}${rank}`
  return cardImages[key] ?? cardImages['♠A']
}

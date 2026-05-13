import spriteSheet from '../assets/52cards.png'

// Verified actual dimensions: 1440 × 720px
const SHEET_W = 1440
const SHEET_H = 720
const COLS = 13
const ROWS = 4
const CELL_W = SHEET_W / COLS  // 110.769...
const CELL_H = SHEET_H / ROWS  // 180

const SUIT_ROW = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
const RANK_COL = {
  'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5,
  '7': 6, '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12,
}

/**
 * Returns inline style object to display a card from the sprite sheet.
 * @param {string} rank  - 'A','2'...'K'
 * @param {string} suit  - '♠','♥','♦','♣'
 * @param {number} displayW - rendered card width in px
 * @param {number} displayH - rendered card height in px
 */
export function getCardStyle(rank, suit, displayW, displayH) {
  const col = RANK_COL[rank]
  const row = SUIT_ROW[suit]

  if (col === undefined || row === undefined) {
    // Fallback for jokers or unknown cards
    return {
      width: displayW,
      height: displayH,
      borderRadius: 6,
      background: 'linear-gradient(135deg,#fff8e1,#ffe082)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
    }
  }

  const scaleX = displayW / CELL_W
  const scaleY = displayH / CELL_H

  return {
    backgroundImage: `url(${spriteSheet})`,
    backgroundSize: `${SHEET_W * scaleX}px ${SHEET_H * scaleY}px`,
    backgroundPosition: `-${col * CELL_W * scaleX}px -${row * CELL_H * scaleY}px`,
    backgroundRepeat: 'no-repeat',
    width: displayW,
    height: displayH,
    borderRadius: 6,
    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
    flexShrink: 0,
  }
}

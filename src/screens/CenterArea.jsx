import React from 'react'
import { getCardImage } from '../utils/cardImage'
import { motion } from 'framer-motion'
import cardBackImg from '../assets/card-back.png'

// Dark green card back (matching reference)
function CardBack({ onClick = null, style = {}, stackOffset = false }) {
  return (
    <img 
      src={cardBackImg} 
      alt="Card Back"
      onClick={onClick}
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        display: 'block',
        borderRadius: 7,
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    />
  )
}

// White face card — uses new 52_cards_png images
function CardFace({ card, selected = false, style = {}, onClick, cW = 72, cH = 100 }) {
  if (!card) return null
  return (
    <div
      onClick={onClick}
      style={{
        width: '100%', height: '100%',
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 2.5px #F5C518, 0 6px 18px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.3)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', overflow: 'hidden',
        ...style,
      }}
    >
      <img
        src={getCardImage(card.rank, card.suit)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 6 }}
        draggable={false}
      />
    </div>
  )
}

export default function CenterArea({
  wildJoker,
  drawPile,
  discardPile,
  gameState,
  isPlayerTurn,
  onDrawClosed,
  onDrawOpen,
  onDeclare,
  canDrawClosed = false,
  canDrawOpen = false,
  canDeclare = false,
  drawPileRef,
  discardPileRef,
  cardW = 72,
  cardH = 100,
}) {
  const topCard = discardPile[discardPile.length - 1]
  const isDrawPhase = gameState === 'draw' && isPlayerTurn
  const isWaiting = !isPlayerTurn || gameState === 'dealing'

  // Card dimensions passed from GameScreen for 100% consistency
  const cW = cardW
  const cH = cardH

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        zIndex: 4,
        position: 'relative',
        pointerEvents: 'auto',
        opacity: gameState === 'dealing' ? 0 : isWaiting ? 0.55 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* ── DRAW PILE (closed deck) with Joker leaning on it ── */}
      <div ref={drawPileRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ position: 'relative', width: cW, height: cH }}>
          {/* Stack shadow cards */}
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              width: cW,
              height: cH,
              opacity: 0.4,
            }}
          >
            <CardBack />
          </div>
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: cW,
              height: cH,
              opacity: 0.65,
            }}
          >
            <CardBack />
          </div>

          {/* Joker card leaning on draw pile (like reference) */}
          {wildJoker && (
            <div
              style={{
                position: 'absolute',
                top: -8,
                left: -14,
                width: cW - 4,
                height: cH - 4,
                transform: 'rotate(-12deg)',
                zIndex: 2,
              }}
            >
              <CardFace card={wildJoker} cW={cW - 4} cH={cH - 4} />
            </div>
          )}

          {/* Main draw pile card */}
          <motion.div
            whileHover={canDrawClosed ? { y: -5, scale: 1.06 } : {}}
            whileTap={canDrawClosed ? { scale: 0.94 } : {}}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: cW,
              height: cH,
              zIndex: 3,
              cursor: canDrawClosed ? 'pointer' : 'not-allowed',
            }}
          >
            <CardBack
              onClick={canDrawClosed ? onDrawClosed : undefined}
              style={{
                border: 'none',
                boxShadow: canDrawClosed
                  ? '0 0 18px rgba(245,197,24,0.45), 0 8px 20px rgba(0,0,0,0.6)'
                  : '0 6px 16px rgba(0,0,0,0.7)',
                opacity: canDrawClosed ? 1 : 0.55,
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* ── OPEN DISCARD PILE (face-up top card) ── */}
      <div ref={discardPileRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <motion.div
          whileHover={canDrawOpen ? { y: -5, scale: 1.06 } : {}}
          whileTap={canDrawOpen ? { scale: 0.94 } : {}}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          style={{
            width: cW,
            height: cH,
            cursor: canDrawOpen ? 'pointer' : 'default',
          }}
        >
          {topCard ? (
            <CardFace
              card={topCard}
              cW={cW}
              cH={cH}
              onClick={canDrawOpen ? onDrawOpen : undefined}
              style={{
                border: 'none',
                boxShadow: canDrawOpen
                  ? '0 0 18px rgba(245,197,24,0.45), 0 8px 20px rgba(0,0,0,0.5)'
                  : '0 6px 16px rgba(0,0,0,0.5)',
                opacity: canDrawOpen ? 1 : 0.55,
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.25)',
                border: '1.5px dashed rgba(255,255,255,0.2)',
              }}
            />
          )}
        </motion.div>

      </div>

      {/* ── FINISH SLOT (declare zone) — yellow border, empty rectangle ── */}
      <motion.div
        onClick={canDeclare ? onDeclare : undefined}
        whileHover={canDeclare ? { scale: 1.04, y: -3 } : {}}
        whileTap={canDeclare ? { scale: 0.95 } : {}}
        animate={
          canDeclare
            ? {
                boxShadow: [
                  '0 0 0 2px #F5C518, 0 0 18px rgba(245,197,24,0.3)',
                  '0 0 0 3px #F5C518, 0 0 30px rgba(245,197,24,0.55)',
                  '0 0 0 2px #F5C518, 0 0 18px rgba(245,197,24,0.3)',
                ],
              }
            : {}
        }
        transition={
          canDeclare
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
        style={{
          width: cW + 4,
          height: cH + 4,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.18)',
          border: `2.5px solid ${canDeclare ? '#F5C518' : 'rgba(245,197,24,0.55)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canDeclare ? 'pointer' : 'default',
          boxShadow: canDeclare
            ? '0 0 0 2px #F5C518, 0 0 18px rgba(245,197,24,0.3)'
            : 'none',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            color: canDeclare ? '#F5C518' : 'rgba(245,197,24,0.6)',
            fontSize: 10,
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.4,
            letterSpacing: '0.3px',
            whiteSpace: 'pre-line',
          }}
        >
          {'Finish\nslot'}
        </span>
      </motion.div>
    </div>
  )
}

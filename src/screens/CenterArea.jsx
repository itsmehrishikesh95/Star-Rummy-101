import React from 'react'
import { getCardImage } from '../utils/cardImage'
import { motion } from 'framer-motion'
import cardBackImg from '../assets/Star_Rummy_card.png'

// Dark green card back (matching reference)
function CardBack({ onClick = null, style = {}, stackOffset = false }) {
  return (
    <img 
      src={cardBackImg} 
      alt="Card Back"
      onClick={onClick}
      onTouchEnd={onClick ? (e) => { e.preventDefault(); onClick() } : undefined}
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
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        ...style
      }}
    />
  )
}

// White face card — uses new 52_cards_png images
function CardFace({ card, selected = false, style = {}, onClick, cW = 72, cH = 100 }) {
  if (!card) return null
  const isJokerCard = card.isWildJoker || card.isJoker
  return (
    <div
      onClick={onClick}
      onTouchEnd={onClick ? (e) => { e.preventDefault(); onClick() } : undefined}
      style={{
        width: '100%', height: '100%',
        borderRadius: 6,
        border: isJokerCard ? '2px solid #FFD700' : 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      <img
        src={getCardImage(card.rank, card.suit)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 4 }}
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
        gap: 24,
        zIndex: 4,
        position: 'relative',
        pointerEvents: 'auto',
        opacity: gameState === 'dealing' ? 0 : isWaiting ? 0.55 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* ── CLOSED DECK (draw pile) with Joker leaning on LEFT side ── */}
      <div ref={drawPileRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ position: 'relative', width: cW, height: cH }}>
          {/* Stack shadow cards */}
          <div style={{ position: 'absolute', top: -4, left: -4, width: cW, height: cH, opacity: 0.4 }}>
            <CardBack />
          </div>
          <div style={{ position: 'absolute', top: -2, left: -2, width: cW, height: cH, opacity: 0.65 }}>
            <CardBack />
          </div>

          {/* Wild Joker card perpendicular (90°) on LEFT side of closed deck */}
          {wildJoker && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: -(cW * 0.45),
                width: cW - 6,
                height: cH - 6,
                transform: 'translateY(-50%) rotate(-90deg)',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <CardFace card={wildJoker} cW={cW - 6} cH={cH - 6} />
            </div>
          )}

          {/* Main draw pile card (clickable) — enlarged touch area */}
          <motion.div
            whileHover={canDrawClosed ? { y: -5, scale: 1.06 } : {}}
            whileTap={canDrawClosed ? { scale: 0.94 } : {}}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            style={{
              position: 'absolute',
              top: -25, left: -25,
              width: cW + 50, height: cH + 50,
              zIndex: 3,
              cursor: canDrawClosed ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onTouchEnd={canDrawClosed ? (e) => { e.preventDefault(); onDrawClosed && onDrawClosed() } : undefined}
          >
            <div style={{ width: cW, height: cH }}>
              <CardBack
                onClick={canDrawClosed ? onDrawClosed : undefined}
                style={{
                  border: 'none',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.7)',
                  opacity: canDrawClosed ? 1 : 0.55,
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── FINISH SLOT (declare zone) — card-shaped slot in the MIDDLE ── */}
      <motion.div
        onClick={canDeclare ? onDeclare : undefined}
        onTouchEnd={canDeclare ? (e) => { e.preventDefault(); onDeclare && onDeclare() } : undefined}
        whileHover={canDeclare ? { scale: 1.04, y: -3 } : {}}
        whileTap={canDeclare ? { scale: 0.95 } : {}}
        style={{
          width: cW,
          height: cH,
          borderRadius: 7,
          background: 'rgba(0,0,0,0.22)',
          border: `2px dashed rgba(255,255,255,0.3)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canDeclare ? 'pointer' : 'default',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
          flexDirection: 'column',
          gap: 3,
          touchAction: 'manipulation',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Card-shaped inner indicator */}
        <div style={{
          width: cW * 0.5,
          height: cH * 0.45,
          borderRadius: 4,
          border: '1.5px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 2,
        }}>
          <span style={{ fontSize: 14, opacity: 0.4 }}>🃏</span>
        </div>
        <span
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 8,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Finish
        </span>
      </motion.div>

      {/* ── OPEN DECK (discard pile — face-up top card) ── */}
      <div ref={discardPileRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <motion.div
          whileHover={canDrawOpen ? { y: -5, scale: 1.06 } : {}}
          whileTap={canDrawOpen ? { scale: 0.94 } : {}}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          style={{
            width: cW + 50,
            height: cH + 50,
            padding: 25,
            cursor: canDrawOpen ? 'pointer' : 'default',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onTouchEnd={canDrawOpen ? (e) => { e.preventDefault(); onDrawOpen && onDrawOpen() } : undefined}
        >
          <div style={{ width: cW, height: cH }}>
            {topCard ? (
              <CardFace
                card={topCard}
                cW={cW}
                cH={cH}
                onClick={canDrawOpen ? onDrawOpen : undefined}
                style={{
                  border: 'none',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                  opacity: canDrawOpen ? 1 : 0.55,
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 7,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1.5px dashed rgba(255,255,255,0.2)',
                }}
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

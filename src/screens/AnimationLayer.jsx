import React, { useEffect, useState } from 'react'
import { getCardImage } from '../utils/cardImage'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

import cardBackImg from '../assets/card-back.png'

// Reusing CardFace and CardBack from other components for consistency
function CardBack() {
  return (
    <img 
      src={cardBackImg} 
      alt="Card Back" 
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
      }}
    />
  )
}

function CardFace({ card, selected = false, style = {}, onClick }) {
  if (!card) return null

  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        background: '#fff',
        border: 'none',
        boxShadow: selected
          ? '0 0 14px rgba(245,197,24,0.7), 0 8px 20px rgba(0,0,0,0.5)'
          : '0 6px 16px rgba(0,0,0,0.55)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      <img src={getCardImage(card.rank, card.suit)} style={{
        width: '100%', 
        height: '100%', 
        objectFit: 'contain',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
      }} />
    </div>
  )
}

export default function AnimationLayer({ animations, onComplete }) {
  // animations is an array of objects:
  // { id, card, start: {x,y}, end: {x,y}, faceUp: boolean, flipMidFlight: boolean, delay: number, duration: number, scaleEnd: number }

  if (!animations || animations.length === 0) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <AnimatePresence>
        {animations.map(anim => {
          return (
            <motion.div
              key={anim.id}
              initial={{ 
                x: anim.start.x, 
                y: anim.start.y, 
                scale: 1,
                rotateY: anim.flipMidFlight ? 0 : (anim.faceUp ? 180 : 0) 
              }}
              animate={{ 
                x: anim.end.x, 
                y: anim.end.y, 
                scale: [1, 1.05, anim.scaleEnd || 1],
                rotateY: anim.flipMidFlight ? 180 : (anim.faceUp ? 180 : 0) 
              }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{
                duration: anim.duration || 0.6,
                delay: anim.delay || 0,
                ease: [0.25, 1, 0.5, 1], // Custom cubic-bezier for a smooth arc-like feel
              }}
              onAnimationComplete={() => {
                if (onComplete) onComplete(anim.id)
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: anim.width || 72, // Standard card width used in CenterArea, dynamically overridden
                height: anim.height || 100,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Back of the card */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)'
              }}>
                <CardBack />
              </div>
              
              {/* Front of the card */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}>
                <CardFace card={anim.card} />
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body
  )
}

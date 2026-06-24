import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import cardBackImg from '../assets/Star_Rummy_card.png'

// ── Circular countdown timer ring (AI seats) ──────────────────────────────
function CircularTimer({ size, strokeWidth = 4, active, duration = 2 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(0)

  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      setOffset(0)
      startRef.current = null
      return
    }
    startRef.current = null
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000
      const progress = Math.min(elapsed / duration, 1)
      setOffset(circumference * progress)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, duration, circumference])

  // Always light green; turns red only in last 20% of the animation
  const isUrgent = offset > circumference * 0.8
  const strokeColor = isUrgent ? '#ff4444' : '#4ade80'

  return (
    <svg
      width={size} height={size}
      style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none', zIndex: 5 }}
    >
      {/* Dark track */}
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={strokeWidth} />
      {/* Gold ring — no glow/filter */}
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={strokeColor} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ── Player-turn circular timer (driven by seconds remaining) ───────────────
// phase: 'main' = 30s light green ring, 'penalty' = 10s red ring — no glow
export function PlayerCircularTimer({ size, strokeWidth = 4, secondsLeft, totalSeconds = 30, phase = 'main' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / totalSeconds
  const offset = circumference * (1 - progress)

  // Light green for main phase, red for penalty phase
  const strokeColor = phase === 'penalty' ? '#ff4444' : '#4ade80'

  return (
    <svg
      width={size} height={size}
      style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none', zIndex: 5 }}
    >
      {/* Dark track */}
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={strokeWidth} />
      {/* Gold / red ring — no glow/filter */}
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
      />
    </svg>
  )
}

// Dark green card back — matches reference screenshot
function CardBack({ style = {} }) {
  return (
    <img
      src={cardBackImg}
      alt="Card Back"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 5,
        objectFit: 'cover',
        boxShadow: '0 3px 8px rgba(0,0,0,0.7)',
        ...style
      }}
    />
  )
}

function AISeat({ player, active = false, compact = false, actionAnim = null, avatarSz = 56, cardW = 36, cardH = 50, isDealer = false }) {

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        position: 'relative',
      }}
    >
      {/* Avatar circle + circular timer ring */}
      <div style={{ position: 'relative', width: avatarSz, height: avatarSz, flexShrink: 0 }}>
        {/* Gold crown — shown when this AI is the dealer */}
        {isDealer && (
          <div style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: compact ? 20 : 26,
            lineHeight: 1,
            zIndex: 20,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            👑
          </div>
        )}
        <CircularTimer
          size={avatarSz}
          strokeWidth={4}
          active={active && !player.isEliminated}
          duration={2.5}
        />
        <motion.div
          style={{
            width: avatarSz,
            height: avatarSz,
            borderRadius: '50%',
            background: player.isEliminated ? '#1a1a1a' : '#ffffff',
            border: `2px solid ${player.isEliminated ? '#555' : 'rgba(255,255,255,0.9)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 16 : 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            opacity: player.isEliminated ? 0.4 : 1,
          }}
        >
          {player.isEliminated ? '💀' : '👤'}
        </motion.div>
      </div>

      {/* Name + score — black pill */}
      <div
        style={{
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 3,
          padding: '2px 7px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 52,
        }}
      >
        <span style={{ color: '#fff', fontSize: compact ? 8 : 9, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {player.name}
        </span>
        <span
          style={{
            color: player.score >= 80 ? '#ef5350' : '#F5C518',
            fontSize: compact ? 7 : 8,
            fontWeight: 800,
          }}
        >
          {player.isEliminated ? 'OUT' : `★${player.score}`}
        </span>
      </div>

      {/* Stacked card backs below avatar name — hidden, no card images shown for AI */}

      {/* Action badge */}
      {actionAnim && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: actionAnim.type === 'draw' ? 'rgba(34,197,94,0.92)' : 'rgba(239,83,80,0.92)',
            borderRadius: 10,
            padding: '2px 6px',
            color: '#fff',
            fontSize: 8,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          {actionAnim.type === 'draw' ? '🎯 DRAW' : '🎯 DISCARD'}
        </motion.div>
      )}
    </div>
  )
}

export default function PlayersAroundTable({
  aiPlayers,
  isPlayerTurn,
  aiActionAnim,
  viewportWidth,
  tableCompact,
  isLandscape = true,
  aiRefs,
  aiAvatarSz,
  aiCardW,
  aiCardH,
  dealerIndex = null,
}) {
  if (!aiPlayers?.length) return null

  const compact = tableCompact !== undefined ? tableCompact : viewportWidth <= 430

  // Portrait phones have a taller-relative container, so avatars need different vertical positions.
  // Landscape: wide container (2.2:1 ratio) — use original positions.
  // Portrait: container is roughly 1:0.47 ratio — shift top seats higher, side seats lower.
  const positions5 = isLandscape ? [
    { top: '85%', left: '10%',  transform: 'translate(-50%, -50%)' }, // Priya — left rim
    { top: '35%', left: '24%', transform: 'translate(-50%, -50%)' }, // Rahul — left-down on rim
    { top: '30%', left: '50%', transform: 'translate(-50%, -50%)' }, // Sneha — bottom center
    { top: '35%', left: '76%', transform: 'translate(-50%, -50%)' }, // Amit — right-down on rim
    { top: '85%', left: '90%', transform: 'translate(-50%, -50%)' }, // Kavya — right rim
  ] : [
    // Portrait: container is wider than tall, seats need to spread more horizontally
    { top: '80%', left: '8%',  transform: 'translate(-50%, -50%)' }, // Priya — left rim
    { top: '20%', left: '22%', transform: 'translate(-50%, -50%)' }, // Rahul — top-left
    { top: '10%', left: '50%', transform: 'translate(-50%, -50%)' }, // Sneha — top center
    { top: '20%', left: '78%', transform: 'translate(-50%, -50%)' }, // Amit — top-right
    { top: '80%', left: '92%', transform: 'translate(-50%, -50%)' }, // Kavya — right rim
  ]

  const positions4 = isLandscape ? [
    { top: '-10%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '75%', transform: 'translate(-50%, 0)' },
    { top: '38%', left: '98%', transform: 'translate(-50%, -50%)' },
  ] : [
    { top: '5%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '5%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '5%', left: '75%', transform: 'translate(-50%, 0)' },
    { top: '50%', left: '98%', transform: 'translate(-50%, -50%)' },
  ]

  const positions3 = isLandscape ? [
    { top: '-10%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '75%', transform: 'translate(-50%, 0)' },
  ] : [
    { top: '5%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '5%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '5%', left: '75%', transform: 'translate(-50%, 0)' },
  ]

  const posMap = {
    5: positions5,
    4: positions4,
    3: positions3,
  }
  const positions = posMap[aiPlayers.length] || positions5.slice(0, aiPlayers.length)

  return (
    // overflow:visible so seats outside the table bounds are still shown
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'visible' }}>
      {aiPlayers.map((player, idx) => {
        const pos = positions[idx % positions.length]
        const isActive = !isPlayerTurn && aiActionAnim?.playerIndex === idx

        return (
          <div
            key={player.id}
            ref={el => {
              if (aiRefs && aiRefs.current) {
                aiRefs.current[idx] = el
              }
            }}
            style={{
              position: 'absolute',
              ...pos,
              pointerEvents: 'none',
            }}
          >
            <AISeat
              player={player}
              active={isActive}
              compact={compact}
              actionAnim={aiActionAnim?.playerIndex === idx ? aiActionAnim : null}
              avatarSz={aiAvatarSz || (compact ? 46 : 56)}
              cardW={aiCardW || (compact ? 28 : 36)}
              cardH={aiCardH || (compact ? 38 : 50)}
              isDealer={dealerIndex !== null && dealerIndex === idx + 1}
            />
          </div>
        )
      })}
    </div>
  )
}

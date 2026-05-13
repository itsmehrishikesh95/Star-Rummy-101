import React from 'react'
import { motion } from 'framer-motion'

import cardBackImg from '../assets/card-back.png'

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

function AISeat({ player, active = false, compact = false, actionAnim = null, avatarSz = 56, cardW = 36, cardH = 50 }) {

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


      {/* Avatar circle */}
      <motion.div
        style={{
          width: avatarSz,
          height: avatarSz,
          borderRadius: '50%',
          background: player.isEliminated
            ? '#2a2a2a'
            : 'radial-gradient(circle at 38% 30%, #c8c8c8 0%, #909090 45%, #585858 100%)',
          border: `2px solid ${player.isEliminated ? '#444' : active ? '#F5C518' : 'rgba(255,255,255,0.35)'
            }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 16 : 20,
          boxShadow: active
            ? '0 0 0 3px rgba(245,197,24,0.35), 0 4px 14px rgba(0,0,0,0.6)'
            : '0 3px 10px rgba(0,0,0,0.55)',
          opacity: player.isEliminated ? 0.4 : 1,
          flexShrink: 0,
        }}
        animate={
          active && !player.isEliminated && !compact
            ? {
              boxShadow: [
                '0 0 0 0 rgba(245,197,24,0.5), 0 4px 14px rgba(0,0,0,0.6)',
                '0 0 0 8px rgba(245,197,24,0), 0 4px 14px rgba(0,0,0,0.6)',
                '0 0 0 0 rgba(245,197,24,0.5), 0 4px 14px rgba(0,0,0,0.6)',
              ],
            }
            : {}
        }
        transition={
          active && !player.isEliminated && !compact
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : {}
        }
      >
        {player.isEliminated ? '💀' : '👤'}
      </motion.div>

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
  aiRefs,
  aiAvatarSz,
  aiCardW,
  aiCardH,
}) {
  if (!aiPlayers?.length) return null

  const compact = tableCompact !== undefined ? tableCompact : viewportWidth <= 430

  // Positions matching the reference image exactly:
  // Reference has: left-side (outside left edge), top-left, top-center, top-right, right-side (outside right edge)
  // The container is the table div with position:relative
  // Seats sit ON the rim — some extend outside the table bounds
  const positions5 = [
    { top: '55%', left: '10%', transform: 'translate(-50%, -50%)' }, // Priya — left rim
    { top: '18%', left: '24%', transform: 'translate(-50%, -50%)' }, // Rahul — left-down on rim
    { top: '5%',  left: '50%', transform: 'translate(-50%, -50%)' }, // Sneha — top center (arc peak)
    { top: '18%', left: '76%', transform: 'translate(-50%, -50%)' }, // Amit — right-down on rim
    { top: '55%', left: '90%', transform: 'translate(-50%, -50%)' }, // Kavya — right rim
  ]

  const positions4 = [
    { top: '-10%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '75%', transform: 'translate(-50%, 0)' },
    { top: '38%', left: '98%', transform: 'translate(-50%, -50%)' },
  ]

  const positions3 = [
    { top: '-10%', left: '25%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '50%', transform: 'translate(-50%, 0)' },
    { top: '-10%', left: '75%', transform: 'translate(-50%, 0)' },
  ]

  const posMap = {
    5: positions5,
    4: positions4,
    3: positions3,
  }
  const positions = posMap[aiPlayers.length] || positions5.slice(0, aiPlayers.length)

  return (
    // overflow:visible so seats outside the table bounds are still shown
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', overflow: 'visible' }}>
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
            />
          </div>
        )
      })}
    </div>
  )
}

import React from 'react'
import { motion } from 'framer-motion'
import useGameStore from '../store'

const C = {
  bg: '#0D3320',
  card: '#1A5C35',
  dark: '#0A2518',
  gold: '#F5C518',
  goldD: '#D4A020',
  muted: '#8BA898',
}

const DOT = {
  backgroundImage: 'radial-gradient(#1A5C35 1px, transparent 1px)',
  backgroundSize: '20px 20px',
}

const MODES = [
  {
    players: 2,
    icon: '👤',
    title: '2 Players',
    subtitle: '1 vs 1 — You vs AI',
    desc: 'Quick game, single deck, fast rounds.',
    badge: 'QUICK',
    badgeColor: '#22c55e',
  },
  {
    players: 6,
    icon: '👥',
    title: '6 Players',
    subtitle: '1 vs 5 AI opponents',
    desc: 'Full table, two decks, classic 101 Pool.',
    badge: 'CLASSIC',
    badgeColor: '#F5C518',
  },
]

export default function PracticeModeScreen() {
  const setScreen     = useGameStore(s => s.setScreen)
  const setTableSize  = useGameStore(s => s.setTableSize)
  const setActiveRoomCode = useGameStore(s => s.setActiveRoomCode)
  const resetGameData = useGameStore(s => s.resetGameData)

  function startGame(players) {
    setTableSize(players)
    setActiveRoomCode(null)
    resetGameData()
    setScreen('game')
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, ...DOT,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 16px 14px',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen('home')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <span style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 700,
          color: C.gold, letterSpacing: 2,
        }}>PRACTICE MODE</span>
        <div style={{ width: 38 }} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', gap: 20,
      }}>
        <div style={{
          fontSize: 13, color: C.muted, fontWeight: 700,
          letterSpacing: 1, marginBottom: 4,
        }}>
          SELECT TABLE SIZE
        </div>

        {MODES.map(mode => (
          <motion.button
            key={mode.players}
            onClick={() => startGame(mode.players)}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            style={{
              width: '100%', maxWidth: 340,
              background: C.card,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '20px 20px',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 16,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Badge */}
            <div style={{
              position: 'absolute', top: 12, right: 14,
              background: mode.badgeColor,
              color: mode.players === 6 ? '#1a0800' : '#fff',
              fontSize: 9, fontWeight: 900, letterSpacing: 1,
              padding: '3px 8px', borderRadius: 999,
            }}>
              {mode.badge}
            </div>

            {/* Icon */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(245,197,24,0.1)',
              border: '2px solid rgba(245,197,24,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              {mode.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 2 }}>
                {mode.title}
              </div>
              <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
                {mode.subtitle}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, lineHeight: 1.4 }}>
                {mode.desc}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ color: C.muted, fontSize: 20, flexShrink: 0 }}>›</div>
          </motion.button>
        ))}

        <div style={{
          fontSize: 11, color: C.muted, textAlign: 'center',
          marginTop: 8, lineHeight: 1.8,
        }}>
          Practice mode is free — no coins required.
        </div>
      </div>
    </div>
  )
}

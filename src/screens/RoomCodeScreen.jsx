import React, { useState } from 'react'
import useGameStore from '../store'
import socketService from '../services/socket'
import { getOrCreatePlayerId } from '../services/gameSocket'

const DOT  = { backgroundImage: 'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize: '20px 20px' }
const GOLD = { background: 'linear-gradient(180deg,#F5C518 0%,#D4A020 100%)' }
const C    = { bg: '#0D3320', dark: '#0A2518', gold: '#F5C518', muted: '#8BA898', green: '#22c55e' }

export default function RoomCodeScreen() {
  const setScreen      = useGameStore(s => s.setScreen)
  const activeRoomCode = useGameStore(s => s.activeRoomCode)
  const setLobbyFlow   = useGameStore(s => s.setLobbyFlow)
  const setIsRoomHost  = useGameStore(s => s.setIsRoomHost)
  const setEntryFee    = useGameStore(s => s.setEntryFee)
  const deductCoins    = useGameStore(s => s.deductCoins)
  const user           = useGameStore(s => s.user)

  const [copied, setCopied] = useState(false)

  const code       = activeRoomCode || '----'
  const playerName = user?.name || 'Host'

  const [registering, setRegistering] = useState(false)
  const timeoutRef = React.useRef(null)

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const enterLobby = () => {
    if (registering) return
    setRegistering(true)

    // Register room on the server so joiners can find it
    const s = socketService.getSocket()
    if (s?.connected) {
      const playerId = getOrCreatePlayerId()
      const pName = user?.name || useGameStore.getState().profileName || 'Host'
      s.emit('register_room', { code, playerName: pName, playerId })
      console.log('[RoomCodeScreen] register_room emitted:', code, 'playerId:', playerId)
    }

    setEntryFee(500)
    deductCoins(500)
    setLobbyFlow('create')
    setIsRoomHost(true)
    setScreen('match-lobby')
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, ...DOT,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{ height: 50 }} />

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 16px' }}>
        <button
          onClick={() => setScreen('subscription')}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: 'none',
            color: 'white', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Your Room Code</h2>
      </div>

      {/* BODY */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 16px',
        display: 'flex', flexDirection: 'column',
        gap: 16, paddingBottom: 100,
      }}>

        {/* Hero text */}
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Share this code with friends so they can join your room.
          </p>
        </div>

        {/* Code card */}
        <div style={{
          background: C.dark,
          borderRadius: 20,
          padding: '28px 20px',
          border: '1px solid rgba(245,197,24,0.3)',
          textAlign: 'center',
          boxShadow: '0 0 32px rgba(245,197,24,0.08)',
        }}>
          <p style={{
            fontSize: 11, color: C.muted,
            fontWeight: 700, letterSpacing: 2,
            marginBottom: 20,
          }}>ROOM CODE</p>

          {/* Big digit boxes */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
            {code.split('').map((ch, i) => (
              <div key={i} style={{
                width: 56, height: 68,
                borderRadius: 14,
                background: 'rgba(0,0,0,0.45)',
                border: '2px solid rgba(245,197,24,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace', fontSize: 28, fontWeight: 900,
                color: C.gold,
                boxShadow: '0 0 12px rgba(245,197,24,0.15)',
              }}>{ch}</div>
            ))}
          </div>

          {/* Copy button */}
          <button
            onClick={copy}
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.1)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(245,197,24,0.35)'}`,
              borderRadius: 50,
              padding: '10px 28px',
              cursor: 'pointer',
              color: copied ? C.green : C.gold,
              fontWeight: 700, fontSize: 14,
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓ Copied to clipboard!' : '📋 Copy Code'}
          </button>
        </div>

        {/* Info card */}
        <div style={{
          background: C.dark,
          borderRadius: 14,
          padding: '16px',
          border: '1px solid rgba(42,92,53,0.25)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {[
            ['👥', 'Up to 6 players can join'],
            ['⏳', 'Code is valid for this session'],
            ['🔒', 'Only players with the code can enter'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Share hint */}
        <div style={{
          background: 'rgba(245,197,24,0.05)',
          borderRadius: 14,
          border: '1px solid rgba(245,197,24,0.15)',
          padding: '14px 16px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Send the code via WhatsApp or any chat app. Friends enter it on the <b style={{ color: 'white' }}>Join with Code</b> screen.
          </span>
        </div>
      </div>

      {/* BOTTOM BUTTON */}
      <div style={{
        padding: '12px 16px 28px',
        background: 'rgba(5,12,7,0.97)',
        borderTop: '1px solid rgba(42,92,53,0.3)',
      }}>
        <button
          onClick={enterLobby}
          disabled={registering}
          style={{
            ...GOLD,
            width: '100%', padding: '17px',
            borderRadius: 50, border: 'none',
            color: '#1a0800', fontWeight: 900, fontSize: 16,
            cursor: registering ? 'not-allowed' : 'pointer',
            opacity: registering ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(245,197,24,0.3)',
          }}
        >
          {registering ? '⏳ Setting up room...' : 'Enter Lobby →'}
        </button>
      </div>
    </div>
  )
}

import React from 'react'
import useGameStore from '../store'

const C = {
  bgDark: '#042012',
  green: '#0e4b2b',
  gold: '#FFD54F',
  goldDark: '#f5b400',
  textMuted: '#9bc5aa',
}

export default function MainMenu() {
  const coins = useGameStore(s => s.coins)
  const user = useGameStore(s => s.user)
  const setScreen = useGameStore(s => s.setScreen)
  const setActiveRoomCode = useGameStore(s => s.setActiveRoomCode)
  const resetGameData = useGameStore(s => s.resetGameData)
  const profileName   = useGameStore(s => s.profileName)
  const profileAvatar = useGameStore(s => s.profileAvatar)

  const isGuest = user?.isGuest
  const displayName = profileName || user?.name || 'Player'
  const displayAvatar = profileAvatar || '👤'

  const startPractice = () => {
    setScreen('practice-mode')
  }

  return (
    <div className="main-menu">
      <div className="main-card">
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          {/* Profile button */}
          <button
            onClick={() => setScreen('profile')}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(245,197,24,0.5)',
              background: 'rgba(245,197,24,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 22,
            }}
            title="My Profile"
          >
            {displayAvatar}
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <span style={{ fontSize: 16 }}>🪙</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: C.gold }}>
              {coins.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Player name */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700 }}>
            Welcome, <span style={{ color: '#fff' }}>{displayName}</span>
          </span>
        </div>

        {/* Subscription badge */}
        <div
          style={{
            alignSelf: 'center',
            marginBottom: 20,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(43,182,115,0.18)',
            border: '1px solid rgba(43,182,115,0.4)',
            fontSize: 12,
            fontWeight: 700,
            color: '#2bb673',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#2bb673',
            }}
          />
          Active — 25 Days Left
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              fontFamily: 'Orbitron, system-ui, sans-serif',
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 5,
              color: 'white',
              textShadow: '0 0 24px rgba(0,0,0,0.8)',
            }}
          >
            STAR RUMMY
          </div>
        </div>

        {/* Entry fee block */}
        <div
          style={{
            background: 'rgba(0,0,0,0.25)',
            borderRadius: 18,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: `linear-gradient(180deg,${C.gold},${C.goldDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🪙
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, letterSpacing: 1 }}>
              ENTRY FEE
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>
              500 <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>Coins</span>
            </div>
          </div>
        </div>

        {/* Primary buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>

          {/* Practice Mode — shows 2P / 6P picker */}
          <button
            className="gold-btn"
            onClick={startPractice}
            style={{ width: '100%', cursor: 'pointer' }}
          >
            🎮 Practice Mode
          </button>

          <button
            className="gold-btn"
            onClick={() => isGuest ? alert('Please login to create private rooms') : setScreen('subscription')}
            disabled={isGuest}
            style={{
              width: '100%',
              cursor: isGuest ? 'not-allowed' : 'pointer',
              opacity: isGuest ? 0.5 : 1,
              background: 'transparent',
              border: '1px solid rgba(245,197,24,0.4)',
              color: '#F5C518',
            }}
          >
            Create Private Room {isGuest && '(Login Required)'}
          </button>

          <button
            className="outline-btn"
            onClick={() => setScreen('join-room')}
            style={{ width: '100%', cursor: 'pointer' }}
          >
            Join with Code
          </button>
        </div>

      </div>
    </div>
  )
}


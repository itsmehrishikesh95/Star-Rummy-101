import React, { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../store'
import LobbyPlayerSlot from '../components/LobbyPlayerSlot'

const botNames = ['Rahul', 'Sneha', 'Amit', 'Priya', 'Rohit', 'Kiran']

function pickBotName(used) {
  const available = botNames.filter(n => !used.has(n))
  const pool = available.length ? available : botNames
  return pool[Math.floor(Math.random() * pool.length)]
}

const C = {
  bg:       '#0a0f0d',
  card:     '#0f1f16',
  border:   'rgba(42,92,53,0.35)',
  gold:     '#F5C518',
  green:    '#1e7a3e',
  muted:    'rgba(139,168,152,0.7)',
  white:    '#ffffff',
  red:      '#ef5350',
}

const STYLES = `
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.45; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes joinPop {
    0%   { opacity: 0; transform: scale(0.6) translateY(12px); }
    70%  { transform: scale(1.08) translateY(-3px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes countdownPulse {
    0%,100% { transform: scale(1); }
    50%      { transform: scale(1.12); }
  }
  @keyframes feedSlide {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .lobby-join-pop { animation: joinPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .lobby-feed-item-anim { animation: feedSlide 0.3s ease forwards; }
`

export default function MatchLobbyScreen() {
  const setScreen  = useGameStore(s => s.setScreen)
  const lobbyFlow  = useGameStore(s => s.lobbyFlow)
  const tableSize  = 6
  const user       = useGameStore(s => s.user)
  const youName    = user?.name || 'YOU'

  const [players,   setPlayers]   = useState(() => [{ id: 'you', name: youName, isBot: false }])
  const [feed,      setFeed]      = useState([])
  const [countdown, setCountdown] = useState(lobbyFlow === 'join' ? 10 : null)
  const lastJoinedIdRef = useRef(null)

  // inject styles
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'lobby-styles'
    if (!document.getElementById('lobby-styles')) {
      el.textContent = STYLES
      document.head.appendChild(el)
    }
    return () => { const s = document.getElementById('lobby-styles'); if(s) s.remove() }
  }, [])

  const usedBotNames = useMemo(() => {
    const s = new Set()
    players.forEach(p => { if (p.isBot) s.add(p.name.replace(/^Bot\s+/, '')) })
    return s
  }, [players])

  // JOIN flow: bots appear gradually
  useEffect(() => {
    if (lobbyFlow !== 'join') return
    setPlayers(prev => prev.some(p => p.id === 'you') ? prev : [{ id: 'you', name: youName, isBot: false }])
    const iv = setInterval(() => {
      setPlayers(prev => {
        if (prev.length >= tableSize) return prev
        const used = new Set(prev.filter(p => p.isBot).map(p => p.name.replace(/^Bot\s+/, '')))
        const bn = pickBotName(used)
        const id = `bot-${Date.now()}`
        lastJoinedIdRef.current = id
        setFeed(f => [`${bn} joined the room`, ...f].slice(0, 6))
        return [...prev, { id, name: `Bot ${bn}`, isBot: true }]
      })
    }, 900)
    return () => clearInterval(iv)
  }, [lobbyFlow, tableSize, youName])

  // JOIN countdown
  useEffect(() => {
    if (lobbyFlow !== 'join') return
    if (countdown == null) return
    if (countdown <= 0) { setScreen('game'); return }
    const t = setTimeout(() => setCountdown(v => v == null ? v : v - 1), 1000)
    return () => clearTimeout(t)
  }, [lobbyFlow, countdown, setScreen])

  // CREATE flow: bots join gradually
  useEffect(() => {
    if (lobbyFlow !== 'create') return
    const iv = setInterval(() => {
      setPlayers(prev => {
        if (prev.length >= tableSize) return prev
        const used = new Set(prev.filter(p => p.isBot).map(p => p.name.replace(/^Bot\s+/, '')))
        const bn = pickBotName(used)
        const id = `bot-${Date.now()}`
        lastJoinedIdRef.current = id
        setFeed(f => [`${bn} joined the room`, ...f].slice(0, 6))
        return [...prev, { id, name: `Bot ${bn}`, isBot: true }]
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [lobbyFlow, tableSize])

  const slots = useMemo(() => {
    const list = [...players]
    while (list.length < tableSize) list.push({ id: `empty-${list.length}`, isEmpty: true })
    return list.slice(0, tableSize)
  }, [players, tableSize])

  const canStart   = players.length >= 2
  const isFull     = players.length >= tableSize
  const isHost     = lobbyFlow === 'create'
  const fillPct    = Math.round((players.length / tableSize) * 100)

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg,
      backgroundImage: 'radial-gradient(#1A5C3511 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      overflow: 'hidden',
      fontFamily: "'Nunito', sans-serif",
    }}>

      {/* TOP BAR */}
      <div style={{
        width: '100%', height: 52,
        background: 'rgba(0,0,0,0.75)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen('home')}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${C.border}`,
            color: C.white, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
            {isHost ? '🏠 Waiting Room' : '🚪 Joining Room'}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>101 Pool Rummy · {tableSize}P</span>
        </div>

        {/* Player count badge */}
        <div style={{
          background: isFull ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.1)',
          border: `1px solid ${isFull ? '#22c55e55' : C.gold + '44'}`,
          borderRadius: 999, padding: '3px 10px',
          color: isFull ? '#22c55e' : C.gold,
          fontSize: 11, fontWeight: 800,
        }}>{players.length}/{tableSize}</div>
      </div>

      {/* SCROLLABLE BODY */}
      <div style={{
        flex: 1, width: '100%', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 14,
        padding: '16px 14px 100px',
      }}>

        {/* STATUS CARD */}
        <div style={{
          width: '100%',
          background: C.card,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          padding: '18px 16px',
          animation: 'fadeSlideIn 0.4s ease forwards',
        }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>PLAYERS JOINED</span>
            <span style={{ fontSize: 11, color: isFull ? '#22c55e' : C.gold, fontWeight: 800 }}>
              {isFull ? '✓ Room Full' : `${players.length} of ${tableSize}`}
            </span>
          </div>
          <div style={{
            width: '100%', height: 6, borderRadius: 99,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden', marginBottom: 14,
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${fillPct}%`,
              background: isFull
                ? 'linear-gradient(90deg,#22c55e,#4ade80)'
                : `linear-gradient(90deg,${C.green},${C.gold})`,
              transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            }}/>
          </div>

          {/* Countdown or waiting */}
          {countdown != null ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `3px solid ${C.gold}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 900, color: C.gold,
                animation: 'countdownPulse 1s ease infinite',
              }}>{countdown}</div>
              <span style={{ fontSize: 13, color: C.white, fontWeight: 700 }}>
                Game starting soon…
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              color: C.muted, fontSize: 12,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `2px solid ${C.gold}`,
                borderTopColor: 'transparent',
                animation: 'spin 0.9s linear infinite',
                flexShrink: 0,
              }}/>
              {isFull
                ? <span style={{ color: '#22c55e', fontWeight: 700 }}>All players ready! Start when ready.</span>
                : <span>Waiting for players to join…</span>
              }
            </div>
          )}
        </div>

        {/* PLAYER SLOTS */}
        <div style={{
          width: '100%',
          background: C.card,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.5s ease 0.08s both',
        }}>
          <div style={{
            padding: '12px 16px 8px',
            fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2,
            borderBottom: `1px solid ${C.border}`,
          }}>PLAYERS</div>

          {slots.map((p, i) => (
            <div
              key={p.id}
              className={p.isBot && p.id === lastJoinedIdRef.current ? 'lobby-join-pop' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderBottom: i < slots.length - 1 ? `1px solid ${C.border}` : 'none',
                opacity: p.isEmpty ? 0.35 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: p.isEmpty
                  ? 'rgba(255,255,255,0.04)'
                  : p.isBot
                    ? 'linear-gradient(135deg,#2d4a35,#1a3025)'
                    : 'linear-gradient(135deg,#3d2200,#5d3700)',
                border: `2px solid ${
                  p.isEmpty ? 'rgba(255,255,255,0.08)'
                  : p.isBot ? 'rgba(42,92,53,0.6)'
                  : C.gold + '88'
                }`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
                boxShadow: !p.isBot && !p.isEmpty ? `0 0 12px ${C.gold}44` : 'none',
              }}>
                {p.isEmpty ? '?' : p.isBot ? '🤖' : '👤'}
              </div>

              {/* Name + status */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: p.isEmpty ? C.muted : p.isBot ? C.white : C.gold,
                }}>
                  {p.isEmpty ? 'Waiting for player…' : p.name}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: p.isEmpty ? 'rgba(255,255,255,0.2)'
                    : p.isBot ? C.muted
                    : '#22c55e',
                  marginTop: 1,
                }}>
                  {p.isEmpty ? '— empty slot —' : p.isBot ? 'BOT' : '● YOU'}
                </div>
              </div>

              {/* Ready badge */}
              {!p.isEmpty && (
                <div style={{
                  background: p.isBot
                    ? 'rgba(42,92,53,0.3)'
                    : 'rgba(34,197,94,0.15)',
                  border: `1px solid ${p.isBot ? 'rgba(42,92,53,0.5)' : '#22c55e55'}`,
                  borderRadius: 999, padding: '3px 8px',
                  fontSize: 9, fontWeight: 800,
                  color: p.isBot ? C.muted : '#22c55e',
                }}>
                  {p.isBot ? 'READY' : 'READY ✓'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ACTIVITY FEED */}
        {feed.length > 0 && (
          <div style={{
            width: '100%',
            background: C.card,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            animation: 'fadeSlideIn 0.5s ease 0.15s both',
          }}>
            <div style={{
              padding: '10px 16px 8px',
              fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2,
              borderBottom: `1px solid ${C.border}`,
            }}>ACTIVITY</div>
            {feed.map((msg, i) => (
              <div
                key={`${msg}-${i}`}
                className="lobby-feed-item-anim"
                style={{
                  padding: '9px 16px',
                  borderBottom: i < feed.length - 1 ? `1px solid ${C.border}` : 'none',
                  fontSize: 12, color: C.white,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 14 }}>🟢</span>
                <span>{msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* HOST TIP */}
        {isHost && (
          <div style={{
            width: '100%',
            background: 'rgba(245,197,24,0.05)',
            borderRadius: 14,
            border: `1px solid rgba(245,197,24,0.18)`,
            padding: '12px 16px',
            fontSize: 12, color: C.muted,
            display: 'flex', gap: 10, alignItems: 'center',
            animation: 'fadeSlideIn 0.5s ease 0.2s both',
          }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <span>You are the host. Click <b style={{ color: C.gold }}>Start Game</b> when ready — you don't need to wait for all slots to fill.</span>
          </div>
        )}
      </div>

      {/* BOTTOM BUTTON */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 16px 28px',
        background: 'rgba(5,10,7,0.97)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Join flow shows countdown bar */}
        {!isHost && countdown != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>Auto-start in</span>
            <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${(countdown / 10) * 100}%`,
                background: `linear-gradient(90deg,${C.green},${C.gold})`,
                transition: 'width 1s linear',
              }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, flexShrink: 0, minWidth: 24 }}>{countdown}s</span>
          </div>
        )}

        <button
          disabled={!canStart}
          onClick={() => setScreen('game')}
          style={{
            width: '100%', padding: '17px',
            borderRadius: 50, border: 'none',
            background: canStart
              ? 'linear-gradient(180deg,#F5C518 0%,#D4A020 100%)'
              : 'rgba(255,255,255,0.07)',
            color: canStart ? '#1a0800' : 'rgba(255,255,255,0.25)',
            fontWeight: 900, fontSize: 16,
            cursor: canStart ? 'pointer' : 'not-allowed',
            boxShadow: canStart ? '0 4px 20px rgba(245,197,24,0.35)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {canStart ? '🎮 Start Game' : '⏳ Waiting for players…'}
        </button>
      </div>
    </div>
  )
}
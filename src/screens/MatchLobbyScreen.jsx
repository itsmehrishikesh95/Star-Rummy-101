import React, { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../store'
import LobbyPlayerSlot from '../components/LobbyPlayerSlot'
import socketService from '../services/socket'
import { emitStartGame } from '../services/gameSocket'

const BOT_NAMES = ['Rahul', 'Sneha', 'Amit', 'Priya', 'Rohit', 'Kiran']
const BOT_WAIT_MS = 60_000 // 1 minute before asking about bots

function pickBotName(used) {
  const available = BOT_NAMES.filter(n => !used.has(n))
  const pool = available.length ? available : BOT_NAMES
  return pool[Math.floor(Math.random() * pool.length)]
}

const C = {
  bg:     '#0a0f0d',
  card:   '#0f1f16',
  border: 'rgba(42,92,53,0.35)',
  gold:   '#F5C518',
  green:  '#1e7a3e',
  muted:  'rgba(139,168,152,0.7)',
  white:  '#ffffff',
  red:    '#ef5350',
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
  @keyframes feedSlide {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.88) translateY(24px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .lobby-join-pop { animation: joinPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .lobby-feed-item-anim { animation: feedSlide 0.3s ease forwards; }
  .lobby-modal-in { animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
`

// ─── Bot prompt modal ───────────────────────────────────────────────────────
function BotPromptModal({ onYes, onNo }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div
        className="lobby-modal-in"
        style={{
          width: '100%', maxWidth: 340,
          background: '#0f1f16',
          border: '1px solid rgba(245,197,24,0.3)',
          borderRadius: 24,
          padding: '28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ fontSize: 44 }}>🤖</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.white, marginBottom: 8 }}>
            No one joined yet
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            It's been a minute. Want to fill the empty seats with bots so you can start playing?
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
          <button
            onClick={onNo}
            style={{
              flex: 1, padding: '14px 0',
              borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: C.muted, fontWeight: 700, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            No, keep waiting
          </button>
          <button
            onClick={onYes}
            style={{
              flex: 1, padding: '14px 0',
              borderRadius: 50, border: 'none',
              background: 'linear-gradient(180deg,#F5C518 0%,#D4A020 100%)',
              color: '#1a0800', fontWeight: 900, fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(245,197,24,0.35)',
            }}
          >
            Yes, add bots 🤖
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main lobby ─────────────────────────────────────────────────────────────
export default function MatchLobbyScreen() {
  const setScreen   = useGameStore(s => s.setScreen)
  const isRoomHost  = useGameStore(s => s.isRoomHost)
  const user        = useGameStore(s => s.user)
  const activeRoomCode = useGameStore(s => s.activeRoomCode)
  const youName     = user?.name || 'YOU'
  const tableSize   = 6

  const [players,        setPlayers]        = useState([{ id: 'you', name: youName, isBot: false }])
  const [feed,           setFeed]           = useState([])
  const [showBotPrompt,  setShowBotPrompt]  = useState(false)
  const [botsAdded,      setBotsAdded]      = useState(false)
  const [gameError,      setGameError]      = useState('')

  const lastJoinedIdRef  = useRef(null)
  const botTimerRef      = useRef(null)
  const botFillRef       = useRef(null)

  // inject styles once
  useEffect(() => {
    if (!document.getElementById('lobby-styles')) {
      const el = document.createElement('style')
      el.id = 'lobby-styles'
      el.textContent = STYLES
      document.head.appendChild(el)
    }
    return () => { const s = document.getElementById('lobby-styles'); if (s) s.remove() }
  }, [])

  // ── Subscribe to server room_update — keeps player list in sync ──────────
  useEffect(() => {
    const s = socketService.getSocket()
    if (!s) return

    const handleRoomUpdate = (data) => {
      console.log('[Lobby] Updating players:', data.players)
      // Always replace with server data — never append
      setPlayers(
        data.players.map(p => ({
          id:    p.id,
          name:  p.name,
          isBot: false,
        }))
      )
      // Add new joiners to the activity feed
      setFeed(prev => {
        const existingIds = new Set(players.map(p => p.id))
        const newOnes = data.players.filter(p => !existingIds.has(p.id))
        if (!newOnes.length) return prev
        const msgs = newOnes.map(p => `${p.name} joined the room`)
        return [...msgs, ...prev].slice(0, 6)
      })
    }

    s.on('room_update', handleRoomUpdate)
    console.log('[Lobby] Subscribed to room_update')

    // ── Listen for game_error so host sees why start failed ──
    const handleGameError = (data) => {
      console.warn('[Lobby] game_error:', data)
      setGameError(data.message || 'Could not start game')
      setTimeout(() => setGameError(''), 4000)
    }
    s.on('game_error', handleGameError)

    // ── Listen for game_state — navigate ALL players when game starts ──────
    // game_state with state:'playing' is the single source of truth for start.
    // We must listen here (in lobby) because GameScreen isn't mounted yet
    // when the server sends the first game_state after start_game.
    const handleGameState = (data) => {
      if (data.state === 'playing') {
        console.log('[Lobby] game_state received with state:playing — navigating to game')
        setScreen('game')
      }
    }
    s.on('game_state', handleGameState)

    return () => {
      s.off('room_update', handleRoomUpdate)
      s.off('game_error', handleGameError)
      s.off('game_state', handleGameState)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 60-second bot-prompt timer (only for host, only if slots still empty) ──
  useEffect(() => {
    if (!isRoomHost || botsAdded) return

    botTimerRef.current = setTimeout(() => {
      // Only show if there are still empty slots
      setPlayers(prev => {
        if (prev.length < tableSize) setShowBotPrompt(true)
        return prev
      })
    }, BOT_WAIT_MS)

    return () => clearTimeout(botTimerRef.current)
  }, [isRoomHost, botsAdded, tableSize])

  // ── Animate bots in one-by-one after user says Yes ──
  const startBotFill = () => {
    setShowBotPrompt(false)
    setBotsAdded(true)

    botFillRef.current = setInterval(() => {
      setPlayers(prev => {
        if (prev.length >= tableSize) {
          clearInterval(botFillRef.current)
          return prev
        }
        const used = new Set(prev.filter(p => p.isBot).map(p => p.name.replace(/^Bot\s+/, '')))
        const bn = pickBotName(used)
        const id = `bot-${Date.now()}`
        lastJoinedIdRef.current = id
        setFeed(f => [`${bn} joined the room`, ...f].slice(0, 6))
        return [...prev, { id, name: `Bot ${bn}`, isBot: true }]
      })
    }, 900)
  }

  useEffect(() => () => clearInterval(botFillRef.current), [])

  // ── Derived ──
  const slots = useMemo(() => {
    const list = [...players]
    while (list.length < tableSize) list.push({ id: `empty-${list.length}`, isEmpty: true })
    return list.slice(0, tableSize)
  }, [players, tableSize])

  const canStart = players.length >= 1   // host can start alone (bots fill remaining slots)
  const isFull   = players.length >= tableSize
  const fillPct  = Math.round((players.length / tableSize) * 100)

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

      {/* Bot prompt modal */}
      {showBotPrompt && (
        <BotPromptModal
          onYes={startBotFill}
          onNo={() => setShowBotPrompt(false)}
        />
      )}

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
            {isRoomHost ? '🏠 Waiting Room' : '🚪 Joining Room'}
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

          {/* Waiting indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 12 }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `2px solid ${C.gold}`,
              borderTopColor: 'transparent',
              animation: 'spin 0.9s linear infinite',
              flexShrink: 0,
            }}/>
            {isFull
              ? <span style={{ color: '#22c55e', fontWeight: 700 }}>All players ready!</span>
              : isRoomHost
                ? <span>Waiting for players to join…</span>
                : <span style={{ color: C.gold, fontWeight: 700 }}>Waiting for host to start the game…</span>
            }
          </div>
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
                  background: p.isBot ? 'rgba(42,92,53,0.3)' : 'rgba(34,197,94,0.15)',
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
        {isRoomHost && (
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
            <span>You are the host. Click <b style={{ color: C.gold }}>Start Game</b> when ready.</span>
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
        {/* Game error banner */}
        {gameError && (
          <div style={{
            background: 'rgba(239,83,80,0.12)',
            border: '1px solid rgba(239,83,80,0.4)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13, fontWeight: 700, color: '#ef5350',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>❌</span><span>{gameError}</span>
          </div>
        )}
        {isRoomHost ? (
          /* ── HOST: can start the game ── */
          <button
            disabled={!canStart}
            onClick={() => {
              // Emit start_game to server — game_state (state: 'playing') drives navigation
              if (activeRoomCode) emitStartGame(activeRoomCode)
            }}
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
        ) : (
          /* ── JOINER: waiting for host ── */
          <div style={{
            width: '100%', padding: '17px',
            borderRadius: 50,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 800, fontSize: 15,
            textAlign: 'center',
            userSelect: 'none',
          }}>
            ⏳ Waiting for host to start the game…
          </div>
        )}
      </div>
    </div>
  )
}

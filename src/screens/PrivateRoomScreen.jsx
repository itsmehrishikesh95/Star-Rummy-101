import React, { useState } from 'react'
import useGameStore from '../store'
import socketService from '../services/socket'

const DOT = { backgroundImage:'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize:'20px 20px' }
const GOLD = { background:'linear-gradient(180deg,#F5C518 0%,#D4A020 100%)' }
const C = { bg:'#0D3320', card:'#1A5C35', dark:'#0A2518', gold:'#F5C518', muted:'#8BA898' }

// Code is generated ONCE here and immediately saved to the store.
// Never regenerated on re-render.
const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString()

export function PrivateRoomScreen() {
  const { setScreen, coins, setEntryFee, deductCoins, setLobbyFlow, setIsRoomHost, setActiveRoomCode, activeRoomCode } = useGameStore()
  const [fee, setFee] = useState(500)
  const [copied, setCopied] = useState(false)

  const PLAYERS = 6

  // Generate code once on first render and persist it in the store.
  // If activeRoomCode is already set (e.g. came back from another screen), reuse it.
  React.useEffect(() => {
    if (!activeRoomCode) {
      const code = generateCode()
      setActiveRoomCode(code)
      console.log('[PrivateRoomScreen] HOST CODE:', code)
    } else {
      console.log('[PrivateRoomScreen] HOST CODE (existing):', activeRoomCode)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Read the single source of truth from the store
  const code = activeRoomCode || '----'

  const create = () => {
    if (coins < fee) {
      alert('Insufficient coins!')
      return
    }

    setEntryFee(fee)
    deductCoins(fee)
    setLobbyFlow('create')
    setIsRoomHost(true)
    setScreen('match-lobby')
  }

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, ...DOT, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:50 }}/>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 16px 16px' }}>
        <button onClick={() => setScreen('home')} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'none', color:'white', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <h2 style={{ fontSize:18, fontWeight:800, color:'white' }}>Create Private Room</h2>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:14, paddingBottom:100 }}>

        {/* Room Code card */}
        <div style={{ background:C.dark, borderRadius:18, padding:'20px', border:'1px solid rgba(245,197,24,0.2)', textAlign:'center' }}>
          <p style={{ fontSize:11, color:C.muted, fontWeight:700, letterSpacing:2, marginBottom:14 }}>YOUR ROOM CODE</p>
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
            {code.split('').map((ch, i) => (
              <div key={i} style={{ width:42, height:52, borderRadius:10, background:'rgba(0,0,0,0.4)', border:'1.5px solid rgba(245,197,24,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:20, fontWeight:700, color:C.gold }}>{ch}</div>
            ))}
          </div>
          <button onClick={copy} style={{ background:copied?'rgba(76,175,80,0.15)':'rgba(245,197,24,0.1)', border:`1px solid ${copied?'rgba(76,175,80,0.4)':'rgba(245,197,24,0.35)'}`, borderRadius:50, padding:'8px 24px', cursor:'pointer', color:copied?'#4caf50':C.gold, fontWeight:700, fontSize:13 }}>
            {copied ? '✓ Copied!' : '📋 Copy Code'}
          </button>
          <p style={{ fontSize:11, color:'rgba(139,168,152,0.4)', marginTop:10 }}>Share this code with friends</p>
        </div>

        {/* Settings */}
        <div style={{ background:C.dark, borderRadius:18, padding:'18px', border:'1px solid rgba(42,92,53,0.3)', display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <p style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:10 }}>🪙 Entry Fee</p>
            <div style={{ display:'flex', gap:8 }}>
              {[100, 500, 1000].map(f => (
                <button key={f} onClick={() => setFee(f)} style={{ flex:1, padding:'12px 8px', borderRadius:50, cursor:'pointer', fontWeight:800, fontSize:13, border:fee===f?'2px solid #F5C518':'2px solid rgba(255,255,255,0.1)', background:fee===f?'rgba(245,197,24,0.1)':'transparent', color:fee===f?C.gold:C.muted, transition:'all 0.15s' }}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ background:C.dark, borderRadius:14, padding:'14px 16px', border:'1px solid rgba(42,92,53,0.25)', display:'flex', flexDirection:'column', gap:10 }}>
          {[
            ['Entry Fee', `${fee.toLocaleString()} 🪙`],
            ['Players', `${PLAYERS}`],
            ['Prize Pool', `${(fee * PLAYERS * 0.9).toFixed(0)} 🪙`, true]
          ].map(([l, v, g]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, color:C.muted, fontWeight:600 }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:g?C.gold:'white' }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={() => setScreen('join-room')} style={{ width:'100%', padding:'14px', borderRadius:50, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          Have a code? Join Room →
        </button>
      </div>

      {/* Bottom button */}
      <div style={{ padding:'12px 16px 28px', background:'rgba(5,12,7,0.97)', borderTop:'1px solid rgba(42,92,53,0.3)' }}>
        <button onClick={create} style={{ ...GOLD, width:'100%', padding:'17px', borderRadius:50, border:'none', color:'#1a0800', fontWeight:900, fontSize:16, cursor:'pointer', boxShadow:'0 4px 20px rgba(245,197,24,0.3)' }}>
          🎮 Create Room & Play
        </button>
      </div>
    </div>
  )
}

export function JoinRoomScreen() {
  const { setScreen, coins, setEntryFee, deductCoins, setLobbyFlow, setIsRoomHost, setActiveRoomCode } = useGameStore()
  const [code, setCode] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refs = React.useRef([])

  const onChange = (val, i) => {
    if (!/^[a-zA-Z0-9]?$/.test(val)) return
    const n = [...code]; n[i] = val.toUpperCase(); setCode(n)
    setError('')
    if (val && i < 3) refs.current[i + 1]?.focus()
  }
  const onKey = (e, i) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const join = () => {
    if (code.some(c => !c)) return

    const entered = code.join('')
    console.log('VALIDATING:', entered)
    setLoading(true)
    setError('')

    // Always use the singleton socket — never create a new instance
    const s = socketService.getSocket()
    if (!s) {
      setLoading(false)
      setError('Not connected to server. Please try again.')
      return
    }

    console.log('CLIENT SOCKET ID:', s.id)

    // Remove any stale listener before adding fresh one
    s.off('room_validated')

    let timeoutId = null

    const handleValidation = ({ code: responseCode, valid }) => {
      clearTimeout(timeoutId)
      console.log('[JoinRoomScreen] ROOM VALIDATED RESPONSE:', { code: responseCode, valid })

      if (!valid) {
        // Retry once after 500ms — host may not have registered yet (race condition)
        console.log('[JoinRoomScreen] Retrying validation in 500ms...')
        setTimeout(() => {
          s.off('room_validated')

          const handleRetry = ({ code: retryCode, valid: retryValid }) => {
            console.log('[JoinRoomScreen] RETRY VALIDATED RESPONSE:', { code: retryCode, valid: retryValid })
            if (!retryValid) {
              setLoading(false)
              setError('Invalid room code or host not available')
              return
            }
            onValidSuccess()
          }

          s.emit('validate_room', { code: entered })
          s.once('room_validated', handleRetry)
        }, 500)
        return
      }

      onValidSuccess()
    }

    const onValidSuccess = () => {
      // Save entered code as the active room code so downstream screens are consistent
      setActiveRoomCode(entered)

      // Join the socket room on the server
      const user = useGameStore.getState().user
      const playerName = user?.name || 'Player'
      console.log('JOINING:', entered)
      s.emit('join_room', { code: entered, playerName })

      setEntryFee(500)
      deductCoins(500)
      setLobbyFlow('join')
      setIsRoomHost(false)
      setScreen('match-lobby')
    }

    // Emit validation request — uses only the entered code, never global state
    s.emit('validate_room', { code: entered })
    s.once('room_validated', handleValidation)

    // Timeout fallback — if server doesn't respond in 5s
    timeoutId = setTimeout(() => {
      s.off('room_validated', handleValidation)
      setLoading(false)
      setError('Invalid room code or host not available')
    }, 5000)
  }

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, ...DOT, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:50 }}/>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 16px 16px' }}>
        <button onClick={() => setScreen('home')} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'none', color:'white', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, color:'white' }}>Join Private Room</h2>
          <p style={{ fontSize:12, color:C.muted }}>Enter the room code to join</p>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:16, paddingBottom:100 }}>

        {/* Code input card */}
        <div style={{ background:C.dark, borderRadius:18, padding:'24px 20px', border:'1px solid rgba(60,100,160,0.25)', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
          <p style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Enter the 4-digit room code</p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            {code.map((ch, i) => (
              <input
                key={i}
                ref={el => refs.current[i] = el}
                maxLength={1}
                value={ch}
                onChange={e => onChange(e.target.value, i)}
                onKeyDown={e => onKey(e, i)}
                style={{ width:42, height:52, textAlign:'center', fontSize:20, fontFamily:'monospace', fontWeight:700, background:'#0A1628', border:`2px solid ${ch ? '#F5C518' : '#2A4060'}`, borderRadius:10, outline:'none', color:'white', caretColor:C.gold, transition:'border 0.15s' }}
              />
            ))}
          </div>
          <p style={{ fontSize:11, color:'rgba(139,168,152,0.4)', marginTop:10 }}>Enter 4 digit code</p>
        </div>

        {/* Validation error */}
        {error && (
          <div style={{
            background: 'rgba(239,83,80,0.1)',
            border: '1px solid rgba(239,83,80,0.35)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
            <span style={{ fontSize: 13, color: '#ef5350', fontWeight: 700 }}>{error}</span>
          </div>
        )}

        {/* Info */}
        <div style={{ background:C.dark, borderRadius:14, padding:'16px', border:'1px solid rgba(42,92,53,0.25)', display:'flex', flexDirection:'column', gap:12 }}>
          {[
            ['Current Balance:', `🪙 ${coins.toLocaleString()} Coins`, true],
            ['Entry Fee:', '🪙 500 Coins', true]
          ].map(([l, v, g], i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:i===0?'12px':'0', borderBottom:i===0?'1px solid rgba(255,255,255,0.06)':'none' }}>
              <span style={{ fontSize:13, color:C.muted, fontWeight:600 }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:g?C.gold:'white' }}>{v}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize:12, color:C.muted, textAlign:'center', fontStyle:'italic' }}>Ask host to be available to join</p>
      </div>

      <div style={{ padding:'12px 16px 28px', background:'rgba(5,12,7,0.97)', borderTop:'1px solid rgba(42,92,53,0.3)' }}>
        <button
          onClick={join}
          disabled={loading || code.some(c => !c)}
          style={{ ...GOLD, width:'100%', padding:'17px', borderRadius:50, border:'none', color:'#1a0800', fontWeight:900, fontSize:16, cursor:'pointer', opacity:code.every(c => c)?1:0.45, transition:'opacity 0.2s', boxShadow:code.every(c => c)?'0 4px 20px rgba(245,197,24,0.3)':'none' }}
        >
          {loading ? '⏳ Joining...' : '🚪 Join Room'}
        </button>
      </div>
    </div>
  )
}
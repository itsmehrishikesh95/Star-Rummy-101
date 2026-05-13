import React, { useState } from 'react'
import useGameStore from '../store'

const DOT = { backgroundImage:'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize:'20px 20px' }
const GOLD = { background:'linear-gradient(180deg,#F5C518 0%,#D4A020 100%)' }
const C = { bg:'#0D3320', card:'#1A5C35', dark:'#0A2518', gold:'#F5C518', muted:'#8BA898' }

export default function GameModeScreen() {
  const { setScreen, coins, setEntryFee, deductCoins, setLobbyFlow } = useGameStore()
  const tableSize = 6
  const [fee, setFee] = useState(500)
  const options = [100,500,1000,2000]

  const handlePlay = () => {
    if (coins < fee) { alert('Insufficient coins!'); return }
    setEntryFee(fee); deductCoins(fee); setLobbyFlow('create'); setScreen('match-lobby')
  }

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, ...DOT, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:50 }}/>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px 12px' }}>
        <button onClick={()=>setScreen('home')} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'none', color:'white', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:16, fontWeight:700, color:C.gold, letterSpacing:2 }}>STAR RUMMY</span>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,197,24,0.3)', borderRadius:50, padding:'5px 12px' }}>
          <span>🪙</span>
          <span style={{ color:C.gold, fontWeight:800, fontSize:13 }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* SCROLL */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:14, paddingBottom:100 }}>

        {/* Active badge */}
        <div style={{ background:'rgba(45,212,160,0.1)', border:'1px solid rgba(45,212,160,0.3)', borderRadius:50, padding:'7px 16px', display:'flex', alignItems:'center', gap:8, alignSelf:'center' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#2DD4A0' }}/>
          <span style={{ fontSize:12, fontWeight:700, color:'#2DD4A0' }}>Active — 25 Days Left</span>
        </div>

        {/* 101 POOL Banner */}
        <div style={{ background:C.card, borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ background:'rgba(0,0,0,0.5)', padding:'18px', textAlign:'center' }}>
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:32, fontWeight:900, color:C.gold, letterSpacing:4 }}>STAR RUMMY</span>
          </div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
            {/* Entry fee display */}
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(0,0,0,0.25)', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ width:38, height:38, borderRadius:'50%', ...GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🪙</div>
              <div>
                <div style={{ fontSize:11, color:C.muted, fontWeight:700, letterSpacing:1 }}>ENTRY FEE</div>
                <div style={{ fontWeight:900, fontSize:18, color:C.gold }}>{fee.toLocaleString()} <span style={{ fontSize:13, color:C.muted, fontWeight:600 }}>Coins</span></div>
              </div>
            </div>

            {/* Fee options */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {options.map(o => (
                <button key={o} onClick={()=>setFee(o)} style={{
                  padding:'12px', borderRadius:14, cursor:'pointer', fontWeight:800, fontSize:15,
                  border: fee===o ? '2px solid #F5C518' : '2px solid rgba(255,255,255,0.08)',
                  background: fee===o ? 'rgba(245,197,24,0.12)' : 'rgba(0,0,0,0.25)',
                  color: fee===o ? C.gold : C.muted,
                  position:'relative', transition:'all 0.15s',
                }}>
                  {o===500 && <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', background:'#D4A020', color:'#1a0800', fontSize:8, fontWeight:900, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap' }}>POPULAR</div>}
                  {o.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display:'flex', justifyContent:'space-around', padding:'4px 0' }}>
              {[[String(tableSize),'Players'],[`${(fee*tableSize*0.9).toFixed(0)}`,'Prize 🪙',true],['101','Points']].map(([v,l,g])=>(
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontWeight:800, fontSize:18, color:g?C.gold:'white' }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create Private Room */}
        <button onClick={()=>setScreen('private-room')} style={{ ...GOLD, width:'100%', padding:'15px', borderRadius:50, border:'none', color:'#1a0800', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(245,197,24,0.3)' }}>
          🔒 Create Private Room
        </button>

        {/* Join with Code */}
        <button onClick={()=>setScreen('join-room')} style={{ width:'100%', padding:'15px', borderRadius:50, border:'2px solid rgba(255,255,255,0.15)', background:'transparent', color:'white', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🔗 Join with Code
        </button>

        {/* Sub info */}
        <p style={{ fontSize:11, color:C.muted, textAlign:'center', lineHeight:2 }}>
          Subscription ₹1000 = 10,000 coins / month<br/>
          Subscription ₹2000 = 20,000 coins / month
        </p>
      </div>

      {/* PLAY BUTTON FIXED BOTTOM */}
      <div style={{ padding:'12px 16px 28px', background:'rgba(5,12,7,0.97)', borderTop:'1px solid rgba(42,92,53,0.3)' }}>
        <button onClick={handlePlay} style={{ ...GOLD, width:'100%', padding:'17px', borderRadius:50, border:'none', color:'#1a0800', fontWeight:900, fontSize:16, letterSpacing:1, cursor:'pointer', boxShadow:'0 4px 24px rgba(245,197,24,0.4)' }}>
          PLAY NOW — {fee.toLocaleString()} Coins
        </button>
      </div>
    </div>
  )
}
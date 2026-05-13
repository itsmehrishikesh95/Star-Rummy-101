import React, { useEffect, useState } from 'react'
import useGameStore from '../store'

const DOT = { backgroundImage:'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize:'20px 20px' }

export default function SplashScreen() {
  const setScreen = useGameStore(s => s.setScreen)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(t); setTimeout(() => setScreen('otp'), 300); return 100 }
        return p + 2
      })
    }, 40)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ width:'100%', height:'100%', background:'#0D3320', ...DOT, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'80px 32px 60px' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28 }}>
        <div style={{ width:100, height:100, borderRadius:24, background:'linear-gradient(135deg,#1A5C35,#0a2518)', border:'2px solid rgba(245,197,24,0.4)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize:48 }}>🃏</span>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:48, fontWeight:900, color:'#F5C518', lineHeight:1, textShadow:'0 0 30px rgba(245,197,24,0.4)', letterSpacing:2 }}>STAR</div>
          <div style={{ fontSize:18, fontWeight:800, color:'white', letterSpacing:8, marginTop:4 }}>RUMMY</div>
          <div style={{ fontSize:12, color:'#8BA898', letterSpacing:3, marginTop:8 }}>THE ULTIMATE CARD GAME</div>
        </div>
      </div>
      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
        <div style={{ width:'100%', height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:2, width:`${progress}%`, background:'linear-gradient(90deg,#F5C518,#D4A020)', transition:'width 0.08s linear' }}/>
        </div>
        <span style={{ fontSize:12, color:'rgba(139,168,152,0.6)', fontWeight:600 }}>
          {progress < 40 ? 'Shuffling cards...' : progress < 80 ? 'Setting up table...' : 'Almost ready!'}
        </span>
      </div>
    </div>
  )
}
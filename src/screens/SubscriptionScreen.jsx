import React, { useState } from 'react'
import useGameStore from '../store'

const DOT = { backgroundImage:'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize:'20px 20px' }
const C = { bg:'#0D3320', gold:'#F5C518', goldD:'#D4A020', muted:'#8BA898', purple:'#6B3FA0', purpleD:'#4A2080' }

export default function SubscriptionScreen() {
  const { setScreen, addCoins, user } = useGameStore()
  const [sel, setSel] = useState('pro')

  // Prevent guest users from accessing subscription features
  if (user?.isGuest) {
    return (
      <div style={{
        width:'100%',
        height:'100%',
        background:C.bg,
        ...DOT,
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        justifyContent:'center',
        padding:'20px'
      }}>
        <div style={{
          background:'rgba(10,37,24,0.9)',
          border:'1px solid rgba(245,197,24,0.3)',
          borderRadius:20,
          padding:'32px 24px',
          textAlign:'center',
          maxWidth:'320px'
        }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ color:'white', fontSize:20, fontWeight:800, marginBottom:12 }}>
            Login Required
          </h2>
          <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>
            Please login with your phone number to access subscription and payment features.
          </p>
          <button
            onClick={() => setScreen('otp')}
            style={{
              padding:'14px 24px',
              borderRadius:50,
              background:'linear-gradient(135deg,#F5C518,#D4A020)',
              color:'#1a0800',
              fontWeight:800,
              fontSize:16,
              border:'none',
              cursor:'pointer',
              width:'100%'
            }}
          >
            Login Now
          </button>
        </div>
      </div>
    )
  }

  const plans = [
    { id:'basic', name:'Basic', price:999, coins:6000, color:'#2a7a3a', features:['6,000 coins / month','Access all game rooms','Priority matching','No ads'] },
    { id:'pro',   name:'Pro',   price:2000,coins:10000,color:C.purple,  popular:true, features:['10,000 coins / month','Access all game rooms','Play unlimited games','Priority matching','VIP badge','No ads'] },
  ]

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, ...DOT, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:50 }}/>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 16px 8px' }}>
        <button onClick={()=>setScreen('home')} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'none', color:'white', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <h2 style={{ fontSize:18, fontWeight:800, color:'white' }}>Choose Your Subscription</h2>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:14, paddingBottom:100 }}>

        {/* Hero */}
        <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
          <div style={{ fontSize:54, filter:'drop-shadow(0 0 20px rgba(245,197,24,0.4))' }}>👑</div>
          <p style={{ fontSize:13, color:C.muted, marginTop:8 }}>Get unlimited access with coins</p>
        </div>

        {/* Plan cards stacked */}
        {plans.map(plan => (
          <div key={plan.id} onClick={()=>setSel(plan.id)} style={{
            borderRadius:20, padding:'18px 16px', cursor:'pointer',
            border:`2px solid ${sel===plan.id?plan.color:'rgba(42,92,53,0.25)'}`,
            background: sel===plan.id ? `linear-gradient(145deg,rgba(10,20,14,0.98),${plan.color}18)` : 'rgba(10,22,14,0.7)',
            position:'relative', transition:'all 0.2s',
            boxShadow: sel===plan.id ? `0 0 22px ${plan.color}30` : 'none',
          }}>
            {plan.popular && (
              <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:plan.color, color:'white', fontSize:9, fontWeight:900, padding:'3px 14px', borderRadius:20, letterSpacing:1, whiteSpace:'nowrap' }}>MOST POPULAR</div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:18, color:'white' }}>{plan.name}</div>
                <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>🪙 {plan.coins.toLocaleString()} coins</div>
              </div>
              <div style={{ background: plan.id==='pro'?'linear-gradient(135deg,#4a1fa8,#2d0e6e)':'rgba(42,92,53,0.3)', borderRadius:14, padding:'10px 16px', textAlign:'center', border:`1px solid ${plan.color}40` }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:24, fontWeight:900, color:C.gold }}>₹{plan.price.toLocaleString()}</div>
                <div style={{ fontSize:10, color:C.muted }}>per month</div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ color:plan.color, fontSize:14, flexShrink:0 }}>✓</span>
                  <span style={{ fontSize:13, color:'rgba(200,230,210,0.85)', fontWeight:600 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Radio dot */}
            <div style={{ position:'absolute', top:18, right:16, width:22, height:22, borderRadius:'50%', border:`2px solid ${plan.color}`, background:sel===plan.id?plan.color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
              {sel===plan.id && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:12, padding:'12px 14px' }}>
          <p style={{ fontSize:11, color:'rgba(139,168,152,0.4)', lineHeight:1.7 }}>
            🔒 Cancel anytime. Current month remains valid.<br/>
            📋 Subscription required to invite rooms.
          </p>
        </div>
      </div>

      {/* Select Plan fixed bottom */}
      <div style={{ padding:'12px 16px 28px', background:'rgba(5,12,7,0.97)', borderTop:'1px solid rgba(42,92,53,0.3)' }}>
        <button onClick={()=>{ addCoins(plans.find(p=>p.id===sel)?.coins||6000); alert('✅ Subscribed! Coins added.'); setScreen('match-lobby') }} style={{ width:'100%', padding:'17px', borderRadius:50, border:'2px solid white', background:'transparent', color:'white', fontWeight:900, fontSize:16, cursor:'pointer' }}>
          Select a Plan — ₹{plans.find(p=>p.id===sel)?.price.toLocaleString()}/month
        </button>
      </div>
    </div>
  )
}

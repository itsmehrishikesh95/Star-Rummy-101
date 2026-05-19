import React, { useState, useEffect } from 'react'
import useGameStore from '../store'

const AVATARS = ['🧑', '👩', '🧔', '👱', '🧕', '👲', '🧑‍💼', '👩‍💼', '🧑‍🎮', '👩‍🎮']

const GENDERS = [
  { value: 'male',   label: '♂ Male' },
  { value: 'female', label: '♀ Female' },
  { value: 'other',  label: '⚧ Other' },
]

const C = {
  bg: '#0D3320',
  card: '#1A5C35',
  dark: '#0A2518',
  gold: '#F5C518',
  goldD: '#D4A020',
  muted: '#8BA898',
  red: '#ef5350',
  green: '#22c55e',
}

const DOT = {
  backgroundImage: 'radial-gradient(#1A5C35 1px, transparent 1px)',
  backgroundSize: '20px 20px',
}

export default function ProfileScreen() {
  const setScreen = useGameStore(s => s.setScreen)
  const profileName   = useGameStore(s => s.profileName)
  const profileGender = useGameStore(s => s.profileGender)
  const profileEmail  = useGameStore(s => s.profileEmail)
  const profileAvatar = useGameStore(s => s.profileAvatar)
  const setProfile    = useGameStore(s => s.setProfile)
  const user          = useGameStore(s => s.user)

  const [name,   setName]   = useState(profileName   || user?.name || '')
  const [gender, setGender] = useState(profileGender || '')
  const [email,  setEmail]  = useState(profileEmail  || user?.email || '')
  const [avatar, setAvatar] = useState(profileAvatar || AVATARS[0])
  const [saved,  setSaved]  = useState(false)
  const [errors, setErrors] = useState({})

  // Persist to localStorage on mount so data survives app restarts
  useEffect(() => {
    const stored = localStorage.getItem('starRummyProfile')
    if (stored) {
      try {
        const p = JSON.parse(stored)
        if (!profileName && p.name)   setName(p.name)
        if (!profileGender && p.gender) setGender(p.gender)
        if (!profileEmail && p.email) setEmail(p.email)
        if (!profileAvatar && p.avatar) setAvatar(p.avatar)
      } catch (_) {}
    }
  }, [])

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Name is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setProfile({ name: name.trim(), gender, email: email.trim(), avatar })
    localStorage.setItem('starRummyProfile', JSON.stringify({
      name: name.trim(), gender, email: email.trim(), avatar,
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        }}>MY PROFILE</span>
        <div style={{ width: 38 }} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 40px' }}>

        {/* Avatar picker */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(245,197,24,0.12)',
            border: `3px solid ${C.gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 42, marginBottom: 12,
            boxShadow: '0 0 20px rgba(245,197,24,0.25)',
          }}>
            {avatar}
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 10 }}>
            CHOOSE AVATAR
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: 'center', maxWidth: 280,
          }}>
            {AVATARS.map(a => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                style={{
                  width: 44, height: 44, borderRadius: '50%', fontSize: 22,
                  border: avatar === a ? `2px solid ${C.gold}` : '2px solid rgba(255,255,255,0.1)',
                  background: avatar === a ? 'rgba(245,197,24,0.15)' : 'rgba(0,0,0,0.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: C.card, borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>

          {/* Name */}
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              DISPLAY NAME
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: '' })) }}
              placeholder="Enter your name"
              maxLength={20}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(0,0,0,0.35)', border: errors.name ? `1.5px solid ${C.red}` : '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 15, fontWeight: 600, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.name && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
          </div>

          {/* Gender */}
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              GENDER
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {GENDERS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  style={{
                    flex: 1, padding: '10px 4px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                    border: gender === g.value ? `2px solid ${C.gold}` : '2px solid rgba(255,255,255,0.1)',
                    background: gender === g.value ? 'rgba(245,197,24,0.12)' : 'rgba(0,0,0,0.25)',
                    color: gender === g.value ? C.gold : C.muted,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              EMAIL (OPTIONAL)
            </label>
            <input
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: '' })) }}
              placeholder="your@email.com"
              type="email"
              inputMode="email"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(0,0,0,0.35)', border: errors.email ? `1.5px solid ${C.red}` : '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 15, fontWeight: 600, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.email && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            marginTop: 24, width: '100%', padding: '16px',
            borderRadius: 50, border: 'none',
            background: saved
              ? `linear-gradient(180deg, ${C.green}, #16a34a)`
              : `linear-gradient(180deg, ${C.gold}, ${C.goldD})`,
            color: saved ? '#fff' : '#1a0800',
            fontWeight: 900, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(245,197,24,0.3)',
            transition: 'background 0.3s',
            letterSpacing: 0.5,
          }}
        >
          {saved ? '✓ Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}

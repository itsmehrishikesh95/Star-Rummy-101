import React, { useState, useRef, useEffect } from 'react'
import { signInWithPhoneNumber } from 'firebase/auth'
import { auth, setupRecaptcha } from '../firebase'
import useGameStore from '../store'

const DOT = { backgroundImage:'radial-gradient(#1A5C35 1px, transparent 1px)', backgroundSize:'20px 20px' }

export default function OTPScreen() {
  const { setScreen, setUser, setPhone } = useGameStore()
  const [step, setStep] = useState('phone')
  const [phone, setPhoneVal] = useState('')
  const [otp, setOtp] = useState(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState(null)
  const refs = useRef([])

  const sendOTP = async () => {
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit number')
      return
    }

    setError('')
    setLoading(true)

    try {
      const phoneNumber = `+91${phone}`
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier

      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
      setConfirmationResult(result)
      setStep('otp')
      setTimer(30)

      // Start countdown timer
      const countdown = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(countdown)
            return 0
          }
          return prev - 1
        })
      }, 1000)

    } catch (error) {
      console.error('Error sending OTP:', error)
      let errorMessage = 'Failed to send OTP. Please try again.'

      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.'
      } else if (error.code === 'auth/missing-phone-number') {
        errorMessage = 'Phone number is required'
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const onChange = (val, i) => {
    if (!/^[0-9]?$/.test(val)) return
    const n = [...otp]
    n[i] = val
    setOtp(n)

    if (val && i < 5) refs.current[i+1]?.focus()
    if (n.every(d=>d) && i===5) verify(n.join(''))
  }

  const onKey = (e,i) => {
    if(e.key==='Backspace'&&!otp[i]&&i>0) refs.current[i-1]?.focus()
  }

  const verify = async (code) => {
    if (!confirmationResult) {
      setError('Please request OTP first')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await confirmationResult.confirm(code)

      // Get Firebase ID token
      const idToken = await result.user.getIdToken()

      // Send token to backend for verification and JWT issuance
      const response = await fetch('/api/auth/firebase-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to verify login on server')
      }

      const { token: jwtToken, user: backendUser } = payload
      if (!jwtToken || !backendUser) {
        throw new Error('Invalid backend auth response')
      }

      const userData = {
        ...backendUser,
        jwt: jwtToken,
      }

      // Store JWT securely in localStorage for browser flows
      try {
        window.localStorage.setItem('rummy101_jwt', jwtToken)
      } catch (storageError) {
        console.warn('Unable to persist auth token locally', storageError)
      }

      setUser(userData)
      setPhone(phone)
      setScreen('home')

    } catch (error) {
      console.error('Error verifying OTP:', error)
      let errorMessage = 'Invalid OTP. Please try again.'

      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code'
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP has expired. Please request a new one.'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.'
      }

      setError(errorMessage)
      setOtp(['','','','','','']) // Clear OTP inputs
      refs.current[0]?.focus() // Focus first input
    } finally {
      setLoading(false)
    }
  }

  const goBackToPhone = () => {
    setStep('phone')
    setOtp(['','','','','',''])
    setError('')
    setConfirmationResult(null)
  }

  return (
    <div style={{ width:'100%', height:'100%', background:'#0D3320', ...DOT, display:'flex', flexDirection:'column', padding:'0 24px', overflowY:'auto' }}>
      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>

      <div style={{ paddingTop:70, paddingBottom:32, textAlign:'center' }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:32, fontWeight:900, color:'#F5C518' }}>101</div>
        <div style={{ fontSize:11, fontWeight:800, color:'rgba(139,168,152,0.7)', letterSpacing:4 }}>POOL RUMMY</div>
      </div>

      <div style={{ background:'rgba(10,37,24,0.8)', border:'1px solid rgba(42,92,53,0.5)', borderRadius:20, padding:'28px 22px', display:'flex', flexDirection:'column', gap:18 }}>
        {step === 'phone' ? (
          <>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📱</div>
              <h2 style={{ fontSize:20, fontWeight:800, color:'white' }}>Enter Mobile Number</h2>
              <p style={{ fontSize:13, color:'#8BA898', marginTop:4 }}>We'll send you a verification code</p>
            </div>
            <div style={{ display:'flex', border:'1.5px solid rgba(42,92,53,0.6)', borderRadius:12, overflow:'hidden', background:'rgba(0,0,0,0.3)' }}>
              <div style={{ padding:'14px', background:'rgba(42,92,53,0.3)', color:'#8BA898', fontWeight:700, fontSize:15, borderRight:'1px solid rgba(42,92,53,0.4)' }}>+91</div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={e=>{ setPhoneVal(e.target.value.replace(/\D/g,'')); setError('') }}
                onKeyDown={e=>e.key==='Enter'&&sendOTP()}
                style={{ flex:1, padding:'14px', background:'transparent', border:'none', outline:'none', color:'white', fontSize:18, fontWeight:700, letterSpacing:2 }}
              />
            </div>
            {error && <p style={{ color:'#ef5350', fontSize:13, textAlign:'center' }}>{error}</p>}
            <button
              onClick={sendOTP}
              disabled={loading || phone.length !== 10}
              style={{
                padding:'16px',
                border:'none',
                borderRadius:50,
                background: loading || phone.length !== 10 ? 'rgba(245,197,24,0.5)' : 'linear-gradient(180deg,#F5C518,#D4A020)',
                color:'#1a0800',
                fontWeight:900,
                fontSize:16,
                cursor: loading || phone.length !== 10 ? 'not-allowed' : 'pointer',
                boxShadow:'0 4px 20px rgba(245,197,24,0.35)'
              }}
            >
              {loading ? 'Sending...' : 'GET OTP'}
            </button>
            <p style={{ fontSize:11, color:'rgba(139,168,152,0.35)', textAlign:'center', lineHeight:1.6 }}>
              By continuing you agree to our <span style={{color:'#F5C518'}}>Terms</span> & <span style={{color:'#F5C518'}}>Privacy Policy</span>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={goBackToPhone}
              style={{ background:'none', border:'none', color:'#8BA898', cursor:'pointer', fontSize:14, fontWeight:700, alignSelf:'flex-start' }}
            >
              ← Back
            </button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔐</div>
              <h2 style={{ fontSize:20, fontWeight:800, color:'white' }}>Verify OTP</h2>
              <p style={{ fontSize:13, color:'#8BA898', marginTop:4 }}>Sent to +91 {phone}</p>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              {otp.map((d,i) => (
                <input
                  key={i}
                  ref={el=>refs.current[i]=el}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e=>onChange(e.target.value,i)}
                  onKeyDown={e=>onKey(e,i)}
                  style={{
                    width:44,
                    height:52,
                    textAlign:'center',
                    fontSize:22,
                    fontWeight:800,
                    fontFamily:'Orbitron,sans-serif',
                    border:`2px solid ${d?'#F5C518':'rgba(42,92,53,0.5)'}`,
                    borderRadius:10,
                    outline:'none',
                    caretColor:'#F5C518',
                    background:d?'rgba(245,197,24,0.1)':'rgba(0,0,0,0.3)',
                    color:'white',
                    transition:'all 0.15s'
                  }}
                />
              ))}
            </div>
            {error && <p style={{ color:'#ef5350', fontSize:13, textAlign:'center' }}>{error}</p>}
            <button
              onClick={()=>verify(otp.join(''))}
              disabled={loading||otp.some(d=>!d)}
              style={{
                padding:'16px',
                border:'none',
                borderRadius:50,
                background: (loading||otp.some(d=>!d)) ? 'rgba(245,197,24,0.5)' : 'linear-gradient(180deg,#F5C518,#D4A020)',
                color:'#1a0800',
                fontWeight:900,
                fontSize:16,
                cursor: (loading||otp.some(d=>!d)) ? 'not-allowed' : 'pointer',
                opacity:(loading||otp.some(d=>!d))?0.6:1,
                boxShadow:'0 4px 20px rgba(245,197,24,0.35)'
              }}
            >
              {loading ? 'Verifying...' : 'VERIFY & PLAY'}
            </button>
            <p style={{ textAlign:'center', fontSize:13, color:'#8BA898' }}>
              {timer > 0 ? (
                <>Resend in <strong style={{color:'#F5C518'}}>{timer}s</strong></>
              ) : (
                <button
                  onClick={sendOTP}
                  style={{background:'none',border:'none',color:'#F5C518',cursor:'pointer',fontSize:13,fontWeight:700,textDecoration:'underline'}}
                >
                  Resend OTP
                </button>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

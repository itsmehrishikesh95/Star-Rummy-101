import React, { useEffect, useRef, useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { auth } from '../firebase'
import useGameStore from '../store'

const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10)

export default function Login() {
  const setUser = useGameStore((s) => s.setUser)
  const setScreen = useGameStore((s) => s.setScreen)

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  const otpRef = useRef(null)

  // 🔥 Create RecaptchaVerifier ONLY when user sends OTP
  const createRecaptcha = () => {
    // Check if already exists
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier
    }

    try {
      const verifier = new RecaptchaVerifier('recaptcha-container', {
        size: 'normal'
      }, auth)

      window.recaptchaVerifier = verifier
      return verifier
    } catch (err) {
      console.error('RecaptchaVerifier creation error:', err)
      return null
    }
  }

  // ⏱️ Timer for resend
  useEffect(() => {
    let timer
    if (otpSent && secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => Math.max(prev - 1, 0))
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [otpSent, secondsLeft])

  // 🎯 Focus OTP input
  useEffect(() => {
    if (otpSent && otpRef.current) {
      otpRef.current.focus()
    }
  }, [otpSent])

  // 📩 Send OTP - Create RecaptchaVerifier ONLY here on user action
  const handleSendOtp = async () => {
    setError('')
    setInfo('')

    const normalized = normalizePhone(phone)

    if (normalized.length !== 10) {
      setError('Please enter a valid 10-digit Indian phone number.')
      return
    }

    try {
      setLoading(true)
      const fullPhone = `+91${normalized}`

      // Create RecaptchaVerifier only when user clicks Send OTP
      const verifier = createRecaptcha()
      if (!verifier) {
        setError('reCAPTCHA initialization failed. Please try again.')
        return
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        fullPhone,
        verifier
      )

      window.confirmationResult = confirmationResult
      setOtpSent(true)
      setSecondsLeft(30)
      setInfo(`OTP sent to ${fullPhone}.`)
    } catch (err) {
      console.error('Send OTP failed:', err)

      // Handle specific error cases
      if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.')
      } else if (err.message?.includes('appVerificationDisabledForTesting')) {
        setError('reCAPTCHA verification failed. Please try again.')
      } else {
        setError('Unable to send OTP. Try again.')
      }

      // Reset RecaptchaVerifier on failure
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear()
        } catch (e) {
          console.warn('Failed to clear reCAPTCHA:', e)
        }
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  // ✅ Verify OTP
  const handleVerifyOtp = async () => {
    setError('')
    setInfo('')

    if (!otpSent || !window.confirmationResult) {
      setError('Please request an OTP first.')
      return
    }

    if (!otp || otp.length < 4) {
      setError('Enter the OTP sent to your phone.')
      return
    }

    try {
      setLoading(true)

      const result = await window.confirmationResult.confirm(otp.trim())
      const idToken = await result.user.getIdToken()

      const fullPhone = `+91${normalizePhone(phone)}`

      localStorage.setItem('firebase_id_token', idToken)
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('user_phone', fullPhone)

      setUser({
        uid: result.user.uid,
        phone: fullPhone,
        jwt: idToken
      })

      setScreen('home')
    } catch (err) {
      console.error('Verify OTP failed:', err)
      setError('Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // 📱 Input handlers
  const handlePhoneChange = (e) => {
    setPhone(normalizePhone(e.target.value))
    if (error) setError('')
  }

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
    if (error) setError('')
  }

  // 🎭 Guest login handler
  const handlePlayAsGuest = () => {
    setError('')
    setInfo('')

    // Generate unique guest ID
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const guestNumber = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

    const guestUser = {
      uid: guestId,
      displayName: `Guest_${guestNumber}`,
      isGuest: true,
      phone: null,
      jwt: null,
      coins: 5000, // Give guest users starting coins
    }

    // Store guest session in localStorage
    localStorage.setItem('isGuest', 'true')
    localStorage.setItem('guestUser', JSON.stringify(guestUser))

    // Set user in store
    setUser(guestUser)

    // Navigate to home
    setScreen('home')
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0a1a0f 0%, #1a2a1f 50%, #0a1a0f 100%)',
      backgroundImage: `
        radial-gradient(circle at 20% 80%, rgba(245,197,24,0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(245,197,24,0.08) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(42,92,53,0.05) 0%, transparent 50%)
      `,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '0 16px 32px',
      fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Background Pattern Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(rgba(245,197,24,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 0.3,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Logo/Title Section — compact when OTP is shown */}
      <div style={{
        textAlign: 'center',
        marginTop: otpSent ? 24 : 48,
        marginBottom: otpSent ? 16 : 28,
        zIndex: 2,
        position: 'relative',
        transition: 'all 0.3s ease',
      }}>
        <div style={{
          fontSize: otpSent ? '36px' : '48px',
          fontWeight: 900,
          background: 'linear-gradient(45deg, #F5C518, #FFD700, #F5C518)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '6px',
          letterSpacing: '-2px',
          transition: 'font-size 0.3s ease',
        }}>
          101
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: 800,
          color: 'rgba(245,197,24,0.8)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '3px',
        }}>
          Pool Rummy
        </div>
        {!otpSent && (
          <div style={{
            fontSize: '12px',
            color: 'rgba(139,168,152,0.7)',
            fontWeight: 600,
          }}>
            Secure mobile login to continue
          </div>
        )}
      </div>

      {/* Main Login Panel */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'rgba(10, 37, 24, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245,197,24,0.2)',
        borderRadius: '24px',
        padding: '24px 20px',
        boxShadow: `
          0 20px 40px rgba(0,0,0,0.4),
          0 0 60px rgba(245,197,24,0.1),
          inset 0 1px 0 rgba(255,255,255,0.1)
        `,
        zIndex: 2,
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* Phone Input Section */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{
            display: 'block',
            fontSize: '15px',
            fontWeight: 700,
            color: '#F5C518',
            marginBottom: '10px',
            textAlign: 'center',
          }}>
            📱 Enter Mobile Number
          </label>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '2px solid rgba(245,197,24,0.3)',
            borderRadius: '14px',
            background: 'rgba(0,0,0,0.3)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {/* Country Code */}
            <div style={{
              padding: '14px 14px',
              background: 'rgba(245,197,24,0.15)',
              borderRight: '1px solid rgba(245,197,24,0.3)',
              color: '#F5C518',
              fontWeight: 800,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0,
            }}>
              🇮🇳 +91
            </div>

            {/* Phone Input */}
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={handlePhoneChange}
              className="login-input"
              style={{
                flex: 1,
                padding: '14px 14px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'white',
                fontSize: '17px',
                fontWeight: 700,
                letterSpacing: '1px',
                fontFamily: 'monospace',
                minWidth: 0,
              }}
            />
          </div>
        </div>

        {/* Send OTP Button */}
        <button
          onClick={handleSendOtp}
          disabled={loading || phone.length !== 10}
          className="login-button"
          style={{
            width: '100%',
            padding: '15px',
            border: 'none',
            borderRadius: '50px',
            background: loading || phone.length !== 10
              ? 'linear-gradient(135deg, rgba(245,197,24,0.3), rgba(212,160,32,0.3))'
              : 'linear-gradient(135deg, #F5C518, #D4A020)',
            color: loading || phone.length !== 10 ? 'rgba(26,8,0,0.5)' : '#1a0800',
            fontWeight: 900,
            fontSize: '15px',
            cursor: loading || phone.length !== 10 ? 'not-allowed' : 'pointer',
            boxShadow: loading || phone.length !== 10
              ? '0 4px 12px rgba(0,0,0,0.2)'
              : '0 8px 24px rgba(245,197,24,0.4)',
            transition: 'all 0.3s ease',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            touchAction: 'manipulation',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(26,8,0,0.3)',
                borderTopColor: '#1a0800',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Sending OTP...
            </div>
          ) : (
            'Send OTP'
          )}
        </button>

        {/* Play as Guest Button */}
        <button
          onClick={handlePlayAsGuest}
          disabled={loading}
          className="login-button"
          style={{
            width: '100%',
            padding: '14px',
            border: '2px solid rgba(245,197,24,0.4)',
            borderRadius: '50px',
            background: 'transparent',
            color: '#F5C518',
            fontWeight: 800,
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(245,197,24,0.2)',
            transition: 'all 0.3s ease',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            opacity: loading ? 0.6 : 1,
            touchAction: 'manipulation',
          }}
        >
          🎭 Play as Guest
        </button>

        {/* OTP Input Section (shown after OTP sent) */}
        {otpSent && (
          <div style={{
            paddingTop: '18px',
            borderTop: '1px solid rgba(245,197,24,0.2)',
          }}>
            <label style={{
              display: 'block',
              fontSize: '15px',
              fontWeight: 700,
              color: '#F5C518',
              marginBottom: '10px',
              textAlign: 'center',
            }}>
              🔐 Enter OTP
            </label>

            <input
              ref={otpRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={handleOtpChange}
              className="login-input"
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid rgba(245,197,24,0.3)',
                borderRadius: '14px',
                background: 'rgba(0,0,0,0.3)',
                color: 'white',
                fontSize: '20px',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '8px',
                outline: 'none',
                transition: 'all 0.3s ease',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />

            {/* Verify OTP Button */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="login-button"
              style={{
                width: '100%',
                padding: '15px',
                border: 'none',
                borderRadius: '50px',
                background: loading || otp.length < 4
                  ? 'linear-gradient(135deg, rgba(245,197,24,0.3), rgba(212,160,32,0.3))'
                  : 'linear-gradient(135deg, #F5C518, #D4A020)',
                color: loading || otp.length < 4 ? 'rgba(26,8,0,0.5)' : '#1a0800',
                fontWeight: 900,
                fontSize: '15px',
                cursor: loading || otp.length < 4 ? 'not-allowed' : 'pointer',
                boxShadow: loading || otp.length < 4
                  ? '0 4px 12px rgba(0,0,0,0.2)'
                  : '0 8px 24px rgba(245,197,24,0.4)',
                transition: 'all 0.3s ease',
                marginTop: '14px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                touchAction: 'manipulation',
              }}
            >
              {loading ? 'Verifying...' : 'Verify & Play'}
            </button>

            {/* Resend Timer */}
            {secondsLeft > 0 && (
              <div style={{
                textAlign: 'center',
                marginTop: '10px',
                fontSize: '13px',
                color: 'rgba(139,168,152,0.7)',
                fontWeight: 600,
              }}>
                Resend OTP in <span style={{ color: '#F5C518' }}>{secondsLeft}s</span>
              </div>
            )}

            {/* Resend Button */}
            {secondsLeft === 0 && (
              <button
                onClick={handleSendOtp}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  border: '1px solid rgba(245,197,24,0.4)',
                  borderRadius: '25px',
                  background: 'transparent',
                  color: '#F5C518',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  marginTop: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  touchAction: 'manipulation',
                }}
              >
                Resend OTP
              </button>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(239,83,80,0.1)',
            border: '1px solid rgba(239,83,80,0.3)',
            color: '#ef5350',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Success Message */}
        {info && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(76,175,80,0.1)',
            border: '1px solid rgba(76,175,80,0.3)',
            color: '#4caf50',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {info}
          </div>
        )}

        {/* Terms & Privacy */}
        <div style={{
          marginTop: '16px',
          fontSize: '11px',
          color: 'rgba(139,168,152,0.6)',
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          By continuing you agree to our{' '}
          <span style={{ color: '#F5C518', cursor: 'pointer' }}>Terms</span> &{' '}
          <span style={{ color: '#F5C518', cursor: 'pointer' }}>Privacy Policy</span>
        </div>
      </div>

      {/* 🔥 REQUIRED - Firebase reCAPTCHA container */}
      <div id="recaptcha-container" style={{ marginTop: 12, opacity: 0.5 }}></div>

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .login-button:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .login-button:active:not(:disabled) {
            transform: translateY(0px);
            transition: all 0.1s ease;
          }

          .login-input:focus {
            border-color: #F5C518 !important;
            box-shadow: 0 0 20px rgba(245,197,24,0.3) !important;
          }
        `
      }} />
    </div>
  )
}

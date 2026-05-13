import React, { useCallback, useEffect, useRef, useState } from 'react'
import useGameStore from './store'
import SplashScreen from './screens/SplashScreen'
import Login from './screens/Login'
import { PrivateRoomScreen, JoinRoomScreen } from './screens/PrivateRoomScreen'
import SubscriptionScreen from './screens/SubscriptionScreen'
import GameScreen from './screens/GameScreen'
import MatchLobbyScreen from './screens/MatchLobbyScreen'
import MainMenu from './screens/MainMenu'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'

function GameLoadingScreen({ message = 'Preparing table...', error = '', onRetry = null }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#050a06',
      color: '#F5C518',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 14,
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: '3px solid rgba(245,197,24,0.25)',
        borderTopColor: '#F5C518',
        animation: 'spin 0.9s linear infinite',
      }} />
      <div style={{ fontWeight: 900, fontSize: 16 }}>{message}</div>
      {error ? (
        <>
          <div style={{ color: '#ff8a80', fontSize: 14, fontWeight: 700 }}>{error}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                marginTop: 4,
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid rgba(245,197,24,0.35)',
                background: 'rgba(245,197,24,0.12)',
                color: '#F5C518',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </>
      ) : null}
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}

function GameEntryGate() {
  const isGameLoading = useGameStore((s) => s.isGameLoading)
  const isGameReady = useGameStore((s) => s.isGameReady)
  const playerHand = useGameStore((s) => s.playerHand)
  const gameState = useGameStore((s) => s.gameState)
  const gameInitError = useGameStore((s) => s.gameInitError)
  const beginGameLoading = useGameStore((s) => s.beginGameLoading)
  const failGameLoading = useGameStore((s) => s.failGameLoading)
  const clearGameInitError = useGameStore((s) => s.clearGameInitError)
  const initializeMockGameData = useGameStore((s) => s.initializeMockGameData)
  const watchdogRef = useRef(null)
  const initStartedRef = useRef(false)
  const [initTimeout, setInitTimeout] = useState(false)

  const hasPlayerHand = Array.isArray(playerHand) && playerHand.length > 0
  const canRenderGame = isGameReady && hasPlayerHand && !!gameState

  const clearInitTimers = useCallback(() => {
    console.log('CLEAR INIT TIMERS', {
      watchdog: watchdogRef.current,
    })
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const startInitialization = useCallback(() => {
    console.log('STEP 1: startInitialization')
    clearInitTimers()
    initStartedRef.current = true
    setInitTimeout(false)
    clearGameInitError()
    beginGameLoading()

    console.log('STEP 1A: calling initializeMockGameData directly')
    try {
      console.log('STEP 2: initializeMockGameData direct call')
      initializeMockGameData()
      console.log('STEP 3: initializeMockGameData completed')
    } catch (error) {
      console.error('Game init failed during direct mock setup', error)
      initStartedRef.current = false
      failGameLoading('Game init failed')
      return
    }

    watchdogRef.current = setTimeout(() => {
      if (initStartedRef.current && !canRenderGame) {
        console.error('Game init watchdog timeout after 5 seconds')
        setInitTimeout(true)
        try {
          console.log('STEP 4: init watchdog fallback, forcing mock data')
          initializeMockGameData()
        } catch (error) {
          console.error('Game init fallback failed', error)
          failGameLoading('Initialization timeout')
        }
      }
    }, 5000)
    console.log('STEP 1B: watchdog created', { watchdogId: watchdogRef.current })
  }, [beginGameLoading, canRenderGame, clearGameInitError, clearInitTimers, failGameLoading, initializeMockGameData])

  useEffect(() => {
    console.log('STEP 0: GameEntryGate effect', {
      canRenderGame,
      gameInitError,
      initStarted: initStartedRef.current,
      isGameLoading,
      playerHandLength: playerHand.length,
      gameStatePresent: !!gameState,
    })

    if (canRenderGame) {
      clearInitTimers()
      initStartedRef.current = false
      return
    }

    if (gameInitError || initStartedRef.current) return

    startInitialization()
  }, [canRenderGame, gameInitError, isGameLoading, playerHand.length, gameState, startInitialization, clearInitTimers])

  useEffect(() => {
    console.log('GameEntryGate mounted')
    return () => {
      console.log('GameEntryGate unmounted')
      clearInitTimers()
    }
  }, [clearInitTimers])

  const handleRetry = useCallback(() => {
    startInitialization()
  }, [startInitialization])

  if (!canRenderGame) {
    const loadingMessage = initTimeout
      ? 'Initialization timeout — loading mock data'
      : gameInitError
        ? 'Preparing game data failed'
        : (isGameLoading ? 'Preparing game data...' : 'Starting game...')

    const loadingError = initTimeout ? 'Initialization timeout' : gameInitError

    return (
      <GameLoadingScreen
        message={loadingMessage}
        error={loadingError}
        onRetry={handleRetry}
      />
    )
  }

  return (
    <>
      <GameScreen />
      {initTimeout && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(245,197,24,0.95)',
          color: '#000', padding: '10px 16px', borderRadius: 12,
          fontWeight: 700, zIndex: 999,
        }}>
          Initialization timeout — mock data loaded
        </div>
      )}
    </>
  )
}

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const isLoggedIn = useGameStore((s) => s.isLoggedIn)
  const user = useGameStore((s) => s.user)
  const hasUserAccess = isLoggedIn || (user && user.isGuest)
  const setUser = useGameStore((s) => s.setUser)
  const setScreen = useGameStore((s) => s.setScreen)
  const isGame = screen === 'game'

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if (isGame) {
        ScreenOrientation.lock({ orientation: 'landscape' }).catch(console.error)
      } else {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(console.error)
      }
    }

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      })
      const resizeTimeout = setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 220)
      return () => clearTimeout(resizeTimeout)
    }
    return undefined
  }, [isGame])

  useEffect(() => {
    const token = localStorage.getItem('firebase_id_token')
    const phone = localStorage.getItem('user_phone')
    const isGuest = localStorage.getItem('isGuest')
    const guestUserData = localStorage.getItem('guestUser')

    if (token && !isLoggedIn) {
      setUser({ jwt: token, phone: phone || null })
      if (screen === 'splash' || screen === 'otp') {
        setScreen('home')
      }
    } else if (isGuest && guestUserData && !isLoggedIn) {
      // Restore guest session
      try {
        const guestUser = JSON.parse(guestUserData)
        setUser(guestUser)
        if (screen === 'splash' || screen === 'otp') {
          setScreen('home')
        }
      } catch (error) {
        console.error('Failed to restore guest session:', error)
        // Clear corrupted guest data
        localStorage.removeItem('isGuest')
        localStorage.removeItem('guestUser')
      }
    }
  }, [isLoggedIn, screen, setScreen, setUser])

  const renderScreen = () => {
    // Allow authenticated users OR guest users to access the app
    if (!hasUserAccess && screen !== 'splash') {
      return <Login />
    }

    switch (screen) {
      case 'home':         return <MainMenu />
      case 'splash':       return <SplashScreen />
      case 'otp':          return <Login />
      case 'match-lobby':  return <MatchLobbyScreen />
      case 'private-room': return <PrivateRoomScreen />
      case 'join-room':    return <JoinRoomScreen />
      case 'subscription': return <SubscriptionScreen />
      case 'game':         return <GameEntryGate />
      default:             return <MainMenu />
    }
  }

  // ── GAME: fills entire browser window ──
  if (isGame) {
    return (
      <div style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'#000', position:'relative' }}>
        {renderScreen()}
      </div>
    )
  }

  // ── ALL OTHER SCREENS: 390×844 portrait shell centered on desktop ──
  const isDesktop = !Capacitor.isNativePlatform()
    && window.innerWidth > 430
    && window.matchMedia('(pointer: fine)').matches
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'relative',
        width: isDesktop ? 390 : '100vw',
        height: isDesktop ? Math.min(844, window.innerHeight) : '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'hidden',
        borderRadius: isDesktop ? 44 : 0,
        boxShadow: isDesktop
          ? '0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.8)'
          : 'none',
        background: '#0D3320',
      }}>
        {renderScreen()}
      </div>
    </div>
  )
}

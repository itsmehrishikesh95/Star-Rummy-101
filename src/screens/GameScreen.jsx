import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useEffect as _ue } from 'react'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import useGameStore from '../store'
import { calculateAlignment } from '../utils/alignmentConfig'
import RummyCardAnimations from './RummyCardAnimations'
import PlayersAroundTable from './PlayersAroundTable'
import { PlayerCircularTimer } from './PlayersAroundTable'
import CenterArea from './CenterArea'
import PlayerHand from './PlayerHand'
import Controls from './Controls'
import TopBar from './TopBar'
import Scoreboard from './Scoreboard'
import AnimationLayer from './AnimationLayer'
import startBg from '../assets/NEWGAMETABLE.png'
import jokerHatImg from '../assets/Joker_hat.png'
import { getCardImage } from '../utils/cardImage'
import { validateDeclaration as engineValidateDeclaration, isValidGroup as engineIsValidGroup } from '../game/engine'
import socketService from '../services/socket'
import { subscribeToGame, emitDrawCard, emitDiscardCard, emitStartGame } from '../services/gameSocket'

const C = {
  bg: '#0a0f0d',
  tableFelt: '#1e7a3e',
  topBar: 'rgba(0,0,0,0.85)',
  gold: '#F5C518',
  white: '#ffffff',
  grey: 'rgba(255,255,255,0.5)',
  cardRed: '#d32f2f',
  cardBlack: '#1a1a1a',
  purpleDark: '#2d0a4a',
  purpleMid: '#4a1a6a',
  btnBorder: 'rgba(255,255,255,0.15)',
  green: '#22c55e',
}

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function clamp(min, value, max) {
  return Math.min(Math.max(value, min), max)
}

// AI player names (will be sliced by table size)
const AI_NAMES = ['Priya', 'Rahul', 'Sneha', 'Amit', 'Kavya', 'Vikram']

function makeDeck() {
  const deck = []
  let id = 0
  for (let s of SUITS)
    for (let r of RANKS)
      deck.push({
        id: id++,
        rank: r,
        suit: s,
        pts: ['A', 'J', 'Q', 'K', '10'].includes(r) ? 10 : parseInt(r),
        isJoker: false,
        isWildJoker: false
      })
  // No printed jokers — only wild jokers (cut from deck) are used in 101 Pool Rummy
  return deck
}

function makeTwoDecks() {
  const deck1 = makeDeck()
  const deck2 = makeDeck().map(card => ({
    ...card,
    id: card.id + 54  // Offset second deck IDs by 54
  }))
  return [...deck1, ...deck2]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealCards(deck, numPlayers) {
  const s = shuffle(deck)
  const hands = []
  for (let i = 0; i < numPlayers; i++) {
    hands.push(s.slice(i * 13, (i + 1) * 13))
  }
  const offset = numPlayers * 13
  return {
    playerHand: hands[0],
    aiHands: hands.slice(1),
    drawPile: s.slice(offset),
    discardPile: [s[offset]],
    wildJoker: s[offset + 1],
  }
}

function sortAndGroup(hand) {
  const sorted = [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit)
    return RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)
  })
  const groups = [[], [], [], []]
  sorted.forEach((card, i) => {
    groups[Math.min(Math.floor(i / Math.ceil(sorted.length / 4)), 3)].push(card)
  })
  return groups
}

// Group cards by suit then rank for display
function getHandGroups(hand) {
  if (!hand || hand.length === 0) return [[]]
  const bySuit = {}
  hand.forEach(card => {
    const key = (card.isJoker || card.isWildJoker) ? 'joker' : card.suit
    if (!bySuit[key]) bySuit[key] = []
    bySuit[key].push(card)
  })
  Object.keys(bySuit).forEach(suit => {
    if (suit !== 'joker') {
      bySuit[suit].sort((a, b) =>
        RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank))
    }
  })
  return Object.values(bySuit).filter(g => g.length > 0)
}

// Safe animation helper - fallback to 0 if calculation fails
function getCardRotation(cardId) {
  try {
    const raw = String(cardId ?? 0)
      .split('')
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    return (raw % 7) - 3
  } catch (error) {
    console.warn('getCardRotation failed, using 0:', error)
    return 0
  }
}

// Evaluate a single group of cards
// Wild Joker rules (101 Pool Rummy):
// - Printed joker (isJoker=true): always acts as joker, scores 0
// - Wild joker (isWildJoker=true): can act as joker OR as its natural card
//   → If used as natural card in a pure sequence, it IS a pure sequence
function evalGroup(group) {
  if (!group || group.length === 0)
    return { label: 'Empty', color: '#555', pts: 0, valid: false }

  const printedJokers = group.filter(c => c.isJoker)           // 🃏 printed joker only
  const wildJokers    = group.filter(c => c.isWildJoker)       // wild joker (natural card)
  const natural       = group.filter(c => !c.isJoker && !c.isWildJoker)
  const allJokers     = [...printedJokers, ...wildJokers]       // both types act as joker
  const pts = natural.reduce((s, c) => s + (c.pts || 0), 0)

  // ── PURE SEQUENCE check ──
  // Case A: No jokers at all — standard consecutive same-suit run
  // Case B: Wild joker(s) used AS their natural card value (same suit, fills the rank)
  // In both cases: no printed jokers allowed, all cards same suit, consecutive
  if (printedJokers.length === 0) {
    // Treat wild jokers as their natural card for this check
    const allAsNatural = [...natural, ...wildJokers]
    if (allAsNatural.length >= 3) {
      const sameSuit = allAsNatural.every(c => c.suit === allAsNatural[0].suit)
      if (sameSuit) {
        const idx = allAsNatural.map(c => RANKS.indexOf(c.rank)).sort((a, b) => a - b)
        // No duplicates allowed in a pure sequence
        const noDups = idx.every((v, i) => i === 0 || v !== idx[i - 1])
        const isConsec = noDups && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
        if (isConsec)
          return { label: 'Pure Seq', color: '#1565c0', pts: 0, valid: true, type: 'pureSeq' }
      }
    }
  }

  // ── IMPURE SEQUENCE check ──
  // Natural cards must ALL be same suit AND consecutive (gaps filled by jokers)
  // Minimum 3 cards total (natural + jokers)
  if (natural.length >= 1 && natural.length + allJokers.length >= 3) {
    const sameSuit = natural.every(c => c.suit === natural[0].suit)
    if (sameSuit) {
      const idx = natural.map(c => RANKS.indexOf(c.rank)).sort((a, b) => a - b)
      // No duplicate ranks among natural cards
      const noDups = idx.every((v, i) => i === 0 || v !== idx[i - 1])
      if (noDups) {
        const gaps = idx.reduce((acc, v, i) => i === 0 ? 0 : acc + (v - idx[i - 1] - 1), 0)
        if (gaps <= allJokers.length)
          return { label: 'Sequence', color: '#2e7d32', pts: 0, valid: true, type: 'seq' }
      }
    }
  }

  // ── SET check ──
  // 3–4 cards same rank, different suits, jokers allowed
  if (natural.length >= 2) {
    const sameRank = natural.every(c => c.rank === natural[0].rank)
    const uniqueSuits = new Set(natural.map(c => c.suit)).size
    const total = natural.length + allJokers.length
    if (sameRank && uniqueSuits === natural.length && total >= 3 && total <= 4)
      return { label: 'Set', color: '#2e7d32', pts: 0, valid: true, type: 'set' }
  }

  // ── INVALID — score is sum of natural card values (jokers = 0) ──
  return { label: `${pts}pts`, color: '#c62828', pts, valid: false, type: 'invalid' }
}

// Check if hand can be declared
function checkDeclaration(hand) {
  const groups = getHandGroups(hand)
  const evals = groups.map(g => evalGroup(g))

  const hasPureSeq = evals.some(
    e => e.type === 'pureSeq')
  const seqCount = evals.filter(
    e => e.type === 'pureSeq' || e.type === 'seq').length
  const allValid = evals.every(e => e.valid)
  const totalInvalidPts = evals.reduce(
    (s, e) => s + e.pts, 0)

  return {
    canDeclare: hasPureSeq && seqCount >= 2 && allValid,
    hasPureSeq,
    seqCount,
    allValid,
    totalInvalidPts,
    reason: !hasPureSeq
      ? 'Need 1 Pure Sequence!'
      : seqCount < 2
        ? 'Need 2 Sequences!'
        : !allValid
          ? `${totalInvalidPts} pts not in valid groups`
          : ''
  }
}

// Calculate score for a hand — capped at 80 per 101 Pool Rummy rules
function calcScore(hand) {
  const groups = getHandGroups(hand)
  const raw = groups.reduce((s, g) => s + evalGroup(g).pts, 0)
  return Math.min(raw, 80)
}


const ANIM_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Rajdhani:wght@600;700&display=swap');

  .flip-card { perspective: 800px; cursor: pointer; }
  .flip-card-inner {
    position: relative; width: 100%; height: 100%;
    transition: transform 0.65s cubic-bezier(0.4,0,0.2,1);
    transform-style: preserve-3d;
  }
  .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
  .flip-front, .flip-back {
    position: absolute; inset: 0; backface-visibility: hidden;
    border-radius: 10px; overflow: hidden;
  }
  .flip-back { transform: rotateY(180deg); }

  .card-selectable {
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                box-shadow 0.25s ease, filter 0.25s ease;
    cursor: pointer;
    touch-action: none; /* Disable native touch behaviors */
  }
  .card-selectable:hover {
    transform: translateY(-10px) scale(1.04);
    filter: brightness(1.08);
  }
  .card-selectable.selected {
    transform: translateY(-22px) scale(1.06);
    box-shadow: 0 0 0 3px #F5C518,
                0 12px 40px rgba(245,197,24,0.6),
                0 20px 60px rgba(0,0,0,0.8);
    filter: brightness(1.12);
  }

  @keyframes dealCard {
    0%   { transform: translate(var(--dx), var(--dy)) scale(0.3) rotate(var(--dr)); opacity:0; }
    60%  { opacity: 1; }
    100% { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
  }
  .deal-animate {
    animation: dealCard 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
    animation-delay: var(--deal-delay);
    opacity: 0;
  }

  @keyframes discardFly {
    0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
    40%  { transform: translate(var(--tx), calc(var(--ty)*0.4)) rotate(calc(var(--rot)*0.6)) scale(0.9); opacity:1; }
    100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.5); opacity:0; }
  }
  .discard-animate { animation: discardFly 0.5s cubic-bezier(0.4,0,1,1) forwards; }

  @keyframes drawPop {
    0%   { transform: translateY(20px) scale(0.7); opacity:0; }
    60%  { transform: translateY(-8px) scale(1.05); opacity:1; }
    80%  { transform: translateY(2px) scale(0.98); }
    100% { transform: translateY(0) scale(1); opacity:1; }
  }
  .draw-animate { animation: drawPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }

  @keyframes validFlash {
    0%,100% { box-shadow: none; }
    25%     { box-shadow: 0 0 0 4px #00E676, 0 0 24px #00E676; }
    50%     { box-shadow: 0 0 0 2px #00E676, 0 0 10px #00E676; }
    75%     { box-shadow: 0 0 0 5px #00E676, 0 0 30px #00E676; }
  }
  .valid-flash { animation: validFlash 0.7s ease forwards; }

  @keyframes invalidShake {
    0%,100% { transform: translateX(0) rotate(0deg); }
    15%     { transform: translateX(-8px) rotate(-2deg); }
    30%     { transform: translateX(8px) rotate(2deg); }
    45%     { transform: translateX(-6px) rotate(-1deg); }
    60%     { transform: translateX(6px) rotate(1deg); }
    75%     { transform: translateX(-3px); }
    90%     { transform: translateX(3px); }
  }
  @keyframes invalidRedFlash {
    0%,100% { box-shadow: none; }
    30%     { box-shadow: 0 0 0 4px #FF1744, 0 0 20px #FF1744; }
    60%     { box-shadow: 0 0 0 2px #FF1744; }
  }
  .invalid-shake {
    animation: invalidShake 0.6s ease forwards,
               invalidRedFlash 0.6s ease forwards;
  }

  @keyframes winSpread {
    0%   { transform: translateX(0) rotate(0deg) translateY(0); }
    100% { transform: translateX(var(--wx)) rotate(var(--wr)) translateY(var(--wy)); }
  }
  @keyframes winGlow {
    0%,100% { filter: brightness(1); }
    50%     { filter: brightness(1.4) drop-shadow(0 0 12px #F5C518); }
  }
  .win-spread {
    animation: winSpread 0.6s cubic-bezier(0.34,1.3,0.64,1) forwards,
               winGlow 1s ease 0.6s infinite;
  }

  @keyframes confettiFall {
    0%   { transform: translateY(-20px) rotate(0deg) scale(1); opacity:1; }
    100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity:0; }
  }
  .confetti-piece {
    animation: confettiFall var(--cf-dur) linear var(--cf-delay) forwards;
    position: absolute;
  }

  @keyframes sortMove {
    0%   { transform: translateX(var(--sort-from)); }
    50%  { transform: translateX(var(--sort-from)) translateY(-18px); }
    100% { transform: translateX(0) translateY(0); }
  }
  .sort-animate {
    animation: sortMove 0.45s cubic-bezier(0.4,0,0.2,1) var(--sort-delay) both;
  }

  @keyframes opponentDeal {
    0%   { transform: translate(var(--ox),var(--oy)) scale(0.2) rotate(180deg); opacity:0; }
    100% { transform: translate(0,0) scale(1) rotate(var(--of)); opacity:1; }
  }
  .opponent-deal {
    animation: opponentDeal 0.4s cubic-bezier(0.22,1,0.36,1) var(--op-delay) both;
  }

  @keyframes jokerSparkle {
    0%,100% { filter: hue-rotate(0deg) brightness(1); transform: scale(1); }
    25%     { filter: hue-rotate(90deg) brightness(1.3); transform: scale(1.08); }
    50%     { filter: hue-rotate(180deg) brightness(1.1); transform: scale(1); }
    75%     { filter: hue-rotate(270deg) brightness(1.3); transform: scale(1.05); }
  }
  .joker-sparkle { animation: jokerSparkle 2s ease infinite; }

  @keyframes turnPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,197,24,0.6); }
    50%     { box-shadow: 0 0 0 12px transparent; }
  }
  .turn-pulse { animation: turnPulse 1.2s ease infinite; }

  @keyframes deckRipple {
    0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,197,24,0.7); }
    50%  { transform: scale(0.96); box-shadow: 0 0 0 18px rgba(245,197,24,0); }
    100% { transform: scale(1); }
  }
  .deck-ripple { animation: deckRipple 0.4s ease forwards; }

  @keyframes cardBurn {
    0%   { transform: scale(1) rotate(0deg); filter: brightness(1); opacity:1; }
    40%  { transform: scale(1.1) rotate(-5deg); filter: brightness(2) sepia(1) saturate(5); }
    100% { transform: scale(0) rotate(30deg); filter: brightness(3) blur(8px); opacity:0; }
  }
  .card-burn { animation: cardBurn 0.7s ease forwards; }
`

export default function GameScreen() {
  const setScreen = useGameStore(s => s.setScreen)
  const tableSize = useGameStore(s => s.tableSize) || 6
  const user = useGameStore(s => s.user)
  const activeRoomCode = useGameStore(s => s.activeRoomCode)  // multiplayer room code
  const isMultiplayer = !!activeRoomCode

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  )
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return screen.orientation?.type?.includes('landscape') ||
        window.matchMedia('(orientation: landscape)').matches ||
        true
    } catch (e) {
      return true
    }
  })

  useEffect(() => {
    console.log('STEP 7: GameScreen mounted')
  }, [])

  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
      try {
        const landscape =
          screen.orientation?.type?.includes('landscape') ||
          window.matchMedia('(orientation: landscape)').matches
        setIsLandscape(landscape)
      } catch (e) {
        setIsLandscape(true)
      }
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    if (screen.orientation?.addEventListener) {
      screen.orientation.addEventListener('change', updateViewport)
    }

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
      if (screen.orientation?.removeEventListener) {
        screen.orientation.removeEventListener('change', updateViewport)
      }
    }
  }, [])

  // Calculate all responsive alignment from centralized config
  const alignment = useMemo(() => 
    calculateAlignment(viewportWidth, viewportHeight, isLandscape),
    [viewportWidth, viewportHeight, isLandscape]
  )
  const {
    isShortLandscape, isIphoneSE, isStandardPhone, isFoldOrTablet, hasSideScoreboard, tableCompact,
    cardW, cardH, contentPadding, scoreboardWidth,
    actionBarHeight, handBottom, centerAreaTop, getAIPositions
  } = alignment
  const isMobileLandscape = isLandscape && viewportHeight <= 560
  const [aiPlayers, setAiPlayers] = useState([])
  const [gameState, setGameState] = useState('dealing')
  // 'dealing' | 'draw' | 'discard' | 'finished'
  const [playerHand, setPlayerHand] = useState([])
  const [drawPile, setDrawPile] = useState([])
  const [discardPile, setDiscardPile] = useState([])
  const [wildJoker, setWildJoker] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  // Multi-select for Group feature — array of selected cards
  const [selectedCards, setSelectedCards] = useState([])
  const [playerScore, setPlayerScore] = useState(0)
  const [currentTurn, setCurrentTurn] = useState(0)
  const isPlayerTurn = currentTurn === 0
  const currentTurnRef = useRef(0)
  const [turnTimer, setTurnTimer] = useState(30)
  // Two-phase timer: 'main' (30s green) → 'penalty' (10s red) → auto-discard
  const [timerPhase, setTimerPhase] = useState('main') // 'main' | 'penalty' | 'idle'
  const [penaltyTimer, setPenaltyTimer] = useState(10)
  const penaltyTimerRef = useRef(null)
  const [dealtCount, setDealtCount] = useState(0)
  const [showDeclare, setShowDeclare] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  // track if player drew this turn
  const [deckRipple, setDeckRipple] = useState(false)
  const [drawnCardAnim, setDrawnCardAnim] = useState(false)
  const [discardAnim, setDiscardAnim] = useState(false)
  const [flyingCard, setFlyingCard] = useState(null) // {card, fromPile, toPosition}
  const [aiActionAnim, setAiActionAnim] = useState(null) // {type: 'draw'|'discard', playerIndex}
  const [sortAnim, setSortAnim] = useState(false)
  const [sortKey, setSortKey] = useState(0)
  const [confetti, setConfetti] = useState([])
  const [groupFlash, setGroupFlash] = useState({})
  // Track if human player has dropped this round (still in game but skipped each turn)
  const [playerDropped, setPlayerDropped] = useState(false)
  // Snapshot of all hands at round end — used to show cards in result screen
  const [roundSnapshot, setRoundSnapshot] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const timerRef = useRef(null)
  const turnStartTimeoutRef = useRef(null)
  const aiTurnTimeoutRef = useRef(null)
  const aiDiscardTimeoutRef = useRef(null)
  const aiActionClearTimeoutRef = useRef(null)
  const confettiTimeoutRef = useRef(null)
  const groupFlashTimeoutRef = useRef(null)
  const isAdvancingTurnRef = useRef(false)
  const aiTurnExecutingRef = useRef(false)
  const drawPendingRef = useRef(false)
  const discardPendingRef = useRef(false)
  const activeRoundRef = useRef(1)
  const aiPlayersRef = useRef([])
  const [turnPhase, setTurnPhase] = useState('idle')
  const handRef = useRef(null)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const scrollStart = useRef(0)
  const dragIndexRef = useRef(null)
  const [scoreboard, setScoreboard] = useState([])
  const [roundNumber, setRoundNumber] = useState(1)
  const [winner, setWinner] = useState(null)
  // dealerIndex: 0 = human player, 1-5 = AI index+1. Tracks who won the toss (dealer).
  const [dealerIndex, setDealerIndex] = useState(null)

  const drawPileRef = useRef(null)
  const discardPileRef = useRef(null)
  const aiRefs = useRef([])
  const sortRef = useRef(null)
  const [layerAnimations, setLayerAnimations] = useState([])

  const removeAnim = (id) => {
    setLayerAnimations(prev => {
      const anim = prev.find(a => a.id === id)
      
      // If a dealt card animation completes, add it to the hand incrementally
      if (anim && id.startsWith('deal_human_')) {
        setTimeout(() => {
          setPlayerHand(currentHand => {
            // Prevent duplicates if double-fired
            if (currentHand.some(c => c.id === anim.card.id)) return currentHand
            return [...currentHand, anim.card]
          })
          setDealtCount(count => count + 1)
        }, 0)
      }
      
      return prev.filter(a => a.id !== id)
    })
  }

  useEffect(() => {
    aiPlayersRef.current = aiPlayers
  }, [aiPlayers])

  useEffect(() => () => {
    clearInterval(timerRef.current)
    clearInterval(penaltyTimerRef.current)
    clearTimeout(turnStartTimeoutRef.current)
    clearTimeout(aiTurnTimeoutRef.current)
    clearTimeout(aiDiscardTimeoutRef.current)
    clearTimeout(aiActionClearTimeoutRef.current)
    clearTimeout(confettiTimeoutRef.current)
    clearTimeout(groupFlashTimeoutRef.current)
  }, [])

  // ── MULTIPLAYER BRIDGE ─────────────────────────────────────────────────────
  // When activeRoomCode is present, subscribe to server game_state and sync to local state.
  // Does NOT run in solo/mock mode (activeRoomCode is null).
  useEffect(() => {
    if (!isMultiplayer) return
    const s = socketService.socket
    if (!s?.connected) {
      // Socket not connected yet — retry after a short delay
      const retryTimer = setTimeout(() => {
        const sock = socketService.socket
        if (sock?.connected) {
          sock.emit('request_game_state', { code: activeRoomCode, playerId: '' })
        }
      }, 1000)
      return () => clearTimeout(retryTimer)
    }

    const mySocketId = s.id
    console.log('[GameScreen] Multiplayer mode active', { code: activeRoomCode, mySocketId })

    // Convert server suit format (S/H/D/C) to client format (♠/♥/♦/♣)
    const suitToUnicode = { S: '♠', H: '♥', D: '♦', C: '♣' }
    function convertCard(card) {
      if (!card) return card
      return {
        ...card,
        suit: suitToUnicode[card.suit] || card.suit,
        pts: ['A', 'J', 'Q', 'K', '10'].includes(card.rank) ? 10 : (parseInt(card.rank) || 0),
      }
    }

    const cleanup = subscribeToGame(activeRoomCode, mySocketId, {
      onGameState: (data) => {
        const rawHand = data.hand || []
        const myHand = rawHand.map(convertCard)

        setPlayerHand(myHand)
        setDiscardPile((data.discardPile || []).map(convertCard))
        setDrawPile([])  // server manages the deck; we only show deckSize
        setWildJoker(null) // no wild joker in multiplayer for now

        // Map server player index to local currentTurn (0 = me, 1+ = others)
        const myIndex = (data.players || []).findIndex(p => p.id === mySocketId)
        const serverTurnIndex = (data.players || []).findIndex(p => p.id === data.currentTurn)
        const localTurn = serverTurnIndex === myIndex ? 0 : (serverTurnIndex >= 0 ? serverTurnIndex : 0)
        setCurrentTurn(localTurn)
        currentTurnRef.current = localTurn

        // Build opponent player list from server data (everyone except me)
        const aiData = (data.players || [])
          .filter(p => p.id !== mySocketId)
          .map((p, i) => ({
            id: i,
            name: p.name || `Player ${i + 1}`,
            hand: new Array(p.handSize || 0).fill({ id: `hidden-${i}`, rank: '?', suit: '?' }),
            score: 0,
            isEliminated: false,
          }))
        setAiPlayers(aiData)

        // Derive local game phase from turn and hand size
        const myTurn = data.currentTurn === mySocketId
        if (myTurn && myHand.length <= 13) {
          setGameState('draw')
          setHasDrawn(false)
        } else if (myTurn && myHand.length === 14) {
          setGameState('discard')
          setHasDrawn(true)
        } else if (!myTurn) {
          // Not my turn — set to draw (waiting) so UI doesn't block
          setGameState('draw')
          setHasDrawn(false)
        }

        // Mark dealing as complete
        setDealtCount(13)

        console.log('[GameScreen] game_state synced', {
          myTurn,
          handSize: myHand.length,
          currentTurn: data.currentTurn,
          players: data.players?.length,
        })
      },

      onGameError: (data) => {
        console.warn('[Game Error]', data)
      },

      onHostChanged: (data) => {
        console.log('[GameScreen] host_changed', data)
      },

      onRoomClosed: (data) => {
        setTimeout(() => setScreen('home'), 2500)
      },
    })

    // Request current game state in case we missed the broadcast
    // (GameScreen mounts after navigation, so the first game_state may have fired already)
    import('../services/gameSocket').then(({ getOrCreatePlayerId }) => {
      s.emit('request_game_state', { code: activeRoomCode, playerId: getOrCreatePlayerId() })
      console.log('[GameScreen] requested game_state resync')
    }).catch(() => {})

    return cleanup
  }, [isMultiplayer, activeRoomCode])

  function clearPendingTurnTimers() {
    clearInterval(timerRef.current)
    clearInterval(penaltyTimerRef.current)
    clearTimeout(turnStartTimeoutRef.current)
    clearTimeout(aiTurnTimeoutRef.current)
    clearTimeout(aiDiscardTimeoutRef.current)
    clearTimeout(aiActionClearTimeoutRef.current)
    clearTimeout(confettiTimeoutRef.current)
    clearTimeout(groupFlashTimeoutRef.current)
  }

  function lockTurnAdvance(reason) {
    if (isAdvancingTurnRef.current) {
      console.log('TURN LOCK ACTIVE', { reason, turnPhase, currentTurn: currentTurnRef.current })
      console.log('DUPLICATE NEXT TURN BLOCKED', { reason, turnPhase, currentTurn: currentTurnRef.current })
      return true
    }
    isAdvancingTurnRef.current = true
    setTurnPhase('advancing_turn')
    return false
  }

  function resetTurnState(phase = 'idle') {
    setTurnPhase(phase)
    if (phase === 'player_turn' || phase === 'ai_turn' || phase === 'idle') {
      isAdvancingTurnRef.current = false
      aiTurnExecutingRef.current = false
    }
    if (phase === 'idle') {
      // Keep idle fully cleared between rounds
      aiTurnExecutingRef.current = false
    }
  }

  // inject animation styles into head
  useEffect(() => {
    const styleEl = document.createElement('style')
    styleEl.id = 'rummy-anim-styles'
    if (!document.getElementById('rummy-anim-styles')) {
      styleEl.textContent = ANIM_STYLES
      document.head.appendChild(styleEl)
    }
    return () => {
      const el = document.getElementById('rummy-anim-styles')
      if (el) el.remove()
    }
  }, [])

  // ── INIT / DEAL ANIMATION ──
  useEffect(() => {
    // Skip local init in multiplayer — server provides game state
    if (isMultiplayer) return

    console.log('INIT EFFECT TRIGGERED')
    const numPlayers = tableSize
    // Use 2 decks for 6 players, 1 deck for 2 players
    const deck = numPlayers >= 5
      ? makeTwoDecks()
      : makeDeck()
    const dealt = dealCards(deck, numPlayers)

    // Helper function to mark wild jokers
    const wildCard = dealt.wildJoker
    const markWildJokers = (cards) => cards.map(c => ({
      ...c,
      isWildJoker: !c.isJoker && c.rank === wildCard.rank
    }))

    setDrawPile(markWildJokers(dealt.drawPile))
    setDiscardPile(markWildJokers(dealt.discardPile))
    setWildJoker({ ...wildCard, isWildJoker: true })
    const ais = dealt.aiHands.map((hand, i) => ({
      id: i,
      name: AI_NAMES[i],
      hand: markWildJokers(hand),
      score: 0,
      isEliminated: false,
    }))
    const playerName = user?.name || 'You'
    const initialBoard = [
      { id: 'you', name: playerName, score: 0, isEliminated: false, isYou: true },
      ...ais.map(ai => ({
        id: `ai-${ai.id}`,
        name: ai.name,
        score: 0,
        isEliminated: false,
        isYou: false,
      })),
    ]
    setScoreboard(initialBoard)
    setRoundNumber(1)
    setWinner(null)
    setPlayerScore(0)
    setAiPlayers(ais)
    setCurrentTurn(0)
    currentTurnRef.current = 0
    setPlayerHand([])
    setDealtCount(0)
    setGameState('dealing')
    setTurnPhase('idle')
    isAdvancingTurnRef.current = false
    aiTurnExecutingRef.current = false
    clearTimeout(turnStartTimeoutRef.current)
    clearTimeout(aiTurnTimeoutRef.current)
    clearTimeout(aiDiscardTimeoutRef.current)
    clearTimeout(aiActionClearTimeoutRef.current)
    clearInterval(timerRef.current)

    const fullHand = markWildJokers(dealt.playerHand)

    // Wait a short delay to ensure DOM layout is stable
    setTimeout(() => {
      const drawBox = drawPileRef.current?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2 }
      const handBox = handRef.current?.getBoundingClientRect() || { left: window.innerWidth / 2 - 200, top: window.innerHeight - 100, width: 400 }

      const anims = []

      // ── Human player only: 13 cards fly one-by-one from deck to hand ──
      // AI hands are already set instantly via setAiPlayers(ais) above — no animation
      for (let round = 0; round < 13; round++) {
        anims.push({
          id: `deal_human_${round}`,
          card: fullHand[round],
          start: { x: drawBox.left, y: drawBox.top },
          end: { x: handBox.left + (handBox.width / 13) * round, y: handBox.top },
          faceUp: true,
          flipMidFlight: true,
          delay: round * 0.1,   // 0.1s stagger between each card
          duration: 0.4,
          scaleEnd: 1,
          width: cardW,
          height: cardH,
        })
      }

      setLayerAnimations(anims)

      // After last card lands (13 cards × 0.1s stagger + 0.4s flight + small buffer)
      const totalDealTime = (12 * 0.1 + 0.4 + 0.3) * 1000

      setTimeout(() => {
        // Fallback: ensure all cards are present if animations were skipped/interrupted
        setPlayerHand(current => current.length === 13 ? current : fullHand)
        setDealtCount(13)
        // Start game
        const firstPlayer = Math.floor(Math.random() * numPlayers)
        const tossMessage = firstPlayer === 0
          ? 'You won the toss!'
          : `Toss won by ${ais[firstPlayer - 1]?.name || 'AI'}.`
        console.log('DEALING COMPLETE - Starting turn', { firstPlayer, tossMessage })
        setDealerIndex(firstPlayer)
        turnStartTimeoutRef.current = setTimeout(() => {
          console.log('CALLING startTurn', { firstPlayer })
          turnEngine.startTurn(firstPlayer)
        }, 300)
      }, totalDealTime)

    }, 300)

    return () => {
      console.log('INIT EFFECT CLEANUP')
    }
  }, [])  // Empty dependency array - only run once on mount

  // ── TURN TIMER (two-phase: 30s green → 10s red → auto-discard) ──
  useEffect(() => {
    if (gameState !== 'discard' && gameState !== 'draw') {
      // Not player's turn or game not active — reset both timers
      clearInterval(timerRef.current)
      clearInterval(penaltyTimerRef.current)
      setTimerPhase('idle')
      return
    }

    // Reset to main phase whenever a new turn starts
    clearInterval(timerRef.current)
    clearInterval(penaltyTimerRef.current)
    setTurnTimer(30)
    setPenaltyTimer(10)
    setTimerPhase('main')

    // Phase 1: 30s green countdown
    timerRef.current = setInterval(() => {
      setTurnTimer(v => {
        if (v <= 1) {
          clearInterval(timerRef.current)
          if (isPlayerTurn) {
            // Start penalty phase
            setTimerPhase('penalty')
            setPenaltyTimer(10)
            penaltyTimerRef.current = setInterval(() => {
              setPenaltyTimer(p => {
                if (p <= 1) {
                  clearInterval(penaltyTimerRef.current)
                  setTimerPhase('idle')
                  if (!isAdvancingTurnRef.current) autoDiscard()
                  return 0
                }
                return p - 1
              })
            }, 1000)
          }
          return 0
        }
        return v - 1
      })
    }, 1000)

    return () => {
      clearInterval(timerRef.current)
      clearInterval(penaltyTimerRef.current)
    }
  }, [gameState, isPlayerTurn])

  // ── CENTRALIZED TURN ENGINE ──
  const turnEngine = {
    log: (event, data = {}) => {
      console.log(`TURN ENGINE: ${event}`, {
        currentTurn: currentTurnRef.current,
        gameState,
        hasDrawn,
        ...data
      })
    },

    startTurn: (playerIndex) => {
      console.log('START TURN CALLED', { playerIndex, currentGameState: gameState })
      turnEngine.log('TURN START', { playerIndex })
      clearPendingTurnTimers()
      resetTurnState(playerIndex === 0 ? 'player_turn' : 'ai_turn')
      setCurrentTurn(playerIndex)
      currentTurnRef.current = playerIndex
      setHasDrawn(false)
      setSelectedCard(null)  // FIX: Clear selected card on turn start
      setSelectedCards([])   // Clear multi-select on turn start
      console.log('SETTING GAME STATE TO DRAW')
      setGameState('draw')
      setTurnTimer(30)
      setPenaltyTimer(10)
      setTimerPhase('main')
      console.log('GAME STATE SET TO DRAW', { playerIndex, isPlayerTurn: playerIndex === 0 })

      if (playerIndex !== 0) {
        const ai = aiPlayersRef.current[playerIndex - 1]
        if (!ai || ai.isEliminated) {
          turnEngine.log('SKIP ELIMINATED AI', { playerIndex })
          turnEngine.advanceTurnOnce('skip-eliminated-ai')
          return
        }
        console.log('AI TURN SCHEDULED', { playerIndex, delayMs: 1000 })
        aiTurnTimeoutRef.current = setTimeout(() => turnEngine.playAITurn(playerIndex - 1), 1000)
      }
    },

    advanceTurnOnce: (reason = 'unspecified') => {
      console.log('NEXT TURN FIRED', { reason, currentTurn: currentTurnRef.current })
      if (lockTurnAdvance(reason)) return
      clearPendingTurnTimers()
      turnEngine.log('END TURN', { reason })

      let next = (currentTurnRef.current + 1) % 6
      let attempts = 0
      const aiSnapshot = aiPlayersRef.current
      while (attempts < 6) {
        // Skip: eliminated AI, OR player 0 if they've dropped this round
        const skipPlayer0 = next === 0 && playerDropped
        const skipAI = next !== 0 && aiSnapshot[next - 1]?.isEliminated
        if (!skipPlayer0 && !skipAI) {
          break
        }
        next = (next + 1) % 6
        attempts++
      }

      if (attempts >= 6) {
        turnEngine.log('ROUND COMPLETE - All players eliminated')
        setTurnPhase('round_end')
        return
      }

      turnEngine.log('NEXT PLAYER', { next })
      turnEngine.startTurn(next)
    },

    playAITurn: (aiIndex) => {
      if (isAdvancingTurnRef.current || aiTurnExecutingRef.current) {
        console.log('TURN LOCK ACTIVE', { source: 'playAITurn', aiIndex, isAdvancingTurn: isAdvancingTurnRef.current, aiTurnExecuting: aiTurnExecutingRef.current })
        console.log('DUPLICATE NEXT TURN BLOCKED', { source: 'playAITurn', aiIndex, turnPhase, currentTurn: currentTurnRef.current })
        return
      }
      aiTurnExecutingRef.current = true
      const ai = aiPlayersRef.current[aiIndex]
      console.log('AI TURN EXECUTED', { aiIndex, name: ai?.name })
      if (!ai || ai.isEliminated) {
        turnEngine.log('AI ELIMINATED', { aiIndex })
        aiTurnExecutingRef.current = false
        turnEngine.advanceTurnOnce('ai-eliminated')
        return
      }

      turnEngine.log('AI DRAW', { aiIndex, name: ai.name })
      setAiActionAnim({ type: 'draw', playerIndex: aiIndex })

      setTimeout(() => {
        const drawBox = drawPileRef.current?.getBoundingClientRect()
        const aiBox = aiRefs.current[aiIndex]?.getBoundingClientRect()
        
        setLayerAnimations(prev => [...prev, {
          id: `ai_draw_${Date.now()}`,
          card: null,
          start: { x: drawBox?.left || window.innerWidth/2, y: drawBox?.top || window.innerHeight/2 },
          end: { x: aiBox?.left || window.innerWidth/2, y: aiBox?.top || 0 },
          faceUp: false,
          flipMidFlight: false,
          delay: 0,
          duration: 0.5,
          scaleEnd: 0.5
        }])

        setTimeout(() => {
          setDrawPile(dp => {
            let currentDp = dp
            if (!currentDp.length) {
              // Reshuffle discard pile (except top card) into draw pile
              setDiscardPile(currentDiscard => {
                if (currentDiscard.length <= 1) {
                  turnEngine.log('AI DRAW - NO CARDS AVAILABLE', { aiIndex })
                  aiTurnExecutingRef.current = false
                  turnEngine.advanceTurnOnce('ai-no-cards')
                  return currentDiscard
                }
                const topCard = currentDiscard[currentDiscard.length - 1]
                const cardsToShuffle = currentDiscard.slice(0, -1)
                currentDp = shuffle(cardsToShuffle)
                turnEngine.log('AI RESHUFFLE', { aiIndex, newDrawPileSize: currentDp.length })
                return [topCard]
              })
            }

            if (!currentDp.length) {
              aiTurnExecutingRef.current = false
              turnEngine.advanceTurnOnce('ai-draw-empty')
              return dp
            }

            let card = currentDp[0]
            const newDp = currentDp.slice(1)
            
            // Mark wild joker if needed
            if (wildJoker && !card.isJoker && card.rank === wildJoker.rank) {
              card = { ...card, isWildJoker: true }
            }
            
            const newHand = [...ai.hand, card]

            setAiPlayers(prevAis => {
              const nais = [...prevAis]
              nais[aiIndex] = { ...nais[aiIndex], hand: newHand }
              return nais
            })

            clearTimeout(aiActionClearTimeoutRef.current)
            aiActionClearTimeoutRef.current = setTimeout(() => setAiActionAnim(null), 600)
            clearTimeout(aiDiscardTimeoutRef.current)
            aiDiscardTimeoutRef.current = setTimeout(() => turnEngine.doAiDiscard(aiIndex, newHand), 1000)
            return newDp
          })
        }, 500)
      }, 800)
    },

    doAiDiscard: (aiIndex, currentHand) => {
      const groups = getHandGroups(currentHand)
      const evals = groups.map(g => evalGroup(g))
      let discard = currentHand[currentHand.length - 1]
      let maxPts = -1
      groups.forEach((g, gi) => {
        if (!evals[gi].valid) {
          g.forEach(c => {
            if (c.pts > maxPts) { maxPts = c.pts; discard = c }
          })
        }
      })

      const finalHand = currentHand.filter(c => c.id !== discard.id)

      turnEngine.log('AI DISCARD', { aiIndex, card: `${discard.rank}${discard.suit}` })
      setAiActionAnim({ type: 'discard', playerIndex: aiIndex })

      const aiBox = aiRefs.current[aiIndex]?.getBoundingClientRect()
      const discardBox = discardPileRef.current?.getBoundingClientRect()
      
      setLayerAnimations(prev => [...prev, {
        id: `ai_discard_${Date.now()}`,
        card: discard,
        start: { x: aiBox?.left || window.innerWidth/2, y: aiBox?.top || 0 },
        end: { x: discardBox?.left || window.innerWidth/2, y: discardBox?.top || window.innerHeight/2 },
        faceUp: true,
        flipMidFlight: false,
        delay: 0,
        duration: 0.5,
        scaleEnd: 0.8
      }])

      setTimeout(() => {
        setAiPlayers(ais => {
          const next = [...ais]
          next[aiIndex] = { ...next[aiIndex], hand: finalHand }
          return next
        })

        setDiscardPile(p => [...p, discard])

        clearTimeout(aiActionClearTimeoutRef.current)
        aiActionClearTimeoutRef.current = setTimeout(() => {
          setAiActionAnim(null)
          aiTurnExecutingRef.current = false
          turnEngine.advanceTurnOnce('ai-discard-complete')
        }, 600)
      }, 500)
    }
  }

  function getTossMessage(playerIndex) {
    if (playerIndex === 0) return 'You won the toss!'
    const ai = aiPlayersRef.current[playerIndex - 1]
    return `Toss won by ${ai?.name || 'AI'}.`
  }

  function buildEngineGroupsFromHand(hand) {
    return getHandGroups(hand).map(group =>
      group.map(card => ({
        id: String(card.id),
        suit: card.suit,
        rank: card.rank,
        isJoker: !!card.isJoker,
        isWildJoker: false,
      }))
    )
  }

  function buildEngineHand(hand) {
    return hand.map(card => ({
      id: String(card.id),
      suit: card.suit,
      rank: card.rank,
      isJoker: !!card.isJoker,
      isWildJoker: false,
    }))
  }

  function buildEngineWildJoker(card) {
    if (!card) return null
    return {
      id: String(card.id),
      suit: card.suit,
      rank: card.rank,
      isJoker: !!card.isJoker,
      isWildJoker: false,
    }
  }

  function buildCombinations(items, chooseCount, startIndex = 0, acc = [], out = []) {
    if (acc.length === chooseCount) {
      out.push([...acc])
      return out
    }
    for (let i = startIndex; i < items.length; i++) {
      acc.push(items[i])
      buildCombinations(items, chooseCount, i + 1, acc, out)
      acc.pop()
    }
    return out
  }

  function findValidDeclarationGroups(engineHand, engineWild) {
    // Build a map from id → local card object (with isWildJoker flag)
    const byId = new Map(engineHand.map(card => [card.id, card]))
    const memo = new Map()

    // Helper: check if a group of local cards is valid using evalGroup
    function isGroupValid(cardIds) {
      const cards = cardIds.map(id => {
        const ec = byId.get(id)
        if (!ec) return null
        // Reconstruct local card with correct flags
        return {
          id: ec.id,
          rank: ec.rank,
          suit: ec.suit,
          pts: ['A', 'J', 'Q', 'K', '10'].includes(ec.rank) ? 10 : parseInt(ec.rank) || 0,
          isJoker: !!ec.isJoker,
          isWildJoker: !!ec.isWildJoker,
        }
      }).filter(Boolean)
      const result = evalGroup(cards)
      return result.valid
    }

    function search(remainingIds) {
      const key = remainingIds.join('|')
      if (memo.has(key)) return memo.get(key)
      if (remainingIds.length === 0) return []
      if (remainingIds.length < 3) { memo.set(key, null); return null }

      const fixedId = remainingIds[0]
      const otherIds = remainingIds.slice(1)

      for (let size = 3; size <= Math.min(5, remainingIds.length); size++) {
        const combos = buildCombinations(otherIds, size - 1)
        for (const combo of combos) {
          const groupIds = [fixedId, ...combo]
          if (!isGroupValid(groupIds)) continue

          const rest = remainingIds.filter(id => !groupIds.includes(id))
          const tail = search(rest)
          if (tail !== null) {
            const solved = [groupIds.map(id => byId.get(id)), ...tail]
            memo.set(key, solved)
            return solved
          }
        }
      }

      memo.set(key, null)
      return null
    }

    return search(engineHand.map(c => c.id))
  }

  function getDeclarationVerdict(handAfterDiscard) {
    // Try all possible groupings using the backtracking solver
    // This finds the best possible arrangement regardless of current display order
    const engineHand = buildEngineHand(handAfterDiscard)
    const engineWild = buildEngineWildJoker(wildJoker)

    // First try: group by suit (standard)
    const suitGroups = getHandGroups(handAfterDiscard)
    const suitEvals = suitGroups.map(g => evalGroup(g))
    const suitPure = suitEvals.some(e => e.type === 'pureSeq')
    const suitSeqs = suitEvals.filter(e => e.type === 'pureSeq' || e.type === 'seq').length
    const suitValid = suitEvals.every(e => e.valid)

    if (suitPure && suitSeqs >= 2 && suitValid) {
      console.log('✅ DECLARE: valid via suit grouping')
      return { valid: true }
    }

    // Second try: backtracking solver finds any valid grouping
    const solvedGroups = findValidDeclarationGroups(engineHand, engineWild)
    if (solvedGroups) {
      const byId = new Map(handAfterDiscard.map(c => [String(c.id), c]))
      const localGroups = solvedGroups.map(g =>
        g.map(ec => byId.get(ec.id)).filter(Boolean)
      )
      const solvedEvals = localGroups.map(g => evalGroup(g))
      const solvedPure = solvedEvals.some(e => e.type === 'pureSeq')
      const solvedSeqs = solvedEvals.filter(e => e.type === 'pureSeq' || e.type === 'seq').length
      const solvedValid = solvedEvals.every(e => e.valid)

      if (solvedPure && solvedSeqs >= 2 && solvedValid) {
        console.log('✅ DECLARE: valid via solver')
        return { valid: true }
      }
    }

    // Build reason from suit grouping attempt
    const reason = !suitPure
      ? 'Need at least 1 pure sequence'
      : suitSeqs < 2
        ? 'Need at least 2 sequences'
        : 'Not all cards are in valid groups'

    console.log('❌ DECLARE blocked:', reason, { suitPure, suitSeqs, suitValid })
    return { valid: false, reason }
  }

  function validateMove(action, payload = {}) {
    if (isAdvancingTurnRef.current) {
      console.log('🔒 TURN LOCK ACTIVE', { action, turnPhase })
      // FIX: Don't call showToast during validation - only return result
      return { ok: false, message: 'Turn is advancing, please wait.' }
    }

    if (!isPlayerTurn) {
      console.log('⏸️ NOT YOUR TURN', { action, isPlayerTurn, currentTurn })
      return { ok: false, message: 'Wait for your turn!' }
    }

    if (playerDropped) {
      return { ok: false, message: 'You have dropped this round.' }
    }

    if (gameState === 'dealing' || gameState === 'finished') {
      console.log('🎴 WRONG GAME STATE', { action, gameState })
      // FIX: Don't call showToast during validation - only return result
      return { ok: false, message: 'Action not allowed right now.' }
    }

    if (action === 'draw') {
      if (gameState !== 'draw') {
        console.log('🚫 MUST BE IN DRAW STATE', { action, gameState, hasDrawn })
        // FIX: Don't call showToast during validation - only return result
        return { ok: false, message: 'You must discard before drawing again.' }
      }
      if (hasDrawn) {
        console.log('🚫 ALREADY DRAWN', { action, hasDrawn })
        // FIX: Don't call showToast during validation - only return result
        return { ok: false, message: 'Already drew a card this turn.' }
      }
      // In multiplayer, server manages the deck — skip local pile checks
      if (isMultiplayer) {
        return { ok: true }
      }
      if (payload.fromDiscard && discardPile.length === 0) {
        console.log('🚫 DISCARD PILE EMPTY', { action, discardPileLength: discardPile.length })
        // FIX: Don't call showToast during validation - only return result
        return { ok: false, message: 'Discard pile is empty!' }
      }
      if (!payload.fromDiscard && drawPile.length === 0) {
        // Allow draw if discard pile can be reshuffled (keep top card, shuffle rest)
        if (discardPile.length <= 1) {
          console.log('🚫 DRAW PILE EMPTY AND CANNOT RESHUFFLE', { action, drawPileLength: drawPile.length })
          return { ok: false, message: 'Draw pile is empty!' }
        }
        // else: drawFromPile will handle the reshuffle — allow the action
        console.log('✅ DRAW ALLOWED (will reshuffle discard)', { discardPileLength: discardPile.length })
        return { ok: true }
      }
      console.log('✅ DRAW ALLOWED', { action, gameState, hasDrawn })
      return { ok: true }
    }

    if (action === 'discard') {
      if (gameState !== 'discard') {
        console.log('DEBUG: invalid discard blocked - not in discard state', { action, gameState })
        return { ok: false, message: 'Draw a card first!' }
      }
      if (!hasDrawn) {
        console.log('DEBUG: invalid discard blocked - has not drawn', { action, hasDrawn })
        return { ok: false, message: 'You must draw before discarding.' }
      }
      if (!selectedCard) {
        console.log('DEBUG: invalid discard blocked - no card selected', { action, selectedCard })
        return { ok: false, message: 'Select a card to discard.' }
      }
      // In multiplayer, skip hand-check (server validates)
      if (!isMultiplayer && !playerHand.some(c => c.id === selectedCard.id)) {
        console.log('DEBUG: invalid discard blocked - card not in hand', { action, selectedCard, playerHandLength: playerHand.length })
        return { ok: false, message: 'Selected card is not in your hand.' }
      }
      return { ok: true }
    }

    if (action === 'declare') {
      if (gameState !== 'discard') return { ok: false, message: 'Draw a card first!' }
      if (!hasDrawn) return { ok: false, message: 'Draw a card before declaring.' }
      if (!selectedCard) return { ok: false, message: 'Select a card to discard to Finish Slot.' }
      const handAfterDiscard = playerHand.filter(c => c.id !== selectedCard.id)
      if (handAfterDiscard.length !== 13) return { ok: false, message: 'Need exactly 13 cards to declare.' }
      // Always allow — wrong show handled in declare()
      return { ok: true }
    }

    if (action === 'sort') {
      // Sort and Group are always allowed during the game (not just player's turn)
      // Players can rearrange their hand at any time
      if (gameState === 'dealing' || gameState === 'finished') {
        return { ok: false, message: 'Cannot sort now.' }
      }
      return { ok: true }
    }

    if (action === 'drop') {
      if (gameState !== 'draw' && gameState !== 'discard') {
        console.log('DEBUG: invalid drop blocked - wrong game state', { action, gameState })
        return { ok: false, message: 'Cannot drop now.' }
      }
      return { ok: true }
    }

    if (action === 'selectCard') {
      if (gameState !== 'discard' && gameState !== 'draw') {
        console.log('DEBUG: invalid select blocked - wrong state', { action, gameState })
        return { ok: false, message: 'Wait for your turn!' }
      }
      // Allow selection in both draw and discard states
      // Players can view/select cards anytime during their turn
      return { ok: true }
    }

    return { ok: true }
  }

  function runGuarded(action, fn, payload = {}) {
    const verdict = validateMove(action, payload)
    if (!verdict.ok) {
      return false
    }
    fn()
    return true
  }

  function applyRoundScores({ playerDelta = 0, aiDeltas = [], reason = 'Round updated' }) {
    console.log('DEBUG: score calculation', { playerDelta, aiDeltas, reason })

    setScoreboard(prev => {
      const next = prev.map((entry, idx) => {
        const delta = idx === 0 ? playerDelta : (aiDeltas[idx - 1] || 0)
        const updatedScore = entry.score + delta
        return {
          ...entry,
          score: updatedScore,
          isEliminated: updatedScore >= 101,
        }
      })

      const active = next.filter(p => !p.isEliminated)
      if (active.length === 1) {
        console.log('DEBUG: elimination trigger - only one player left', { winner: active[0].name, score: active[0].score })
        setWinner(active[0])
        setTimeout(() => setShowResult(true), 1200)
      }

      // Check if human player (index 0) just got eliminated
      const humanJustEliminated = next[0]?.isEliminated && !prev[0]?.isEliminated
      if (humanJustEliminated && active.length > 1) {
        // Human eliminated but game continues — show elimination screen
        setTimeout(() => setShowResult(true), 1200)
      }

      setPlayerScore(next[0]?.score || 0)
      setAiPlayers(oldAi =>
        oldAi.map((ai, i) => ({
          ...ai,
          score: next[i + 1]?.score || ai.score,
          isEliminated: !!next[i + 1]?.isEliminated,
        }))
      )

      return next
    })
  }

  function startNextRound() {
    if (winner) {
      setScreen('home')
      return
    }

    // Close modals, clear all animation states
    setShowResult(false)
    setShowDeclare(false)
    setResultMsg('')
    setFlyingCard(null)
    setConfetti([])
    setGroupFlash({})
    setSortAnim(false)
    setDrawnCardAnim(false)
    setDiscardAnim(false)
    setAiActionAnim(null)
    setDeckRipple(false)
    setLayerAnimations([])

    clearPendingTurnTimers()
    isAdvancingTurnRef.current = false
    aiTurnExecutingRef.current = false
    drawPendingRef.current = false
    discardPendingRef.current = false
    setTurnPhase('idle')

    const numPlayers = 6
    const deck = [...makeDeck(), ...makeDeck()]
    const dealt = dealCards(deck, numPlayers)

    const wildCard = dealt.wildJoker
    const markWildJokers = (cards) => cards.map(c => ({
      ...c,
      isWildJoker: !c.isJoker && c.rank === wildCard.rank
    }))

    setDrawPile(markWildJokers(dealt.drawPile))
    setDiscardPile(markWildJokers(dealt.discardPile))
    setWildJoker({ ...wildCard, isWildJoker: true })

    // AI hands set instantly — no animation
    setAiPlayers(prev =>
      prev.map((ai, i) => ({
        ...ai,
        hand: markWildJokers(dealt.aiHands[i] || []),
      }))
    )

    // Reset player hand for deal animation
    setPlayerHand([])
    setDealtCount(0)
    setSelectedCard(null)
    setHasDrawn(false)
    setPlayerDropped(false)  // Reset drop status for new round
    setRoundSnapshot(null)   // Clear hand snapshot
    setGameState('dealing')

    const nextRound = roundNumber + 1
    setRoundNumber(nextRound)
    activeRoundRef.current = nextRound

    const fullHand = markWildJokers(dealt.playerHand)

    // Deal animation — same as init, human only
    setTimeout(() => {
      const drawBox = drawPileRef.current?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2 }
      const handBox = handRef.current?.getBoundingClientRect() || { left: window.innerWidth / 2 - 200, top: window.innerHeight - 100, width: 400 }

      const anims = []
      for (let i = 0; i < 13; i++) {
        anims.push({
          id: `deal_human_${i}`,
          card: fullHand[i],
          start: { x: drawBox.left, y: drawBox.top },
          end: { x: handBox.left + (handBox.width / 13) * i, y: handBox.top },
          faceUp: true,
          flipMidFlight: true,
          delay: i * 0.1,
          duration: 0.4,
          scaleEnd: 1,
          width: cardW,
          height: cardH,
        })
      }
      setLayerAnimations(anims)

      const totalDealTime = (12 * 0.1 + 0.4 + 0.3) * 1000
      setTimeout(() => {
        setPlayerHand(current => current.length === 13 ? current : fullHand)
        setDealtCount(13)

        const firstPlayer = (nextRound - 1) % numPlayers
        const tossMessage = firstPlayer === 0
          ? 'You won the toss!'
          : `Toss won by ${aiPlayersRef.current[firstPlayer - 1]?.name || 'AI'}.`
        setDealerIndex(firstPlayer)
        turnStartTimeoutRef.current = setTimeout(() => {
          turnEngine.startTurn(firstPlayer)
        }, 300)
      }, totalDealTime)
    }, 400)
  }

  const canDrawMove = !!validateMove('draw', { fromDiscard: false }).ok
  const canDrawOpenMove = !!validateMove('draw', { fromDiscard: true }).ok
  const canDiscardMove = !!validateMove('discard').ok
  
  // Declare button active when: your turn + drawn (14 cards) + card selected + remaining = 13
  const canDeclareMove = useMemo(() => {
    if (!isPlayerTurn) return false
    if (gameState !== 'discard') return false
    if (!hasDrawn) return false
    if (!selectedCard) return false
    // Must have exactly 14 cards (13 dealt + 1 drawn), discard 1 = 13 remaining
    if (playerHand.length !== 14) return false
    const handAfterDiscard = playerHand.filter(c => c.id !== selectedCard.id)
    if (handAfterDiscard.length !== 13) return false
    return true
  }, [isPlayerTurn, gameState, hasDrawn, selectedCard, playerHand])
  
  // Sort and Group are always available (not just on player's turn)
  const canSortMove = gameState !== 'dealing' && gameState !== 'finished' && playerHand.length > 0
  const canGroupMove = canSortMove && selectedCards.length >= 2
  const canDropMove = !!validateMove('drop').ok
  // Cards are always interactable for multi-select (Group/Sort)
  // Single-select (Discard/Declare) is gated inside selectCard()
  const canSelectCard = gameState !== 'dealing' && gameState !== 'finished'

  // DRAW CARD
  function drawFromPile(fromDiscard = false) {
    if (drawPendingRef.current) {
      return
    }

    if (!runGuarded('draw', () => { }, { fromDiscard })) return

    // ── MULTIPLAYER: emit to server, wait for game_state ──
    if (isMultiplayer) {
      emitDrawCard(activeRoomCode, fromDiscard)
      drawPendingRef.current = true
      // Server will broadcast game_state with updated hand — no local state change
      setTimeout(() => { drawPendingRef.current = false }, 2000)
      return
    }

    // ── SOLO MODE: local state update ──
    drawPendingRef.current = true
    turnEngine.log('DRAW', { fromDiscard, playerHandLength: playerHand.length, isPlayerTurn })

    let card
    if (fromDiscard) {
      if (!discardPile.length) {
        drawPendingRef.current = false
        return
      }
      card = discardPile[discardPile.length - 1]
      setDiscardPile(p => p.slice(0, -1))
    } else {
      let currentDrawPile = drawPile
      if (!currentDrawPile.length) {
        // Reshuffle discard pile (except top card) into draw pile
        if (discardPile.length <= 1) {
          drawPendingRef.current = false
          return
        }
        const topCard = discardPile[discardPile.length - 1]
        const cardsToShuffle = discardPile.slice(0, -1)
        currentDrawPile = shuffle(cardsToShuffle)
        setDiscardPile([topCard])
        setDrawPile(currentDrawPile)
        turnEngine.log('RESHUFFLE', { newDrawPileSize: currentDrawPile.length })
      }
      const ri = Math.floor(Math.random() * currentDrawPile.length)
      card = currentDrawPile[ri]
      setDrawPile(p => p.filter((_, i) => i !== ri))
    }

    // Mark wild joker if needed
    if (wildJoker && !card.isJoker && card.rank === wildJoker.rank) {
      card = { ...card, isWildJoker: true }
    }

    // Trigger flying card animation from center to hand
    const startBox = fromDiscard ? discardPileRef.current?.getBoundingClientRect() : drawPileRef.current?.getBoundingClientRect()
    const handBox = handRef.current?.getBoundingClientRect()
    
    setLayerAnimations(prev => [...prev, {
      id: `draw_${Date.now()}`,
      card: card,
      start: { x: startBox?.left || window.innerWidth/2, y: startBox?.top || window.innerHeight/2 },
      end: { x: handBox?.left + (handBox?.width/2 || 0), y: handBox?.top || window.innerHeight },
      faceUp: true,
      flipMidFlight: !fromDiscard,
      delay: 0,
      duration: 0.5,
      scaleEnd: 1,
      width: cardW,
      height: cardH
    }])

    // Add card to hand after animation completes (500ms)
    setTimeout(() => {
      // FIX: Validate round is still active
      if (activeRoundRef.current !== roundNumber) {
        console.log('DRAW CALLBACK CANCELLED - Round changed')
        drawPendingRef.current = false
        setFlyingCard(null)
        return
      }
      
      const newHand = [...playerHand, card]
      setPlayerHand(newHand)

      // Draw pop animation on new card
      setDrawnCardAnim(false)
      setTimeout(() => setDrawnCardAnim(true), 50)
      setTimeout(() => setDrawnCardAnim(false), 500)

      setSelectedCard(card)
      setHasDrawn(true)
      setGameState('discard')
      drawPendingRef.current = false

      // Show joker reveal — no toast
      if (card.isWildJoker) {
      }
    }, 500)
  }

  // DISCARD CARD — accepts optional cardOverride for drag-to-discard
  function discardCard(cardOverride = null) {
    if (discardPendingRef.current) {
      return
    }

    // Use drag-supplied card if provided, otherwise fall back to selectedCard state
    const cardToDiscard = cardOverride || selectedCard
    if (!cardToDiscard) return

    // Temporarily sync selectedCard so runGuarded validation passes
    if (cardOverride) setSelectedCard(cardOverride)

    if (!runGuarded('discard', () => { })) return

    // ── MULTIPLAYER ──
    if (isMultiplayer) {
      discardPendingRef.current = true
      emitDiscardCard(activeRoomCode, cardToDiscard.id)
      setSelectedCard(null)
      setSelectedCards([])
      setTimeout(() => { discardPendingRef.current = false }, 1000)
      return
    }

    // ── SOLO MODE ──
    discardPendingRef.current = true
    turnEngine.log('DISCARD', { card: cardToDiscard?.id, playerHandLength: playerHand.length })

    const discardBox = discardPileRef.current?.getBoundingClientRect()
    let startX = window.innerWidth / 2
    let startY = window.innerHeight - 100
    if (handRef.current) {
      const cardEl = handRef.current.querySelector(`[data-card-id="${cardToDiscard.id}"]`)
      if (cardEl) {
        const cardBox = cardEl.getBoundingClientRect()
        startX = cardBox.left + cardBox.width / 2
        startY = cardBox.top + cardBox.height / 2
      } else {
        const handBox = handRef.current.getBoundingClientRect()
        startX = handBox.left + handBox.width / 2
        startY = handBox.top
      }
    }

    setLayerAnimations(prev => [...prev, {
      id: `discard_${Date.now()}`,
      card: cardToDiscard,
      start: { x: startX, y: startY },
      end: { x: discardBox?.left || window.innerWidth/2, y: discardBox?.top || window.innerHeight/2 },
      faceUp: true,
      flipMidFlight: false,
      delay: 0,
      duration: 0.5,
      scaleEnd: 0.9
    }])

    setTimeout(() => {
      if (activeRoundRef.current !== roundNumber) {
        discardPendingRef.current = false
        setFlyingCard(null)
        return
      }
      const newHand = playerHand.filter(c => c.id !== cardToDiscard.id)
      if (newHand.length !== 13) {
        setFlyingCard(null)
        discardPendingRef.current = false
        return
      }
      setDiscardPile(p => [...p, cardToDiscard])
      setPlayerHand(newHand)
      setSelectedCard(null)
      setSelectedCards([])
      setHasDrawn(false)
      setGameState('draw')
      discardPendingRef.current = false
      turnEngine.advanceTurnOnce('player-discard')
    }, 500)
  }

  // DROP GAME
  // First drop (before drawing): 20 pts penalty
  // Middle drop (after drawing): 40 pts penalty
  // Player is removed from this round's turns — game continues until someone declares
  function dropGame() {
    if (!runGuarded('drop', () => { })) return
    clearInterval(timerRef.current)

    const pts = !hasDrawn ? 20 : 40
    const dropType = !hasDrawn ? 'First drop' : 'Middle drop'

    // Add drop points to player score only — AI scores unchanged
    applyRoundScores({
      playerDelta: pts,
      aiDeltas: aiPlayers.map(() => 0),
      reason: `${dropType}: +${pts} pts`,
    })

    // Mark player as dropped — they sit out the rest of this round
    setPlayerDropped(true)
    setSelectedCard(null)
    setHasDrawn(false)

    // Advance turn to next player — game continues without human
    turnEngine.advanceTurnOnce('player-drop')
  }

  // DECLARE
  // Both valid and wrong-show declarations end the round immediately:
  // - Valid: player scores 0, all AI score their unmatched pts (capped 80)
  // - Wrong show: player scores 80, all AI score 0, round ends
  function declare() {
    if (!runGuarded('declare', () => { })) return

    const handAfterDiscard = playerHand.filter(c => c.id !== selectedCard.id)
    if (handAfterDiscard.length !== 13) {
      return
    }

    // Stop all timers and AI turns immediately — round is ending
    clearPendingTurnTimers()
    isAdvancingTurnRef.current = true  // lock turn engine
    setGameState('finished')

    // Calculate each AI player's actual hand score NOW before any state changes
    // Sum of all unmatched card values, best-grouped by suit, capped at 80
    // NOTE: For real multiplayer, server will send each player's hand score
    const aiRoundPts = aiPlayers.map(ai => calcScore(ai.hand))

    // Snapshot all hands for the result screen
    setRoundSnapshot({
      playerHand: handAfterDiscard,
      aiHands: aiPlayers.map(ai => ({ name: ai.name, hand: ai.hand })),
    })

    const declarationVerdict = getDeclarationVerdict(handAfterDiscard)

    if (!declarationVerdict.valid) {
      // ── WRONG SHOW ──
      // Declaring player: +80 pts
      // All other players: their actual hand score (same as if someone else declared)
      const newFlash = {}
      handGroups.forEach((_, gi) => { newFlash[gi] = 'invalid' })
      setGroupFlash(newFlash)
      clearTimeout(groupFlashTimeoutRef.current)
      groupFlashTimeoutRef.current = setTimeout(() => setGroupFlash({}), 700)

      setDiscardPile(p => [...p, selectedCard])
      setPlayerHand(handAfterDiscard)
      setSelectedCard(null)
      setHasDrawn(false)

      applyRoundScores({
        playerDelta: 80,
        aiDeltas: aiRoundPts,
        reason: 'Wrong show! +80 pts penalty',
      })

      setResultMsg('Wrong show! +80 pts penalty. Round over.')
      setTimeout(() => setShowResult(true), 800)
      return
    }

    // ── VALID DECLARATION ──
    // Declaring player: 0 pts (winner of this round)
    // All other players: their actual hand score, capped at 80
    const newFlash = {}
    handGroups.forEach((_, gi) => { newFlash[gi] = 'valid' })
    setGroupFlash(newFlash)
    clearTimeout(groupFlashTimeoutRef.current)
    groupFlashTimeoutRef.current = setTimeout(() => setGroupFlash({}), 800)

    const CONFETTI_COLORS = ['#F5C518', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA']
    setConfetti(Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${Math.random() * 100}%`,
      width: `${6 + Math.random() * 8}px`,
      height: `${10 + Math.random() * 10}px`,
      dur: `${1.5 + Math.random() * 2}s`,
      delay: `${Math.random() * 0.8}s`,
      rotate: `${Math.random() * 360}deg`,
    })))
    clearTimeout(confettiTimeoutRef.current)
    confettiTimeoutRef.current = setTimeout(() => setConfetti([]), 4000)

    setDiscardPile(p => [...p, selectedCard])
    setPlayerHand(handAfterDiscard)
    setSelectedCard(null)

    applyRoundScores({
      playerDelta: 0,
      aiDeltas: aiRoundPts,
      reason: 'Valid declaration! Round over.',
    })

    setResultMsg('Valid Declaration! You win this round! +0 pts')
    setTimeout(() => setShowDeclare(true), 600)
  }

  // SORT HAND — Smart sort using Pool Rummy rules:
  // Uses a greedy algorithm to find the best grouping:
  // 1. Try to form pure sequences first
  // 2. Then impure sequences
  // 3. Then sets
  // 4. Remaining cards go into an "invalid" group
  // Groups ordered: Pure Seq → Sequence → Set → Invalid (highest pts first)
  function sortHand() {
    if (!canSortMove) { return }

    const hand = [...playerHand]
    const used = new Set()
    const resultGroups = []

    // Helper: get rank index
    const ri = (card) => RANKS.indexOf(card.rank)

    // Helper: is joker
    const isJkr = (c) => c.isJoker || c.isWildJoker

    // Get natural cards and jokers separately
    const jokers = hand.filter(isJkr)
    const naturals = hand.filter(c => !isJkr(c))

    // Group naturals by suit
    const bySuit = {}
    naturals.forEach(c => {
      if (!bySuit[c.suit]) bySuit[c.suit] = []
      bySuit[c.suit].push(c)
    })
    // Sort each suit by rank
    Object.values(bySuit).forEach(arr => arr.sort((a, b) => ri(a) - ri(b)))

    // ── PASS 1: Find PURE sequences (no jokers) ──
    Object.values(bySuit).forEach(suitCards => {
      let i = 0
      while (i < suitCards.length) {
        if (used.has(suitCards[i].id)) { i++; continue }
        // Try to extend a pure sequence starting at i
        const seq = [suitCards[i]]
        let j = i + 1
        while (j < suitCards.length) {
          if (used.has(suitCards[j].id)) { j++; continue }
          const last = seq[seq.length - 1]
          if (ri(suitCards[j]) === ri(last) + 1) {
            seq.push(suitCards[j])
          } else if (ri(suitCards[j]) > ri(last) + 1) {
            break
          }
          j++
        }
        if (seq.length >= 3) {
          seq.forEach(c => used.add(c.id))
          resultGroups.push({ cards: seq, type: 'pureSeq' })
        }
        i++
      }
    })

    // ── PASS 2: Find IMPURE sequences (with jokers) ──
    // Natural cards in the sequence MUST be same suit
    let availableJokers = jokers.filter(j => !used.has(j.id))
    Object.values(bySuit).forEach(suitCards => {
      const unused = suitCards.filter(c => !used.has(c.id))
      if (unused.length === 0 || availableJokers.length === 0) return
      let i = 0
      while (i < unused.length) {
        if (used.has(unused[i].id)) { i++; continue }
        const seq = [unused[i]]
        let j = i + 1
        let jokersUsed = []
        while (j < unused.length) {
          if (used.has(unused[j].id)) { j++; continue }
          const last = seq.filter(c => !c.isJoker && !c.isWildJoker).slice(-1)[0] || seq[seq.length - 1]
          const gap = ri(unused[j]) - ri(last) - 1
          if (gap === 0) {
            seq.push(unused[j])
          } else if (gap > 0 && gap <= availableJokers.length - jokersUsed.length) {
            for (let g = 0; g < gap; g++) {
              const jk = availableJokers.find(jj => !jokersUsed.includes(jj.id) && !used.has(jj.id))
              if (jk) { seq.push(jk); jokersUsed.push(jk.id) }
            }
            seq.push(unused[j])
          } else {
            break
          }
          j++
        }
        // Try appending a joker at end to reach length 3
        if (seq.length === 2 && availableJokers.length > jokersUsed.length) {
          const jk = availableJokers.find(jj => !jokersUsed.includes(jj.id) && !used.has(jj.id))
          if (jk) { seq.push(jk); jokersUsed.push(jk.id) }
        }
        if (seq.length >= 3) {
          seq.forEach(c => used.add(c.id))
          jokersUsed.forEach(id => used.add(id))
          availableJokers = availableJokers.filter(jj => !used.has(jj.id))
          resultGroups.push({ cards: seq, type: 'seq' })
        }
        i++
      }
    })

    // ── PASS 3: Find SETS (same rank, different suits) ──
    const byRank = {}
    naturals.filter(c => !used.has(c.id)).forEach(c => {
      if (!byRank[c.rank]) byRank[c.rank] = []
      byRank[c.rank].push(c)
    })
    availableJokers = jokers.filter(j => !used.has(j.id))
    Object.values(byRank).forEach(rankCards => {
      const unused = rankCards.filter(c => !used.has(c.id))
      const uniqueSuits = [...new Map(unused.map(c => [c.suit, c])).values()]
      if (uniqueSuits.length >= 2) {
        const setCards = uniqueSuits.slice(0, 4)
        let jokersUsed = []
        // Add jokers if needed to reach 3
        while (setCards.length < 3 && availableJokers.length > jokersUsed.length) {
          const jk = availableJokers.find(jj => !jokersUsed.includes(jj.id))
          if (jk) { setCards.push(jk); jokersUsed.push(jk.id) }
        }
        if (setCards.length >= 3) {
          setCards.forEach(c => used.add(c.id))
          jokersUsed.forEach(id => used.add(id))
          availableJokers = availableJokers.filter(jj => !used.has(jj.id))
          resultGroups.push({ cards: setCards, type: 'set' })
        }
      }
    })

    // ── PASS 4: Remaining cards → invalid group ──
    const remaining = hand.filter(c => !used.has(c.id))
    if (remaining.length > 0) {
      // Sort remaining by pts descending so highest cost cards are visible first
      remaining.sort((a, b) => (b.pts || 0) - (a.pts || 0))
      resultGroups.push({ cards: remaining, type: 'invalid' })
    }

    // ── Order groups: Pure Seq → Seq → Set → Invalid ──
    const order = { pureSeq: 0, seq: 1, set: 2, invalid: 3 }
    resultGroups.sort((a, b) => {
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type]
      // Among invalid groups, higher pts first
      if (a.type === 'invalid' && b.type === 'invalid') {
        const pa = a.cards.reduce((s, c) => s + (c.pts || 0), 0)
        const pb = b.cards.reduce((s, c) => s + (c.pts || 0), 0)
        return pb - pa
      }
      return 0
    })

    const finalGroups = resultGroups.map(g => g.cards)

    // Push sorted groups directly into PlayerHand via sortRef
    if (sortRef.current) {
      sortRef.current(finalGroups)
    }
  }

  // DRAG TO REORDER (touch/drag friendly)
  function handleReorder(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === null) return
    const newHand = [...playerHand]
    const [moved] = newHand.splice(fromIndex, 1)
    newHand.splice(toIndex, 0, moved)
    setPlayerHand(newHand)
  }

  // SELECT CARD
  // - selectedCards (multi-select for Sort/Group): always allowed, tap again to deselect
  // - selectedCard (single-select for Discard/Declare): only on player's turn, tap again to deselect
  function selectCard(card) {
    // Multi-select toggle — always allowed
    setSelectedCards(prev => {
      const exists = prev.some(c => c.id === card.id)
      return exists ? prev.filter(c => c.id !== card.id) : [...prev, card]
    })

    // Single select toggle — only on player's turn
    if (isPlayerTurn && (gameState === 'draw' || gameState === 'discard')) {
      setSelectedCard(p => p?.id === card.id ? null : card)
    }
  }

  // GROUP — take all selectedCards, pull them from their current groups, form a new group
  function groupHand() {
    if (selectedCards.length < 2) {
      return
    }
    if (!canSortMove) { return }

    const selectedIds = new Set(selectedCards.map(c => c.id))

    setSelectedCards([])
    setSelectedCard(null)

    // Use sortRef to directly update handGroups inside PlayerHand
    sortRef.current(prev => {
      // Remove selected cards from all existing groups
      const remaining = prev
        .map(g => g.filter(c => !selectedIds.has(c.id)))
        .filter(g => g.length > 0)

      // New group = the selected cards in their original order from playerHand
      const newGroup = playerHand.filter(c => selectedIds.has(c.id))

      return [...remaining, newGroup]
    })
  }

  // AUTO PLAY (timer ran out)
  // Case A: player hasn't drawn yet → auto-draw from closed pile, then auto-discard
  // Case B: player already drew (14 cards) → auto-discard highest-point invalid card
  function autoDiscard() {
    if (!playerHand.length) return

    const executeDiscard = (hand) => {
      // Pick highest-point card from an invalid group; fallback to last card
      const groups = getHandGroups(hand)
      const evals = groups.map(g => evalGroup(g))
      let card = hand[hand.length - 1]
      let maxPts = -1
      groups.forEach((g, gi) => {
        if (!evals[gi].valid) {
          g.forEach(c => {
            if ((c.pts || 0) > maxPts) { maxPts = c.pts; card = c }
          })
        }
      })

      setSelectedCard(card)
      setTimeout(() => {
        if (activeRoundRef.current !== roundNumber) return
        const newHand = hand.filter(c => c.id !== card.id)
        setDiscardPile(p => [...p, card])
        setPlayerHand(newHand)
        setSelectedCard(null)
        setSelectedCards([])
        setHasDrawn(false)
        setGameState('draw')
        turnEngine.advanceTurnOnce('auto-discard-timeout')
      }, 500)
    }

    if (!hasDrawn) {
      // Auto-draw from closed pile first
      const pile = drawPile
      if (!pile.length) {
        // No cards in draw pile — skip turn
        turnEngine.advanceTurnOnce('auto-skip-empty-deck')
        return
      }
      const drawnCard = pile[pile.length - 1]
      const newPile = pile.slice(0, -1)
      setDrawPile(newPile)
      const newHand = [...playerHand, drawnCard]
      setPlayerHand(newHand)
      setHasDrawn(true)
      // Small delay so the draw is visible before discard
      setTimeout(() => executeDiscard(newHand), 400)
    } else {
      // Already drew — just discard
      executeDiscard(playerHand)
    }
  }

  function handleCardDragStart(e, index) {
    dragIndexRef.current = index
    setDragIndex(index)
    setIsDragging(true)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      const img = new Image()
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
      e.dataTransfer.setDragImage(img, 0, 0)
    }
  }

  function handleCardDragOver(e, index) {
    e.preventDefault()
    if (dragIndexRef.current === null) return
    if (index !== dragOverIdx) {
      setDragOverIdx(index)
    }
  }

  function handleCardDrop(e, index) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) {
      resetDrag(); return
    }
    const newHand = [...playerHand]
    const [moved] = newHand.splice(from, 1)
    newHand.splice(index, 0, moved)
    setPlayerHand(newHand)
    resetDrag()
  }

  function handleCardDragEnd() {
    resetDrag()
  }

  function resetDrag() {
    dragIndexRef.current = null
    setDragIndex(null)
    setDragOverIdx(null)
    setIsDragging(false)
  }

  // Scroll handlers for hand container
  function onHandPointerDown(e) {
    if (isDragging) return
    e.target.setPointerCapture(e.pointerId)
    dragStartX.current = e.clientX
    scrollStart.current = handRef.current?.scrollLeft || 0
  }
  function onHandPointerMove(e) {
    if (e.buttons !== 1 || isDragging) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 8 && handRef.current) {
      handRef.current.scrollLeft = scrollStart.current - dx
    }
  }

  const topCard = discardPile[discardPile.length - 1]
  const dropPts = !hasDrawn ? 20 : 40
  const declaration = checkDeclaration(playerHand)
  const totalPts = declaration.totalInvalidPts
  const handGroups = getHandGroups(playerHand)

  // ── Button style helper ──
  const btnStyle = (c1, c2, textColor) => ({
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    color: textColor, fontWeight: 900, fontSize: 14,
    border: 'none', borderRadius: 999, padding: '10px 28px',
    cursor: 'pointer', width: '100%', marginTop: 4,
  })

  // ── Mini card for result screen — uses new 52_cards_png images ──
  function MiniCard({ card }) {
    if (!card) return null
    const isJokerCard = card.isWildJoker || card.isJoker
    return (
      <div style={{
        width: 28, height: 40, borderRadius: 4, flexShrink: 0,
        overflow: 'visible', position: 'relative',
        boxShadow: isJokerCard
          ? '0 0 0 1.5px #FFD700, 0 0 5px rgba(255,215,0,0.5)'
          : '0 1px 4px rgba(0,0,0,0.35)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden' }}>
          <img
            src={getCardImage(card.rank, card.suit)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 4 }}
            draggable={false}
          />
        </div>
        {isJokerCard && (
          <img
            src={jokerHatImg}
            draggable={false}
            style={{
              position: 'absolute', top: -14, left: -9,
              width: 18, height: 'auto',
              pointerEvents: 'none', zIndex: 10,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
            }}
          />
        )}
      </div>
    )
  }

  // ── Player row with cards for result screen ──
  function PlayerCardRows({ scoreboard, roundSnapshot, playerHand }) {
    // Build per-player data: name, hand, score, isYou, isEliminated
    const rows = scoreboard.map((p, idx) => {
      let hand = []
      if (p.isYou) {
        hand = roundSnapshot?.playerHand || playerHand || []
      } else {
        hand = roundSnapshot?.aiHands?.[idx - 1]?.hand || []
      }
      return { ...p, hand }
    })

    return (
      <div style={{ marginBottom: 14, textAlign: 'left' }}>
        {rows.map(p => {
          const roundPts = calcScore(p.hand)
          const scoreColor = p.isEliminated ? '#ef5350' : p.score === 0 ? '#a4ffb5' : '#F5C518'
          return (
            <div key={p.id} style={{
              background: p.isYou ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${p.isYou ? 'rgba(245,197,24,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '8px 10px', marginBottom: 6,
            }}>
              {/* Name + total score row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {p.isYou ? '👤 You' : p.name}
                  {p.isEliminated ? ' 💀' : ''}
                </span>
                <span style={{ color: scoreColor, fontSize: 12, fontWeight: 900 }}>
                  {p.isEliminated ? `OUT (${p.score})` : `${p.score}/101`}
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 400, marginLeft: 4 }}>
                    +{roundPts}pts
                  </span>
                </span>
              </div>
              {/* Cards row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {p.hand.length > 0
                  ? p.hand.map((card, i) => <MiniCard key={card?.id ?? i} card={card} />)
                  : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>No cards</span>
                }
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Disable rotate overlay on native platforms (Android/iOS) since orientation is locked natively
  if (!Capacitor.isNativePlatform() && !isLandscape) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#050a06',
        color: '#F5C518',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{
            width: 92,
            height: 92,
            margin: '0 auto 24px',
            borderRadius: '50%',
            border: '3px solid rgba(245,197,24,0.3)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 42,
          }}>
            ↻
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Rotate your device</div>
          <div style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.9 }}>Please rotate your device to play</div>
        </div>
      </div>
    )
  }

  // Hand scroll handlers (mouse/touch) – visual only
  function onHandMouseDown(e) {
    if (isDragging) return
    dragStartX.current = e.clientX
    scrollStart.current = handRef.current?.scrollLeft || 0
  }
  function onHandMouseMove(e) {
    if (e.buttons !== 1 || isDragging) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 4 && handRef.current) {
      handRef.current.scrollLeft = scrollStart.current - dx
    }
  }
  function onHandTouchStart(e) {
    if (isDragging) return
    const t = e.touches[0]
    dragStartX.current = t.clientX
    scrollStart.current = handRef.current?.scrollLeft || 0
  }
  function onHandTouchMove(e) {
    if (isDragging) return
    const t = e.touches[0]
    const dx = t.clientX - dragStartX.current
    if (Math.abs(dx) > 4 && handRef.current) {
      handRef.current.scrollLeft = scrollStart.current - dx
    }
  }

  // Card drag handlers wired to existing logic
  function onCardDragStart(e, index) {
    handleCardDragStart(e, index)
  }
  function onCardDragEnter(e, index) {
    handleCardDragOver(e, index)
  }
  function onCardDragOver(e, index) {
    handleCardDragOver(e, index)
  }
  function onCardDrop(e, index) {
    handleCardDrop(e, index)
  }
  function onCardDragEnd() {
    handleCardDragEnd()
  }

  return (
    <div
      style={{
        width: '100dvw',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: `url(${startBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
        fontFamily: "'Nunito', sans-serif",
        position: 'relative',
      }}
    >
      {/* Top Bar — fully transparent, only ← and ⚙ buttons float over the table */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        pointerEvents: 'none',
      }}>
        {/* Back button */}
        <button
          onClick={() => setScreen('home')}
          style={{
            pointerEvents: 'auto',
            width: 36, height: 36,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >←</button>
        {/* Settings button */}
        <button
          onClick={() => {}}
          style={{
            pointerEvents: 'auto',
            width: 36, height: 36,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >⚙</button>
      </div>

      {/* TABLE ZONE */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          padding: isMobileLandscape ? '0 4px' : '2px 8px',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: isMobileLandscape ? 'min(98vw, 1000px)' : 'min(98vw, 900px)',
            // Portrait phones: use a taller fixed height so the table fills the zone properly.
            // Landscape: keep aspect-ratio-driven sizing.
            ...(isMobileLandscape
              ? { aspectRatio: '2.2 / 1', maxHeight: '52vh' }
              : isLandscape
                ? { aspectRatio: '2.2 / 1', maxHeight: '55vh' }
                : { height: 'min(46vw, 340px)', minHeight: 180 }
            ),
            overflow: 'visible',
          }}
        >
          {hasSideScoreboard && (
            <div style={{ position: 'absolute', right: -Math.min(260, Math.max(220, viewportWidth * 0.24)) - 12, top: 10, zIndex: 12 }}>
              <Scoreboard players={scoreboard} currentTurn={currentTurn} round={roundNumber} winner={winner} />
            </div>
          )}

          {/* Green oval table is now part of the background image */}

          {/* AI players around the table */}
          <PlayersAroundTable
            aiPlayers={aiPlayers}
            isPlayerTurn={isPlayerTurn}
            aiActionAnim={aiActionAnim}
            viewportWidth={viewportWidth}
            tableCompact={tableCompact}
            isLandscape={isLandscape}
            aiRefs={aiRefs}
            aiAvatarSz={alignment.aiAvatarSz}
            dealerIndex={dealerIndex}
            aiCardW={alignment.aiCardW}
            aiCardH={alignment.aiCardH}
          />

          {/* Center area: draw pile, discard, finish slot */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: '18%',
              paddingLeft: '5%',
              zIndex: 4,
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}>
              <CenterArea
                wildJoker={wildJoker}
                drawPile={drawPile}
                discardPile={discardPile}
                gameState={gameState}
                isPlayerTurn={isPlayerTurn}
                onDrawClosed={() => drawFromPile(false)}
                onDrawOpen={() => drawFromPile(true)}
                onDeclare={declare}
                canDrawClosed={canDrawMove}
                canDrawOpen={canDrawOpenMove}
                canDeclare={canDeclareMove}
                drawPileRef={drawPileRef}
                discardPileRef={discardPileRef}
                cardW={Math.round(cardW * 0.75)}
                cardH={Math.round(cardH * 0.75)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ZONE */}
      <div
        className="bottom-zone"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          padding: '16px 8px 6px',
          zIndex: 11,
          overflow: 'visible',
        }}
      >
        {/* Player Hand */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            overflow: 'visible',   // allow selected card to lift without clipping
          }}
        >
          <PlayerHand
            playerHand={playerHand}
            selectedCard={selectedCard}
            selectedCards={selectedCards}
            gameState={gameState}
            cardW={cardW}
            cardH={cardH}
            handRef={handRef}
            sortRef={sortRef}
            onCardSelect={selectCard}
            onCardDragStart={onCardDragStart}
            onCardDragEnter={onCardDragEnter}
            onCardDragOver={onCardDragOver}
            onCardDrop={onCardDrop}
            onCardDragEnd={onCardDragEnd}
            onHandMouseDown={onHandMouseDown}
            onHandMouseMove={onHandMouseMove}
            onHandTouchStart={onHandTouchStart}
            onHandTouchMove={onHandTouchMove}
            isDragging={isDragging}
            dragIndex={dragIndex}
            dragOverIdx={dragOverIdx}
            groupFlash={groupFlash}
            canInteract={canSelectCard}
            canDiscard={canDiscardMove}
            discardPileRef={discardPileRef}
            onDiscard={discardCard}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
          />
        </div>

        {/* Bottom row: Sort+Drop LEFT | pts label CENTER | Avatar+info RIGHT | Group+Discard+Declare FAR RIGHT */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 4,
            width: '100%',
          }}
        >
          {/* LEFT: Sort + Drop */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Controls
              playerScore={playerScore}
              gameState={gameState}
              selectedCard={selectedCard}
              hasDrawn={hasDrawn}
              declaration={declaration}
              onDeclare={() => {}}
              onDropGame={dropGame}
              onSort={sortHand}
              onGroup={() => {}}
              onDiscard={() => {}}
              isPlayerTurn={isPlayerTurn}
              canDropMove={canDropMove}
              canSortMove={canSortMove}
              canGroupMove={false}
              canDiscardMove={false}
              canDeclareMove={false}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              compactMode={alignment.compactMode}
              smallMode={alignment.smallMode}
              avatarSize={alignment.avatarSize}
              buttonHeight={38}
              buttonMinWidth={38}
              buttonPadding="0"
              showOnly={['sort', 'drop']}
            />
          </div>

          {/* RIGHT SIDE: Avatar + info + Group/Discard/Declare */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 110, flexShrink: 0 }}>
            {/* Avatar + name pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Avatar with circular turn timer */}
              <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                {/* Gold crown — shown when this player is the dealer */}
                {dealerIndex === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 26,
                    lineHeight: 1,
                    zIndex: 20,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}>
                    👑
                  </div>
                )}
                <PlayerCircularTimer
                  size={52}
                  strokeWidth={4}
                  secondsLeft={
                    !isPlayerTurn ? 30
                    : timerPhase === 'penalty' ? penaltyTimer
                    : turnTimer
                  }
                  totalSeconds={timerPhase === 'penalty' ? 10 : 30}
                  phase={timerPhase === 'penalty' ? 'penalty' : 'main'}
                />
                <motion.div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: '2px solid rgba(255,255,255,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  👤
                </motion.div>
              </div>
              <div style={{
                background: 'rgba(0,0,0,0.88)',
                borderRadius: 5,
                padding: '3px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1.2 }}>
                  {user?.name || 'YOU'}
                </span>
                <span style={{ color: '#F5C518', fontSize: 9, fontWeight: 800, lineHeight: 1.2 }}>
                  ★{playerScore}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>
                  Hand: {calcScore(playerHand)}pts
                </span>
                <span style={{
                  color: playerDropped ? '#ef5350' : isPlayerTurn ? (timerPhase === 'penalty' ? '#ff4444' : '#4caf50') : 'rgba(255,255,255,0.5)',
                  fontSize: 8, fontWeight: 700,
                }}>
                  {playerDropped ? 'DROPPED' : isPlayerTurn
                    ? timerPhase === 'penalty'
                      ? `EXTRA · ${penaltyTimer}s`
                      : `YOUR TURN · ${turnTimer}s`
                    : 'PRACTICE'}
                </span>
              </div>
            </div>

            {/* Group + Discard + Declare */}
            <Controls
              playerScore={playerScore}
              gameState={gameState}
              selectedCard={selectedCard}
              hasDrawn={hasDrawn}
              declaration={declaration}
              onDeclare={declare}
              onDropGame={() => {}}
              onSort={() => {}}
              onGroup={groupHand}
              onDiscard={discardCard}
              isPlayerTurn={isPlayerTurn}
              canDropMove={false}
              canSortMove={false}
              canGroupMove={canGroupMove}
              canDiscardMove={canDiscardMove}
              canDeclareMove={canDeclareMove}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              compactMode={alignment.compactMode}
              smallMode={alignment.smallMode}
              avatarSize={alignment.avatarSize}
              buttonHeight={38}
              buttonMinWidth={38}
              buttonPadding="0"
              showOnly={['group', 'discard', 'declare']}
            />
          </div>
        </div>
      </div>

      {/* 🔥 ALL OVERLAYS MUST BE INSIDE ROOT */}

      {/* 🔥 ALL OVERLAYS MUST BE INSIDE ROOT */}

      <AnimationLayer animations={layerAnimations} onComplete={removeAnim} />



      {showDeclare && (
        <div className="modal-overlay">
          <div className="declare-modal" style={{ textAlign: 'center', padding: '28px 24px', maxWidth: 340 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div className="modal-title" style={{ fontSize: 22, fontWeight: 900, color: '#F5C518', marginBottom: 6 }}>
              VALID DECLARATION!
            </div>
            <div style={{ color: '#a4ffb5', fontSize: 14, marginBottom: 4 }}>You win this round!</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 }}>
              Your score: <strong style={{ color: '#fff' }}>{playerScore}/101</strong>
            </div>
            <div style={{ marginBottom: 18, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              AI players scored points for their unmatched cards (capped at 80).
            </div>
            <button
              onClick={() => { setShowDeclare(false); startNextRound() }}
              style={{
                background: 'linear-gradient(135deg, #F5C518, #e6a800)',
                color: '#000', fontWeight: 900, fontSize: 15,
                border: 'none', borderRadius: 999, padding: '10px 32px',
                cursor: 'pointer', width: '100%',
              }}
            >
              {winner ? '🏅 See Final Result' : '▶ Next Round'}
            </button>
          </div>
        </div>
      )}

      {showResult && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', maxWidth: 560,
            background: 'linear-gradient(160deg, #0d2a14 0%, #071a0c 100%)',
            border: '2px solid rgba(245,197,24,0.35)',
            borderRadius: 0,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
            padding: '20px 16px 24px',
          }}>
            {winner ? (
              // ── GAME OVER ──
              <>
                <div style={{ fontSize: 44, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#F5C518', marginBottom: 6 }}>
                  {winner.isYou ? 'YOU WIN!' : `${winner.name} WINS!`}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 14 }}>
                  Last player remaining under 101 points
                </div>
                <PlayerCardRows scoreboard={scoreboard} roundSnapshot={roundSnapshot} playerHand={playerHand} />
                <button onClick={() => setScreen('home')} style={btnStyle('#F5C518','#e6a800','#000')}>
                  🏠 Back to Lobby
                </button>
              </>
            ) : scoreboard[0]?.isEliminated ? (
              // ── HUMAN ELIMINATED ──
              <>
                <div style={{ fontSize: 44, marginBottom: 6 }}>💀</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#ef5350', marginBottom: 6 }}>
                  YOU'RE ELIMINATED!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 14 }}>
                  Your score reached {scoreboard[0]?.score}/101
                </div>
                <PlayerCardRows scoreboard={scoreboard} roundSnapshot={roundSnapshot} playerHand={playerHand} />
                <button onClick={() => setScreen('home')} style={btnStyle('#ef5350','#c62828','#fff')}>
                  🏠 Back to Lobby
                </button>
              </>
            ) : (
              // ── ROUND OVER ──
              <>
                <div style={{ fontSize: 28, marginBottom: 4 }}>📋</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
                  Round {roundNumber} Over
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 14, lineHeight: 1.4 }}>
                  {resultMsg}
                </div>
                <PlayerCardRows scoreboard={scoreboard} roundSnapshot={roundSnapshot} playerHand={playerHand} />
                <button onClick={() => startNextRound()} style={btnStyle('#22c55e','#16a34a','#fff')}>
                  ▶ Next Round
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {confetti.map(c => (
        <div key={c.id} className="confetti-piece" />
      ))}
    </div>
  )
}

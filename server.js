import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFileSync, existsSync } from 'fs'
import admin from 'firebase-admin'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(express.json())

// ──── AUTH + DATA STORES ────
const otpStore = new Map()
const users = new Map()
const firebaseUsers = new Map()
const rooms = new Map()

const JWT_SECRET = process.env.JWT_SECRET || 'rummy101_jwt_secret_please_change'
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return

  let serviceAccount = null

  if (FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT)
  } else if (FIREBASE_SERVICE_ACCOUNT_PATH && existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
    serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
  } else if (existsSync(path.join(__dirname, 'firebase-service-account.json'))) {
    serviceAccount = JSON.parse(readFileSync(path.join(__dirname, 'firebase-service-account.json'), 'utf8'))
  }

  if (!serviceAccount) {
    console.warn('Firebase Admin service account not configured. Firebase token routes will fail until configured.')
    return
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

function generateJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
  if (!token) return res.status(401).json({ error: 'Missing authorization token' })

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ──── GAME CONSTANTS ────
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

// ──── GAME LOGIC FUNCTIONS ────

// Create a standard deck of 54 cards (52 + 2 jokers)
function createDeck() {
  const deck = []
  let id = 0

  // Regular cards
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: id++,
        rank,
        suit,
        pts: ['A', 'J', 'Q', 'K', '10'].includes(rank) ? 10 : parseInt(rank) || 0,
        isJoker: false,
      })
    }
  }

  // Add 2 jokers
  deck.push({ id: 52, rank: '🃏', suit: '', pts: 0, isJoker: true })
  deck.push({ id: 53, rank: '🃏', suit: '', pts: 0, isJoker: true })

  return deck
}

// Shuffle array using Fisher-Yates algorithm
function shuffle(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Distribute cards to players (13 cards each)
function distributeCards(deck, playerCount) {
  const shuffledDeck = shuffle(deck)
  const hands = []
  const cardsPerPlayer = 13

  for (let i = 0; i < playerCount; i++) {
    const start = i * cardsPerPlayer
    const end = start + cardsPerPlayer
    hands.push(shuffledDeck.slice(start, end))
  }

  const remainingCards = shuffledDeck.slice(playerCount * cardsPerPlayer)
  const drawPile = remainingCards.slice(1) // All except first card
  const discardPile = [remainingCards[0]] // First card as discard

  return { hands, drawPile, discardPile }
}

// Validate if a move is allowed for the current player
function validateMove(room, userId, action) {
  if (!room.game) return { valid: false, reason: 'Game not started' }
  if (room.game.currentTurn !== userId) return { valid: false, reason: 'Not your turn' }

  switch (action) {
    case 'draw':
      return { valid: room.game.drawPile.length > 0, reason: 'No cards to draw' }
    case 'discard':
      return { valid: true, reason: '' } // Always allow discard if it's your turn
    default:
      return { valid: true, reason: '' }
  }
}

// Move to next player's turn
function nextTurn(room) {
  const currentIndex = room.game.playerOrder.indexOf(room.game.currentTurn)
  const nextIndex = (currentIndex + 1) % room.game.playerOrder.length
  room.game.currentTurn = room.game.playerOrder[nextIndex]
  room.game.turnStartTime = Date.now()
}

// Broadcast game state to all players in room
function broadcastGameState(roomCode) {
  const room = rooms.get(roomCode)
  if (!room || !room.game) return

  // Send full game state to all players
  io.to(roomCode).emit('game-state', {
    players: room.game.players.map(p => ({
      userId: p.userId,
      hand: p.hand, // Send full hand for now (in production, hide other players' hands)
      score: p.score,
      hasDeclared: p.hasDeclared,
      hasDropped: p.hasDropped,
    })),
    drawPileCount: room.game.drawPile.length,
    discardPile: room.game.discardPile,
    currentTurn: room.game.currentTurn,
    wildJoker: room.game.wildJoker,
    gamePhase: room.game.gamePhase,
    round: room.game.round,
  })
}

// ──── OTP ENDPOINTS ────
app.post('/api/send-otp', (req, res) => {
  const { phone } = req.body
  if (!phone || phone.length !== 10) return res.status(400).json({ error: 'Invalid phone' })
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000 })
  console.log(`📱 OTP for ${phone}: ${otp}`)
  res.json({ success: true, message: 'OTP sent', debug_otp: otp })
})

app.post('/api/verify-otp', (req, res) => {
  const { phone, otp } = req.body
  const stored = otpStore.get(phone)
  if (!stored) return res.status(400).json({ error: 'OTP not sent or expired' })
  if (Date.now() > stored.expires) {
    otpStore.delete(phone)
    return res.status(400).json({ error: 'OTP expired' })
  }
  if (stored.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' })
  otpStore.delete(phone)
  const userId = `user_${phone}_${Date.now()}`
  const token = Buffer.from(`${userId}:${phone}`).toString('base64')
  users.set(token, { userId, phone, coins: 12450 })
  res.json({ success: true, token, userId, phone, coins: 12450 })
})

app.post('/api/auth/firebase-verify', async (req, res) => {
  initFirebaseAdmin()
  if (admin.apps.length === 0) {
    return res.status(500).json({ error: 'Firebase Admin is not configured' })
  }

  const { idToken } = req.body
  if (!idToken) {
    return res.status(400).json({ error: 'Missing Firebase ID token' })
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    const { uid, phone_number: phoneNumber } = decoded
    if (!uid) {
      return res.status(401).json({ error: 'Invalid Firebase token' })
    }

    let userRecord = firebaseUsers.get(uid)
    if (!userRecord) {
      userRecord = {
        uid,
        phoneNumber: phoneNumber || null,
        createdAt: Date.now(),
        coins: 12450,
      }
      firebaseUsers.set(uid, userRecord)
    } else if (phoneNumber && userRecord.phoneNumber !== phoneNumber) {
      userRecord.phoneNumber = phoneNumber
      firebaseUsers.set(uid, userRecord)
    }

    const jwtToken = generateJwt({ uid, phoneNumber })
    return res.json({ success: true, token: jwtToken, user: userRecord })
  } catch (verifyError) {
    console.error('Firebase token verification failed:', verifyError)
    return res.status(401).json({ error: 'Invalid or expired Firebase ID token' })
  }
})

app.get('/api/auth/me', authenticateJwt, (req, res) => {
  return res.json({ success: true, user: req.user })
})

// ──── SOCKET.IO EVENT HANDLERS ────
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id)

  // ──── ROOM MANAGEMENT ────
  socket.on('join-room', ({ roomCode, userId, entryFee = 0 }) => {
    try {
      let room = rooms.get(roomCode)
      if (!room) {
        room = {
          code: roomCode,
          players: [],
          maxPlayers: 6, // Support up to 6 players
          entryFee,
          status: 'waiting',
          game: null,
          createdAt: Date.now(),
        }
        rooms.set(roomCode, room)
      }

      // Check if room is full
      if (room.players.length >= room.maxPlayers) {
        socket.emit('room-error', { message: 'Room is full' })
        return
      }

      // Check if game already started
      if (room.status !== 'waiting') {
        socket.emit('room-error', { message: 'Game already in progress' })
        return
      }

      // Check if player already in room (reconnect)
      const existingPlayer = room.players.find(p => p.userId === userId)
      if (existingPlayer) {
        existingPlayer.socketId = socket.id
        existingPlayer.connected = true
        socket.emit('reconnected', { message: 'Reconnected successfully' })
      } else {
        // Add new player
        room.players.push({
          socketId: socket.id,
          userId,
          connected: true,
          ready: false,
          score: 0,
          hand: [],
          hasDeclared: false,
          hasDropped: false,
        })
      }

      socket.join(roomCode)
      socket.roomCode = roomCode
      socket.userId = userId

      // Broadcast room update
      io.to(roomCode).emit('room-update', {
        players: room.players.map(p => ({
          userId: p.userId,
          ready: p.ready,
          connected: p.connected,
        })),
        status: room.status,
        maxPlayers: room.maxPlayers,
      })

      console.log(`👤 ${userId} joined room ${roomCode} (${room.players.length}/${room.maxPlayers})`)

      // Auto-start game when room is full
      if (room.players.length === room.maxPlayers && room.status === 'waiting') {
        setTimeout(() => startGame(roomCode), 1000)
      }
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('room-error', { message: 'Failed to join room' })
    }
  })

  // ──── GAME MANAGEMENT ────
  socket.on('start-game', ({ roomCode }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room || room.status !== 'waiting') return

      startGame(roomCode)
    } catch (error) {
      console.error('Error starting game:', error)
    }
  })

  socket.on('draw-card', ({ roomCode, fromDiscard = false }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room?.game) return

      const validation = validateMove(room, socket.userId, 'draw')
      if (!validation.valid) {
        socket.emit('move-error', { message: validation.reason })
        return
      }

      const player = room.game.players.find(p => p.userId === socket.userId)
      if (!player) return

      let drawnCard
      if (fromDiscard && room.game.discardPile.length > 0) {
        drawnCard = room.game.discardPile.pop()
      } else if (room.game.drawPile.length > 0) {
        drawnCard = room.game.drawPile.pop()
      } else {
        socket.emit('move-error', { message: 'No cards to draw' })
        return
      }

      player.hand.push(drawnCard)
      room.game.gamePhase = 'discard' // Player must now discard

      console.log(`🎴 ${socket.userId} drew a card`)
      broadcastGameState(roomCode)
    } catch (error) {
      console.error('Error drawing card:', error)
    }
  })

  socket.on('discard-card', ({ roomCode, cardId }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room?.game) return

      const validation = validateMove(room, socket.userId, 'discard')
      if (!validation.valid) {
        socket.emit('move-error', { message: validation.reason })
        return
      }

      const player = room.game.players.find(p => p.userId === socket.userId)
      if (!player) return

      const cardIndex = player.hand.findIndex(card => card.id === cardId)
      if (cardIndex === -1) {
        socket.emit('move-error', { message: 'Card not in hand' })
        return
      }

      const discardedCard = player.hand.splice(cardIndex, 1)[0]
      room.game.discardPile.push(discardedCard)
      room.game.gamePhase = 'draw' // Next player can draw

      console.log(`🗑️ ${socket.userId} discarded ${discardedCard.rank}${discardedCard.suit}`)
      nextTurn(room)
      broadcastGameState(roomCode)
    } catch (error) {
      console.error('Error discarding card:', error)
    }
  })

  socket.on('group-cards', ({ roomCode, groups }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room?.game) return

      const player = room.game.players.find(p => p.userId === socket.userId)
      if (!player) return

      // Validate grouping logic (simplified - in production, implement full rummy rules)
      const allCardIds = groups.flat().map(card => card.id)
      const handCardIds = player.hand.map(card => card.id)

      if (allCardIds.length !== handCardIds.length ||
          !allCardIds.every(id => handCardIds.includes(id))) {
        socket.emit('move-error', { message: 'Invalid grouping' })
        return
      }

      player.groups = groups
      console.log(`🔀 ${socket.userId} grouped cards`)
      broadcastGameState(roomCode)
    } catch (error) {
      console.error('Error grouping cards:', error)
    }
  })

  socket.on('declare', ({ roomCode }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room?.game) return

      const player = room.game.players.find(p => p.userId === socket.userId)
      if (!player) return

      player.hasDeclared = true
      console.log(`🏆 ${socket.userId} declared!`)

      // Check if all players have declared or game should end
      const activePlayers = room.game.players.filter(p => !p.hasDropped)
      const declaredCount = activePlayers.filter(p => p.hasDeclared).length

      if (declaredCount === activePlayers.length) {
        // End game
        room.game.gamePhase = 'finished'
        calculateScores(room)
      }

      broadcastGameState(roomCode)
    } catch (error) {
      console.error('Error declaring:', error)
    }
  })

  socket.on('drop-game', ({ roomCode, penalty = 20 }) => {
    try {
      const room = rooms.get(roomCode)
      if (!room?.game) return

      const player = room.game.players.find(p => p.userId === socket.userId)
      if (!player) return

      player.hasDropped = true
      player.score += penalty
      console.log(`💸 ${socket.userId} dropped with penalty ${penalty}`)

      // Check if only one player left
      const activePlayers = room.game.players.filter(p => !p.hasDropped)
      if (activePlayers.length === 1) {
        room.game.gamePhase = 'finished'
        activePlayers[0].hasDeclared = true // Winner
        calculateScores(room)
      }

      broadcastGameState(roomCode)
    } catch (error) {
      console.error('Error dropping game:', error)
    }
  })

  // ──── DISCONNECTION HANDLING ────
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode
    if (roomCode) {
      const room = rooms.get(roomCode)
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id)
        if (player) {
          player.connected = false
          console.log(`🔌 ${player.userId} disconnected from ${roomCode}`)

          // Broadcast disconnection
          io.to(roomCode).emit('player-disconnected', { userId: player.userId })

          // Clean up empty rooms after delay
          setTimeout(() => {
            const currentRoom = rooms.get(roomCode)
            if (currentRoom && currentRoom.players.every(p => !p.connected)) {
              rooms.delete(roomCode)
              console.log(`🗑️ Room ${roomCode} cleaned up`)
            }
          }, 30000) // 30 second grace period
        }
      }
    }
    console.log('🔌 Client disconnected:', socket.id)
  })
})

// ──── GAME MANAGEMENT FUNCTIONS ────
function startGame(roomCode) {
  try {
    const room = rooms.get(roomCode)
    if (!room || room.players.length < 2) return

    room.status = 'playing'

    // Create and distribute cards
    const deck = createDeck()
    const { hands, drawPile, discardPile } = distributeCards(deck, room.players.length)

    // Initialize game state
    room.game = {
      players: room.players.map((player, index) => ({
        ...player,
        hand: hands[index],
        groups: [],
      })),
      drawPile,
      discardPile,
      wildJoker: discardPile[0], // First discard becomes wild joker
      currentTurn: room.players[0].userId,
      playerOrder: room.players.map(p => p.userId),
      gamePhase: 'draw', // 'draw' | 'discard' | 'finished'
      round: 1,
      turnStartTime: Date.now(),
      maxTurnTime: 30000, // 30 seconds
    }

    console.log(`🎮 Game started in room ${roomCode} with ${room.players.length} players`)
    broadcastGameState(roomCode)
  } catch (error) {
    console.error('Error starting game:', error)
  }
}

function calculateScores(room) {
  // Simplified scoring - in production, implement full rummy scoring rules
  room.game.players.forEach(player => {
    if (player.hasDropped) {
      // Already penalized
    } else if (player.hasDeclared) {
      // Winner gets 0 points
      player.score += 0
    } else {
      // Calculate points from remaining cards
      const remainingPoints = player.hand.reduce((sum, card) => sum + card.pts, 0)
      player.score += remainingPoints
    }
  })

  console.log('📊 Game scores calculated')
}

// ──── SERVER STARTUP ────
const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`🚀 Rummy 101 Server running on port ${PORT}`)
  console.log(`📡 WebSocket ready for connections`)
  console.log(`🎮 Supports up to 6 players per room`)
})

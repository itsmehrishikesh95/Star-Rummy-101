import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://star-rummy-101-production.up.railway.app'

console.log('Backend URL:', import.meta.env.VITE_BACKEND_URL)

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.listeners = {} // Store listener callbacks for cleanup
  }

  connect() {
    if (this.socket?.connected) {
      console.log('✓ Socket already connected')
      return this.socket
    }

    this.socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      this.isConnected = true
      console.log('✓ Socket connected:', this.socket.id)
    })

    this.socket.on('disconnect', () => {
      this.isConnected = false
      console.log('✗ Socket disconnected')
    })

    this.socket.on('connect_error', (error) => {
      console.error('✗ Socket connection error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.isConnected = false
      console.log('✓ Socket disconnected')
    }
  }

  // ──── ROOM MANAGEMENT ────
  joinRoom(roomCode, userId, entryFee = 0) {
    if (!this.socket?.connected) {
      console.error('Socket not connected. Call connect() first.')
      return
    }
    this.socket.emit('join-room', { roomCode, userId, entryFee })
    console.log(`→ Joining room: ${roomCode}`)
  }

  // ──── GAME EVENTS (EMIT) ────
  drawCard(roomCode, fromDiscard = false) {
    this.socket?.emit('draw-card', { roomCode, fromDiscard })
  }

  discardCard(roomCode, cardId) {
    this.socket?.emit('discard-card', { roomCode, cardId })
  }

  groupCards(roomCode, groups) {
    this.socket?.emit('group-cards', { roomCode, groups })
  }

  declare(roomCode) {
    this.socket?.emit('declare', { roomCode })
  }

  dropGame(roomCode, penalty = 20) {
    this.socket?.emit('drop-game', { roomCode, penalty })
  }

  startGame(roomCode) {
    this.socket?.emit('start-game', { roomCode })
  }

  // ──── EVENT LISTENERS ────
  onRoomUpdate(callback) {
    this.socket?.on('room-update', callback)
    this.listeners['room-update'] = callback
  }

  onGameStarting(callback) {
    this.socket?.on('game-starting', callback)
    this.listeners['game-starting'] = callback
  }

  onGameState(callback) {
    this.socket?.on('game-state', callback)
    this.listeners['game-state'] = callback
  }

  onMoveError(callback) {
    this.socket?.on('move-error', callback)
    this.listeners['move-error'] = callback
  }

  onPlayerDisconnected(callback) {
    this.socket?.on('player-disconnected', callback)
    this.listeners['player-disconnected'] = callback
  }

  onPlayerDeclared(callback) {
    this.socket?.on('player-declared', callback)
    this.listeners['player-declared'] = callback
  }

  onPlayerDropped(callback) {
    this.socket?.on('player-dropped', callback)
    this.listeners['player-dropped'] = callback
  }

  onPlayerLeft(callback) {
    this.socket?.on('player-left', callback)
    this.listeners['player-left'] = callback
  }

  onRoomError(callback) {
    this.socket?.on('room-error', callback)
    this.listeners['room-error'] = callback
  }

  onReconnected(callback) {
    this.socket?.on('reconnected', callback)
    this.listeners['reconnected'] = callback
  }

  // ──── CLEANUP ────
  removeAllListeners() {
    Object.keys(this.listeners).forEach(eventName => {
      this.socket?.off(eventName, this.listeners[eventName])
    })
    this.listeners = {}
  }

  removeListener(eventName) {
    if (this.listeners[eventName]) {
      this.socket?.off(eventName, this.listeners[eventName])
      delete this.listeners[eventName]
    }
  }
}

// Singleton instance
const socketService = new SocketService()

export default socketService

// ──── DEBUG HELPER ────
// Call once after connect to verify backend round-trip
export function testJoinRoom() {
  const s = socketService.socket
  if (!s) {
    console.warn('[Socket] testJoinRoom: socket not initialised yet')
    return
  }
  s.emit('join_room', {
    roomId: 'test123',
    playerName: 'player_' + Math.floor(Math.random() * 1000),
  })
  // Guard: only register this listener once
  s.off('room_update', _onRoomUpdate)
  s.on('room_update', _onRoomUpdate)
}

function _onRoomUpdate(data) {
  console.log('[Socket] Room Update:', data)
}

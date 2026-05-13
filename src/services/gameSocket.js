/**
 * gameSocket.js
 * Thin multiplayer bridge between the server game events and the UI.
 *
 * Rules:
 * - Only active when a room code is present (multiplayer mode)
 * - Does NOT touch solo/mock game flow
 * - All emits use the server's underscore event names (draw_card, discard_card, start_game)
 * - Exposes a single subscribe() function that GameScreen calls once on mount
 */

import socketService from './socket'

// ── Emit helpers ────────────────────────────────────────────────────────────

export function emitStartGame(code) {
  const s = socketService.socket
  if (!s?.connected) return
  s.emit('start_game', { code })
  console.log('[gameSocket] emit start_game', { code })
}

export function emitDrawCard(code) {
  const s = socketService.socket
  if (!s?.connected) return
  s.emit('draw_card', { code })
  console.log('[gameSocket] emit draw_card', { code })
}

export function emitDiscardCard(code, cardId) {
  const s = socketService.socket
  if (!s?.connected) return
  s.emit('discard_card', { code, cardId })
  console.log('[gameSocket] emit discard_card', { code, cardId })
}

// ── Subscribe ────────────────────────────────────────────────────────────────
/**
 * Subscribe to server game events for a given room code.
 *
 * @param {string}   code          - Room code
 * @param {string}   mySocketId    - This client's socket.id
 * @param {object}   callbacks     - { onGameState, onGameError, onHostChanged, onRoomClosed }
 * @returns {function}             - Cleanup function — call on unmount
 */
export function subscribeToGame(code, mySocketId, callbacks) {
  const s = socketService.socket
  if (!s) return () => {}

  const {
    onGameState   = () => {},
    onGameError   = () => {},
    onHostChanged = () => {},
    onRoomClosed  = () => {},
  } = callbacks

  // ── game_state ─────────────────────────────────────────────────────────────
  // Server sends a personalised snapshot to each player.
  // Shape: { code, players, discardPile, deckSize, turnIndex, currentTurn, state, hand }
  function handleGameState(data) {
    if (data.code !== code) return
    console.log('[gameSocket] game_state received', {
      currentTurn: data.currentTurn,
      myTurn: data.currentTurn === mySocketId,
      handSize: data.hand?.length ?? data.players?.find(p => p.id === mySocketId)?.hand?.length,
    })
    onGameState(data)
  }

  // ── game_error ─────────────────────────────────────────────────────────────
  function handleGameError(data) {
    console.warn('[gameSocket] game_error', data)
    onGameError(data)
  }

  // ── host_changed ───────────────────────────────────────────────────────────
  function handleHostChanged(data) {
    console.log('[gameSocket] host_changed', data)
    onHostChanged(data)
  }

  // ── room_closed ────────────────────────────────────────────────────────────
  function handleRoomClosed(data) {
    console.log('[gameSocket] room_closed', data)
    onRoomClosed(data)
  }

  s.on('game_state',    handleGameState)
  s.on('game_error',    handleGameError)
  s.on('host_changed',  handleHostChanged)
  s.on('room_closed',   handleRoomClosed)

  // Return cleanup
  return () => {
    s.off('game_state',    handleGameState)
    s.off('game_error',    handleGameError)
    s.off('host_changed',  handleHostChanged)
    s.off('room_closed',   handleRoomClosed)
  }
}

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

// ── Persistent player identity ───────────────────────────────────────────────
// Survives socket reconnects. Generated once per device/browser and stored in
// localStorage so the server can identify the host even after a new socket.id.
function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem('star_rummy_player_id')
    if (!id) {
      id = 'pid_' + Math.random().toString(36).slice(2) + '_' + Date.now()
      localStorage.setItem('star_rummy_player_id', id)
    }
    return id
  } catch {
    // localStorage unavailable (e.g. private browsing edge cases)
    return 'pid_' + Math.random().toString(36).slice(2)
  }
}

export { getOrCreatePlayerId }

// ── Emit helpers ────────────────────────────────────────────────────────────

export function emitStartGame(code) {
  const s = socketService.socket
  if (!s?.connected) return
  // Send persistent playerId so server can verify host even after reconnect
  const playerId = getOrCreatePlayerId()
  s.emit('start_game', { code, playerId })
  console.log('[gameSocket] emit start_game', { code, playerId })
}

export function emitDrawCard(code, fromDiscard = false) {
  const s = socketService.socket
  if (!s?.connected) return
  const playerId = getOrCreatePlayerId()
  s.emit('draw_card', { code, playerId, fromDiscard })
  console.log('[gameSocket] emit draw_card', { code, playerId, fromDiscard })
}

export function emitDiscardCard(code, cardId) {
  const s = socketService.socket
  if (!s?.connected) return
  const playerId = getOrCreatePlayerId()
  s.emit('discard_card', { code, cardId, playerId })
  console.log('[gameSocket] emit discard_card', { code, cardId, playerId })
}

export function emitDeclareHand(code, cardId) {
  const s = socketService.socket
  if (!s?.connected) return
  const playerId = getOrCreatePlayerId()
  s.emit('declare_hand', { code, cardId, playerId })
  console.log('[gameSocket] emit declare_hand', { code, cardId, playerId })
}

export function emitDropGame(code) {
  const s = socketService.socket
  if (!s?.connected) return
  const playerId = getOrCreatePlayerId()
  s.emit('drop_game', { code, playerId })
  console.log('[gameSocket] emit drop_game', { code, playerId })
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
    onRoundResult = () => {},
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

  // ── round_result ───────────────────────────────────────────────────────────
  // Server sends full round results (all hands revealed) on declare / drop end.
  function handleRoundResult(data) {
    if (data.code !== code) return
    console.log('[gameSocket] round_result', { round: data.round, type: data.type, valid: data.valid })
    onRoundResult(data)
  }

  s.on('game_state',    handleGameState)
  s.on('game_error',    handleGameError)
  s.on('host_changed',  handleHostChanged)
  s.on('room_closed',   handleRoomClosed)
  s.on('round_result',  handleRoundResult)

  // Return cleanup
  return () => {
    s.off('game_state',    handleGameState)
    s.off('game_error',    handleGameError)
    s.off('host_changed',  handleHostChanged)
    s.off('room_closed',   handleRoomClosed)
    s.off('round_result',  handleRoundResult)
  }
}

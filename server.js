import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  RANKS,
  calcScore,
  getDeclarationVerdict,
} from './src/game/rummyRules.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ── Room store ─────────────────────────────────────────────────────────────
// { roomCode: { host: socketId, hostPlayerId: string, players: [{ id, playerId, name }] } }
const rooms = {};

// ── Game store ─────────────────────────────────────────────────────────────
// {
//   roomCode: {
//     players, deck, hands, discardPile, turnIndex, state,
//     wildJoker, scores{}, eliminated{}, dropped{}, hasDrawn,
//     round, declareValid, roundEnding
//   }
// }
const games = {};

// ── Card / rank helpers ──────────────────────────────────────────────────────
const SUITS = ['S', 'H', 'D', 'C'];

function buildDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}_${id++}`, rank, suit });
    }
  }
  return deck;
}

function buildTwoDecks() {
  const deck1 = buildDeck();
  const deck2 = [];
  let id = 100;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck2.push({ id: `${rank}${suit}_${id++}`, rank, suit });
    }
  }
  return [...deck1, ...deck2];
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Game lifecycle helpers ────────────────────────────────────────────────────

// Players still in the game (not eliminated)
function activePlayers(game) {
  return game.players.filter((p) => !game.eliminated[p.playerId]);
}

// Players that can still take a turn this round (not eliminated, not dropped)
function inRoundPlayers(game) {
  return game.players.filter((p) => !game.eliminated[p.playerId] && !game.dropped[p.playerId]);
}

// Find the next seat index that can act (skips eliminated + dropped).
function nextActiveTurn(game, from) {
  for (let i = 0; i < game.players.length; i++) {
    const n = (from + 1 + i) % game.players.length;
    const p = game.players[n];
    if (!game.eliminated[p.playerId] && !game.dropped[p.playerId]) return n;
  }
  return from;
}

// Find the next seat that is still in the game (skips eliminated only).
// Used to choose the first player for a fresh round.
function nextNonEliminated(game, from) {
  for (let i = 0; i < game.players.length; i++) {
    const n = (from + 1 + i) % game.players.length;
    const p = game.players[n];
    if (!game.eliminated[p.playerId]) return n;
  }
  return from;
}

// Deal a fresh round into an existing game object. Keeps cumulative scores +
// eliminations; resets per-round flags (dropped, hasDrawn).
function dealRound(game, firstTurnIndex) {
  const deck = shuffle(game.players.length >= 5 ? buildTwoDecks() : buildDeck());
  const hands = {};
  let cursor = 0;

  for (const player of game.players) {
    if (game.eliminated[player.playerId]) {
      hands[player.id] = [];
    } else {
      hands[player.id] = deck.slice(cursor, cursor + 13);
      cursor += 13;
    }
  }

  const remaining = deck.slice(cursor);
  const firstDiscard = remaining.shift();   // top of open pile
  const wildJoker = remaining.shift();      // cut joker indicator

  game.deck = remaining;
  game.hands = hands;
  game.discardPile = firstDiscard ? [firstDiscard] : [];
  game.wildJoker = wildJoker || null;
  game.dropped = {};
  game.hasDrawn = false;
  game.turnIndex = firstTurnIndex;
  game.state = 'playing';
  game.roundEnding = false;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────
// Personalised — each player only sees their own hand; others expose handSize.
function buildSnapshot(game, forSocketId) {
  const playerMeta = game.players.map((p) => ({
    id:           p.id,
    name:         p.name,
    handSize:     (game.hands[p.id] || []).length,
    score:        game.scores[p.playerId] || 0,
    isEliminated: !!game.eliminated[p.playerId],
    dropped:      !!game.dropped[p.playerId],
    hand:         p.id === forSocketId ? (game.hands[p.id] || []) : undefined,
  }));

  const me = game.players.find((p) => p.id === forSocketId);
  const isMyTurn = game.players[game.turnIndex]?.id === forSocketId;

  return {
    players:     playerMeta,
    hand:        game.hands[forSocketId] || [],
    discardPile: game.discardPile,
    deckSize:    game.deck.length,
    turnIndex:   game.turnIndex,
    currentTurn: game.players[game.turnIndex]?.id ?? null,
    state:       game.state,
    wildJoker:   game.wildJoker,
    round:       game.round,
    hasDrawn:    isMyTurn ? game.hasDrawn : false,
    myScore:     me ? (game.scores[me.playerId] || 0) : 0,
    myDropped:   me ? !!game.dropped[me.playerId] : false,
    myEliminated: me ? !!game.eliminated[me.playerId] : false,
  };
}

function broadcastGameState(code) {
  const game = games[code];
  if (!game) return;
  for (const player of game.players) {
    io.to(player.id).emit('game_state', { code, ...buildSnapshot(game, player.id) });
  }
}

// Apply round points to cumulative scores + recompute eliminations.
function applyRoundPoints(game, pointsByPlayerId) {
  for (const p of game.players) {
    const delta = pointsByPlayerId[p.playerId] || 0;
    game.scores[p.playerId] = (game.scores[p.playerId] || 0) + delta;
    if (game.scores[p.playerId] >= 101) game.eliminated[p.playerId] = true;
  }
}

// Conclude a round and broadcast results. Then schedule the next round (or end).
function concludeRound(code, { declarerIndex = null, valid = false, type = 'declare' }) {
  const game = games[code];
  if (!game || game.roundEnding) return;
  game.roundEnding = true;
  game.state = 'roundOver';

  const wildRank = game.wildJoker?.rank;
  const pointsByPlayerId = {};

  game.players.forEach((p, idx) => {
    let roundPoints = 0;
    if (type === 'declare') {
      if (idx === declarerIndex) {
        roundPoints = valid ? 0 : 80;
      } else if (game.dropped[p.playerId] || game.eliminated[p.playerId]) {
        roundPoints = 0; // drop penalty already applied; eliminated players don't accrue more
      } else {
        roundPoints = calcScore(game.hands[p.id] || [], wildRank);
      }
    }
    // type === 'laststanding' → everyone 0 (drop penalties already applied)
    pointsByPlayerId[p.playerId] = roundPoints;
  });

  applyRoundPoints(game, pointsByPlayerId);

  // Determine winner (only one active player remains)
  const stillActive = activePlayers(game);
  let winner = null;
  if (stillActive.length === 1) {
    winner = { id: stillActive[0].id, name: stillActive[0].name };
    game.state = 'gameover';
  }

  // Build full result (all hands revealed at round end)
  const resultPlayers = game.players.map((p, idx) => ({
    id:           p.id,
    name:         p.name,
    hand:         game.hands[p.id] || [],
    roundPoints:  pointsByPlayerId[p.playerId] || 0,
    totalScore:   game.scores[p.playerId] || 0,
    isEliminated: !!game.eliminated[p.playerId],
    dropped:      !!game.dropped[p.playerId],
    isDeclarer:   idx === declarerIndex,
  }));

  const declarerName = declarerIndex != null ? game.players[declarerIndex]?.name : null;
  let message;
  if (type === 'laststanding') {
    message = `${winner ? winner.name : 'Last player'} wins the round — everyone else dropped.`;
  } else if (valid) {
    message = `${declarerName} made a valid declaration!`;
  } else {
    message = `${declarerName} made a wrong show (+80 pts).`;
  }

  io.to(code).emit('round_result', {
    code,
    round:     game.round,
    type,
    valid,
    declarerName,
    wildJoker: game.wildJoker,
    players:   resultPlayers,
    winner,
    message,
  });

  console.log(`[round_result] code="${code}" round=${game.round} type=${type} valid=${valid} winner=${winner?.name || 'none'}`);

  // Next round (or stop the game)
  if (winner) {
    // Game over — keep the game object so late resyncs still work.
    return;
  }

  setTimeout(() => {
    const g = games[code];
    if (!g || g.state === 'gameover') return;
    // First turn for next round: next non-eliminated seat after the previous starter.
    g.round += 1;
    const start = nextNonEliminated(g, g.roundStartIndex ?? 0);
    g.roundStartIndex = start;
    dealRound(g, start);
    console.log(`[next_round] code="${code}" round=${g.round} firstTurn=${start}`);
    broadcastGameState(code);
  }, 6500);
}

// ── Health check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Rummy server running');
});

// ── Socket events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect]    socket.id=${socket.id}`);

  // ── register_room ──────────────────────────────────────────────────────────
  socket.on('register_room', ({ code, playerName, playerId }) => {
    if (!code) return;
    rooms[code] = {
      host:         socket.id,
      hostPlayerId: playerId || socket.id,
      players: [{ id: socket.id, playerId: playerId || socket.id, name: playerName || 'Host' }],
    };
    socket.join(code);
    console.log(`[register_room] socket.id=${socket.id} code="${code}" name="${playerName}" playerId="${playerId}"`);
    socket.emit('room_registered', { code });
    io.to(code).emit('room_update', { code, players: rooms[code].players });
  });

  // ── validate_room ──────────────────────────────────────────────────────────
  socket.on('validate_room', ({ code }) => {
    const valid = !!(code && rooms[code]);
    socket.emit('room_validated', { code, valid });
  });

  // ── rejoin_room ────────────────────────────────────────────────────────────
  socket.on('rejoin_room', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) return;
    const oldId = player.id;
    player.id = socket.id;
    if (room.hostPlayerId === playerId) room.host = socket.id;
    // Migrate hand bucket in any active game
    const game = games[code];
    if (game && oldId !== socket.id && game.hands[oldId]) {
      game.hands[socket.id] = game.hands[oldId];
      delete game.hands[oldId];
      const gp = game.players.find((p) => p.playerId === playerId);
      if (gp) gp.id = socket.id;
    }
    socket.join(code);
    console.log(`[rejoin_room] playerId="${playerId}" new socket.id=${socket.id} code="${code}"`);
    socket.emit('room_rejoined', { code });
  });

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, playerName, playerId }) => {
    if (!code || !rooms[code]) {
      socket.emit('room_error', { message: 'Room not found.' });
      return;
    }
    const alreadyIn = rooms[code].players.some((p) => p.id === socket.id || (playerId && p.playerId === playerId));
    if (!alreadyIn) {
      rooms[code].players.push({ id: socket.id, playerId: playerId || socket.id, name: playerName || 'Player' });
      socket.join(code);
      console.log(`[join_room]  socket.id=${socket.id} name="${playerName}" playerId="${playerId}" code="${code}"`);
    }
    io.to(code).emit('room_update', { code, players: rooms[code].players });
  });

  // ── request_game_state ──────────────────────────────────────────────────────
  socket.on('request_game_state', ({ code, playerId }) => {
    const game = games[code];
    if (!game) return;
    let player = game.players.find((p) => p.playerId === playerId);
    if (!player) player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    if (player.id !== socket.id) {
      // heal socket binding after reconnect
      const oldId = player.id;
      if (game.hands[oldId]) {
        game.hands[socket.id] = game.hands[oldId];
        delete game.hands[oldId];
      }
      player.id = socket.id;
      socket.join(code);
    }
    socket.emit('game_state', { code, ...buildSnapshot(game, socket.id) });
  });

  // ── start_game ─────────────────────────────────────────────────────────────
  socket.on('start_game', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room) { socket.emit('game_error', { message: 'Room not found.' }); return; }

    const matchedPlayer = room.players.find((p) => p.playerId === playerId);
    if (matchedPlayer && matchedPlayer.id !== socket.id) {
      matchedPlayer.id = socket.id;
      if (room.hostPlayerId === playerId) room.host = socket.id;
      socket.join(code);
    }
    if (!playerId) { socket.emit('game_error', { message: 'Missing player identity.' }); return; }
    if (playerId !== room.hostPlayerId) { socket.emit('game_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 1) { socket.emit('game_error', { message: 'Need at least 1 player.' }); return; }
    if (games[code]) return;

    console.log('⏳ Starting 10-second countdown for room:', code);
    io.to(code).emit('game_starting', { code, countdown: 10 });

    setTimeout(() => {
      if (games[code]) return;

      // Build the game shell, then deal round 1 with a random toss.
      const players = room.players.map((p) => ({ ...p }));
      const game = {
        players,
        deck: [],
        hands: {},
        discardPile: [],
        turnIndex: 0,
        state: 'playing',
        wildJoker: null,
        scores: {},
        eliminated: {},
        dropped: {},
        hasDrawn: false,
        round: 1,
        roundEnding: false,
        roundStartIndex: 0,
      };
      players.forEach((p) => { game.scores[p.playerId] = 0; });

      const firstTurn = Math.floor(Math.random() * players.length); // random toss
      game.roundStartIndex = firstTurn;
      games[code] = game;
      dealRound(game, firstTurn);

      console.log(`✅ Game created: ${code} — players: ${players.length}, toss→seat ${firstTurn}, wild=${game.wildJoker?.rank}`);
      broadcastGameState(code);
    }, 10000);
  });

  // ── draw_card ──────────────────────────────────────────────────────────────
  socket.on('draw_card', ({ code, fromDiscard }) => {
    const game = games[code];
    if (!game || game.state !== 'playing') { socket.emit('game_error', { message: 'Game not active.' }); return; }

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'Not your turn.' });
      return;
    }
    if (game.hasDrawn) { socket.emit('game_error', { message: 'Already drew this turn.' }); return; }

    let card;
    if (fromDiscard) {
      if (game.discardPile.length === 0) { socket.emit('game_error', { message: 'Discard pile is empty.' }); return; }
      card = game.discardPile.pop();
    } else {
      if (game.deck.length === 0) {
        const top = game.discardPile.pop();
        game.deck = shuffle(game.discardPile);
        game.discardPile = top ? [top] : [];
      }
      card = game.deck.shift();
    }
    if (!card) { socket.emit('game_error', { message: 'No cards left.' }); return; }

    game.hands[socket.id].push(card);
    game.hasDrawn = true;
    console.log(`[draw_card]  socket.id=${socket.id} card=${card.id} fromDiscard=${!!fromDiscard} code="${code}"`);
    broadcastGameState(code);
  });

  // ── discard_card ───────────────────────────────────────────────────────────
  socket.on('discard_card', ({ code, cardId }) => {
    const game = games[code];
    if (!game || game.state !== 'playing') { socket.emit('game_error', { message: 'Game not active.' }); return; }

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'Not your turn.' });
      return;
    }
    if (!game.hasDrawn) { socket.emit('game_error', { message: 'Draw a card first.' }); return; }

    const hand = game.hands[socket.id];
    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) { socket.emit('game_error', { message: 'Card not in hand.' }); return; }

    const [card] = hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    game.hasDrawn = false;
    game.turnIndex = nextActiveTurn(game, game.turnIndex);

    console.log(`[discard_card] socket.id=${socket.id} card=${card.id} nextTurn=${game.turnIndex}`);
    broadcastGameState(code);
  });

  // ── declare_hand ─────────────────────────────────────────────────────────────
  // payload: { code, cardId }  — cardId is the card sent to the finish slot.
  socket.on('declare_hand', ({ code, cardId }) => {
    const game = games[code];
    if (!game || game.state !== 'playing') { socket.emit('game_error', { message: 'Game not active.' }); return; }

    const turnIndex = game.turnIndex;
    const currentPlayer = game.players[turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'Not your turn.' });
      return;
    }
    if (!game.hasDrawn) { socket.emit('game_error', { message: 'Draw a card before declaring.' }); return; }

    const hand = game.hands[socket.id];
    const finishIdx = hand.findIndex((c) => c.id === cardId);
    if (finishIdx === -1) { socket.emit('game_error', { message: 'Finish card not in hand.' }); return; }

    // Move finish card to discard pile, leaving 13 to validate.
    const [finishCard] = hand.splice(finishIdx, 1);
    game.discardPile.push(finishCard);
    game.hasDrawn = false;

    const verdict = getDeclarationVerdict(hand, game.wildJoker?.rank);
    game.declareValid = !!verdict.valid;

    console.log(`[declare_hand] socket.id=${socket.id} valid=${game.declareValid} reason=${verdict.reason || ''}`);
    concludeRound(code, { declarerIndex: turnIndex, valid: game.declareValid, type: 'declare' });
  });

  // ── drop_game ────────────────────────────────────────────────────────────────
  socket.on('drop_game', ({ code }) => {
    const game = games[code];
    if (!game || game.state !== 'playing') { socket.emit('game_error', { message: 'Game not active.' }); return; }

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'You can only drop on your turn.' });
      return;
    }

    const pts = game.hasDrawn ? 40 : 20; // middle drop vs first drop
    const pid = currentPlayer.playerId;
    game.dropped[pid] = true;
    game.scores[pid] = (game.scores[pid] || 0) + pts;
    if (game.scores[pid] >= 101) game.eliminated[pid] = true;
    game.hasDrawn = false;

    console.log(`[drop_game] socket.id=${socket.id} pts=${pts} total=${game.scores[pid]}`);

    // If only one player remains in the round, they win it automatically.
    const remaining = inRoundPlayers(game);
    if (remaining.length <= 1) {
      concludeRound(code, { type: 'laststanding' });
      return;
    }

    game.turnIndex = nextActiveTurn(game, game.turnIndex);
    broadcastGameState(code);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] socket.id=${socket.id}`);

    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const wasInRoom = room.players.some((p) => p.id === socket.id);
      if (!wasInRoom) continue;

      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[code];
        delete games[code];
        console.log(`[cleanup] room "${code}" deleted (empty)`);
        continue;
      }
      if (room.host === socket.id) {
        room.host = room.players[0].id;
        io.to(code).emit('host_changed', { code, newHost: room.host });
      }
      io.to(code).emit('room_update', { code, players: room.players });
    }

    for (const code of Object.keys(games)) {
      const game = games[code];
      const removedIndex = game.players.findIndex((p) => p.id === socket.id);
      if (removedIndex === -1) continue;

      const removed = game.players[removedIndex];
      game.players.splice(removedIndex, 1);
      delete game.hands[socket.id];

      if (game.players.length === 0) {
        delete games[code];
        console.log(`[cleanup] game "${code}" deleted (no players)`);
        continue;
      }
      if (removedIndex < game.turnIndex) game.turnIndex -= 1;
      if (game.turnIndex >= game.players.length) game.turnIndex = 0;
      // If the disconnect leaves a single active player, end the round.
      if (game.state === 'playing' && inRoundPlayers(game).length <= 1) {
        concludeRound(code, { type: 'laststanding' });
        continue;
      }
      broadcastGameState(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Rummy server running on port ${PORT}`);
});

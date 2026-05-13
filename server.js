import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ── Room store ─────────────────────────────────────────────────────────────
// { roomCode: { host: socketId, players: [{ id, name }] } }
const rooms = {};

// ── Game store ─────────────────────────────────────────────────────────────
// { roomCode: { players, deck, hands, discardPile, turnIndex, state } }
const games = {};

// ── Deck helpers ───────────────────────────────────────────────────────────
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit });
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Personalised snapshot — each player only sees their own hand.
function buildSnapshot(game, forSocketId) {
  const playerMeta = game.players.map((p) => ({
    id:       p.id,
    name:     p.name,
    handSize: (game.hands[p.id] || []).length,
    // Only the requesting socket gets their full hand
    hand:     p.id === forSocketId ? (game.hands[p.id] || []) : undefined,
  }));

  return {
    players:     playerMeta,
    hand:        game.hands[forSocketId] || [],   // convenience top-level field
    discardPile: game.discardPile,
    deckSize:    game.deck.length,
    turnIndex:   game.turnIndex,
    currentTurn: game.players[game.turnIndex]?.id ?? null,
    state:       game.state,
  };
}

// Emit personalised game_state to every player in the room.
function broadcastGameState(code) {
  const game = games[code];
  if (!game) return;
  for (const player of game.players) {
    const snapshot = buildSnapshot(game, player.id);
    io.to(player.id).emit('game_state', { code, ...snapshot });
  }
}

// ── Health check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Rummy server running');
});

// ── Socket events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect]    socket.id=${socket.id}`);

  // ── register_room ──────────────────────────────────────────────────────────
  socket.on('register_room', ({ code, playerName }) => {
    if (!code) return;

    console.log('REGISTER RECEIVED:', code);

    rooms[code] = {
      host:    socket.id,
      players: [{ id: socket.id, name: playerName || 'Host' }],
    };

    socket.join(code);
    console.log(`[register_room] SERVER SOCKET ID: ${socket.id} code="${code}" name="${playerName}"`);
    console.log('Rooms after register:', Object.keys(rooms));

    socket.emit('room_registered', { code });
    io.to(code).emit('room_update', { code, players: rooms[code].players });
  });

  // ── validate_room ──────────────────────────────────────────────────────────
  socket.on('validate_room', ({ code }) => {
    const valid = !!(code && rooms[code]);
    console.log(`[validate_room] code="${code}" valid=${valid}`);
    socket.emit('room_validated', { code, valid });
  });

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, playerName }) => {
    if (!code || !rooms[code]) {
      socket.emit('room_error', { message: 'Room not found.' });
      return;
    }

    const alreadyIn = rooms[code].players.some((p) => p.id === socket.id);
    if (!alreadyIn) {
      rooms[code].players.push({ id: socket.id, name: playerName || 'Player' });
      socket.join(code);
      console.log(`[join_room]  socket.id=${socket.id} name="${playerName}" code="${code}"`);
    }

    console.log('Rooms:', Object.keys(rooms));
    io.to(code).emit('room_update', { code, players: rooms[code].players });
  });

  // ── start_game ─────────────────────────────────────────────────────────────
  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room) { socket.emit('game_error', { message: 'Room not found.' }); return; }
    if (room.host !== socket.id) { socket.emit('game_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 2) { socket.emit('game_error', { message: 'Need at least 2 players.' }); return; }

    const deck = shuffle(buildDeck());
    const players = room.players;
    const hands = {};
    let cursor = 0;

    for (const player of players) {
      hands[player.id] = deck.slice(cursor, cursor + 13);
      cursor += 13;
    }

    const remaining = deck.slice(cursor);
    const firstDiscard = remaining.shift();

    games[code] = {
      players,
      deck:        remaining,
      hands,
      discardPile: firstDiscard ? [firstDiscard] : [],
      turnIndex:   0,
      state:       'playing',
    };

    console.log(`[start_game] code="${code}" players=${players.length}`);
    broadcastGameState(code);
  });

  // ── draw_card ──────────────────────────────────────────────────────────────
  socket.on('draw_card', ({ code }) => {
    const game = games[code];
    if (!game) { socket.emit('game_error', { message: 'Game not found.' }); return; }

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'Not your turn.' });
      return;
    }

    if (game.deck.length === 0) {
      const top = game.discardPile.pop();
      game.deck = shuffle(game.discardPile);
      game.discardPile = top ? [top] : [];
    }

    const card = game.deck.shift();
    if (!card) { socket.emit('game_error', { message: 'No cards left.' }); return; }

    game.hands[socket.id].push(card);
    console.log(`[draw_card]  socket.id=${socket.id} card=${card.id} code="${code}"`);
    broadcastGameState(code);
  });

  // ── discard_card ───────────────────────────────────────────────────────────
  socket.on('discard_card', ({ code, cardId }) => {
    const game = games[code];
    if (!game) { socket.emit('game_error', { message: 'Game not found.' }); return; }

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('game_error', { message: 'Not your turn.' });
      return;
    }

    const hand = game.hands[socket.id];
    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) { socket.emit('game_error', { message: 'Card not in hand.' }); return; }

    const [card] = hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    game.turnIndex = (game.turnIndex + 1) % game.players.length;

    console.log(`[discard_card] socket.id=${socket.id} card=${card.id} nextTurn=${game.turnIndex}`);
    broadcastGameState(code);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] socket.id=${socket.id}`);

    // ── Room cleanup with host migration ──────────────────────────────────────
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const wasInRoom = room.players.some((p) => p.id === socket.id);
      if (!wasInRoom) continue;

      // Remove the player
      room.players = room.players.filter((p) => p.id !== socket.id);

      // No players left → delete room and game
      if (room.players.length === 0) {
        delete rooms[code];
        delete games[code];
        console.log(`[cleanup] room "${code}" deleted (empty)`);
        continue;
      }

      // Host left → migrate to next player, game continues
      if (room.host === socket.id) {
        room.host = room.players[0].id;
        io.to(code).emit('host_changed', { code, newHost: room.host });
        console.log(`[cleanup] host migrated for room "${code}" → ${room.host}`);
      }

      io.to(code).emit('room_update', { code, players: room.players });
    }

    // ── Game cleanup — keep game alive, fix turn index ────────────────────────
    for (const code of Object.keys(games)) {
      const game = games[code];
      const removedIndex = game.players.findIndex((p) => p.id === socket.id);
      if (removedIndex === -1) continue;

      game.players.splice(removedIndex, 1);
      delete game.hands[socket.id];

      if (game.players.length === 0) {
        delete games[code];
        console.log(`[cleanup] game "${code}" deleted (no players)`);
        continue;
      }

      // Fix turnIndex precisely per spec:
      // - removed player was before current turn → shift index back by 1
      // - removed player was the current turn → clamp to valid range
      if (removedIndex < game.turnIndex) {
        game.turnIndex -= 1;
      }
      if (game.turnIndex >= game.players.length) {
        game.turnIndex = 0;
      }

      broadcastGameState(code);
      console.log(`[cleanup] player removed from game "${code}", turnIndex=${game.turnIndex}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Rummy server running on port ${PORT}`);
});

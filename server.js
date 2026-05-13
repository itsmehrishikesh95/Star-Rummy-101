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

// In-memory room store: { roomId: [{ id: socketId, name: playerName }] }
const rooms = {};

// Health check
app.get('/', (req, res) => {
  res.send('Rummy server running');
});

io.on('connection', (socket) => {
  console.log(`[connect]    socket.id=${socket.id}`);

  // join_room: { roomId: string, playerName: string }
  socket.on('join_room', ({ roomId, playerName }) => {
    if (!roomId || !playerName) return;

    // Ensure room array exists
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Prevent duplicate players (same socket id)
    const alreadyIn = rooms[roomId].some((p) => p.id === socket.id);
    if (!alreadyIn) {
      rooms[roomId].push({ id: socket.id, name: playerName });
      socket.join(roomId);
      console.log(`[join_room]  socket.id=${socket.id} name="${playerName}" room="${roomId}"`);
    }

    // Broadcast updated player list to everyone in the room
    io.to(roomId).emit('room_update', { roomId, players: rooms[roomId] });
    console.log(`[room_state] room="${roomId}" players=${JSON.stringify(rooms[roomId])}`);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] socket.id=${socket.id}`);

    // Remove player from all rooms they were in
    for (const roomId of Object.keys(rooms)) {
      const before = rooms[roomId].length;
      rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id);

      if (rooms[roomId].length !== before) {
        // Notify remaining players
        io.to(roomId).emit('room_update', { roomId, players: rooms[roomId] });

        // Clean up empty rooms
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Rummy server running on port ${PORT}`);
});

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// Removed broken imports
// import { createTileBag, drawTiles } from '../../ScrabbleReactVite/src/components/bag.jsx';
// import { specialTileLayouts } from '../src/specialTileLayouts.js';
// import userRoutes from '../../src/routes/userRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// If you later re-add API routes:
// app.use('/api/users', userRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const players = new Map();
const games = new Map();

io.use((socket, next) => {
  const { userId, username, isGuest, playerNumber, isHost, tabId, roomId } = socket.handshake.auth;

  socket.auth = {
    userId,
    username,
    isGuest,
    playerNumber,
    isHost,
    tabId,
    roomId
  };

  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.auth);

  socket.on('create-game', ({ roomId }) => {
    players.set(socket.id, {
      ...socket.auth,
      roomId,
      playerNumber: 1,
      isHost: true
    });

    socket.join(roomId);
    socket.emit('game-created', { roomId });
  });

  socket.on('join-game', ({ roomId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const hostSocket = Array.from(room).find(id => {
      const player = players.get(id);
      return player && player.isHost;
    });

    if (!hostSocket) {
      socket.emit('error', { message: 'Host not found' });
      return;
    }

    players.set(socket.id, {
      ...socket.auth,
      roomId,
      playerNumber: 2,
      isHost: false
    });

    socket.join(roomId);
    io.to(roomId).emit('player-joined', {
      players: Array.from(room).map(id => players.get(id))
    });
  });

  socket.on('start-game', ({ roomId, starterId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    const roomPlayers = Array.from(room).map(id => ({
      socketId: id,
      ...players.get(id)
    }));

    roomPlayers.sort((a, b) => a.playerNumber - b.playerNumber);

    // ✅ Dummy tile bag
    const bag = Array.from({ length: 100 }, (_, i) => `T${i}`);

    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    const player1Rack = bag.slice(0, 7);
    const player2Rack = bag.slice(7, 14);
    const remainingBag = bag.slice(14);

    const randomLayout = 'default'; // ✅ fallback layout

    const initialGameState = {
      players: roomPlayers.map((p, index) => ({
        username: p.username,
        userId: p.userId,
        isGuest: p.isGuest,
        playerNumber: p.playerNumber,
        isHost: p.isHost,
        rack: index === 0 ? player1Rack : player2Rack,
        score: 0
      })),
      bag: remainingBag,
      currentPlayerIndex: 0,
      boardTiles: Array(15).fill(null).map(() => Array(15).fill(null)),
      activeLayout: randomLayout
    };

    games.set(roomId, initialGameState);
    io.to(roomId).emit('game-start', initialGameState);
  });

  socket.on('sync-player-info', ({ roomId, playerNumber, isHost }) => {
    players.set(socket.id, {
      ...socket.auth,
      roomId,
      playerNumber,
      isHost
    });

    const gameState = games.get(roomId);
    if (gameState) {
      socket.emit('sync-game-state', gameState);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.auth);
    players.delete(socket.id);
  });
});

// Optional route to serve frontend index.html for SPA
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

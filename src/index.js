import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import http from 'http';
import { Server } from 'socket.io';
import { specialTileLayouts } from './specialTileLayouts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/guest', guestRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('Scrabble backend is running 🎯');
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://scrabble-react-vite-git-fd-demetre-gadabadzes-projects.vercel.app/",
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // { [roomId]: [{ id, username }] }

io.on('connection', (socket) => {
  console.log('✅ New user connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
  if (!rooms[roomId]) rooms[roomId] = [];
  
  rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);

  if (rooms[roomId].length >= 2) return;

  const player = { id: socket.id, username };
  rooms[roomId].push(player);
  socket.join(roomId);

  // Only the joining player gets yourId
  socket.emit('player-joined', {
    players: rooms[roomId],
    yourId: socket.id,
    roomId
  });

  // Others just get updated player list
  socket.to(roomId).emit('player-joined', {
    players: rooms[roomId],
    yourId: null,
    roomId
  });
});


  socket.on('start-game', ({ roomId, starterId }) => {
    // --- NEW: Use Georgian tile bag from bag.jsx spec ---
    const georgianLetters = [
      { letter: 'ა', points: 1, count: 10 },
      { letter: 'ბ', points: 3, count: 5 },
      { letter: 'გ', points: 2, count: 4 },
      { letter: 'დ', points: 2, count: 6 },
      { letter: 'ე', points: 1, count: 8 },
      { letter: 'ვ', points: 4, count: 3 },
      { letter: 'ზ', points: 4, count: 3 },
      { letter: 'თ', points: 3, count: 5 },
      { letter: 'ი', points: 1, count: 10 },
      { letter: 'კ', points: 5, count: 2 },
      { letter: 'ლ', points: 2, count: 6 },
      { letter: 'მ', points: 3, count: 5 },
      { letter: 'ნ', points: 1, count: 8 },
      { letter: 'ო', points: 1, count: 8 },
      { letter: 'პ', points: 4, count: 3 },
      { letter: 'ჟ', points: 8, count: 1 },
      { letter: 'რ', points: 2, count: 6 },
      { letter: 'ს', points: 1, count: 8 },
      { letter: 'ტ', points: 3, count: 5 },
      { letter: 'უ', points: 1, count: 7 },
      { letter: 'ფ', points: 5, count: 2 },
      { letter: 'ქ', points: 4, count: 3 },
      { letter: 'ღ', points: 6, count: 2 },
      { letter: 'ყ', points: 7, count: 1 },
      { letter: 'შ', points: 4, count: 2 },
      { letter: 'ჩ', points: 4, count: 2 },
      { letter: 'ც', points: 3, count: 2 },
      { letter: 'ძ', points: 7, count: 1 },
      { letter: 'წ', points: 6, count: 2 },
      { letter: 'ჭ', points: 6, count: 2 },
      { letter: 'ხ', points: 3, count: 2 },
      { letter: 'ჯ', points: 5, count: 2 },
      { letter: 'ჰ', points: 10, count: 2 },
      { letter: '*', points: 0, count: 3 }, // Joker tiles
    ];
    const bag = [];
    georgianLetters.forEach(({ letter, points, count }) => {
      for (let i = 0; i < count; i++) {
        bag.push({ letter, points });
      }
    });
    // Shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (!rooms[roomId] || rooms[roomId].length < 2) return;

const fullBag = [...bag];
const playersWithRack = rooms[roomId].slice(0, 2).map((player, idx) => {
  const rack = fullBag.splice(0, 7);
  return {
    id: player.id,
    username: player.username,
    rack
  };
});

// Choose a random layout for the game
const layoutKeys = Object.keys(specialTileLayouts);
const randomLayout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];

console.log(`🎲 Chosen random layout: ${randomLayout} (from ${layoutKeys.join(', ')})`);

io.to(roomId).emit('game-start', {
  roomId,
  starterId,
  players: playersWithRack,
  bag: fullBag,
  currentPlayerIndex: 0,
  activeLayout: randomLayout
});


  });

  socket.on('play-word', ({ roomId, gameState }) => {
    console.log(`📤 Player ${socket.id} played in room ${roomId}`);
    console.log('Game state:', gameState);
    io.to(roomId).emit('opponent-played', gameState);
    setTimeout(() => {
      io.to(roomId).emit('sync-game-state', gameState);
    }, 100);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.findIndex(player => player.id === socket.id);
      if (index !== -1) {
        room.splice(index, 1);
        if (room.length === 0) {
          delete rooms[roomId];
          console.log(`🧹 Room ${roomId} deleted (empty).`);
        } else {
          io.to(roomId).emit('player-joined', {
            players: room,
            yourId: null,
          });
        }
      }
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

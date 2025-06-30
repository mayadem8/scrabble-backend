import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
//import { createTileBag, drawTiles } from '../../ScrabbleReactVite/src/components/bag.jsx'; // Adjust the import path as needed
//import { specialTileLayouts } from '../src/specialTileLayouts.js';
//import userRoutes from '../../src/routes/userRoutes.js'; // Import userRoutes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from React build FIRST
app.use(express.static(path.join(__dirname, 'dist')));

// Add API routes here if you have any
app.use('/api/users', userRoutes); // Register userRoutes

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const players = new Map(); // Map to track player info by socket ID
const games = new Map();   // Map to track game states

io.use((socket, next) => {
  const { userId, username, isGuest, playerNumber, isHost, tabId, roomId } = socket.handshake.auth;
  
  // Attach auth info to socket for later use
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
    // Store host's info
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

    // Get host's socket
    const hostSocket = Array.from(room).find(id => {
      const player = players.get(id);
      return player && player.isHost;
    });

    if (!hostSocket) {
      socket.emit('error', { message: 'Host not found' });
      return;
    }

    // Store joining player's info
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

    // Get all players in room with their info
    const roomPlayers = Array.from(room).map(id => ({
      socketId: id,
      ...players.get(id)
    }));

    // Sort by player number to preserve order
    roomPlayers.sort((a, b) => a.playerNumber - b.playerNumber);

    // Create initial tile bag with jokers
    const bag = createTileBag();
    
    // Shuffle the bag
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    // Deal initial racks
    const player1Rack = bag.slice(0, 7);
    const player2Rack = bag.slice(7, 14);
    const remainingBag = bag.slice(14);

    // Randomly select a board layout
    const layoutKeys = Object.keys(specialTileLayouts);
    const randomLayout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];

    // Create initial game state with correct player order
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
    // Update player info in our tracking
    players.set(socket.id, {
      ...socket.auth,
      roomId,
      playerNumber,
      isHost
    });

    // If game exists, sync the game state
    const gameState = games.get(roomId);
    if (gameState) {
      socket.emit('sync-game-state', gameState);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.auth);
    // Clean up player tracking
    players.delete(socket.id);
  });
});

// Uncomment and update if you want to serve index.html for all routes
// app.get('*', (req, res) => {
//   try {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//   } catch (error) {
//     console.error('Error serving index.html:', error);
//     res.status(500).send('Server Error');
//   }
// });

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

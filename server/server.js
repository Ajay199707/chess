const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: ['http://localhost:5173', 'https://ajay199707.github.io'],
  methods: ['GET', 'POST'],
  credentials: true 
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, { cors: corsOptions });
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_prod';
const MONGO_URI = process.env.MONGO_URI;

// --- MONGODB CONNECTION & SCHEMAS ---
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
} else {
  console.log('⚠️ No MONGO_URI found. Starting without persistent database.');
}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  passwordHash: String,
  elo: { type: Number, default: 1200 }
});
const User = mongoose.model('User', userSchema);

const matchSchema = new mongoose.Schema({
  roomId: String,
  whiteEmail: String,
  whiteName: String,
  blackEmail: String,
  blackName: String,
  result: String,
  reason: String,
  pgn: String,
  createdAt: { type: Date, default: Date.now }
});
const Match = mongoose.model('Match', matchSchema);


// --- IN-MEMORY STATE (for active fast-paced gameplay) ---
const rooms = new Map(); 
const lobbies = new Set();
// --------------------

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id);

  // --- Auth Handlers ---
  socket.on('register', async ({ name, email, password }) => {
    try {
      if (!name || !email || !password) return socket.emit('auth_response', { success: false, message: 'Missing fields' });
      
      const existingUser = await User.findOne({ email });
      if (existingUser) return socket.emit('auth_response', { success: false, message: 'Email already exists' });
      
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await User.create({ email, name, passwordHash, elo: 1200 });
      
      socket.user = newUser; 
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.emit('auth_response', { 
        success: true, 
        name, email, stats: { elo: 1200 }, 
        token 
      });
    } catch(err) {
      socket.emit('auth_response', { success: false, message: 'Server error during registration' });
    }
  });

  socket.on('login', async ({ email, password }) => {
    try {
      const user = await User.findOne({ email });
      if (!user) return socket.emit('auth_response', { success: false, message: 'Invalid credentials' });
      
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return socket.emit('auth_response', { success: false, message: 'Invalid credentials' });
      
      socket.user = user; 
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.emit('auth_response', { 
        success: true, 
        name: user.name, email: user.email, stats: { elo: user.elo }, 
        token 
      });
    } catch(err) {
      socket.emit('auth_response', { success: false, message: 'Server error during login' });
    }
  });

  socket.on('google_login', async ({ credential }) => {
    try {
      const decoded = jwt.decode(credential);
      if (!decoded || !decoded.email) {
        return socket.emit('auth_response', { success: false, message: 'Invalid Google token' });
      }
      
      const email = decoded.email;
      const name = decoded.name || 'Google User';
      
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, name, passwordHash: 'GOOGLE_AUTH', elo: 1200 });
      }
      
      socket.user = user;
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.emit('auth_response', { 
        success: true, 
        name: user.name, 
        email: user.email, 
        stats: { elo: user.elo }, 
        token 
      });
    } catch (e) {
      socket.emit('auth_response', { success: false, message: 'Google login error' });
    }
  });

  socket.on('verify_session', async ({ email, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.email === email) {
        const user = await User.findOne({ email });
        if (user) {
          socket.user = user;
          return socket.emit('session_verified', { success: true });
        }
      }
      socket.emit('session_verified', { success: false });
    } catch(e) {
      socket.emit('session_verified', { success: false });
    }
  });

  // --- Protected Endpoints ---
  socket.use((packet, next) => {
    const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect', 'request_leaderboard', 'request_match_history'];
    if (publicEvents.includes(packet[0])) return next();
    if (!socket.user) return next(new Error('Unauthorized'));
    next();
  });

  // Helper to parse time controls
  const getInitialSeconds = (tc) => {
    switch (tc) {
      case 'bullet': return 60;
      case 'blitz3': return 180;
      case 'blitz5': return 300;
      case 'rapid10': return 600;
      case 'casual': default: return 0;
    }
  };

  // Helper to broadcast room state
  const broadcastRoomUpdate = (room, roomId) => {
    io.to(roomId).emit('room_update', {
      gameState: {
        fen: room.chess.fen(),
        history: room.chess.history(),
        status: room.status,
        winner: room.winner || null,
        lastMove: room.lastMove || null,
        timeControl: room.timeControl,
        clocks: room.clocks
      },
      players: room.players
    });
  };

  socket.on('join_room', ({ roomId, name, timeControl }) => {
    let room = rooms.get(roomId);
    
    if (!room) {
      // Create new room
      const initialSeconds = getInitialSeconds(timeControl);
      room = {
        id: roomId,
        chess: new Chess(),
        players: { w: socket.user.email, b: null },
        playerNames: { w: name, b: null },
        spectators: [],
        status: 'waiting',
        timeControl: timeControl,
        clocks: { white: initialSeconds, black: initialSeconds },
        lastMoveTimestamp: null
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('role_assigned', { color: 'white', isSpectator: false });
    } else {
      socket.join(roomId);
      if (!room.players.b && room.players.w !== socket.user.email) {
        room.players.b = socket.user.email;
        room.playerNames.b = name;
        room.status = 'playing';
        room.lastMoveTimestamp = Date.now();
        socket.emit('role_assigned', { color: 'black', isSpectator: false });
      } else if (room.players.w === socket.user.email) {
        socket.emit('role_assigned', { color: 'white', isSpectator: false });
      } else if (room.players.b === socket.user.email) {
        socket.emit('role_assigned', { color: 'black', isSpectator: false });
      } else {
        room.spectators.push(socket.user.email);
        socket.emit('role_assigned', { color: null, isSpectator: true });
      }
    }
    broadcastRoomUpdate(room, roomId);
  });

  socket.on('enter_lobby', () => {
    const lobbyArr = Array.from(lobbies);
    const opponent = lobbyArr.find(s => s.id !== socket.id);
    
    if (opponent) {
      lobbies.delete(opponent);
      const roomId = `room_${Date.now()}`;
      
      const tc = 'blitz5';
      const initialSeconds = getInitialSeconds(tc);
      const room = {
        id: roomId,
        chess: new Chess(),
        players: { w: socket.user.email, b: opponent.user.email },
        playerNames: { w: socket.user.name, b: opponent.user.name },
        spectators: [],
        status: 'playing',
        timeControl: tc,
        clocks: { white: initialSeconds, black: initialSeconds },
        lastMoveTimestamp: Date.now()
      };
      rooms.set(roomId, room);

      socket.join(roomId);
      opponent.join(roomId);
      socket.emit('role_assigned', { color: 'white', isSpectator: false });
      opponent.emit('role_assigned', { color: 'black', isSpectator: false });
      
      // Let frontend redirect to game
      socket.emit('challenge_accepted', { roomId, timeControl: tc });
      opponent.emit('challenge_accepted', { roomId, timeControl: tc });
    } else {
      lobbies.add(socket);
    }
  });

  socket.on('make_move', async (data) => {
    const { roomCode, move } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    const turnColor = room.chess.turn();
    const expectedEmail = turnColor === 'w' ? room.players.w : room.players.b;
    
    if (socket.user.email !== expectedEmail) return socket.emit('error', 'Not your turn');

    try {
      // Calculate time spent
      const now = Date.now();
      if (room.timeControl !== 'casual' && room.lastMoveTimestamp) {
        const elapsedSeconds = Math.floor((now - room.lastMoveTimestamp) / 1000);
        const playerClock = turnColor === 'w' ? 'white' : 'black';
        room.clocks[playerClock] = Math.max(0, room.clocks[playerClock] - elapsedSeconds);
        
        if (room.clocks[playerClock] === 0) {
          return handleGameOver(room, roomCode, 'timeout');
        }
      }

      const result = room.chess.move(move);
      if (result) {
        room.lastMove = result;
        room.lastMoveTimestamp = Date.now();

        if (room.chess.isGameOver()) {
          if (room.chess.isCheckmate()) {
            await handleGameOver(room, roomCode, 'checkmate');
          } else {
            await handleGameOver(room, roomCode, 'draw'); // stalemate/etc
          }
        } else {
          broadcastRoomUpdate(room, roomCode);
        }
      }
    } catch (err) {
      // Invalid move
    }
  });

  async function handleGameOver(room, roomCode, reason) {
    room.status = reason === 'timeout' || reason === 'checkmate' ? reason : 'draw';
    
    if (reason === 'timeout' || reason === 'checkmate') {
      const loserColor = room.chess.turn();
      room.winner = loserColor === 'w' ? 'b' : 'w';
    } else {
      room.winner = null;
    }

    // Save to DB and adjust ELO
    if (room.winner) {
      const winnerEmail = room.winner === 'w' ? room.players.w : room.players.b;
      const loserEmail = room.winner === 'w' ? room.players.b : room.players.w;
      try {
        await User.updateOne({ email: winnerEmail }, { $inc: { elo: 25 } });
        await User.updateOne({ email: loserEmail }, { $inc: { elo: -25 } });
      } catch (e) {}
    }

    try {
      const whiteUser = await User.findOne({ email: room.players.w });
      const blackUser = await User.findOne({ email: room.players.b });
      
      const result = room.winner === 'w' ? 'white' : room.winner === 'b' ? 'black' : 'draw';
      
      await Match.create({
        roomId: roomCode,
        whiteEmail: room.players.w,
        whiteName: whiteUser ? whiteUser.name : 'Unknown',
        blackEmail: room.players.b,
        blackName: blackUser ? blackUser.name : 'Unknown',
        result,
        reason,
        pgn: room.chess.pgn()
      });
    } catch(err) {
      console.error('Failed to save match history', err);
    }
    
    broadcastRoomUpdate(room, roomCode);
  }

  socket.on('chat_message', (data) => {
    const { roomCode, message } = data;
    io.to(roomCode).emit('chat_message', {
      sender: socket.user.name, 
      text: message.trim(),
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    lobbies.delete(socket);
  });
});

// Server-side clock tick interval (Anti-Cheat Timer Enforcement)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.status === 'playing' && room.timeControl !== 'casual' && room.lastMoveTimestamp) {
      const turnColor = room.chess.turn();
      const playerClock = turnColor === 'w' ? 'white' : 'black';
      
      const elapsedSeconds = Math.floor((now - room.lastMoveTimestamp) / 1000);
      const remainingTime = Math.max(0, room.clocks[playerClock] - elapsedSeconds);
      
      if (remainingTime === 0) {
        room.clocks[playerClock] = 0;
        handleGameOver(room, roomId, 'timeout');
      }
    }
  }
}, 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Secure Server running on http://localhost:${PORT}`);
});

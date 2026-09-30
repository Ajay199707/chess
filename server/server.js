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
    const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect', 'request_leaderboard'];
    if (publicEvents.includes(packet[0])) return next();
    if (!socket.user) return next(new Error('Unauthorized'));
    next();
  });

  
  socket.on('request_leaderboard', async () => {
    try {
      // Find top 10 players sorted by ELO descending
      const topPlayers = await User.find({}, 'name elo').sort({ elo: -1 }).limit(10);
      socket.emit('leaderboard_data', topPlayers);
    } catch (e) {
      console.error('Leaderboard error', e);
    }
  });

  
  socket.on('request_match_history', async () => {
    try {
      const email = socket.user.email;
      const matches = await Match.find({
        $or: [{ whiteEmail: email }, { blackEmail: email }]
      }).sort({ createdAt: -1 }).limit(20);
      socket.emit('match_history_data', matches);
    } catch (e) {
      console.error('Match history error', e);
    }
  });

  socket.on('enter_lobby', () => {
    const lobbyArr = Array.from(lobbies);
    const opponent = lobbyArr.find(s => s.id !== socket.id);
    
    if (opponent) {
      lobbies.delete(opponent);
      const roomId = `room_${Date.now()}`;
      
      const game = {
        id: roomId,
        chess: new Chess(),
        players: { w: socket.user.email, b: opponent.user.email },
        status: 'playing'
      };
      rooms.set(roomId, game);

      socket.join(roomId);
      opponent.join(roomId);

      io.to(roomId).emit('match_start', {
        roomCode: roomId,
        playerColor: { [socket.user.email]: 'w', [opponent.user.email]: 'b' },
        fen: game.chess.fen(),
        history: game.chess.history()
      });
    } else {
      lobbies.add(socket);
    }
  });

  socket.on('make_move', async (data) => {
    const { roomCode, move } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    const turnColor = room.chess.turn();
    const expectedEmail = room.players[turnColor];
    
    if (socket.user.email !== expectedEmail) return socket.emit('error', 'Not your turn');

    try {
      const result = room.chess.move(move);
      if (result) {
        io.to(roomCode).emit('board_update', {
          fen: room.chess.fen(),
          history: room.chess.history(),
          lastMove: result
        });

        if (room.chess.isGameOver()) {
          room.status = 'completed';
          let winner = null;
          let result = 'draw';
          let reason = 'draw';

          if (room.chess.isCheckmate()) {
            winner = room.chess.turn() === 'w' ? 'b' : 'w';
            result = winner === 'w' ? 'white' : 'black';
            reason = 'checkmate';
            
            const winnerEmail = room.players[winner];
            const loserEmail = room.players[winner === 'w' ? 'b' : 'w'];
            await User.updateOne({ email: winnerEmail }, { $inc: { elo: 25 } });
            await User.updateOne({ email: loserEmail }, { $inc: { elo: -25 } });
          } else if (room.chess.isStalemate()) {
            reason = 'stalemate';
          } else if (room.chess.isThreefoldRepetition()) {
            reason = 'repetition';
          } else if (room.chess.isInsufficientMaterial()) {
            reason = 'insufficient';
          } else if (room.chess.isDraw()) {
            reason = '50-move';
          }

          try {
            const whiteUser = await User.findOne({ email: room.players.w });
            const blackUser = await User.findOne({ email: room.players.b });

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

          io.to(roomCode).emit('game_over', { reason, winner });
        }
      }
    } catch (err) {
      // Ignore invalid move
    }
  });

  socket.on('chat_message', (data) => {
    const { roomCode, message } = data;
    if (typeof message !== 'string' || message.length > 200) return;

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

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Secure Server running on http://localhost:${PORT}`);
});

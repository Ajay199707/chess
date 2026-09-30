const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);

// CORS configuration (Fixes Vuln #5)
const corsOptions = {
  origin: ['http://localhost:5173', 'https://ajay199707.github.io'],
  methods: ['GET', 'POST'],
  credentials: true 
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const io = new Server(server, { cors: corsOptions });
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_replace_in_prod';

// --- IN-MEMORY DB ---
const users = new Map(); 
const rooms = new Map(); 
const feedbacks = [];
const lobbies = new Set();
// --------------------

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id);

  // --- Auth Handlers ---
  socket.on('register', async ({ name, email, password }) => {
    if (!name || !email || !password) return socket.emit('auth_response', { success: false, message: 'Missing fields' });
    if (users.has(email)) return socket.emit('auth_response', { success: false, message: 'Email already exists' });
    
    const passwordHash = await bcrypt.hash(password, 10); // Fixes Vuln #2
    const newUser = { email, name, passwordHash, elo: 1200 };
    users.set(email, newUser);
    
    socket.user = newUser; // Attach identity to socket (Fixes Vuln #1)
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    
    socket.emit('auth_response', { 
      success: true, 
      name, email, stats: { elo: 1200 }, 
      token 
    });
  });

  socket.on('login', async ({ email, password }) => {
    const user = users.get(email);
    if (!user) return socket.emit('auth_response', { success: false, message: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return socket.emit('auth_response', { success: false, message: 'Invalid credentials' });
    
    socket.user = user; // Attach identity to socket
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    
    socket.emit('auth_response', { 
      success: true, 
      name: user.name, email: user.email, stats: { elo: user.elo }, 
      token 
    });
  });

  socket.on('google_login', ({ credential }) => {
    try {
      // Decode the Google JWT to extract user profile
      const decoded = jwt.decode(credential);
      if (!decoded || !decoded.email) {
        return socket.emit('auth_response', { success: false, message: 'Invalid Google token' });
      }
      
      const email = decoded.email;
      const name = decoded.name || 'Google User';
      
      // Auto-register or login
      let user = users.get(email);
      if (!user) {
        user = { email, name, passwordHash: 'GOOGLE_AUTH', elo: 1200 };
        users.set(email, user);
      }
      
      socket.user = user; // Attach identity
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


  // Verify session (for page reload)
  socket.on('verify_session', ({ email, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.email === email && users.has(email)) {
        socket.user = users.get(email);
        socket.emit('session_verified', { success: true });
      } else {
        socket.emit('session_verified', { success: false });
      }
    } catch(e) {
      socket.emit('session_verified', { success: false });
    }
  });

  // --- Protected Endpoints (Only work if socket.user exists) ---
  socket.use((packet, next) => {
    const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect'];
    if (publicEvents.includes(packet[0])) return next();
    if (!socket.user) return next(new Error('Unauthorized'));
    next();
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

  socket.on('make_move', (data) => {
    const { roomCode, move } = data; // ignores fen/history from client
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
          if (room.chess.isCheckmate()) {
            winner = room.chess.turn() === 'w' ? 'b' : 'w';
          }
          io.to(roomCode).emit('game_over', { reason: 'checkmate', winner });
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

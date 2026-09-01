import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from 'chess.js';
import * as db from './server/database.js';
import crypto from 'crypto';

const onlineUsers = new Map(); // socket.id -> { name, email, elo, status: 'lobby' | 'playing' }
const activeChallenges = new Map(); // challengeId -> { challengerEmail, targetEmail, timeControl, challengerSocketId }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Enable CORS and configure socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

import fs from 'fs';

app.get('/api/feedbacks', (req, res) => {
  try {
    const dbFile = path.join(__dirname, 'db.json');
    if (!fs.existsSync(dbFile)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    res.json(data.feedbacks || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files in production if dist exists, otherwise serve a simple API status
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.accepts('html')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
} else {
  app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'chess-socket-server' });
  });
}

// In-memory room store
// roomId -> RoomObject
const rooms = new Map();

// Timer trackers for timeouts: roomId -> TimeoutObject
const roomTimeouts = new Map();

function cleanRoom(roomId) {
  const timeout = roomTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomTimeouts.delete(roomId);
  }
  rooms.delete(roomId);
}

function handleTimeout(roomId, color) {
  const room = rooms.get(roomId);
  if (!room || room.gameState.status !== 'playing') return;

  room.gameState.clocks[color] = 0;
  const winner = color === 'white' ? 'black' : 'white';
  endGameAndSaveStats(room, 'timeout', winner);
  io.to(roomId).emit('room_update', getCleanRoomState(room));
}

function scheduleTimeout(roomId, color, secondsRemaining) {
  // Clear any existing timeout for the room
  const existingTimeout = roomTimeouts.get(roomId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  if (secondsRemaining <= 0) {
    handleTimeout(roomId, color);
    return;
  }

  const timeout = setTimeout(() => {
    handleTimeout(roomId, color);
  }, secondsRemaining * 1000);

  roomTimeouts.set(roomId, timeout);
}

function getCleanRoomState(room) {
  return {
    id: room.id,
    hostSocketId: room.hostSocketId,
    players: {
      white: room.players.white ? { name: room.players.white.name, connected: room.players.white.connected } : null,
      black: room.players.black ? { name: room.players.black.name, connected: room.players.black.connected } : null,
    },
    spectators: room.spectators.map(s => ({ name: s.name })),
    gameState: room.gameState,
  };
}

function broadcastOnlineUsers() {
  const usersList = [];
  onlineUsers.forEach((u) => {
    usersList.push({
      name: u.name,
      email: u.email,
      elo: u.elo,
      status: u.status
    });
  });

  const uniqueUsers = [];
  const seenEmails = new Set();
  for (const user of usersList) {
    if (!seenEmails.has(user.email)) {
      seenEmails.add(user.email);
      uniqueUsers.push(user);
    }
  }

  const activeMatches = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.gameMode === 'online-2p' && room.gameState.status === 'playing') {
      activeMatches.push({
        id: roomId,
        white: room.players.white?.name || 'Waiting...',
        whiteElo: room.players.white?.elo || 1200,
        black: room.players.black?.name || 'Waiting...',
        blackElo: room.players.black?.elo || 1200,
        spectators: room.spectators.length,
      });
    }
  }

  io.emit('online_users_update', {
    users: uniqueUsers,
    totalOnline: uniqueUsers.length,
    activeMatches
  });
}

function endGameAndSaveStats(room, status, winner) {
  room.gameState.status = status;
  room.gameState.winner = winner;

  const existingTimeout = roomTimeouts.get(room.id);
  if (existingTimeout) clearTimeout(existingTimeout);

  const whiteSocketId = room.players.white?.socketId;
  const blackSocketId = room.players.black?.socketId;
  const whiteUser = onlineUsers.get(whiteSocketId);
  const blackUser = onlineUsers.get(blackSocketId);

  if (whiteUser && blackUser) {
    let whiteOutcome = 'draw';
    let blackOutcome = 'draw';
    if (winner === 'white') {
      whiteOutcome = 'win';
      blackOutcome = 'loss';
    } else if (winner === 'black') {
      whiteOutcome = 'loss';
      blackOutcome = 'win';
    }

    const whiteRes = db.recordMatchComplete(whiteUser.email, blackUser.email, whiteOutcome);
    const blackRes = db.recordMatchComplete(blackUser.email, whiteUser.email, blackOutcome);

    if (whiteRes) whiteUser.elo = whiteRes.newElo;
    if (blackRes) blackUser.elo = blackRes.newElo;

    io.to(whiteSocketId).emit('stats_update', { elo: whiteUser.elo });
    io.to(blackSocketId).emit('stats_update', { elo: blackUser.elo });
    
    // Generate PGN and save match record
    try {
      const matchGame = new Chess();
      if (room.gameState.history && Array.isArray(room.gameState.history)) {
        for (const m of room.gameState.history) {
          try { matchGame.move(m); } catch (e) { /* ignore */ }
        }
      }
      
      let pgnResult = '*';
      if (winner === 'white') pgnResult = '1-0';
      else if (winner === 'black') pgnResult = '0-1';
      else if (winner === null) pgnResult = '1/2-1/2';
      
      matchGame.header('White', whiteUser.name, 'Black', blackUser.name, 'Result', pgnResult);
      
      db.saveMatch(
        whiteUser.email, 
        blackUser.email, 
        whiteUser.name, 
        blackUser.name, 
        matchGame.pgn(), 
        winner || 'draw', 
        room.gameState.timeControl
      );
    } catch (e) {
      console.error("Failed to save match history:", e);
    }
  }

  if (whiteUser) whiteUser.status = 'lobby';
  if (blackUser) blackUser.status = 'lobby';
  broadcastOnlineUsers();
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentPlayerColor = null; // 'white', 'black', or null (spectator)
  let currentPlayerName = '';
  let loggedInEmail = null;

  // --- ACCOUNT AUTHENTICATION HANDLERS ---
  socket.on('register', ({ name, email, password }) => {
    const res = db.registerUser(name, email, password);
    if (res.success) {
      loggedInEmail = res.email;
      onlineUsers.set(socket.id, {
        name: res.name,
        email: res.email,
        elo: res.stats.elo,
        status: 'lobby'
      });
      broadcastOnlineUsers();
    }
    socket.emit('auth_response', res);
  });

  socket.on('login', ({ email, password }) => {
    const res = db.loginUser(email, password);
    if (res.success) {
      loggedInEmail = res.email;
      onlineUsers.set(socket.id, {
        name: res.name,
        email: res.email,
        elo: res.stats.elo,
        status: 'lobby'
      });
      broadcastOnlineUsers();
    }
    socket.emit('auth_response', res);
  });

  socket.on('google_login', async ({ credential, clientId }) => {
    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      
      if (payload && payload.email) {
        const res = db.googleLoginUser(payload.email, payload.name || payload.given_name || 'Player');
        if (res.success) {
          loggedInEmail = res.email;
          onlineUsers.set(socket.id, {
            name: res.name,
            email: res.email,
            elo: res.stats.elo,
            status: 'lobby'
          });
          broadcastOnlineUsers();
        }
        socket.emit('auth_response', res);
      } else {
        socket.emit('auth_response', { success: false, message: "Invalid Google token payload" });
      }
    } catch (err) {
      console.error("Google verify error:", err);
      socket.emit('auth_response', { success: false, message: "Google authentication failed" });
    }
  });

  socket.on('verify_session', ({ email, token }) => {
    const res = db.verifySession(email, token);
    if (res.success) {
      loggedInEmail = res.email;
      onlineUsers.set(socket.id, {
        name: res.name,
        email: res.email,
        elo: res.stats.elo,
        status: 'lobby'
      });
      broadcastOnlineUsers();
    }
    socket.emit('session_verified', res);
  });

  socket.on('logout', ({ email, token }) => {
    db.logoutUser(email, token);
    onlineUsers.delete(socket.id);
    loggedInEmail = null;
    broadcastOnlineUsers();
    socket.emit('logged_out');
  });

  socket.on('request_match_history', ({ email }) => {
    if (!email) return;
    const matches = db.getUserMatches(email);
    socket.emit('match_history_data', matches);
  });

  socket.on('submit_feedback', ({ type, rating, message }) => {
    const user = onlineUsers.get(socket.id);
    const name = user ? user.name : 'Guest';
    const email = user ? user.email : 'Anonymous';
    const res = db.saveFeedback(name, email, type, rating, message);
    socket.emit('feedback_response', res);
  });

  socket.on('enter_lobby', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      user.status = 'lobby';
      broadcastOnlineUsers();
    }

    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const isWhite = room.players.white?.socketId === socket.id;
        const isBlack = room.players.black?.socketId === socket.id;

        if (isWhite) {
          room.players.white = null;
        } else if (isBlack) {
          room.players.black = null;
        } else {
          room.spectators = room.spectators.filter(s => s.socketId !== socket.id);
        }

        socket.leave(currentRoomId);

        const noWhite = !room.players.white;
        const noBlack = !room.players.black;
        if (noWhite && noBlack && room.spectators.length === 0) {
          cleanRoom(currentRoomId);
        } else {
          io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
          io.to(currentRoomId).emit('chat_message', {
            sender: 'System',
            text: `${currentPlayerName} has left the room.`,
            isSystem: true,
            timestamp: Date.now(),
          });
        }
      }
      currentRoomId = '';
      currentPlayerColor = null;
    }
  });

  // --- DIRECT PLAY CHALLENGES ---
  socket.on('send_challenge', ({ targetEmail, timeControl }) => {
    const challenger = onlineUsers.get(socket.id);
    if (!challenger) return;

    // Find recipient's active socket
    let targetSocketId = null;
    onlineUsers.forEach((user, sId) => {
      if (user.email === targetEmail.toLowerCase().trim()) {
        targetSocketId = sId;
      }
    });

    if (!targetSocketId) {
      socket.emit('challenge_failed', { message: "Player is no longer online." });
      return;
    }

    const challengeId = crypto.randomBytes(8).toString('hex');
    activeChallenges.set(challengeId, {
      challengerEmail: challenger.email,
      targetEmail: targetEmail.toLowerCase().trim(),
      timeControl,
      challengerSocketId: socket.id
    });

    io.to(targetSocketId).emit('challenge_received', {
      challengerName: challenger.name,
      challengerEmail: challenger.email,
      timeControl,
      challengeId
    });
  });

  socket.on('notify_next_match', ({ targetEmail }) => {
    const challenger = onlineUsers.get(socket.id);
    if (!challenger) return;

    let targetSocketId = null;
    onlineUsers.forEach((user, sId) => {
      if (user.email === targetEmail.toLowerCase().trim()) {
        targetSocketId = sId;
      }
    });

    if (targetSocketId) {
      io.to(targetSocketId).emit('next_match_notification', {
        challengerName: challenger.name,
        challengerEmail: challenger.email
      });
    }
  });

  socket.on('respond_challenge', ({ challengeId, accept }) => {
    const challenge = activeChallenges.get(challengeId);
    if (!challenge) {
      socket.emit('challenge_error', { message: "Challenge expired or invalid." });
      return;
    }

    if (accept) {
      // Create new match room code
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Update statuses to playing
      const challengerUser = onlineUsers.get(challenge.challengerSocketId);
      const targetUser = onlineUsers.get(socket.id);
      if (challengerUser) challengerUser.status = 'playing';
      if (targetUser) targetUser.status = 'playing';
      broadcastOnlineUsers();

      // Notify both players to join the new room
      io.to(challenge.challengerSocketId).emit('challenge_accepted', { roomId, timeControl: challenge.timeControl });
      socket.emit('challenge_accepted', { roomId, timeControl: challenge.timeControl });
    } else {
      io.to(challenge.challengerSocketId).emit('challenge_declined', { message: "Your challenge was declined." });
    }

    activeChallenges.delete(challengeId);
  });

  // Join or Create a room
  socket.on('join_room', ({ roomId, name, timeControl }) => {
    currentPlayerName = name || 'Anonymous';
    currentRoomId = roomId;

    let room = rooms.get(roomId);

    if (!room) {
      // Create new room
      room = {
        id: roomId,
        hostSocketId: socket.id,
        players: {
          white: { socketId: socket.id, name: currentPlayerName, connected: true },
          black: null,
        },
        spectators: [],
        gameState: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          history: [],
          timeControl: timeControl || 'casual',
          clocks: {
            white: getInitialTime(timeControl),
            black: getInitialTime(timeControl),
            lastActive: null,
          },
          status: 'waiting', // 'waiting', 'playing', 'checkmate', 'draw', 'timeout', 'abandoned'
          winner: null,
        },
      };
      currentPlayerColor = 'white';
      rooms.set(roomId, room);
    } else {
      // Join existing room
      if (room.players.white && room.players.white.name === currentPlayerName && !room.players.white.connected) {
        // Reconnection as White
        room.players.white.socketId = socket.id;
        room.players.white.connected = true;
        currentPlayerColor = 'white';
      } else if (room.players.black && room.players.black.name === currentPlayerName && !room.players.black.connected) {
        // Reconnection as Black
        room.players.black.socketId = socket.id;
        room.players.black.connected = true;
        currentPlayerColor = 'black';
      } else if (!room.players.white) {
        room.players.white = { socketId: socket.id, name: currentPlayerName, connected: true };
        currentPlayerColor = 'white';
      } else if (!room.players.black) {
        room.players.black = { socketId: socket.id, name: currentPlayerName, connected: true };
        currentPlayerColor = 'black';
      } else {
        // Spectator
        room.spectators.push({ socketId: socket.id, name: currentPlayerName });
        currentPlayerColor = null; // spectator
      }
    }

    // Cancel any room cleanup timeout
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = null;
    }

    socket.join(roomId);
    socket.emit('role_assigned', { color: currentPlayerColor, isSpectator: currentPlayerColor === null });
    io.to(roomId).emit('room_update', getCleanRoomState(room));

    // Send a system notification in chat
    io.to(roomId).emit('chat_message', {
      sender: 'System',
      text: `${currentPlayerName} has joined as ${currentPlayerColor ? currentPlayerColor.toUpperCase() : 'a SPECTATOR'}.`,
      isSystem: true,
      timestamp: Date.now()
    });
  });

  // Handle color swapping in lobby
  socket.on('select_color', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'waiting') return;

    // Verify caller is a player
    const isWhite = room.players.white?.socketId === socket.id;
    const isBlack = room.players.black?.socketId === socket.id;
    if (!isWhite && !isBlack) return;

    // Swap players in slots
    const temp = room.players.white;
    room.players.white = room.players.black;
    room.players.black = temp;

    // Re-assign roles to respective player socket connections
    if (room.players.white) {
      io.to(room.players.white.socketId).emit('role_assigned', { color: 'white', isSpectator: false });
    }
    if (room.players.black) {
      io.to(room.players.black.socketId).emit('role_assigned', { color: 'black', isSpectator: false });
    }

    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    io.to(currentRoomId).emit('chat_message', {
      sender: 'System',
      text: 'Players swapped colors.',
      isSystem: true,
      timestamp: Date.now()
    });
  });

  // Handle spectator joining as player
  socket.on('join_as_player', ({ color }) => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'waiting') return;

    if (color !== 'white' && color !== 'black') return;
    if (room.players[color]) return; // slot occupied

    // Remove from spectators if present
    room.spectators = room.spectators.filter(s => s.socketId !== socket.id);

    // If currently playing in other slot, vacate it
    const otherColor = color === 'white' ? 'black' : 'white';
    if (room.players[otherColor]?.socketId === socket.id) {
      room.players[otherColor] = null;
    }

    room.players[color] = { socketId: socket.id, name: currentPlayerName, connected: true };
    currentPlayerColor = color;

    socket.emit('role_assigned', { color: currentPlayerColor, isSpectator: false });
    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    io.to(currentRoomId).emit('chat_message', {
      sender: 'System',
      text: `${currentPlayerName} joined as ${color.toUpperCase()}.`,
      isSystem: true,
      timestamp: Date.now()
    });
  });

  // Handle player switching to spectator
  socket.on('switch_to_spectator', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'waiting') return;

    const isWhite = room.players.white?.socketId === socket.id;
    const isBlack = room.players.black?.socketId === socket.id;
    if (!isWhite && !isBlack) return;

    const color = isWhite ? 'white' : 'black';
    room.players[color] = null;

    if (!room.spectators.some(s => s.socketId === socket.id)) {
      room.spectators.push({ socketId: socket.id, name: currentPlayerName });
    }
    currentPlayerColor = null;

    socket.emit('role_assigned', { color: null, isSpectator: true });
    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    io.to(currentRoomId).emit('chat_message', {
      sender: 'System',
      text: `${currentPlayerName} switched to Spectator mode.`,
      isSystem: true,
      timestamp: Date.now()
    });
  });

  // Handle manual game start by host
  socket.on('start_game', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'waiting') return;

    // Only host can start
    if (socket.id !== room.hostSocketId) return;

    // Check both slots filled
    if (!room.players.white || !room.players.black) {
      return;
    }

    room.gameState.status = 'playing';
    room.gameState.clocks.lastActive = Date.now();

    const whiteUser = onlineUsers.get(room.players.white?.socketId);
    const blackUser = onlineUsers.get(room.players.black?.socketId);
    if (whiteUser) whiteUser.status = 'playing';
    if (blackUser) blackUser.status = 'playing';
    broadcastOnlineUsers();

    if (room.gameState.timeControl !== 'casual') {
      scheduleTimeout(currentRoomId, 'white', room.gameState.clocks.white);
    }

    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    io.to(currentRoomId).emit('chat_message', {
      sender: 'System',
      text: '🚀 The match has started! Good luck!',
      isSystem: true,
      timestamp: Date.now()
    });
  });

  // Handle chess move
  socket.on('make_move', ({ move, fen, history }) => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    // Resolve player color dynamically
    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;

    // Check turn
    const isWhiteTurn = room.gameState.fen.split(' ')[1] === 'w';
    if ((isWhiteTurn && role !== 'white') || (!isWhiteTurn && role !== 'black')) {
      return; // Not their turn
    }

    const activeColor = role;
    const nextColor = activeColor === 'white' ? 'black' : 'white';

    // Update game state
    room.gameState.fen = fen;
    room.gameState.history = history;
    room.gameState.lastMove = move; // Store last move for client highlight syncing

    // Calculate time elapsed
    if (room.gameState.timeControl !== 'casual' && room.gameState.clocks.lastActive) {
      const elapsed = Math.round((Date.now() - room.gameState.clocks.lastActive) / 1000);
      room.gameState.clocks[activeColor] = Math.max(0, room.gameState.clocks[activeColor] - elapsed);

      if (room.gameState.clocks[activeColor] <= 0) {
        handleTimeout(currentRoomId, activeColor);
        return;
      }
    }

    // Update active state timestamp
    room.gameState.clocks.lastActive = Date.now();

    // Verify game status using chess.js
    let isGameOver = false;
    try {
      const tempGame = new Chess(fen);
      isGameOver = tempGame.isGameOver();
      if (isGameOver) {
        if (tempGame.isCheckmate()) {
          const winner = tempGame.turn() === 'w' ? 'black' : 'white';
          endGameAndSaveStats(room, 'checkmate', winner);
        } else {
          endGameAndSaveStats(room, 'draw', null);
        }
      }
    } catch (e) {
      console.error("Error checking game over state on server:", e);
    }

    if (!isGameOver) {
      // Schedule next timeout
      if (room.gameState.timeControl !== 'casual') {
        scheduleTimeout(currentRoomId, nextColor, room.gameState.clocks[nextColor]);
      }
    }

    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
  });

  // Global Lobby Chat
  socket.on('send_global_chat', ({ text }) => {
    const user = onlineUsers.get(socket.id);
    const senderName = user ? user.name : (currentPlayerName || 'Anonymous');
    if (!senderName) return;
    io.emit('global_chat_message', {
      sender: senderName,
      text,
      timestamp: Date.now(),
    });
  });

  // Handle room chat messages and emoji reactions
  socket.on('send_chat', ({ text, isReaction }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    
    // Resolve sender tag color dynamically
    let role = null;
    if (room) {
      if (room.players.white?.socketId === socket.id) role = 'white';
      else if (room.players.black?.socketId === socket.id) role = 'black';
    }

    io.to(currentRoomId).emit('chat_message', {
      sender: currentPlayerName,
      color: role,
      text,
      isReaction,
      timestamp: Date.now(),
    });
  });

  // Handle resignation
  socket.on('resign', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;

    const winner = role === 'white' ? 'black' : 'white';
    endGameAndSaveStats(room, 'abandoned', winner);

    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    io.to(currentRoomId).emit('chat_message', {
      sender: 'System',
      text: `${currentPlayerName} (${role.toUpperCase()}) resigned.`,
      isSystem: true,
      timestamp: Date.now(),
    });
  });

  // Handle Draw offers
  socket.on('offer_draw', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;
    socket.to(currentRoomId).emit('draw_offered', { from: role });
  });

  socket.on('draw_response', ({ accept }) => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    if (accept) {
      endGameAndSaveStats(room, 'draw', null);

      io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
      io.to(currentRoomId).emit('chat_message', {
        sender: 'System',
        text: 'Game drawn by agreement.',
        isSystem: true,
        timestamp: Date.now(),
      });
    } else {
      socket.to(currentRoomId).emit('draw_declined');
    }
  });

  // Handle Undo requests
  socket.on('request_undo', () => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;
    socket.to(currentRoomId).emit('undo_requested', { from: role });
  });

  socket.on('undo_response', ({ accept, steps }) => {
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState.status !== 'playing') return;

    if (accept) {
      // Revert history and fen
      socket.to(currentRoomId).emit('undo_accepted', { steps });
      io.to(currentRoomId).emit('chat_message', {
        sender: 'System',
        text: 'Move undone by agreement.',
        isSystem: true,
        timestamp: Date.now(),
      });
    } else {
      socket.to(currentRoomId).emit('undo_declined');
    }
  });

  // Sync board specifically for undo/restart
  socket.on('sync_game', ({ fen, history }) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;

    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;

    room.gameState.fen = fen;
    room.gameState.history = history;
    room.gameState.clocks.lastActive = Date.now();

    if (room.gameState.timeControl !== 'casual') {
      const activeColor = fen.split(' ')[1] === 'w' ? 'white' : 'black';
      scheduleTimeout(currentRoomId, activeColor, room.gameState.clocks[activeColor]);
    }

    io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
  });

  // Handle Restart requests
  socket.on('offer_restart', () => {
    const room = rooms.get(currentRoomId);
    if (!room) return;

    let role = null;
    if (room.players.white?.socketId === socket.id) role = 'white';
    else if (room.players.black?.socketId === socket.id) role = 'black';

    if (!role) return;
    socket.to(currentRoomId).emit('restart_offered', { from: role });
  });

  socket.on('restart_response', ({ accept }) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (accept) {
      // Reset room game state
      room.gameState.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      room.gameState.history = [];
      room.gameState.clocks = {
        white: getInitialTime(room.gameState.timeControl),
        black: getInitialTime(room.gameState.timeControl),
        lastActive: Date.now(),
      };
      room.gameState.status = 'playing';
      room.gameState.winner = null;

      if (room.gameState.timeControl !== 'casual') {
        scheduleTimeout(currentRoomId, 'white', room.gameState.clocks.white);
      }

      io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
      io.to(currentRoomId).emit('chat_message', {
        sender: 'System',
        text: 'Game restarted.',
        isSystem: true,
        timestamp: Date.now(),
      });
    } else {
      socket.to(currentRoomId).emit('restart_declined');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();

    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const isWhite = room.players.white?.socketId === socket.id;
    const isBlack = room.players.black?.socketId === socket.id;

    if (isWhite && room.players.white) {
      room.players.white.connected = false;
      io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
      io.to(currentRoomId).emit('chat_message', {
        sender: 'System',
        text: `${currentPlayerName} (WHITE) disconnected.`,
        isSystem: true,
        timestamp: Date.now(),
      });

      // Start 30-second abandonment timer
      room.cleanupTimeout = setTimeout(() => {
        const r = rooms.get(currentRoomId);
        if (r && r.players.white && !r.players.white.connected) {
          endGameAndSaveStats(r, 'abandoned', 'black');
          io.to(currentRoomId).emit('room_update', getCleanRoomState(r));
          cleanRoom(currentRoomId);
        }
      }, 30000);
    } else if (isBlack && room.players.black) {
      room.players.black.connected = false;
      io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
      io.to(currentRoomId).emit('chat_message', {
        sender: 'System',
        text: `${currentPlayerName} (BLACK) disconnected.`,
        isSystem: true,
        timestamp: Date.now(),
      });

      // Start 30-second abandonment timer
      room.cleanupTimeout = setTimeout(() => {
        const r = rooms.get(currentRoomId);
        if (r && r.players.black && !r.players.black.connected) {
          endGameAndSaveStats(r, 'abandoned', 'white');
          io.to(currentRoomId).emit('room_update', getCleanRoomState(r));
          cleanRoom(currentRoomId);
        }
      }, 30000);
    } else {
      // Remove spectator
      room.spectators = room.spectators.filter(s => s.socketId !== socket.id);
      io.to(currentRoomId).emit('room_update', getCleanRoomState(room));
    }

    // If both players left and room has no spectators, clean it up immediately
    const noWhite = !room.players.white || !room.players.white.connected;
    const noBlack = !room.players.black || !room.players.black.connected;
    if (noWhite && noBlack && room.spectators.length === 0) {
      cleanRoom(currentRoomId);
    }
  });
});

function getInitialTime(timeControl) {
  switch (timeControl) {
    case 'bullet': return 60;
    case 'blitz3': return 180;
    case 'blitz5': return 300;
    case 'rapid10': return 600;
    case 'rapid30': return 1800;
    default: return Infinity; // casual
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

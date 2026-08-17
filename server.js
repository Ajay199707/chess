import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from 'chess.js';

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

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

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

  room.gameState.status = 'timeout';
  room.gameState.winner = color === 'white' ? 'black' : 'white';
  room.gameState.clocks[color] = 0;

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

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentPlayerColor = null; // 'white', 'black', or null (spectator)
  let currentPlayerName = '';

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
          room.gameState.status = 'checkmate';
          room.gameState.winner = tempGame.turn() === 'w' ? 'black' : 'white';
        } else {
          room.gameState.status = 'draw';
        }
        // Cancel timers
        const existingTimeout = roomTimeouts.get(currentRoomId);
        if (existingTimeout) clearTimeout(existingTimeout);
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

  // Handle chat messages and emoji reactions
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

    room.gameState.status = 'abandoned';
    room.gameState.winner = role === 'white' ? 'black' : 'white';

    // Clear timeout
    const existingTimeout = roomTimeouts.get(currentRoomId);
    if (existingTimeout) clearTimeout(existingTimeout);

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
      room.gameState.status = 'draw';
      const existingTimeout = roomTimeouts.get(currentRoomId);
      if (existingTimeout) clearTimeout(existingTimeout);

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
          r.gameState.status = 'abandoned';
          r.gameState.winner = 'black';
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
          r.gameState.status = 'abandoned';
          r.gameState.winner = 'white';
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

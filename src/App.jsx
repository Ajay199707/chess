import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import { 
  Play, Users, Award, BookOpen, Volume2, VolumeX, 
  RotateCcw, Shield, HelpCircle, Trophy, Copy, Check,
  LogOut, ArrowLeftRight, Settings, Send
} from 'lucide-react';

import { Chessboard } from './components/Chessboard';
import { ChatPanel } from './components/ChatPanel';
import { Guidelines } from './components/Guidelines';
import { getBestMove } from './utils/chessAI';
import { playSound } from './utils/audio';

// Default stats layout
const DEFAULT_STATS = {
  vsBot: { easy: { wins: 0, losses: 0, draws: 0 }, medium: { wins: 0, losses: 0, draws: 0 }, hard: { wins: 0, losses: 0, draws: 0 } },
  local: { p1Wins: 0, p2Wins: 0, draws: 0 },
  online: { wins: 0, losses: 0, draws: 0 }
};

export default function App() {
  // --- UI & CONFIG STATE ---
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('chess_player_name') || 'Grandmaster');
  const [gameMode, setGameMode] = useState('menu'); // 'menu', 'vs-bot', 'local-2p', 'online-2p'
  const [difficulty, setDifficulty] = useState('medium'); // 'easy', 'medium', 'hard'
  const [botColor, setBotColor] = useState('black'); // 'white', 'black', 'random'
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('chess_board_theme') || 'classic');
  const [timeControl, setTimeControl] = useState('casual'); // 'casual', 'bullet', 'blitz3', 'blitz5', 'rapid10'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'chat', 'moves', 'stats'

  // --- GAME & LOGIC STATE ---
  const [game, setGame] = useState(() => new Chess());
  const [lastMove, setLastMove] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); // 'waiting', 'playing', 'checkmate', 'draw', 'timeout', 'abandoned'
  const [winner, setWinner] = useState(null); // 'white', 'black', null (draw)
  
  // Custom stats
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('chess_player_stats');
      return saved ? JSON.parse(saved) : DEFAULT_STATS;
    } catch {
      return DEFAULT_STATS;
    }
  });

  // --- ONLINE MULTIPLAYER STATE ---
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [playerColor, setPlayerColor] = useState(null); // 'white', 'black', or null (for spectators/local games)
  const [isSpectator, setIsSpectator] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Online dialog/offer prompts
  const [drawOfferPending, setDrawOfferPending] = useState(null); // { from }
  const [undoRequestPending, setUndoRequestPending] = useState(null); // { from }
  const [restartOfferPending, setRestartOfferPending] = useState(null); // { from }
  const [toastMessage, setToastMessage] = useState('');

  // Clocks
  const [clocks, setClocks] = useState({ white: 300, black: 300 });

  // --- MODALS ---
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // References
  const botTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Save Player Name & Theme
  useEffect(() => {
    localStorage.setItem('chess_player_name', playerName);
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem('chess_board_theme', boardTheme);
  }, [boardTheme]);

  // Save Stats
  useEffect(() => {
    localStorage.setItem('chess_player_stats', JSON.stringify(stats));
  }, [stats]);

  // Handle URL share code join automatically
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setGameMode('online-2p');
      setRoomCode(roomParam.toUpperCase());
      handleJoinOnlineRoom(roomParam.toUpperCase());
    }
  }, []);

  // Timer interval ticking for online/local matches
  useEffect(() => {
    let interval = null;
    const isClockActive = gameMode !== 'menu' && gameStatus === 'playing' && timeControl !== 'casual';

    if (isClockActive) {
      interval = setInterval(() => {
        const turn = game.turn() === 'w' ? 'white' : 'black';
        
        // For Local/Bot games, decrement local React clocks
        if (gameMode !== 'online-2p') {
          setClocks(prev => {
            const nextVal = Math.max(0, prev[turn] - 1);
            if (nextVal === 0) {
              // Trigger timeout loss
              setGameStatus('timeout');
              setWinner(turn === 'white' ? 'black' : 'white');
              triggerSound('gameover');
              updateScores(turn === 'white' ? 'black' : 'white', 'timeout');
            }
            return {
              ...prev,
              [turn]: nextVal
            };
          });
        } else {
          // For online games, clocks tick locally for visual smoothness,
          // but will be corrected/overridden by server socket state sync.
          setClocks(prev => ({
            ...prev,
            [turn]: Math.max(0, prev[turn] - 1)
          }));
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameStatus, gameMode, timeControl, game]);

  // Sound triggering safely
  const triggerSound = (type) => {
    if (soundEnabled) {
      playSound(type);
    }
  };

  // Helper to show temporary system toast alerts
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // --- GAME INITIALIZATION ---
  const startNewLocalOrBotGame = (mode, selectedDiff = difficulty, selectedBotCol = botColor, tc = timeControl) => {
    // Clear timeouts
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);

    const newGame = new Chess();
    setGame(newGame);
    setLastMove(null);
    setGameStatus('playing');
    setWinner(null);
    
    // Setup Clocks
    const seconds = getInitialClockSeconds(tc);
    setClocks({ white: seconds, black: seconds });

    triggerSound('gamestart');

    // Bot First Move check
    if (mode === 'vs-bot') {
      let activeColor = selectedBotCol;
      if (selectedBotCol === 'random') {
        activeColor = Math.random() < 0.5 ? 'white' : 'black';
      }
      
      const botPlaysWhite = activeColor === 'white';
      if (botPlaysWhite) {
        showToast("Bot thinking...");
        botTimeoutRef.current = setTimeout(() => {
          const move = getBestMove(newGame, selectedDiff);
          if (move) {
            newGame.move(move);
            setGame(new Chess(newGame.fen()));
            setLastMove({ from: move.from, to: move.to });
            triggerSound('move');
          }
        }, 600);
      }
    }
  };

  // Score updater logic
  const updateScores = (gameWinner, finishReason) => {
    if (isSpectator) return;

    setStats(prev => {
      const nextStats = JSON.parse(JSON.stringify(prev));

      if (gameMode === 'vs-bot') {
        const diffKey = difficulty; // 'easy', 'medium', 'hard'
        if (gameWinner === 'draw') {
          nextStats.vsBot[diffKey].draws++;
        } else {
          // Verify if player color matches winner
          // For Bot mode, user is white by default unless botColor was forced white
          const playerIsWhite = botColor === 'black' || (botColor === 'random' && playerColor === 'white');
          const isPlayerWinner = (gameWinner === 'white' && playerIsWhite) || (gameWinner === 'black' && !playerIsWhite);
          
          if (isPlayerWinner) {
            nextStats.vsBot[diffKey].wins++;
          } else {
            nextStats.vsBot[diffKey].losses++;
          }
        }
      } else if (gameMode === 'local-2p') {
        if (gameWinner === 'draw') {
          nextStats.local.draws++;
        } else if (gameWinner === 'white') {
          nextStats.local.p1Wins++;
        } else {
          nextStats.local.p2Wins++;
        }
      } else if (gameMode === 'online-2p') {
        if (gameWinner === 'draw') {
          nextStats.online.draws++;
        } else {
          const isPlayerWinner = gameWinner === playerColor;
          if (isPlayerWinner) {
            nextStats.online.wins++;
          } else {
            nextStats.online.losses++;
          }
        }
      }

      return nextStats;
    });
  };

  // --- GAME MOVE HANDLER (CLIENT SIDE - LOCAL / VS BOT) ---
  const handleLocalMove = (moveDetails) => {
    try {
      const newGame = new Chess(game.fen());
      const isCapture = newGame.get(moveDetails.to) !== null || (moveDetails.promotion && newGame.get(moveDetails.from)?.type === 'p');
      const result = newGame.move(moveDetails);

      if (result) {
        setGame(newGame);
        setLastMove({ from: moveDetails.from, to: moveDetails.to });

        // Play Sound Cues
        const isCheck = newGame.inCheck();
        const isGameOver = newGame.isGameOver();

        if (isGameOver) {
          handleGameOverState(newGame);
        } else if (isCheck) {
          triggerSound('check');
        } else if (isCapture) {
          triggerSound('capture');
        } else {
          triggerSound('move');
        }

        // Bot Move scheduling if in vs-bot mode
        if (gameMode === 'vs-bot' && !isGameOver) {
          showToast("Bot thinking...");
          botTimeoutRef.current = setTimeout(() => {
            const botMove = getBestMove(newGame, difficulty);
            if (botMove) {
              const isBotCapture = newGame.get(botMove.to) !== null;
              newGame.move(botMove);
              setGame(new Chess(newGame.fen()));
              setLastMove({ from: botMove.from, to: botMove.to });

              const isBotCheck = newGame.inCheck();
              const isBotGameOver = newGame.isGameOver();

              if (isBotGameOver) {
                handleGameOverState(newGame);
              } else if (isBotCheck) {
                triggerSound('check');
              } else if (isBotCapture) {
                triggerSound('capture');
              } else {
                triggerSound('move');
              }
            }
          }, 500);
        }
      }
    } catch (e) {
      console.warn("Invalid move attempted", e);
    }
  };

  const handleGameOverState = (gameInstance) => {
    triggerSound('gameover');
    if (gameInstance.isCheckmate()) {
      const losingTurn = gameInstance.turn(); // Turn of the checkmated player
      const winningColor = losingTurn === 'w' ? 'black' : 'white';
      setGameStatus('checkmate');
      setWinner(winningColor);
      updateScores(winningColor, 'checkmate');
    } else {
      setGameStatus('draw');
      setWinner(null);
      updateScores('draw', 'draw');
    }
  };

  // --- ONLINE SOCKET CONNECTORS ---
  const handleCreateOnlineRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    initSocketConnection(code);
  };

  const handleJoinOnlineRoom = (code = joinCodeInput) => {
    if (!code.trim()) {
      showToast("Please enter a valid room code.");
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    setRoomCode(cleanCode);
    initSocketConnection(cleanCode);
  };

  const handleSwapColors = () => {
    if (socket) socket.emit('select_color');
  };

  const handleStartGame = () => {
    if (socket) socket.emit('start_game');
  };

  const initSocketConnection = (roomCodeStr) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // If we're on a dev server port (e.g. 5173), connect directly to the Express server on port 3001.
    // Otherwise, connect to the custom hosted production backend URL (e.g. on Render).
    // REPLACE "YOUR_RENDER_BACKEND_URL" below with your live Render URL once hosted!
    const BACKEND_PROD_URL = "YOUR_RENDER_BACKEND_URL"; 

    const isDev = window.location.port && window.location.port !== '3001';
    const socketUrl = isDev 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : (BACKEND_PROD_URL !== "YOUR_RENDER_BACKEND_URL" ? BACKEND_PROD_URL : window.location.origin);

    const newSocket = io(socketUrl);
    socketRef.current = newSocket;

    setSocket(newSocket);
    setChatHistory([]);
    setGameStatus('waiting');
    setWinner(null);
    setGame(new Chess());

    newSocket.on('connect', () => {
      newSocket.emit('join_room', {
        roomId: roomCodeStr,
        name: playerName,
        timeControl: timeControl
      });
    });

    newSocket.on('role_assigned', ({ color, isSpectator: spectatorFlag }) => {
      setPlayerColor(color);
      setIsSpectator(spectatorFlag);
      if (spectatorFlag) {
        showToast("Joined room as a spectator");
      } else {
        showToast(`You are playing as ${color.toUpperCase()}`);
      }
    });

    newSocket.on('room_update', (updatedRoomState) => {
      setRoomState(updatedRoomState);
      
      const newGameInstance = new Chess(updatedRoomState.gameState.fen);
      setGame(newGameInstance);
      setGameStatus(updatedRoomState.gameState.status);
      setWinner(updatedRoomState.gameState.winner);

      // Sync last move highlight and play opponent move sound cues
      if (updatedRoomState.gameState.lastMove) {
        const hasFenChanged = updatedRoomState.gameState.fen !== game.fen();
        const isMyTurn = newGameInstance.turn() === (playerColor === 'white' ? 'w' : 'b');
        
        if (hasFenChanged && isMyTurn) {
          const isCheck = newGameInstance.inCheck();
          // Check if piece was captured by checking target square existence in previous game state or looking at the last move details
          const isCapture = updatedRoomState.gameState.lastMove.flags?.includes('c') || 
                            game.get(updatedRoomState.gameState.lastMove.to) !== null;

          if (isCheck) {
            triggerSound('check');
          } else if (isCapture) {
            triggerSound('capture');
          } else {
            triggerSound('move');
          }
        }
        setLastMove(updatedRoomState.gameState.lastMove);
      } else {
        setLastMove(null);
      }

      // Sync Timers
      if (updatedRoomState.gameState.timeControl !== 'casual') {
        setClocks(updatedRoomState.gameState.clocks);
      }

      // Score update checking
      if (['checkmate', 'draw', 'timeout', 'abandoned'].includes(updatedRoomState.gameState.status)) {
        triggerSound('gameover');
        updateScores(updatedRoomState.gameState.winner || 'draw', updatedRoomState.gameState.status);
      }
    });

    newSocket.on('chat_message', (chatMsg) => {
      setChatHistory(prev => [...prev, chatMsg]);
      // Trigger sound on incoming chat reaction
      if (chatMsg.isReaction) {
        triggerSound('capture');
      }
    });

    newSocket.on('draw_offered', ({ from }) => {
      if (from !== playerColor) {
        setDrawOfferPending(from);
      }
    });

    newSocket.on('draw_declined', () => {
      showToast("Draw offer declined by opponent.");
    });

    newSocket.on('undo_requested', ({ from }) => {
      if (from !== playerColor) {
        setUndoRequestPending(from);
      }
    });

    newSocket.on('undo_declined', () => {
      showToast("Undo request declined by opponent.");
    });

    newSocket.on('undo_accepted', () => {
      showToast("Move undone.");
    });

    newSocket.on('restart_offered', ({ from }) => {
      if (from !== playerColor) {
        setRestartOfferPending(from);
      }
    });

    newSocket.on('restart_declined', () => {
      showToast("Restart request declined by opponent.");
    });
  };

  const handleOnlineMove = (moveDetails) => {
    if (!socket || isSpectator || gameStatus !== 'playing') return;

    try {
      const tempGame = new Chess(game.fen());
      const isCapture = tempGame.get(moveDetails.to) !== null;
      const result = tempGame.move(moveDetails);

      if (result) {
        // Optimistic update locally
        setGame(tempGame);
        setLastMove({ from: moveDetails.from, to: moveDetails.to });

        // Play local sound
        if (tempGame.isGameOver()) {
          triggerSound('gameover');
        } else if (tempGame.inCheck()) {
          triggerSound('check');
        } else if (isCapture) {
          triggerSound('capture');
        } else {
          triggerSound('move');
        }

        // Notify server
        socket.emit('make_move', {
          move: moveDetails,
          fen: tempGame.fen(),
          history: tempGame.history()
        });
      }
    } catch {
      // Invalid
    }
  };

  // --- ONLINE DIALOG INTERACTIONS ---
  const handleResign = () => {
    if (window.confirm("Are you sure you want to resign?")) {
      if (gameMode === 'online-2p' && socket) {
        socket.emit('resign');
      } else {
        // Local resignation
        setGameStatus('abandoned');
        const nextWinner = game.turn() === 'w' ? 'black' : 'white';
        setWinner(nextWinner);
        updateScores(nextWinner, 'resign');
        triggerSound('gameover');
      }
    }
  };

  const handleOfferDraw = () => {
    if (gameMode === 'online-2p' && socket) {
      socket.emit('offer_draw');
      showToast("Draw offer sent.");
    } else {
      // Local draw agreement
      if (window.confirm("Agree to draw?")) {
        setGameStatus('draw');
        setWinner(null);
        updateScores('draw', 'draw');
        triggerSound('gameover');
      }
    }
  };

  const handleRespondDraw = (accept) => {
    if (socket) {
      socket.emit('draw_response', { accept });
    }
    setDrawOfferPending(null);
  };

  const handleRequestUndo = () => {
    if (gameMode === 'online-2p' && socket) {
      socket.emit('request_undo');
      showToast("Undo request sent.");
    } else {
      // Local undo
      // Undo user move AND bot move (in vs bot) OR just 1 move (in local-2p)
      const undoSteps = gameMode === 'vs-bot' ? 2 : 1;
      const tempGame = new Chess(game.fen());
      
      let undone = 0;
      for (let i = 0; i < undoSteps; i++) {
        if (tempGame.history().length > 0) {
          tempGame.undo();
          undone++;
        }
      }
      
      if (undone > 0) {
        setGame(tempGame);
        setLastMove(null);
        setGameStatus('playing');
        triggerSound('move');
        showToast(`Undid ${undone} move(s)`);
      } else {
        showToast("No moves to undo!");
      }
    }
  };

  const handleRespondUndo = (accept) => {
    if (socket && accept) {
      // Pop last two moves locally and share FEN
      const tempGame = new Chess(game.fen());
      tempGame.undo(); // opponent's move
      tempGame.undo(); // self move
      
      socket.emit('undo_response', { accept: true, steps: 2 });
      socket.emit('sync_game', { fen: tempGame.fen(), history: tempGame.history() });
    } else if (socket) {
      socket.emit('undo_response', { accept: false });
    }
    setUndoRequestPending(null);
  };

  const handleOfferRestart = () => {
    if (gameMode === 'online-2p' && socket) {
      socket.emit('offer_restart');
      showToast("Restart request sent.");
    } else {
      // Local restart
      startNewLocalOrBotGame(gameMode);
    }
  };

  const handleRespondRestart = (accept) => {
    if (socket) {
      socket.emit('restart_response', { accept });
    }
    setRestartOfferPending(null);
  };

  // --- UTILITIES ---
  const handleExitMatch = () => {
    if (window.confirm("Exit match and return to menu?")) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      // Clean query params on return to menu
      window.history.replaceState({}, document.title, window.location.pathname);
      setGameMode('menu');
      setRoomCode('');
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      showToast("Shareable link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const getInitialClockSeconds = (tc) => {
    switch (tc) {
      case 'bullet': return 60;
      case 'blitz3': return 180;
      case 'blitz5': return 300;
      case 'rapid10': return 600;
      case 'rapid30': return 1800;
      default: return 300; // default to 5 min if visual casual clock
    }
  };

  const formatClock = (seconds) => {
    if (seconds === Infinity) return "∞";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportPGN = () => {
    const pgn = game.pgn();
    if (!pgn) {
      showToast("No moves made to export.");
      return;
    }
    navigator.clipboard.writeText(pgn).then(() => {
      showToast("PGN copied to clipboard!");
    });
  };

  // Compute captured pieces lists
  const capturedPieces = (() => {
    const initial = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
    };
    const current = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };

    game.board().forEach(row => {
      row.forEach(sq => {
        if (sq && sq.type !== 'k') {
          current[sq.color][sq.type]++;
        }
      });
    });

    const capByBlack = []; // White pieces captured
    Object.keys(initial.w).forEach(type => {
      const count = initial.w[type] - current.w[type];
      for (let i = 0; i < count; i++) capByBlack.push({ type, color: 'w' });
    });

    const capByWhite = []; // Black pieces captured
    Object.keys(initial.b).forEach(type => {
      const count = initial.b[type] - current.b[type];
      for (let i = 0; i < count; i++) capByWhite.push({ type, color: 'b' });
    });

    return { w: capByWhite, b: capByBlack }; // w = pieces white captured, b = pieces black captured
  })();

  // Compute Material Advantage
  const materialBalance = (() => {
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let whiteScore = 0;
    let blackScore = 0;
    game.board().forEach(row => {
      row.forEach(sq => {
        if (sq && sq.type !== 'k') {
          if (sq.color === 'w') whiteScore += vals[sq.type];
          else blackScore += vals[sq.type];
        }
      });
    });
    const diff = whiteScore - blackScore;
    return {
      whiteLead: diff > 0 ? `+${diff}` : '',
      blackLead: diff < 0 ? `+${Math.abs(diff)}` : ''
    };
  })();

  const activeTurn = game.turn();

  // Socket listener for Undo Accept/Decline trigger
  useEffect(() => {
    if (!socket) return;
    
    const handleUndoAccept = ({ steps }) => {
      const tempGame = new Chess(game.fen());
      for (let i = 0; i < steps; i++) {
        tempGame.undo();
      }
      setGame(tempGame);
      setLastMove(null);
      setGameStatus('playing');
    };

    socket.on('undo_accepted', handleUndoAccept);
    return () => {
      socket.off('undo_accepted', handleUndoAccept);
    };
  }, [socket, game]);

  const renderTurnBanner = () => {
    if (gameStatus !== 'playing') return null;

    if (gameMode === 'local-2p') {
      return (
        <div className={`turn-indicator-banner ${activeTurn === 'w' ? 'white-turn' : 'black-turn'}`}>
          {activeTurn === 'w' ? "⚪ White to Move" : "⚫ Black to Move"}
        </div>
      );
    }

    if (gameMode === 'vs-bot') {
      const playerIsWhite = botColor === 'black' || (botColor === 'random' && playerColor === 'white');
      const isPlayerTurn = (activeTurn === 'w' && playerIsWhite) || (activeTurn === 'b' && !playerIsWhite);
      return (
        <div className={`turn-indicator-banner ${isPlayerTurn ? 'my-turn' : 'opponent-turn'}`}>
          {isPlayerTurn ? "🟢 Your Turn" : "🤖 Bot is thinking..."}
        </div>
      );
    }

    // Online multiplayer
    const isMyTurn = activeTurn === (playerColor === 'white' ? 'w' : 'b');
    return (
      <div className={`turn-indicator-banner ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
        {isMyTurn 
          ? `🟢 Your Turn (${playerColor.toUpperCase()})` 
          : `⏳ Opponent's Turn (${playerColor === 'white' ? 'BLACK' : 'WHITE'})`}
      </div>
    );
  };

  // --- RENDER FUNCTIONS ---
  return (
    <div className={`app-root theme-${boardTheme}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-alert animate-slide-up">
          {toastMessage}
        </div>
      )}

      {/* MODALS */}
      <Guidelines isOpen={isGuidelinesOpen} onClose={() => setIsGuidelinesOpen(false)} />

      {/* Main Container */}
      <div className="game-container">
        
        {/* --- MENU SCREEN --- */}
        {gameMode === 'menu' && (
          <div className="menu-card animate-fade-in">
            <header className="menu-header">
              <h1>👑 Apex Chess</h1>
              <p>Experience clean, premium chess with real-time multiplayer and chess bot intelligence.</p>
            </header>

            {/* Profile Entry */}
            <div className="menu-profile-input">
              <label htmlFor="name-input">Enter Player Name:</label>
              <div className="input-group">
                <Settings size={18} className="input-icon" />
                <input
                  id="name-input"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.substring(0, 15))}
                  placeholder="Grandmaster"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="menu-grid">
              {/* vs Bot Card */}
              <div className="mode-card">
                <div className="mode-icon-wrapper">
                  <Play size={24} className="text-gold" />
                </div>
                <h3>1 Player vs Bot</h3>
                <p>Sharpen your tactical skills against our adaptive minimax search engine.</p>
                
                <div className="mode-settings">
                  <div className="setting-row">
                    <span>Difficulty:</span>
                    <div className="btn-segmented">
                      {['easy', 'medium', 'hard'].map(d => (
                        <button
                          key={d}
                          className={difficulty === d ? 'active' : ''}
                          onClick={() => setDifficulty(d)}
                        >
                          {d.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setting-row">
                    <span>Play As:</span>
                    <div className="btn-segmented">
                      {[
                        { key: 'white', label: 'WHITE' },
                        { key: 'random', label: 'RAND' },
                        { key: 'black', label: 'BLACK' }
                      ].map(color => (
                        <button
                          key={color.key}
                          className={botColor === color.key ? 'active' : ''}
                          onClick={() => setBotColor(color.key)}
                        >
                          {color.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  className="btn-primary full-width"
                  onClick={() => {
                    setGameMode('vs-bot');
                    startNewLocalOrBotGame('vs-bot');
                  }}
                >
                  Start Battle
                </button>
              </div>

              {/* Multiplayer / Local & Online Card */}
              <div className="mode-card">
                <div className="mode-icon-wrapper">
                  <Users size={24} className="text-emerald" />
                </div>
                <h3>2 Players</h3>
                <p>Play locally with pass-and-play, or create real-time online rooms for matchmaking.</p>

                <div className="time-setting">
                  <span>Time Control:</span>
                  <select 
                    value={timeControl} 
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="select-dropdown"
                  >
                    <option value="casual">Casual (No Timer)</option>
                    <option value="bullet">Bullet (1 Min)</option>
                    <option value="blitz3">Blitz (3 Min)</option>
                    <option value="blitz5">Blitz (5 Min)</option>
                    <option value="rapid10">Rapid (10 Min)</option>
                    <option value="rapid30">Rapid (30 Min)</option>
                  </select>
                </div>

                <div className="multiplayer-options">
                  {/* Local 2P */}
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      setGameMode('local-2p');
                      startNewLocalOrBotGame('local-2p');
                    }}
                  >
                    Play Pass & Play (Local)
                  </button>

                  <div className="divider-label">
                    <span>OR ONLINE MULTIPLAYER</span>
                  </div>

                  {/* Host Online */}
                  <button 
                    className="btn-outline-gold"
                    onClick={() => {
                      setGameMode('online-2p');
                      handleCreateOnlineRoom();
                    }}
                  >
                    Host Online Room
                  </button>

                  {/* Join Room */}
                  <div className="join-group">
                    <input
                      type="text"
                      placeholder="ENTER ROOM CODE"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.substring(0, 6))}
                      maxLength={6}
                    />
                    <button 
                      className="btn-primary inline-btn"
                      onClick={() => {
                        setGameMode('online-2p');
                        handleJoinOnlineRoom();
                      }}
                      disabled={!joinCodeInput.trim()}
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <footer className="menu-footer-actions">
              <button className="btn-text" onClick={() => setIsGuidelinesOpen(true)}>
                <BookOpen size={16} /> How to Play Rules
              </button>
              <button 
                className="btn-text" 
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  triggerSound('move');
                }}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
              </button>
            </footer>
          </div>
        )}

        {/* --- GAMEPLAY ACTIVE SCREEN --- */}
        {gameMode !== 'menu' && (
          <div className="gameplay-grid animate-fade-in">
            
            {/* Header / Top Control Bar */}
            <header className="game-nav-bar">
              <button className="btn-back" onClick={handleExitMatch}>
                <LogOut size={16} />
                <span>Exit Match</span>
              </button>
              
              <div className="room-info-display">
                {gameMode === 'vs-bot' && <h3>🆚 Bot Battle ({difficulty.toUpperCase()})</h3>}
                {gameMode === 'local-2p' && <h3>👥 Pass & Play</h3>}
                {gameMode === 'online-2p' && (
                  <div className="code-badge-group">
                    <span className="room-label">ROOM:</span>
                    <strong className="code">{roomCode}</strong>
                    <button className="copy-link-btn" onClick={handleCopyLink} title="Copy invitation link">
                      {copiedLink ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>

              <div className="utility-controls">
                <select 
                  value={boardTheme} 
                  onChange={(e) => setBoardTheme(e.target.value)}
                  className="theme-select select-dropdown"
                >
                  <option value="classic">🌲 Wood Theme</option>
                  <option value="slate">🪙 Modern Slate</option>
                  <option value="gold">✨ Midnight Gold</option>
                  <option value="forest">🌿 Forest Green</option>
                </select>

                <button 
                  className="icon-only-btn" 
                  onClick={() => setIsGuidelinesOpen(true)}
                  title="Rules & Guidelines"
                >
                  <HelpCircle size={20} />
                </button>

                <button 
                  className="icon-only-btn"
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    triggerSound('move');
                  }}
                  title="Toggle Sound"
                >
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
              </div>
            </header>

            {/* Mobile Tab Selectors */}
            <div className="mobile-tab-bar">
              <button 
                className={activeTab === 'game' ? 'active' : ''} 
                onClick={() => setActiveTab('game')}
              >
                Board
              </button>
              {gameMode === 'online-2p' && (
                <button 
                  className={activeTab === 'chat' ? 'active' : ''} 
                  onClick={() => setActiveTab('chat')}
                >
                  Chat {chatHistory.length > 0 && <span className="unread-dot" />}
                </button>
              )}
              <button 
                className={activeTab === 'moves' ? 'active' : ''} 
                onClick={() => setActiveTab('moves')}
              >
                Moves
              </button>
              <button 
                className={activeTab === 'stats' ? 'active' : ''} 
                onClick={() => setActiveTab('stats')}
              >
                Stats
              </button>
            </div>

            {/* Main Center Area */}
            <div className={`board-column ${activeTab === 'game' ? 'mobile-visible' : 'mobile-hidden'}`}>
              
              {gameMode === 'online-2p' && gameStatus === 'waiting' ? (
                <div className="online-lobby-panel animate-fade-in">
                  <h2>🎮 Match Lobby</h2>
                  <p className="lobby-subtitle">Assign player colors and start the match when ready.</p>

                  <div className="lobby-players-grid">
                    <div className={`lobby-player-slot white-slot ${playerColor === 'white' ? 'self' : ''}`}>
                      <div className="slot-header">⚪ PLAYING AS WHITE</div>
                      <div className="slot-body">
                        <span className="slot-avatar">👤</span>
                        <span className="slot-name">{roomState?.players.white?.name || 'Waiting for player...'}</span>
                      </div>
                      {!isSpectator && playerColor === 'white' && (
                        <button className="btn-select-slot-color" onClick={handleSwapColors}>
                          Switch to Black ➔
                        </button>
                      )}
                    </div>

                    <div className="lobby-separator-icon">
                      <ArrowLeftRight size={20} />
                    </div>

                    <div className={`lobby-player-slot black-slot ${playerColor === 'black' ? 'self' : ''}`}>
                      <div className="slot-header">⚫ PLAYING AS BLACK</div>
                      <div className="slot-body">
                        <span className="slot-avatar">👤</span>
                        <span className="slot-name">{roomState?.players.black?.name || 'Waiting for player...'}</span>
                      </div>
                      {!isSpectator && playerColor === 'black' && (
                        <button className="btn-select-slot-color" onClick={handleSwapColors}>
                          ⬅ Switch to White
                        </button>
                      )}
                    </div>
                  </div>

                  {roomState?.spectators.length > 0 && (
                    <div className="lobby-spectators-list">
                      <span>👁️ Spectators ({roomState.spectators.length}): </span>
                      <strong>{roomState.spectators.map(s => s.name).join(', ')}</strong>
                    </div>
                  )}

                  <div className="lobby-controls">
                    {(!roomState?.players.white || !roomState?.players.black) ? (
                      <div className="lobby-status-msg waiting-join">
                        <p>Waiting for an opponent to join...</p>
                        <button className="btn-secondary" onClick={handleCopyLink}>
                          {copiedLink ? "Link Copied!" : "📋 Copy Invite Link"}
                        </button>
                      </div>
                    ) : (
                      <div className="lobby-status-msg ready-to-start">
                        {socket && roomState && socket.id === roomState.hostSocketId ? (
                          <button className="btn-primary start-match-btn animate-pulse" onClick={handleStartGame}>
                            🚀 Go for Play
                          </button>
                        ) : (
                          <p className="pulse-text">Waiting for the host to start the game...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {renderTurnBanner()}

                  {/* Opponent Card (Top) */}
                  <div className={`player-card opponent ${activeTurn !== (playerColor === 'white' ? 'w' : 'b') && gameStatus === 'playing' ? 'active-turn' : ''}`}>
                    <div className="player-meta">
                      <span className="avatar">🤖</span>
                      <div className="name-section">
                        <span className="player-name">
                          {gameMode === 'vs-bot' && `Bot AI (${difficulty})`}
                          {gameMode === 'local-2p' && "Player 2 (Black)"}
                          {gameMode === 'online-2p' && (
                            playerColor === 'white' 
                              ? (roomState?.players.black?.name || 'Waiting for opponent...')
                              : (roomState?.players.white?.name || 'Opponent')
                          )}
                        </span>
                        {gameMode === 'online-2p' && roomState?.players[playerColor === 'white' ? 'black' : 'white']?.connected === false && (
                          <span className="disconnect-alert">(Disconnected)</span>
                        )}
                      </div>
                    </div>

                    {/* Captured Pieces by Opponent (shows your captured pieces) */}
                    <div className="captured-panel">
                      <div className="piece-chips">
                        {capturedPieces[playerColor === 'black' ? 'b' : 'w'].map((p, idx) => (
                          <span key={idx} className="captured-piece-icon">
                            {p.type.toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span className="lead-tag">
                        {playerColor === 'black' ? materialBalance.blackLead : materialBalance.whiteLead}
                      </span>
                    </div>

                    {/* Timer Clock */}
                    {timeControl !== 'casual' && (
                      <div className="timer-badge">
                        {formatClock(playerColor === 'black' ? clocks.white : clocks.black)}
                      </div>
                    )}
                  </div>

                  {/* Interactive Chessboard */}
                  <Chessboard
                    game={game}
                    onMove={gameMode === 'online-2p' ? handleOnlineMove : handleLocalMove}
                    turn={activeTurn}
                    playerColor={gameMode === 'online-2p' ? playerColor : null}
                    boardTheme={boardTheme}
                    interactive={gameStatus === 'playing' && !isSpectator}
                    lastMove={lastMove}
                  />

                  {/* User Card (Bottom) */}
                  <div className={`player-card self ${activeTurn === (playerColor === 'white' ? 'w' : 'b') && gameStatus === 'playing' ? 'active-turn' : ''}`}>
                    <div className="player-meta">
                      <span className="avatar">👤</span>
                      <div className="name-section">
                        <span className="player-name">
                          {gameMode === 'vs-bot' && playerName}
                          {gameMode === 'local-2p' && "Player 1 (White)"}
                          {gameMode === 'online-2p' && (
                            isSpectator ? `${playerName} (Spectator)` : `${playerName} (You)`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Captured Pieces by User */}
                    <div className="captured-panel">
                      <div className="piece-chips">
                        {capturedPieces[playerColor === 'black' ? 'w' : 'b'].map((p, idx) => (
                          <span key={idx} className="captured-piece-icon">
                            {p.type.toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span className="lead-tag">
                        {playerColor === 'black' ? materialBalance.whiteLead : materialBalance.blackLead}
                      </span>
                    </div>

                    {/* Timer Clock */}
                    {timeControl !== 'casual' && (
                      <div className="timer-badge">
                        {formatClock(playerColor === 'black' ? clocks.black : clocks.white)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Dashboard / Sidebar column (desktop static, mobile tab-toggled) */}
            <div className="dashboard-column">
              
              {/* Online Game Prompts / Notifications inside dashboard */}
              {(drawOfferPending || undoRequestPending || restartOfferPending) && (
                <div className="dialog-alert-card animate-slide-up">
                  {drawOfferPending && (
                    <div className="alert-content">
                      <p>Opponent offered a Draw.</p>
                      <div className="btn-actions">
                        <button className="btn-sm-primary" onClick={() => handleRespondDraw(true)}>Accept</button>
                        <button className="btn-sm-danger" onClick={() => handleRespondDraw(false)}>Decline</button>
                      </div>
                    </div>
                  )}
                  {undoRequestPending && (
                    <div className="alert-content">
                      <p>Opponent requests an Undo.</p>
                      <div className="btn-actions">
                        <button className="btn-sm-primary" onClick={() => handleRespondUndo(true)}>Accept</button>
                        <button className="btn-sm-danger" onClick={() => handleRespondUndo(false)}>Decline</button>
                      </div>
                    </div>
                  )}
                  {restartOfferPending && (
                    <div className="alert-content">
                      <p>Opponent proposed a Restart.</p>
                      <div className="btn-actions">
                        <button className="btn-sm-primary" onClick={() => handleRespondRestart(true)}>Accept</button>
                        <button className="btn-sm-danger" onClick={() => handleRespondRestart(false)}>Decline</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Game Over Panel Overlay */}
              {gameStatus !== 'playing' && gameStatus !== 'waiting' && (
                <div className="game-over-banner">
                  <h2>Game Over!</h2>
                  <p className="game-reason">
                    {gameStatus === 'checkmate' && `Checkmate! Winner: ${winner ? winner.toUpperCase() : 'Draw'}`}
                    {gameStatus === 'draw' && 'Draw by agreement / stalemate / repetition'}
                    {gameStatus === 'timeout' && `Timeout! Winner: ${winner.toUpperCase()}`}
                    {gameStatus === 'abandoned' && `Match ended by abandonment. Winner: ${winner ? winner.toUpperCase() : 'None'}`}
                  </p>
                  <button className="btn-primary" onClick={handleOfferRestart}>
                    <RotateCcw size={16} /> Request Rematch
                  </button>
                </div>
              )}



              {/* Action Buttons Panel */}
              <div className={`control-actions-panel ${activeTab === 'game' ? 'mobile-visible' : 'mobile-hidden'}`}>
                <button 
                  className="action-tile resign" 
                  onClick={handleResign}
                  disabled={gameStatus !== 'playing' || isSpectator}
                >
                  🏳️ Resign Match
                </button>
                
                <button 
                  className="action-tile draw" 
                  onClick={handleOfferDraw}
                  disabled={gameStatus !== 'playing' || isSpectator}
                >
                  🤝 Offer Draw
                </button>

                <button 
                  className="action-tile undo" 
                  onClick={handleRequestUndo}
                  disabled={gameStatus !== 'playing' || isSpectator || game.history().length === 0}
                >
                  ↩️ Request Undo
                </button>

                <button 
                  className="action-tile restart" 
                  onClick={handleOfferRestart}
                  disabled={isSpectator}
                >
                  🔄 Restart Match
                </button>
              </div>

              {/* Tab: Chat Panel (online mode only) */}
              {gameMode === 'online-2p' && (
                <div className={`dashboard-tab-pane ${activeTab === 'chat' ? 'active mobile-visible' : 'mobile-hidden'}`}>
                  <ChatPanel
                    socket={socket}
                    roomCode={roomCode}
                    playerName={playerName}
                    chatHistory={chatHistory}
                    setChatHistory={setChatHistory}
                  />
                </div>
              )}

              {/* Tab: Move Log List */}
              <div className={`dashboard-tab-pane ${activeTab === 'moves' ? 'active mobile-visible' : 'mobile-hidden'}`}>
                <div className="moves-log-panel">
                  <div className="panel-header">
                    <h3>📜 Move History</h3>
                    <button className="btn-text-gold" onClick={exportPGN} disabled={game.history().length === 0}>
                      Export PGN
                    </button>
                  </div>
                  <div className="moves-list-scroll">
                    {game.history().length === 0 ? (
                      <span className="empty-moves">No moves played yet.</span>
                    ) : (
                      <div className="moves-table">
                        {game.history({ verbose: true }).reduce((acc, move, index) => {
                          if (index % 2 === 0) {
                            acc.push({
                              num: Math.floor(index / 2) + 1,
                              white: move.san,
                              black: ''
                            });
                          } else {
                            acc[acc.length - 1].black = move.san;
                          }
                          return acc;
                        }, []).map((row) => (
                          <div key={row.num} className="move-row">
                            <span className="move-index">{row.num}.</span>
                            <span className="move-san w">{row.white}</span>
                            <span className="move-san b">{row.black || '...'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab: Local Stats */}
              <div className={`dashboard-tab-pane ${activeTab === 'stats' ? 'active mobile-visible' : 'mobile-hidden'}`}>
                <div className="stats-panel">
                  <div className="panel-header">
                    <Trophy size={18} className="text-gold" />
                    <h3>🏆 Statistics & Standings</h3>
                  </div>

                  <div className="stats-section">
                    <h4>🤖 vs Chess Bot AI</h4>
                    <div className="stats-row">
                      <span>Easy:</span>
                      <strong>{stats.vsBot.easy.wins}W - {stats.vsBot.easy.losses}L - {stats.vsBot.easy.draws}D</strong>
                    </div>
                    <div className="stats-row">
                      <span>Medium:</span>
                      <strong>{stats.vsBot.medium.wins}W - {stats.vsBot.medium.losses}L - {stats.vsBot.medium.draws}D</strong>
                    </div>
                    <div className="stats-row">
                      <span>Hard:</span>
                      <strong>{stats.vsBot.hard.wins}W - {stats.vsBot.hard.losses}L - {stats.vsBot.hard.draws}D</strong>
                    </div>
                  </div>

                  <div className="stats-section">
                    <h4>👥 Pass & Play (Local)</h4>
                    <div className="stats-row">
                      <span>Wins P1 / P2:</span>
                      <strong>{stats.local.p1Wins}W - {stats.local.p2Wins}W - {stats.local.draws}D</strong>
                    </div>
                  </div>

                  <div className="stats-section">
                    <h4>🌐 Online Matches</h4>
                    <div className="stats-row">
                      <span>Overall:</span>
                      <strong>{stats.online.wins}W - {stats.online.losses}L - {stats.online.draws}D</strong>
                    </div>
                  </div>

                  <button 
                    className="btn-outline-gold full-width"
                    onClick={() => {
                      if (window.confirm("Reset all statistics?")) {
                        setStats(DEFAULT_STATS);
                        showToast("Stats reset successfully.");
                      }
                    }}
                  >
                    Reset Statistics
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

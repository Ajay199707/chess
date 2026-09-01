import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import { 
  Play, Users, Award, BookOpen, Volume2, VolumeX, 
  RotateCcw, Shield, HelpCircle, Trophy, Copy, Check,
  LogOut, ArrowLeftRight, Settings, Send, Sun, Moon, Coins,
  MessageSquarePlus, X, Bell, BellOff
} from 'lucide-react';

import { Chessboard } from './components/Chessboard';
import { ChatPanel } from './components/ChatPanel';
import { GlobalChatPanel } from './components/GlobalChatPanel';
import { Guidelines } from './components/Guidelines';
import { OnlinePlayersPanel } from './components/OnlinePlayersPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { ReplayViewerModal } from './components/ReplayViewerModal';
import { PublicProfileModal } from './components/PublicProfileModal';
import { LoginScreen } from './components/LoginScreen';
import { FeedbackModal } from './components/FeedbackModal';
import './index.css';
import { getBestMove } from './utils/chessAI';
import { playSound } from './utils/audio';

// Safe localStorage wrapper to prevent crashes in private modes or headless crawlers (Lighthouse/PageSpeed)
const safeGetItem = (key, defaultValue) => {
  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (e) {
    console.warn(`Failed to read ${key} from localStorage:`, e);
    return defaultValue;
  }
};

const safeSetItem = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to write ${key} to localStorage:`, e);
  }
};

// Default stats layout
const DEFAULT_STATS = {
  vsBot: { easy: { wins: 0, losses: 0, draws: 0 }, medium: { wins: 0, losses: 0, draws: 0 }, hard: { wins: 0, losses: 0, draws: 0 } },
  local: { p1Wins: 0, p2Wins: 0, draws: 0 },
  online: { wins: 0, losses: 0, draws: 0 },
  elo: 1200
};

export default function App() {
  // --- UI & CONFIG STATE ---
  const [playerName, setPlayerName] = useState(() => safeGetItem('chess_player_name', 'Grandmaster'));
  const [gameMode, setGameMode] = useState('menu'); // 'menu', 'vs-bot', 'local-2p', 'online-2p'
  const [difficulty, setDifficulty] = useState('medium'); // 'easy', 'medium', 'hard'
  const [botColor, setBotColor] = useState('black'); // 'white', 'black', 'random'
  const [boardTheme, setBoardTheme] = useState(() => safeGetItem('chess_board_theme', 'classic'));
  const [timeControl, setTimeControl] = useState('casual'); // 'casual', 'bullet', 'blitz3', 'blitz5', 'rapid10'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => safeGetItem('chess_dark_mode', 'true') === 'true');
  const [isCapturesOpen, setIsCapturesOpen] = useState(false);
  const [showFloatingCaptures, setShowFloatingCaptures] = useState(() => safeGetItem('chess_show_floating_captures', 'true') === 'true');
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'chat', 'moves', 'stats'

  // --- USER AUTHENTICATION STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null); // { name, email, stats: { gamesPlayed, onlineMatchesPlayed, elo } }
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [activeChallengeRequest, setActiveChallengeRequest] = useState(null); // { challengerName, challengerEmail, timeControl, challengeId }
  const userToken = safeGetItem('chess_user_token', null);
  const userEmail = safeGetItem('chess_user_email', null);

  // --- GAME & LOGIC STATE ---
  const [game, setGame] = useState(() => new Chess());
  const [lastMove, setLastMove] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); // 'waiting', 'playing', 'checkmate', 'draw', 'timeout', 'abandoned'
  const [winner, setWinner] = useState(null); // 'white', 'black', null (draw)
  
  // Custom stats
  const [stats, setStats] = useState(() => {
    try {
      const saved = safeGetItem('chess_player_stats', null);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.elo === undefined) parsed.elo = 1200;
        return parsed;
      }
      return DEFAULT_STATS;
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
  const [globalMessages, setGlobalMessages] = useState([]);
  
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
  const [rematchRequestSent, setRematchRequestSent] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [nextMatchNotifications, setNextMatchNotifications] = useState([]); // [{ id, name, email }]
  const [premove, setPremove] = useState(null); // { from, to, promotion }
  const [matchHistory, setMatchHistory] = useState([]);
  const [viewingMatch, setViewingMatch] = useState(null);
  const [publicProfileData, setPublicProfileData] = useState(null);
  const [friendsData, setFriendsData] = useState({ friends: [], friendRequests: [] });

  // References
  const botTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const capturesRef = useRef(null);
  const playerColorRef = useRef(null);
  const premoveRef = useRef(null);

  // Draggable Captured Pieces Bag logic
  const [bagPos, setBagPos] = useState({ x: 0, y: 0 });
  const [isDraggingBag, setIsDraggingBag] = useState(false);
  const bagDragStart = useRef({ x: 0, y: 0 });
  const bagDragOffset = useRef({ x: 0, y: 0 });
  const bagDragDist = useRef(0);

  const handleBagMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDraggingBag(true);
    bagDragStart.current = { x: e.clientX, y: e.clientY };
    bagDragOffset.current = { x: bagPos.x, y: bagPos.y };
    bagDragDist.current = 0;
    e.preventDefault();
  };

  const handleBagTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDraggingBag(true);
    bagDragStart.current = { x: touch.clientX, y: touch.clientY };
    bagDragOffset.current = { x: bagPos.x, y: bagPos.y };
    bagDragDist.current = 0;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingBag) return;
      const dx = e.clientX - bagDragStart.current.x;
      const dy = e.clientY - bagDragStart.current.y;
      bagDragDist.current = Math.sqrt(dx * dx + dy * dy);
      setBagPos({
        x: bagDragOffset.current.x + dx,
        y: bagDragOffset.current.y + dy
      });
    };

    const handleTouchMove = (e) => {
      if (!isDraggingBag) return;
      const touch = e.touches[0];
      const dx = touch.clientX - bagDragStart.current.x;
      const dy = touch.clientY - bagDragStart.current.y;
      bagDragDist.current = Math.sqrt(dx * dx + dy * dy);
      setBagPos({
        x: bagDragOffset.current.x + dx,
        y: bagDragOffset.current.y + dy
      });
    };

    const handleMouseUp = () => {
      setIsDraggingBag(false);
    };

    if (isDraggingBag) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingBag]);

  // Cleanup socket on unmount & load confetti script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      document.body.removeChild(script);
    };
  }, []);

  // Save Player Name & Theme
  useEffect(() => {
    safeSetItem('chess_player_name', playerName);
  }, [playerName]);

  useEffect(() => {
    safeSetItem('chess_board_theme', boardTheme);
  }, [boardTheme]);

  // Save Stats
  useEffect(() => {
    safeSetItem('chess_player_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    safeSetItem('chess_show_floating_captures', String(showFloatingCaptures));
  }, [showFloatingCaptures]);

  useEffect(() => {
    safeSetItem('chess_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.body.classList.add('mode-dark');
      document.body.classList.remove('mode-light');
    } else {
      document.body.classList.add('mode-light');
      document.body.classList.remove('mode-dark');
    }
  }, [isDarkMode]);

  // Click outside handler for captures popover
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (capturesRef.current && !capturesRef.current.contains(e.target)) {
        setIsCapturesOpen(false);
      }
    };
    if (isCapturesOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCapturesOpen]);

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

  const triggerHapticFeedback = (type) => {
    if (navigator.vibrate) {
      if (type === 'capture') {
        navigator.vibrate(30);
      } else if (type === 'check') {
        navigator.vibrate([60, 40, 60]);
      } else if (type === 'gameover') {
        navigator.vibrate([150, 50, 150]);
      } else if (type === 'move') {
        navigator.vibrate(10);
      }
    }
  };

  const triggerConfettiCelebration = () => {
    if (window.confetti) {
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }, 250);
    }
  };

  // Sound triggering safely
  const triggerSound = (type) => {
    if (soundEnabled) {
      playSound(type);
    }
    triggerHapticFeedback(type);
  };

  // Helper to show temporary system toast alerts
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // --- PERSISTENT SOCKET CONNECTION & AUTHENTICATION EFFECT ---
  useEffect(() => {
    const BACKEND_PROD_URL = "https://chess-smdm.onrender.com"; 
    const isDev = window.location.port && window.location.port !== '3001';
    const socketUrl = isDev 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : (BACKEND_PROD_URL !== "YOUR_RENDER_BACKEND_URL" ? BACKEND_PROD_URL : window.location.origin);

    const newSocket = io(socketUrl, {
      transports: ['websocket']
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('online_users_update', ({ users, activeMatches }) => {
      setOnlineUsers(users);
      if (activeMatches) {
        setActiveMatches(activeMatches);
      }
    });

    newSocket.on('global_chat_message', (msg) => {
      setGlobalMessages(prev => [...prev, msg].slice(-100));
    });

    newSocket.on('challenge_received', (challenge) => {
      setActiveChallengeRequest(challenge);
      triggerSound('move');
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Chess Challenge!", {
          body: `${challenge.challengerName} has challenged you to a game!`
        });
      }
    });

    newSocket.on('challenge_accepted', ({ roomId, timeControl: tc }) => {
      setRoomCode(roomId);
      setGameMode('online-2p');
      setTimeControl(tc);
      setChatHistory([]);
      setGameStatus('waiting');
      setWinner(null);
      setGame(new Chess());
    });

    newSocket.on('challenge_declined', ({ message }) => {
      showToast(message || "Challenge was declined.");
    });

    newSocket.on('challenge_failed', ({ message }) => {
      showToast(message || "Failed to challenge player.");
    });

    newSocket.on('session_verified', (res) => {
      if (res.success) {
        setIsAuthenticated(true);
        setUserProfile({ name: res.name, email: res.email, stats: res.stats });
      } else {
        safeRemoveItem('chess_user_token');
        safeRemoveItem('chess_user_email');
      }
    });

    newSocket.on('auth_response', (res) => {
      if (res.success) {
        safeSetItem('chess_user_token', res.token);
        safeSetItem('chess_user_email', res.email);
        setIsAuthenticated(true);
        setUserProfile({ name: res.name, email: res.email, stats: res.stats });
      }
    });

    newSocket.on('logged_out', () => {
      setIsAuthenticated(false);
      setUserProfile(null);
      safeRemoveItem('chess_user_token');
      safeRemoveItem('chess_user_email');
    });

    newSocket.on('stats_update', ({ elo, eloChange }) => {
      setUserProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            elo,
            lastEloChange: eloChange,
            gamesPlayed: prev.stats.gamesPlayed + 1,
            onlineMatchesPlayed: prev.stats.onlineMatchesPlayed + 1
          }
        };
      });
    });

    newSocket.on('match_history_data', (matches) => {
      setMatchHistory(matches);
    });

    newSocket.on('public_profile_data', (profile) => {
      setPublicProfileData(profile);
    });

    newSocket.on('friends_list_data', (data) => {
      setFriendsData(data);
    });

    newSocket.on('friend_request_received', ({ senderEmail }) => {
      showToast(`${senderEmail} sent you a friend request!`);
      // Request updated list
      if (newSocket && newSocket.id) {
         // but wait, we need our own email.
         // the server automatically sends the updated list to the user when request is sent, if we set it up. 
         // actually server only sent 'friend_request_received'. Let's just tell server to send us the list:
         // email is tricky here because it's in a closure without current userProfile.
         // so let's rely on server emitting `friends_list_data` automatically if possible.
      }
    });

    newSocket.on('friend_request_sent', (res) => {
      if (res.success) showToast("Friend request sent!");
    });


    newSocket.on('feedback_response', (res) => {
      if (res.success) {
        showToast("Thank you for your feedback! Review logged successfully.");
      } else {
        showToast("Failed to submit feedback. Please try again.");
      }
    });

    newSocket.on('next_match_notification', ({ challengerName, challengerEmail }) => {
      const noteId = Math.random().toString(36).substring(2, 9);
      setNextMatchNotifications(prev => [...prev, { id: noteId, name: challengerName, email: challengerEmail }]);
      triggerSound('capture');
      setTimeout(() => {
        setNextMatchNotifications(prev => prev.filter(n => n.id !== noteId));
      }, 8000);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Sync playerColorRef to avoid dependency loop in room socket listeners
  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);

  // Dynamic Reconnection Logic for Mobile Drops
  useEffect(() => {
    if (!socket) return;
    
    const onReconnect = () => {
      // If we reconnected and have auth, re-verify
      const savedEmail = safeGetItem('chess_user_email', null);
      const savedToken = safeGetItem('chess_user_token', null);
      if (savedEmail && savedToken) {
        socket.emit('verify_session', { email: savedEmail, token: savedToken });
      }
      
      // If we were in a multiplayer match, tell the server we are back
      if (gameMode === 'online-2p' && roomCode) {
        socket.emit('join_room', { 
          roomId: roomCode, 
          name: safeGetItem('chess_user_email') ? 'Player' : 'Guest', // will be overwritten by server state
          timeControl: timeControl
        });
      }
    };

    socket.on('connect', onReconnect);
    return () => socket.off('connect', onReconnect);
  }, [socket, gameMode, roomCode, timeControl]);

  const handleAuthSuccess = (profile, token) => {
    safeSetItem('chess_user_token', token);
    safeSetItem('chess_user_email', profile.email);
    setIsAuthenticated(true);
    setUserProfile(profile);
    
    // Request notification permissions so they get alerts in background
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.emit('logout', { email: userProfile?.email, token: userToken });
    }
  };

  const handleSubmitFeedback = ({ type, rating, message }) => {
    if (socket) {
      socket.emit('submit_feedback', { type, rating, message });
    }
  };

  const handleNotifyPlayer = (targetEmail, targetName) => {
    if (socket) {
      socket.emit('notify_next_match', { targetEmail });
      showToast(`Notified ${targetName} that you are waiting!`);
    }
  };

  const handleSendChallenge = (targetEmail, targetName, timeControlValue) => {
    if (socket) {
      socket.emit('send_challenge', { targetEmail, timeControl: timeControlValue });
      showToast(`Challenge sent to ${targetName}`);
    }
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
      setPlayerColor(botPlaysWhite ? 'black' : 'white');

      if (botPlaysWhite) {
        scheduleBotMove(newGame);
      }
    } else if (mode === 'local-2p') {
      setPlayerColor(null);
    }
  };

  // Score updater logic with Elo calculation
  const updateScores = (gameWinner, finishReason) => {
    if (isSpectator) return;

    setStats(prev => {
      const nextStats = JSON.parse(JSON.stringify(prev));
      if (nextStats.elo === undefined) nextStats.elo = 1200;
      
      const currentElo = nextStats.elo;
      let eloChange = 0;

      if (gameMode === 'vs-bot') {
        const diffKey = difficulty; // 'easy', 'medium', 'hard'
        const botRatings = { easy: 1000, medium: 1400, hard: 1800 };
        const opponentRating = botRatings[diffKey];
        
        const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentElo) / 400));
        let actualScore = 0.5; // draw
        if (gameWinner !== 'draw') {
          const playerIsWhite = botColor === 'black' || (botColor === 'random' && playerColor === 'white');
          const isPlayerWinner = (gameWinner === 'white' && playerIsWhite) || (gameWinner === 'black' && !playerIsWhite);
          actualScore = isPlayerWinner ? 1 : 0;
          if (isPlayerWinner) triggerConfettiCelebration();
        }

        eloChange = Math.round(32 * (actualScore - expectedScore));

        if (gameWinner === 'draw') {
          nextStats.vsBot[diffKey].draws++;
        } else {
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
        } else {
          triggerConfettiCelebration();
          if (gameWinner === 'white') {
            nextStats.local.p1Wins++;
          } else {
            nextStats.local.p2Wins++;
          }
        }
      } else if (gameMode === 'online-2p') {
        let actualScore = 0.5;
        if (gameWinner !== 'draw') {
          const isPlayerWinner = gameWinner === playerColor;
          actualScore = isPlayerWinner ? 1 : 0;
          if (isPlayerWinner) triggerConfettiCelebration();
        }
        eloChange = Math.round(32 * (actualScore - 0.5));

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

      nextStats.elo = Math.max(100, currentElo + eloChange);
      
      if (eloChange > 0) {
        showToast(`🏆 Rating updated: ${nextStats.elo} (+${eloChange})`);
      } else if (eloChange < 0) {
        showToast(`📉 Rating updated: ${nextStats.elo} (${eloChange})`);
      }

      return nextStats;
    });
  };

  const handleSetPremove = (pm) => {
    setPremove(pm);
    premoveRef.current = pm;
  };

  // --- GAME MOVE HANDLER (CLIENT SIDE - LOCAL / VS BOT) ---
  const handleLocalMove = (moveDetails) => {
    try {
      const newGame = new Chess();
      newGame.loadPgn(game.pgn());
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
          scheduleBotMove(newGame);
        }
      }
    } catch (e) {
      console.warn("Invalid move attempted", e);
    }
  };

  const scheduleBotMove = (currentGame) => {
    showToast("Bot thinking...");
    botTimeoutRef.current = setTimeout(() => {
      const botMove = getBestMove(currentGame, difficulty);
      if (botMove) {
        const isBotCapture = currentGame.get(botMove.to) !== null;
        currentGame.move(botMove);
        const botFinishedGame = new Chess();
        botFinishedGame.loadPgn(currentGame.pgn());
        setGame(botFinishedGame);
        setLastMove({ from: botMove.from, to: botMove.to });

        const isBotCheck = currentGame.inCheck();
        const isBotGameOver = currentGame.isGameOver();

        if (isBotGameOver) {
          handleGameOverState(currentGame);
        } else if (isBotCheck) {
          triggerSound('check');
        } else if (isBotCapture) {
          triggerSound('capture');
        } else {
          triggerSound('move');
        }

        if (premoveRef.current && !isBotGameOver) {
          const pm = premoveRef.current;
          handleSetPremove(null);
          
          setTimeout(() => {
            try {
              const isPmCapture = botFinishedGame.get(pm.to) !== null || (pm.promotion && botFinishedGame.get(pm.from)?.type === 'p');
              const pmResult = botFinishedGame.move(pm);
              if (pmResult) {
                const finalPmGame = new Chess();
                finalPmGame.loadPgn(botFinishedGame.pgn());
                setGame(finalPmGame);
                setLastMove({ from: pm.from, to: pm.to });
                if (finalPmGame.isGameOver()) handleGameOverState(finalPmGame);
                else if (finalPmGame.inCheck()) triggerSound('check');
                else if (isPmCapture) triggerSound('capture');
                else triggerSound('move');
                
                if (!finalPmGame.isGameOver()) {
                  scheduleBotMove(finalPmGame);
                }
              }
            } catch (e) {
              console.warn("Premove invalidated by bot's move");
            }
          }, 150);
        }
      }
    }, 600);
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
    setGameMode('online-2p');
    setChatHistory([]);
    setGameStatus('waiting');
    setWinner(null);
    setGame(new Chess());
  };

  const handleJoinOnlineRoom = (code = joinCodeInput) => {
    if (!code.trim()) {
      showToast("Please enter a valid room code.");
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    setRoomCode(cleanCode);
    setGameMode('online-2p');
    setChatHistory([]);
    setGameStatus('waiting');
    setWinner(null);
    setGame(new Chess());
  };

  const handleSwapColors = () => {
    if (socket) socket.emit('select_color');
  };

  const handleJoinAsPlayer = (color) => {
    if (socket) socket.emit('join_as_player', { color });
  };

  const handleSwitchToSpectator = () => {
    if (socket) socket.emit('switch_to_spectator');
  };

  const handleStartGame = () => {
    if (socket) socket.emit('start_game');
  };

  useEffect(() => {
    if (activeTab === 'stats' && isAuthenticated && socket && userProfile?.email) {
      socket.emit('request_match_history', { email: userProfile.email });
    }
  }, [activeTab, isAuthenticated, socket, userProfile]);

  useEffect(() => {
    if (isAuthenticated && socket && userProfile?.email) {
      socket.emit('request_friends_list', { email: userProfile.email });
    }
  }, [isAuthenticated, socket, userProfile?.email]);

  // --- ROOM-SPECIFIC SOCKET EVENT LISTENERS ---
  useEffect(() => {
    if (!socket || !roomCode || gameMode !== 'online-2p') return;

    socket.emit('join_room', {
      roomId: roomCode,
      name: userProfile?.name || playerName,
      timeControl: timeControl
    });

    const handleRoleAssigned = ({ color, isSpectator: spectatorFlag }) => {
      setPlayerColor(color);
      setIsSpectator(spectatorFlag);
      if (spectatorFlag) {
        showToast("Joined room as a spectator");
      } else {
        showToast(`You are playing as ${color.toUpperCase()}`);
      }
    };

    const handleRoomUpdate = (updatedRoomState) => {
      setRoomState(updatedRoomState);
      
      const newGameInstance = new Chess();
      if (updatedRoomState.gameState.history && Array.isArray(updatedRoomState.gameState.history)) {
        for (const m of updatedRoomState.gameState.history) {
          try {
            newGameInstance.move(m);
          } catch (err) {
            console.error("Failed to replay move in history:", m, err);
          }
        }
      } else {
        newGameInstance.load(updatedRoomState.gameState.fen);
      }
      setGame(newGameInstance);
      setGameStatus(updatedRoomState.gameState.status);
      setWinner(updatedRoomState.gameState.winner);
      
      if (updatedRoomState.gameState.status === 'playing') {
        setRematchRequestSent(false);
        setRestartOfferPending(null);
      }

      // Sync last move highlight and play opponent move sound cues
      if (updatedRoomState.gameState.lastMove) {
        const isMyTurn = newGameInstance.turn() === (playerColorRef.current === 'white' ? 'w' : 'b');
        const isCheck = newGameInstance.inCheck();
        const isCapture = updatedRoomState.gameState.lastMove.flags?.includes('c');

        if (isCheck) {
          triggerSound('check');
        } else if (isCapture) {
          triggerSound('capture');
        } else {
          triggerSound('move');
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
      } else if (premoveRef.current && updatedRoomState.gameState.status === 'playing') {
        const isMyTurn = newGameInstance.turn() === (playerColorRef.current === 'white' ? 'w' : 'b');
        if (isMyTurn) {
          const pm = premoveRef.current;
          handleSetPremove(null);
          
          setTimeout(() => {
            try {
              const isCapture = newGameInstance.get(pm.to) !== null || (pm.promotion && newGameInstance.get(pm.from)?.type === 'p');
              const result = newGameInstance.move(pm);
              if (result) {
                const finalPmGame = new Chess();
                finalPmGame.loadPgn(newGameInstance.pgn());
                setGame(finalPmGame);
                setLastMove({ from: pm.from, to: pm.to });
                if (finalPmGame.isGameOver()) triggerSound('gameover');
                else if (finalPmGame.inCheck()) triggerSound('check');
                else if (isCapture) triggerSound('capture');
                else triggerSound('move');
                
                socket.emit('make_move', {
                  move: pm,
                  fen: finalPmGame.fen(),
                  history: finalPmGame.history()
                });
              }
            } catch (e) {
              console.warn("Premove invalidated by opponent's move");
            }
          }, 150);
        }
      }
    };

    const handleChatMessage = (chatMsg) => {
      setChatHistory(prev => [...prev, chatMsg]);
      if (chatMsg.isReaction) {
        triggerSound('capture');
      }
    };

    const handleDrawOffered = ({ from }) => {
      if (from !== playerColorRef.current) {
        setDrawOfferPending(from);
      }
    };

    const handleDrawDeclined = () => {
      showToast("Draw offer declined by opponent.");
    };

    const handleUndoRequested = ({ from }) => {
      if (from !== playerColorRef.current) {
        setUndoRequestPending(from);
      }
    };

    const handleUndoDeclined = () => {
      showToast("Undo request declined by opponent.");
    };

    const handleUndoAccepted = () => {
      setLastMove(null);
      setGameStatus('playing');
      showToast("Move undone.");
    };

    const handleRestartOffered = ({ from }) => {
      if (from !== playerColorRef.current) {
        setRestartOfferPending(from);
      }
    };

    const handleRestartDeclined = () => {
      setRematchRequestSent(false);
      showToast("Restart request declined by opponent.");
    };

    socket.on('role_assigned', handleRoleAssigned);
    socket.on('room_update', handleRoomUpdate);
    socket.on('chat_message', handleChatMessage);
    socket.on('draw_offered', handleDrawOffered);
    socket.on('draw_declined', handleDrawDeclined);
    socket.on('undo_requested', handleUndoRequested);
    socket.on('undo_declined', handleUndoDeclined);
    socket.on('undo_accepted', handleUndoAccepted);
    socket.on('restart_offered', handleRestartOffered);
    socket.on('restart_declined', handleRestartDeclined);

    return () => {
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('room_update', handleRoomUpdate);
      socket.off('chat_message', handleChatMessage);
      socket.off('draw_offered', handleDrawOffered);
      socket.off('draw_declined', handleDrawDeclined);
      socket.off('undo_requested', handleUndoRequested);
      socket.off('undo_declined', handleUndoDeclined);
      socket.off('undo_accepted', handleUndoAccepted);
      socket.off('restart_offered', handleRestartOffered);
      socket.off('restart_declined', handleRestartDeclined);

      setRoomState(null);
      setPlayerColor(null);
      setIsSpectator(false);
      setLastMove(null);
      socket.emit('enter_lobby');
    };
  }, [socket, roomCode, gameMode, timeControl, userProfile]);

  const handleOnlineMove = (moveDetails) => {
    if (!socket || isSpectator || gameStatus !== 'playing') return;

    try {
      const tempGame = new Chess();
      tempGame.loadPgn(game.pgn());
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
      const tempGame = new Chess();
      tempGame.loadPgn(game.pgn());
      
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
      // Pop last move locally and share FEN
      const tempGame = new Chess();
      tempGame.loadPgn(game.pgn());
      tempGame.undo(); // undo requester's last move
      
      socket.emit('undo_response', { accept: true, steps: 1 });
      socket.emit('sync_game', { fen: tempGame.fen(), history: tempGame.history() });
    } else if (socket) {
      socket.emit('undo_response', { accept: false });
    }
    setUndoRequestPending(null);
  };

  const handleOfferRestart = () => {
    if (gameMode === 'online-2p' && socket) {
      socket.emit('offer_restart');
      setRematchRequestSent(true);
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
    if (!accept) {
      setRematchRequestSent(false);
    }
  };

  // --- UTILITIES ---
  const handleExitMatch = () => {
    if (window.confirm("Exit match and return to menu?")) {
      if (socket && gameStatus === 'playing') {
        socket.emit('resign');
      }
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      // Clean query params on return to menu
      window.history.replaceState({}, document.title, window.location.pathname);
      setGameMode('menu');
      setRoomCode('');
    }
  };

  const handleCopyLink = () => {
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?room=${roomCode}`;
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
  if (!isAuthenticated) {
    return (
      <div className={`app-root theme-${boardTheme} ${isDarkMode ? 'mode-dark' : 'mode-light'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        {toastMessage && (
          <div className="toast-alert animate-slide-up">
            {toastMessage}
          </div>
        )}
        <LoginScreen socket={socket} onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className={`app-root theme-${boardTheme} ${isDarkMode ? 'mode-dark' : 'mode-light'}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-alert animate-slide-up">
          {toastMessage}
        </div>
      )}

      {/* Floating Next Match Notifications Stack */}
      {nextMatchNotifications.length > 0 && (
        <div className="next-match-notifications-container">
          {nextMatchNotifications.map((note) => (
            <div key={note.id} className="next-match-notification-bubble animate-slide-in-right">
              <span className="bell-icon">🔔</span>
              <div className="notification-content" style={{ flex: 1, textAlign: 'left', fontSize: '0.8125rem' }}>
                <strong>{note.name}</strong> is waiting to play the next match with you!
              </div>
              <button 
                className="dismiss-note-btn"
                onClick={() => setNextMatchNotifications(prev => prev.filter(n => n.id !== note.id))}
                aria-label="Dismiss notification"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Challenge Request Invitation Overlay Modal */}
      {activeChallengeRequest && (
        <div className="challenge-request-overlay">
          <div className="challenge-card animate-scale-in">
            <div className="challenge-header">
              <span className="challenge-icon">⚔️</span>
              <h4>Challenge Received!</h4>
            </div>
            <p>
              <strong>{activeChallengeRequest.challengerName}</strong> has challenged you to a <strong>{activeChallengeRequest.timeControl.toUpperCase()}</strong> match!
            </p>
            <div className="challenge-actions">
              <button 
                className="btn-primary" 
                onClick={() => {
                  socket.emit('respond_challenge', { challengeId: activeChallengeRequest.challengeId, accept: true });
                  setActiveChallengeRequest(null);
                }}
              >
                Accept Challenge
              </button>
              <button 
                className="btn-danger" 
                onClick={() => {
                  socket.emit('respond_challenge', { challengeId: activeChallengeRequest.challengeId, accept: false });
                  setActiveChallengeRequest(null);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Guidelines isOpen={isGuidelinesOpen} onClose={() => setIsGuidelinesOpen(false)} />
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
        onSubmit={handleSubmitFeedback} 
      />

      {/* Main Container */}
      <div className="game-container">
        
        {/* --- MENU SCREEN --- */}
        {gameMode === 'menu' && (
          <div className="menu-screen-layout">
            <div className="menu-card animate-fade-in">
              <header className="menu-header">
                <h1>👑 Apex Chess</h1>
                <p className="welcome-greeting">👋 Welcome, {userProfile?.name}! Let's build our strategic mind!</p>
              </header>

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
                      <span>Bot Color:</span>
                      <div className="btn-segmented">
                        {[
                          { val: 'white', label: 'WHITE' },
                          { val: 'black', label: 'BLACK' },
                          { val: 'random', label: 'RANDOM' }
                        ].map(c => (
                          <button
                            key={c.val}
                            className={botColor === c.val ? 'active' : ''}
                            onClick={() => setBotColor(c.val)}
                          >
                            {c.label}
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
                      aria-label="Select match time control"
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
                  <BookOpen size={16} /> <span>How to Play Rules</span>
                </button>
                <button 
                  className="btn-text" 
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    triggerSound('move');
                  }}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span>{soundEnabled ? "Mute Sounds" : "Unmute Sounds"}</span>
                </button>
                <button 
                  className="btn-text" 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  title={isDarkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
                >
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDarkMode ? "Day Mode" : "Night Mode"}</span>
                </button>
                {("Notification" in window) && (
                  <button 
                    className="btn-text" 
                    onClick={() => {
                      if (Notification.permission === 'granted') {
                        showToast("Notifications are already enabled.");
                      } else {
                        Notification.requestPermission().then(perm => {
                          if (perm === 'granted') showToast("Push notifications enabled!");
                        });
                      }
                    }}
                    title="Enable Push Notifications"
                  >
                    {Notification.permission === 'granted' ? <Bell size={16} /> : <BellOff size={16} />}
                    <span>{Notification.permission === 'granted' ? "Alerts On" : "Enable Alerts"}</span>
                  </button>
                )}
                <button 
                  className="btn-text" 
                  onClick={() => setIsFeedbackOpen(true)}
                  title="Share Feedback or Write a Review"
                >
                  <MessageSquarePlus size={16} /> <span>Share Feedback</span>
                </button>
                <button 
                  className="btn-text btn-logout" 
                  onClick={handleLogout}
                  title="Logout Account"
                >
                  <LogOut size={16} /> <span>Logout</span>
                </button>
              </footer>
            </div>

            <div className="menu-lobby-sidebar">
              <OnlinePlayersPanel
                onlineUsers={onlineUsers}
                activeMatches={activeMatches}
                globalMessages={globalMessages}
                socket={socket}
                playerName={playerName}
                currentUserEmail={userProfile?.email}
                onSendChallenge={handleSendChallenge}
                onNotifyPlayer={handleNotifyPlayer}
                onWatchMatch={(roomId) => socket.emit('join_room', { roomCode: roomId, role: 'spectator' })}
              />
            </div>
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
                    <button className="copy-link-btn" onClick={handleCopyLink} title="Copy invitation link" aria-label="Copy invitation link">
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
                  aria-label="Select board theme"
                >
                  <option value="classic">Birch Wood</option>
                  <option value="wood">Walnut Wood</option>
                  <option value="metal">Brushed Metal</option>
                  <option value="slate">Modern Slate</option>
                  <option value="gold">Midnight Gold</option>
                  <option value="forest">Forest Green</option>
                </select>

                <button 
                  className="icon-only-btn" 
                  onClick={() => setIsGuidelinesOpen(true)}
                  title="Rules & Guidelines"
                  aria-label="Rules and Guidelines"
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
                  aria-label="Toggle Sound"
                >
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>

                <button 
                  className="icon-only-btn" 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  title={isDarkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
                  aria-label={isDarkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <button 
                  className={`icon-only-btn ${showFloatingCaptures ? 'active-icon' : 'inactive-icon'}`}
                  onClick={() => setShowFloatingCaptures(!showFloatingCaptures)}
                  title={showFloatingCaptures ? "Hide Floating Captures Bag" : "Show Floating Captures Bag"}
                  aria-label={showFloatingCaptures ? "Hide Floating Captures Bag" : "Show Floating Captures Bag"}
                >
                  <Coins size={20} />
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
                Profile
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
                      {isSpectator && !roomState?.players.white && (
                        <button className="btn-select-slot-color btn-take-seat" onClick={() => handleJoinAsPlayer('white')}>
                          📥 Sit as White
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
                      {isSpectator && !roomState?.players.black && (
                        <button className="btn-select-slot-color btn-take-seat" onClick={() => handleJoinAsPlayer('black')}>
                          📥 Sit as Black
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Switch to Spectator option for players in lobby */}
                  {!isSpectator && (
                    <div className="lobby-spectate-toggle-row">
                      <button className="btn-secondary" onClick={handleSwitchToSpectator}>
                        👁️ Switch to Spectator Mode
                      </button>
                    </div>
                  )}

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
                        {formatClock(playerColor === 'black' ? clocks.white : clocks.black)}
                      </div>
                    )}
                  </div>

                  {/* Interactive Chessboard */}
                  <div className="chessboard-wrapper-container">
                    <Chessboard
                      game={game}
                      onMove={gameMode === 'online-2p' ? handleOnlineMove : handleLocalMove}
                      turn={activeTurn}
                      playerColor={gameMode === 'online-2p' || gameMode === 'vs-bot' ? playerColor : null}
                      boardTheme={boardTheme}
                      interactive={gameStatus === 'playing' && !isSpectator}
                      lastMove={lastMove}
                      premove={premove}
                      onPremove={handleSetPremove}
                    />

                    {/* Floating Captured Pieces (Coins) Toggler */}
                    {gameStatus === 'playing' && showFloatingCaptures && (
                      <div 
                        className="floating-captures-container" 
                        ref={capturesRef}
                        style={{
                          transform: `translate(${bagPos.x}px, ${bagPos.y}px)`
                        }}
                      >
                        <button 
                          className={`floating-captures-trigger ${isCapturesOpen ? 'active' : ''}`}
                          onMouseDown={handleBagMouseDown}
                          onTouchStart={handleBagTouchStart}
                          onClick={() => {
                            if (bagDragDist.current > 5) {
                              bagDragDist.current = 0;
                              return; // ignore as it was a drag
                            }
                            setIsCapturesOpen(!isCapturesOpen);
                          }}
                          title="Drag to reposition / Click to view captured coins"
                          aria-label="View Captured Pieces"
                        >
                          🪙 <span className="captured-badge-count">{capturedPieces[playerColor === 'black' ? 'b' : 'w'].length}</span>
                        </button>

                        {isCapturesOpen && (
                          <div className="floating-captures-popover animate-fade-in">
                            <div className="popover-header">
                              <h4>Captured Coins</h4>
                              <span className="material-advantage-badge">
                                {materialBalance.whiteLead 
                                  ? `White ${materialBalance.whiteLead}` 
                                  : materialBalance.blackLead 
                                    ? `Black ${materialBalance.blackLead}` 
                                    : 'Even'}
                              </span>
                            </div>

                            <div className="popover-divider" />

                            <div className="popover-section">
                              <h5>Captured by You ({capturedPieces[playerColor === 'black' ? 'b' : 'w'].length})</h5>
                              <div className="captured-grid">
                                {capturedPieces[playerColor === 'black' ? 'b' : 'w'].length === 0 ? (
                                  <span className="empty-label">None captured yet</span>
                                ) : (
                                  capturedPieces[playerColor === 'black' ? 'b' : 'w'].map((p, idx) => (
                                    <span key={idx} className="captured-piece-chip" title={`${p.type.toUpperCase()}`}>
                                      {p.type.toUpperCase()}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="popover-divider" />

                            <div className="popover-section">
                              <h5>Captured by Opponent ({capturedPieces[playerColor === 'black' ? 'w' : 'b'].length})</h5>
                              <div className="captured-grid">
                                {capturedPieces[playerColor === 'black' ? 'w' : 'b'].length === 0 ? (
                                  <span className="empty-label">None captured yet</span>
                                ) : (
                                  capturedPieces[playerColor === 'black' ? 'w' : 'b'].map((p, idx) => (
                                    <span key={idx} className="captured-piece-chip opponent" title={`${p.type.toUpperCase()}`}>
                                      {p.type.toUpperCase()}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Card (Bottom) */}
                  <div className={`player-card self ${activeTurn === (playerColor === 'white' ? 'w' : 'b') && gameStatus === 'playing' ? 'active-turn' : ''}`}>
                    <div className="player-meta">
                      <span className="avatar">👤</span>
                      <div className="name-section">
                        <span className="player-name">
                          {gameMode === 'vs-bot' && `${playerName} (${stats.elo || 1200})`}
                          {gameMode === 'local-2p' && "Player 1 (White)"}
                          {gameMode === 'online-2p' && (
                            isSpectator ? `${playerName} (Spectator)` : `${playerName} (${stats.elo || 1200})`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Captured Pieces by User */}
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
                        {formatClock(playerColor === 'black' ? clocks.black : clocks.white)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Column 1 (Left): Moves & Stats */}
            <div className="left-column">
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
                <ProfilePanel 
                  stats={stats} 
                  userProfile={userProfile}
                  matchHistory={matchHistory}
                  onViewReplay={(match) => setViewingMatch(match)}
                  onResetStats={() => {
                    if (window.confirm("Reset all statistics?")) {
                      setStats(DEFAULT_STATS);
                      showToast("Stats reset successfully.");
                    }
                  }}
                />
              </div>

              {/* Tab: Online Players */}
              <div className="dashboard-tab-pane mobile-hidden">
                <OnlinePlayersPanel 
                  onlineUsers={onlineUsers} 
                  activeMatches={activeMatches}
                  globalMessages={globalMessages}
                  currentUserEmail={userProfile?.email}
                  onSendChallenge={handleSendChallenge}
                  onNotifyPlayer={handleNotifyPlayer}
                  onWatchMatch={handleJoinAsSpectator}
                  socket={socket}
                  playerName={playerName}
                  friendsData={friendsData}
                />
              </div>
            </div>

            {/* Column 3 (Right): Actions & Chat */}
            <div className="right-column">
              {/* Online Game Prompts / Notifications inside dashboard */}
              {(drawOfferPending || undoRequestPending || (restartOfferPending && gameStatus === 'playing')) && (
                <div className="dialog-alert-card animate-fade-in">
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
                  {restartOfferPending && gameStatus === 'playing' && (
                    <div className="alert-content">
                      <p>Opponent requested to Restart the match.</p>
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
                  
                  {gameMode === 'online-2p' && userProfile?.stats?.lastEloChange !== undefined && !isSpectator && (
                    <div className="game-over-elo-change" style={{ margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        ELO: {userProfile.stats.elo} 
                        <span style={{ 
                          color: userProfile.stats.lastEloChange >= 0 ? 'var(--color-emerald)' : 'var(--color-danger)',
                          marginLeft: '8px'
                        }}>
                          ({userProfile.stats.lastEloChange >= 0 ? '+' : ''}{userProfile.stats.lastEloChange})
                        </span>
                      </span>
                    </div>
                  )}

                  {gameMode === 'online-2p' ? (
                    isSpectator ? (
                      <p className="spectator-msg">Waiting for players to request rematch...</p>
                    ) : restartOfferPending ? (
                      <div className="rematch-proposal-box">
                        <p className="rematch-proposal-text font-pulse">🤝 Opponent offered a Rematch!</p>
                        <div className="btn-actions-row">
                          <button className="btn-primary" onClick={() => handleRespondRestart(true)}>
                            Accept
                          </button>
                          <button className="btn-danger" onClick={() => handleRespondRestart(false)}>
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : rematchRequestSent ? (
                      <div className="rematch-status-box">
                        <p className="rematch-status-text font-pulse">⏳ Waiting for opponent to accept...</p>
                      </div>
                    ) : (
                      <button className="btn-primary" onClick={handleOfferRestart}>
                        <RotateCcw size={16} /> Request Rematch
                      </button>
                    )
                  ) : (
                    <button className="btn-primary" onClick={handleOfferRestart}>
                      <RotateCcw size={16} /> Play Again
                    </button>
                  )}
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
                  disabled={
                    gameStatus !== 'playing' || 
                    isSpectator || 
                    (gameMode === 'online-2p' && activeTurn === (playerColor === 'white' ? 'w' : 'b')) || 
                    game.history().length === 0
                  }
                >
                  ↩️ Request Undo
                </button>

                <button 
                  className="action-tile restart" 
                  onClick={handleOfferRestart}
                  disabled={isSpectator || rematchRequestSent}
                >
                  {rematchRequestSent ? "⏳ Waiting for Restart..." : "🔄 Restart Match"}
                </button>
                
                <button 
                  className="action-tile config" 
                  onClick={() => setShowFloatingCaptures(!showFloatingCaptures)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Coins size={16} /> {showFloatingCaptures ? "Hide Captures Bag" : "Show Captures Bag"}
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
            </div>
          </div>
        )}

      </div>
      
      {publicProfileData && (
        <PublicProfileModal 
          profile={publicProfileData}
          onClose={() => setPublicProfileData(null)}
          onViewReplay={(match, profileEmail) => {
             // We can open the replay viewer directly from here!
             setViewingMatch({
               ...match, 
               userIsWhite: profileEmail.toLowerCase() === match.whiteEmail 
             });
          }}
          socket={socket}
          currentUserEmail={userProfile?.email}
        />
      )}

      {viewingMatch && (
        <ReplayViewerModal 
          match={{
            ...viewingMatch, 
            userIsWhite: viewingMatch.userIsWhite !== undefined ? viewingMatch.userIsWhite : (userProfile?.email?.toLowerCase() === viewingMatch.whiteEmail)
          }} 
          onClose={() => setViewingMatch(null)} 
        />
      )}
    </div>
  );
}

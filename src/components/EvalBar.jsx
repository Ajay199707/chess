import React, { useMemo } from 'react';
import { evaluateBoard } from '../utils/chessAI';

export const EvalBar = ({ game, isFlipped }) => {
  const score = useMemo(() => {
    // If checkmate, give infinite score to the winner
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? -20000 : 20000;
    }
    return evaluateBoard(game);
  }, [game.fen()]);

  // Use tanh to map score smoothly between -1 and 1
  const normalized = Math.tanh(score / 600); 
  
  // Convert to percentage (0% means completely black, 100% completely white)
  let whitePercent = 50 + (50 * normalized);
  
  // Cap between 2% and 98% visually unless checkmate
  if (game.isCheckmate()) {
     whitePercent = game.turn() === 'w' ? 0 : 100;
  } else {
     whitePercent = Math.max(5, Math.min(95, whitePercent));
  }

  // Formatting text e.g. "+1.2" or "-0.5"
  const getScoreText = () => {
    if (game.isCheckmate()) return 'M';
    const val = (score / 100).toFixed(1);
    return score > 0 ? `+${val}` : val;
  };

  const isWhiteWinning = score > 0;

  return (
    <div className="eval-bar-container" style={{
      width: '18px',
      height: '100%',
      backgroundColor: '#333333',
      borderRadius: '6px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: isFlipped ? 'column-reverse' : 'column',
      position: 'relative',
      border: '1px solid var(--border-color)',
      marginRight: '12px'
    }}>
      {/* Black's section */}
      <div style={{
        flex: isFlipped ? `0 0 ${whitePercent}%` : `0 0 ${100 - whitePercent}%`,
        backgroundColor: '#262421', // Lichess-style dark gray
        transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%'
      }} />

      {/* White's section */}
      <div style={{
        flex: isFlipped ? `0 0 ${100 - whitePercent}%` : `0 0 ${whitePercent}%`,
        backgroundColor: '#ffffff',
        transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%'
      }} />

      {/* Score Text */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '0.65rem',
        zIndex: 2,
        color: isWhiteWinning ? '#262421' : '#ffffff',
        bottom: isFlipped ? (isWhiteWinning ? 'auto' : '4px') : (isWhiteWinning ? '4px' : 'auto'),
        top: isFlipped ? (isWhiteWinning ? '4px' : 'auto') : (isWhiteWinning ? 'auto' : '4px'),
      }}>
        {getScoreText()}
      </div>
    </div>
  );
};

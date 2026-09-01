import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from './Chessboard';
import { Chess } from 'chess.js';
import { X, ChevronLeft, ChevronRight, Copy, Check, FastForward, Rewind } from 'lucide-react';

export const ReplayViewerModal = ({ match, onClose }) => {
  const [game] = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (match?.pgn) {
      game.loadPgn(match.pgn);
      setHistory(game.history({ verbose: true }));
      setCurrentMoveIndex(game.history().length); // start at the end
    }
  }, [match, game]);

  const tempGameInstance = useMemo(() => {
    const tempGame = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      tempGame.move(history[i]);
    }
    return tempGame;
  }, [currentMoveIndex, history]);

  const handlePrev = () => setCurrentMoveIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentMoveIndex(prev => Math.min(history.length, prev + 1));
  const handleStart = () => setCurrentMoveIndex(0);
  const handleEnd = () => setCurrentMoveIndex(history.length);

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(match.pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!match) return null;

  const isWhite = match.userIsWhite; // We'll pass this in
  const opponentName = isWhite ? match.blackName : match.whiteName;
  const boardOrientation = isWhite ? 'white' : 'black';

  return (
    <div className="login-overlay-container" style={{ zIndex: 1100 }}>
      <div className="login-card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: 0 }}>Match Replay</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs {opponentName} • {new Date(match.date).toLocaleDateString()}</span>
          </div>
          <button className="icon-only-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="replay-board-wrapper" style={{ margin: '0 auto', width: '100%', maxWidth: '400px' }}>
          <Chessboard 
            game={tempGameInstance} 
            playerColor={boardOrientation}
            interactive={false}
          />
        </div>

        <div className="replay-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
          <button className="btn-secondary" style={{ padding: '0.5rem' }} onClick={handleStart} disabled={currentMoveIndex === 0}><Rewind size={20} /></button>
          <button className="btn-primary" style={{ padding: '0.5rem 1.5rem' }} onClick={handlePrev} disabled={currentMoveIndex === 0}><ChevronLeft size={24} /></button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', width: '50px', textAlign: 'center' }}>
            {currentMoveIndex} / {history.length}
          </span>
          <button className="btn-primary" style={{ padding: '0.5rem 1.5rem' }} onClick={handleNext} disabled={currentMoveIndex === history.length}><ChevronRight size={24} /></button>
          <button className="btn-secondary" style={{ padding: '0.5rem' }} onClick={handleEnd} disabled={currentMoveIndex === history.length}><FastForward size={20} /></button>
        </div>

        <div className="replay-footer" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button className="btn-outline-gold" onClick={handleCopyPgn} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
            {copied ? 'PGN Copied!' : 'Copy PGN'}
          </button>
        </div>

      </div>
    </div>
  );
};

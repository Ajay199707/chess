import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { evaluateBoard, getBestMove } from '../utils/chessAI';
import { X, Search, AlertTriangle, AlertCircle, Sparkles, MoveRight } from 'lucide-react';
import { Chessboard } from './Chessboard'; // Assume we can re-use it visually

export const GameReviewModal = ({ gameHistory, onClose, initialTheme }) => {
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [reviewGame, setReviewGame] = useState(() => new Chess());

  useEffect(() => {
    // Run analysis in background (using setTimeout chunks to avoid freezing UI)
    const runAnalysis = async () => {
      setAnalyzing(true);
      const history = gameHistory.history({ verbose: true });
      const tempGame = new Chess();
      let prevEval = 0;
      
      const newAnalysis = [];
      
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        
        // Before move evaluation (approximate using evaluateBoard directly, note: evaluateBoard doesn't run full minimax tree, just static eval, but good enough for a basic demo)
        const staticScoreBefore = evaluateBoard(tempGame);
        tempGame.move(move);
        const staticScoreAfter = evaluateBoard(tempGame);
        
        // Real engine would do deep search. We will simulate deep search by using getBestMove depth 2 if needed, 
        // but static eval difference works for basic 'Blunder' detection if someone hangs a piece!
        
        // White move: positive is good. Black move: negative is good.
        // Diff from the perspective of the player who just moved
        const isWhite = i % 2 === 0;
        const diff = isWhite ? (staticScoreAfter - prevEval) : (prevEval - staticScoreAfter);
        
        let classification = 'good'; // 'good', 'inaccuracy', 'mistake', 'blunder', 'brilliant'
        let icon = null;
        let color = '#a3a3a3';

        if (diff <= -300) {
          classification = 'blunder';
          icon = <AlertTriangle size={16} />;
          color = '#ef4444'; // red
        } else if (diff <= -150) {
          classification = 'mistake';
          icon = <AlertCircle size={16} />;
          color = '#f97316'; // orange
        } else if (diff <= -50) {
          classification = 'inaccuracy';
          icon = <span style={{fontWeight:'bold', fontSize:'14px'}}>?!</span>;
          color = '#eab308'; // yellow
        } else if (diff >= 300) {
          classification = 'brilliant';
          icon = <Sparkles size={16} />;
          color = '#06b6d4'; // cyan
        }

        newAnalysis.push({
          moveNumber: Math.floor(i/2) + 1,
          san: move.san,
          color: isWhite ? 'white' : 'black',
          fen: tempGame.fen(),
          classification,
          icon,
          colorHex: color,
          diff
        });
        
        prevEval = staticScoreAfter;

        // Yield to main thread
        await new Promise(r => setTimeout(r, 10));
      }

      setAnalysis(newAnalysis);
      setReviewGame(new Chess());
      setAnalyzing(false);
    };
    
    runAnalysis();
  }, [gameHistory]);

  const goToMove = (index) => {
    if (index < 0 || index > analysis.length) return;
    setCurrentMoveIndex(index);
    const newG = new Chess();
    if (index > 0) {
      newG.load(analysis[index - 1].fen);
    }
    setReviewGame(newG);
  };

  const currentAnalysis = currentMoveIndex > 0 ? analysis[currentMoveIndex - 1] : null;

  return (
    <div className="challenge-request-overlay" style={{ zIndex: 3000 }} onClick={onClose}>
      <div className="challenge-card animate-scale-in" style={{ maxWidth: '800px', width: '90%', padding: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Left: Board */}
        <div style={{ flex: 1, padding: '1rem', background: '#1e1c1a' }}>
          <div style={{ pointerEvents: 'none' }}>
            <Chessboard game={reviewGame} boardTheme={initialTheme} interactive={false} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-secondary" onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex === 0 || analyzing}>Previous</button>
            <button className="btn-secondary" onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex === analysis.length || analyzing}>Next</button>
          </div>
        </div>

        {/* Right: Panel */}
        <div style={{ width: '300px', background: 'var(--bg-surface)', padding: '1rem', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={20} /> Game Review
            </h3>
            <button className="icon-only-btn" onClick={onClose}><X size={20} /></button>
          </div>

          {analyzing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ marginBottom: '1rem' }} />
              Engine analyzing game...
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {currentAnalysis && (
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: `4px solid ${currentAnalysis.colorHex}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: currentAnalysis.colorHex }}>
                    {currentAnalysis.icon}
                    <span style={{ textTransform: 'capitalize' }}>{currentAnalysis.classification}</span>
                  </div>
                  <div>
                    {currentAnalysis.color === 'white' ? 'White' : 'Black'} played <strong>{currentAnalysis.san}</strong>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.9rem' }}>
                <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Move List</h4>
                {analysis.reduce((result, item, index) => {
                  if (index % 2 === 0) {
                    result.push([item]);
                  } else {
                    result[result.length - 1].push(item);
                  }
                  return result;
                }, []).map((pair, idx) => (
                  <div key={idx} style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: '30px', color: 'var(--text-muted)' }}>{idx + 1}.</div>
                    
                    <div 
                      style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: currentMoveIndex === idx*2 + 1 ? 'rgba(255,255,255,0.1)' : 'transparent', padding: '2px 4px', borderRadius: '4px' }}
                      onClick={() => goToMove(idx*2 + 1)}
                    >
                      {pair[0].san} {pair[0].classification !== 'good' && <span style={{ color: pair[0].colorHex, display: 'flex', alignItems: 'center' }}>{pair[0].icon}</span>}
                    </div>

                    <div 
                      style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: currentMoveIndex === idx*2 + 2 ? 'rgba(255,255,255,0.1)' : 'transparent', padding: '2px 4px', borderRadius: '4px' }}
                      onClick={() => pair[1] && goToMove(idx*2 + 2)}
                    >
                      {pair[1] && pair[1].san} {pair[1] && pair[1].classification !== 'good' && <span style={{ color: pair[1].colorHex, display: 'flex', alignItems: 'center' }}>{pair[1].icon}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

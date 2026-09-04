import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessPieceSVG } from '../utils/chessPieces';

export const Chessboard = ({
  game,
  onMove,
  turn,
  playerColor, // 'white', 'black', or null (for local/bot mode)
  boardTheme = 'classic',
  interactive = true,
  lastMove = null,
  premove = null,
  onPremove = null,
}) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [promotionPending, setPromotionPending] = useState(null); // { from, to }
  const [animatingMove, setAnimatingMove] = useState(null);

  // Flip board if player is black
  const isFlipped = playerColor === 'black';

  // Normalize playerColor: 'white' -> 'w', 'black' -> 'b', null -> null
  const normalizedPlayerColor = playerColor === 'white' ? 'w' : playerColor === 'black' ? 'b' : null;

  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const displayRanks = isFlipped ? [...ranks].reverse() : ranks;
  const displayFiles = isFlipped ? [...files].reverse() : files;

  // Clear selections when game state changes
  useEffect(() => {
    setSelectedSquare(null);
    setPossibleMoves([]);
    setPromotionPending(null);
  }, [game]);

  useEffect(() => {
    if (lastMove) {
      setAnimatingMove({ ...lastMove, id: Date.now() });
    }
  }, [lastMove]);

  const getSquareName = (file, rank) => `${file}${rank}`;

  // Find checking King's square if in check
  const getKingInCheckSquare = () => {
    if (!game.inCheck()) return null;
    const activeColor = game.turn();
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq && sq.type === 'k' && sq.color === activeColor) {
          const filesArr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          return `${filesArr[c]}${8 - r}`;
        }
      }
    }
    return null;
  };

  const kingInCheck = getKingInCheckSquare();

  // Click handler
  const handleSquareClick = (square) => {
    if (!interactive) return;

    const piece = game.get(square);
    const isOpponentTurn = normalizedPlayerColor && normalizedPlayerColor !== game.turn();

    // If spectator (not playing in this game), no interaction
    if (normalizedPlayerColor && game.turn() !== normalizedPlayerColor && !onPremove) {
      return;
    }

    // If a promotion modal is open, force selection there
    if (promotionPending) return;

    // Helper to get pseudo-legal moves for premoving
    const getPremoveMoves = (sq) => {
      try {
        const fenParts = game.fen().split(' ');
        fenParts[1] = normalizedPlayerColor; // force our turn
        fenParts[3] = '-'; // clear en-passant target to avoid FEN validation errors
        const dummy = new Chess(fenParts.join(' '));
        return dummy.moves({ square: sq, verbose: true }).map(m => m.to);
      } catch (e) {
        return [];
      }
    };

    // Case 1: Select own piece
    if (piece && (!normalizedPlayerColor || piece.color === normalizedPlayerColor)) {
      if (isOpponentTurn && onPremove) {
        // Premove selection
        if (premove && premove.from === square && !premove.to) {
          // Deselect
          setSelectedSquare(null);
          setPossibleMoves([]);
          onPremove(null);
        } else {
          setSelectedSquare(square);
          setPossibleMoves(getPremoveMoves(square));
          // If we had a full premove before, clear it because we are selecting a new piece
          onPremove(null);
        }
        return;
      } else if (!isOpponentTurn && piece.color === game.turn()) {
        // Normal selection
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
        return;
      }
    }

    // Case 2: Attempt move to clicked square
    if (selectedSquare) {
      if (possibleMoves.includes(square)) {
        if (isOpponentTurn && onPremove) {
          // Register premove
          onPremove({ from: selectedSquare, to: square, promotion: 'q' });
          setSelectedSquare(null);
          setPossibleMoves([]);
        } else {
          // Normal move
          const movingPiece = game.get(selectedSquare);
          const isPawn = movingPiece && movingPiece.type === 'p';
          const isPromotionRank = square.endsWith('8') || square.endsWith('1');

          if (isPawn && isPromotionRank) {
            setPromotionPending({ from: selectedSquare, to: square });
          } else {
            executeMove(selectedSquare, square);
          }
        }
      } else {
        // Reset selections if clicked elsewhere
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  const executeMove = (from, to, promotion = 'q') => {
    onMove({ from, to, promotion });
    setSelectedSquare(null);
    setPossibleMoves([]);
    setPromotionPending(null);
  };

  // Drag-and-drop events
  const handleDragStart = (e, square) => {
    if (!interactive) return;
    
    const isOpponentTurn = normalizedPlayerColor && normalizedPlayerColor !== game.turn();
    
    if (isOpponentTurn && !onPremove) {
      e.preventDefault();
      return;
    }

    const piece = game.get(square);
    if (piece && (!normalizedPlayerColor || piece.color === normalizedPlayerColor)) {
      if (isOpponentTurn) {
        if (piece.color !== normalizedPlayerColor) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', square);
        setSelectedSquare(square);
        
        // Helper to get pseudo-legal moves for premoving
        try {
          const fenParts = game.fen().split(' ');
          fenParts[1] = normalizedPlayerColor; 
          fenParts[3] = '-'; // clear en-passant target to avoid FEN validation errors
          const dummy = new Chess(fenParts.join(' '));
          const moves = dummy.moves({ square, verbose: true });
          setPossibleMoves(moves.map(m => m.to));
        } catch (e) {
          setPossibleMoves([]);
        }
      } else {
        if (piece.color !== game.turn()) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', square);
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
      }
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetSquare) => {
    e.preventDefault();
    const sourceSquare = e.dataTransfer.getData('text/plain');

    if (sourceSquare && possibleMoves.includes(targetSquare)) {
      const isOpponentTurn = normalizedPlayerColor && normalizedPlayerColor !== game.turn();
      
      if (isOpponentTurn && onPremove) {
        onPremove({ from: sourceSquare, to: targetSquare, promotion: 'q' });
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        const movingPiece = game.get(sourceSquare);
        const isPawn = movingPiece && movingPiece.type === 'p';
        const isPromotionRank = targetSquare.endsWith('8') || targetSquare.endsWith('1');

        if (isPawn && isPromotionRank) {
          setPromotionPending({ from: sourceSquare, to: targetSquare });
        } else {
          executeMove(sourceSquare, targetSquare);
        }
      }
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const getSquareCenter = (sq) => {
    const fileIdx = displayFiles.indexOf(sq[0]);
    const rankIdx = displayRanks.indexOf(parseInt(sq[1]));
    return {
      x: fileIdx * 12.5 + 6.25,
      y: rankIdx * 12.5 + 6.25
    };
  };

  const renderArrows = () => {
    const allArrows = [...arrows];
    if (drawStart && drawCurrent && drawStart !== drawCurrent) {
      allArrows.push({ start: drawStart, end: drawCurrent, isTemp: true });
    }
    
    if (allArrows.length === 0) return null;

    return (
      <svg className="arrows-overlay" viewBox="0 0 100 100" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10}}>
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="rgba(235, 97, 80, 0.8)" />
          </marker>
        </defs>
        {allArrows.map((arrow, idx) => {
          const s = getSquareCenter(arrow.start);
          const e = getSquareCenter(arrow.end);
          const dx = e.x - s.x;
          const dy = e.y - s.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          const shorten = 3;
          const ex = e.x - (dx/len)*shorten;
          const ey = e.y - (dy/len)*shorten;
          
          return (
            <line
              key={idx}
              x1={s.x}
              y1={s.y}
              x2={ex}
              y2={ey}
              stroke="rgba(235, 97, 80, 0.8)"
              strokeWidth="1.8"
              markerEnd="url(#arrowhead)"
              opacity={arrow.isTemp ? 0.6 : 1}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div 
      className={`chessboard-wrapper theme-${boardTheme}`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onPremove) onPremove(null);
        setSelectedSquare(null);
        setPossibleMoves([]);
      }}
    >
      <div className="chessboard" style={{ position: 'relative' }}>
        {renderArrows()}
        {displayRanks.map((rank) =>
          displayFiles.map((file) => {
            const squareName = getSquareName(file, rank);
            let piece = game.get(squareName);
            
            // Visually move the piece if it's currently premoved
            if (premove) {
              if (squareName === premove.from) {
                piece = null;
              } else if (squareName === premove.to) {
                piece = game.get(premove.from);
                // Note: If they premove to capture an opponent's piece, this overwrites 
                // the opponent's piece visually on this square, which matches standard behavior.
              }
            }

            const isDark = (files.indexOf(file) + ranks.indexOf(rank)) % 2 !== 0;
            const isSelected = selectedSquare === squareName;
            const isPossibleDest = possibleMoves.includes(squareName);
            const isLastSource = lastMove?.from === squareName;
            const isLastDest = lastMove?.to === squareName;
            const isKingInCheck = kingInCheck === squareName;
            const isPremoveSource = premove?.from === squareName;
            const isPremoveDest = premove?.to === squareName;

            let squareClass = 'square';
            if (isDark) squareClass += ' dark';
            else squareClass += ' light';

            if (isSelected) squareClass += ' selected';
            if (customHighlights.has(squareName)) squareClass += ' custom-highlight';
            if (isLastSource || isLastDest) squareClass += ' last-move';
            if (isKingInCheck) squareClass += ' king-check';
            if (isPremoveSource || isPremoveDest) squareClass += ' premove';

            return (
              <div
                key={squareName}
                className={squareClass}
                onClick={() => handleSquareClick(squareName)}
                onMouseDown={(e) => handleSquareMouseDown(e, squareName)}
                onMouseEnter={() => handleSquareMouseEnter(squareName)}
                onMouseUp={(e) => handleSquareMouseUp(e, squareName)}
                onContextMenu={(e) => e.preventDefault()}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, squareName)}
                style={{ position: 'relative' }}
              >
                {/* Piece Rendering */}
                {piece && (() => {
                  const isAnimating = animatingMove && squareName === animatingMove.to && !isPremoveDest;
                  const dx = isAnimating ? (displayFiles.indexOf(animatingMove.from[0]) - displayFiles.indexOf(animatingMove.to[0])) * 100 : 0;
                  const dy = isAnimating ? (displayRanks.indexOf(parseInt(animatingMove.from[1])) - displayRanks.indexOf(parseInt(animatingMove.to[1]))) * 100 : 0;
                  
                  return (
                    <div
                      key={isAnimating ? `anim-${animatingMove.id}` : `static-${piece.type}-${piece.color}`}
                      className={`piece ${normalizedPlayerColor && piece.color !== game.turn() ? 'inert' : 'draggable'} ${isAnimating ? 'animate-move' : ''}`}
                      draggable={interactive && (!normalizedPlayerColor || piece.color === normalizedPlayerColor)}
                      onDragStart={(e) => handleDragStart(e, squareName)}
                      style={isAnimating ? { '--dx': `${dx}%`, '--dy': `${dy}%` } : {}}
                    >
                      <ChessPieceSVG type={piece.type} color={piece.color} />
                    </div>
                  );
                })()}

                {/* Possible move dot marker */}
                {isPossibleDest && (
                  <div className={`move-indicator ${piece ? 'capture' : ''}`} />
                )}

                {/* Ranks & Files Labels (Only on edge squares) */}
                {((!isFlipped && file === 'a') || (isFlipped && file === 'h')) && (
                  <span className="coordinate rank">{rank}</span>
                )}
                {((!isFlipped && rank === 1) || (isFlipped && rank === 8)) && (
                  <span className="coordinate file">{file}</span>
                )}
              </div>
            );
          })
        )}

        {/* Custom Pawn Promotion choices overlay */}
        {promotionPending && (
          <div className="promotion-overlay">
            <div className="promotion-menu">
              <h4>Promote Pawn to:</h4>
              <div className="promotion-options">
                {[
                  { name: 'Queen', key: 'q' },
                  { name: 'Rook', key: 'r' },
                  { name: 'Bishop', key: 'b' },
                  { name: 'Knight', key: 'n' },
                ].map((option) => (
                  <button
                    key={option.key}
                    className="promo-btn"
                    onClick={() => executeMove(promotionPending.from, promotionPending.to, option.key)}
                  >
                    <div className="promo-piece-wrapper">
                      <ChessPieceSVG type={option.key} color={game.turn()} />
                    </div>
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>
              <button className="promo-cancel" onClick={() => setPromotionPending(null)}>
                Cancel Move
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

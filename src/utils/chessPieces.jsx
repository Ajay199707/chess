import React from 'react';

// Unicode Chess Pieces (The "real coins" as provided in the classic chess layout)
const unicode = {
  wp: "♙", wr: "♖", wn: "♘", wb: "♗", wq: "♕", wk: "♔",
  bp: "♟", br: "♜", bn: "♞", bb: "♝", bq: "♛", bk: "♚"
};

export const ChessPieceSVG = ({ type, color, size = '100%' }) => {
  const key = `${color}${type.toLowerCase()}`;
  const char = unicode[key] || '';
  const isWhite = color === 'w';

  return (
    <span 
      className={`piece ${isWhite ? 'white-piece' : 'black-piece'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size === '100%' ? '100%' : 'auto',
        height: size === '100%' ? '100%' : 'auto',
        fontSize: size === '100%' ? 'clamp(28px, 8vmin, 52px)' : size,
        lineHeight: 1,
        userSelect: 'none',
        color: isWhite ? '#ffffff' : '#000000',
        textShadow: isWhite 
          ? '0 1px 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.8)' 
          : '0 0 2px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.6)',
        cursor: 'pointer',
        WebkitTextStroke: isWhite ? 'none' : '0.5px rgba(255,255,255,0.5)'
      }}
    >
      {char}
    </span>
  );
};

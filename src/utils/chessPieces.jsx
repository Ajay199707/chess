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
        width: '100%',
        height: '100%',
        fontSize: 'clamp(28px, 8vmin, 52px)',
        lineHeight: 1,
        userSelect: 'none',
        color: isWhite ? '#ffffff' : '#111111',
        textShadow: '1px 2px 2px rgba(0,0,0,0.45)',
        cursor: 'pointer'
      }}
    >
      {char}
    </span>
  );
};

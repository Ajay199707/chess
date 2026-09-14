import React from 'react';

const unicodeWhite = { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" };
const unicodeBlack = { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" };

// Geometric Paths for Minimalist & Cyber
const paths = {
  p: "M 22.5,15 A 6,6 0 1,0 22.5,27 A 6,6 0 1,0 22.5,15 Z M 15,35 L 30,35 L 26,26 L 19,26 Z",
  r: "M 13,15 L 17,15 L 17,20 L 20,20 L 20,15 L 25,15 L 25,20 L 28,20 L 28,15 L 32,15 L 32,35 L 13,35 Z",
  n: "M 15,35 L 30,35 L 28,22 L 32,18 C 32,18 28,12 22,12 C 16,12 14,18 14,18 L 18,22 Z",
  b: "M 22.5,10 L 16,22 L 20,35 L 25,35 L 29,22 Z",
  q: "M 10,15 L 16,25 L 16,35 L 29,35 L 29,25 L 35,15 L 28,18 L 22.5,10 L 17,18 Z",
  k: "M 22.5,10 L 22.5,18 M 18.5,14 L 26.5,14 M 14,22 L 31,22 L 28,35 L 17,35 Z"
};

const MinimalistPiece = ({ type, isWhite, width, height }) => (
  <svg viewBox="0 0 45 45" style={{ width, height, cursor: 'pointer', filter: isWhite ? 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' : 'drop-shadow(0px 1px 3px rgba(255,255,255,0.3))' }}>
    <path d={paths[type]} fill={isWhite ? "#f8f9fa" : "#343a40"} stroke={isWhite ? "#dee2e6" : "rgba(255,255,255,0.2)"} strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const CyberPiece = ({ type, isWhite, width, height }) => {
  const glowColor = isWhite ? "#00f3ff" : "#ff00e5"; // Cyan for White, Magenta for Black
  return (
    <svg viewBox="0 0 45 45" style={{ width, height, cursor: 'pointer', filter: `drop-shadow(0px 0px 6px ${glowColor})` }}>
      <path d={paths[type]} fill="none" stroke={glowColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d={paths[type]} fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TokenPiece = ({ type, isWhite, char, width, height }) => {
  return (
    <svg viewBox="0 0 45 45" style={{ width, height, cursor: 'pointer', filter: 'drop-shadow(0px 6px 4px rgba(0,0,0,0.5))' }}>
      <defs>
        <radialGradient id="marble" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#e9ecef" />
          <stop offset="100%" stopColor="#ced4da" />
        </radialGradient>
        <radialGradient id="darkWood" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#5c3a21" />
          <stop offset="50%" stopColor="#3b2210" />
          <stop offset="100%" stopColor="#1f1006" />
        </radialGradient>
      </defs>
      {/* Coin Base */}
      <circle cx="22.5" cy="22.5" r="18" fill={isWhite ? "url(#marble)" : "url(#darkWood)"} stroke={isWhite ? "#adb5bd" : "#212529"} strokeWidth="2" />
      
      {/* Inner Engraving Ring */}
      <circle cx="22.5" cy="22.5" r="14" fill="none" stroke={isWhite ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
      
      {/* Engraved Character */}
      <text x="22.5" y="32" fontSize="26" textAnchor="middle" fill={isWhite ? "#6c757d" : "#c2a68f"} style={{ textShadow: isWhite ? '0px 1px 1px rgba(255,255,255,0.8)' : '0px -1px 1px rgba(0,0,0,0.8)' }}>
        {char}
      </text>
    </svg>
  );
};

export const ChessPieceSVG = ({ type, color, size = '100%', isUI = false, style = 'staunton' }) => {
  const isWhite = color === 'w';
  const t = type.toLowerCase();
  
  // Choose unicode char set based on color
  const char = (isWhite ? unicodeWhite[t] : unicodeBlack[t]) || '';
  
  const width = size === '100%' ? '100%' : size;
  const height = size === '100%' ? '100%' : size;
  const fontSize = size === '100%' ? 'clamp(28px, 8vmin, 52px)' : size;

  if (style === 'minimalist') return <MinimalistPiece type={t} isWhite={isWhite} width={width} height={height} />;
  if (style === 'cyber') return <CyberPiece type={t} isWhite={isWhite} width={width} height={height} />;
  
  if (style === 'tokens') {
    // Note for tokens: we use the opposing or solid unicode character as the engraving so it looks filled. 
    // White unicode is hollow (♙), Black is solid (♟). We'll engrave the solid ones.
    const engraveChar = unicodeBlack[t] || '';
    return <TokenPiece type={t} isWhite={isWhite} char={engraveChar} width={width} height={height} />;
  }

  // Neo
  if (style === 'neo') {
    return (
      <span className={`piece ${isWhite ? 'white-piece' : 'black-piece'}`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width, height, fontSize, lineHeight: 1, userSelect: 'none', cursor: 'pointer',
        color: isWhite ? '#f8f9fa' : '#212529',
        textShadow: isWhite 
          ? '0 0 10px rgba(255,255,255,0.6), 0 4px 4px rgba(0,0,0,0.4)' 
          : '0 0 8px rgba(0,0,0,0.8), 0 2px 2px rgba(255,255,255,0.2)',
        WebkitTextStroke: isWhite ? '0.5px #adb5bd' : '0.5px #6c757d'
      }}>
        {char}
      </span>
    );
  }

  // Classic Staunton (Default fallback)
  return (
    <span className={`piece ${isWhite ? 'white-piece' : 'black-piece'}`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width, height, fontSize, lineHeight: 1, userSelect: 'none', cursor: 'pointer',
      color: isWhite ? '#ffffff' : '#000000',
      textShadow: isWhite ? '0 1px 2px rgba(0,0,0,0.6)' : (isUI ? '0 0 2px rgba(255,255,255,0.8)' : '0 1px 1px rgba(255,255,255,0.2)'),
      WebkitTextStroke: isWhite ? '1px #000' : (isUI ? '0.5px rgba(255,255,255,0.5)' : 'none')
    }}>
      {char}
    </span>
  );
};

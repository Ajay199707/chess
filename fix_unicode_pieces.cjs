const fs = require('fs');
let code = fs.readFileSync('src/utils/chessPieces.jsx', 'utf8');

// Fix Neo
code = code.replace(
  "color: isWhite ? '#f8f9fa' : '#212529',",
  "color: isWhite ? '#f8f9fa' : '#212529',\n        WebkitTextStroke: isWhite ? 'none' : '1px rgba(255,255,255,0.4)',"
);
code = code.replace(
  "textShadow: isWhite ? '0 0 10px rgba(255,255,255,0.6)' : '0 0 10px rgba(0,0,0,0.8)'",
  "textShadow: isWhite ? '0 0 10px rgba(255,255,255,0.6)' : '0 0 8px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.8)'"
);

// Fix Staunton
code = code.replace(
  "WebkitTextStroke: isWhite ? '1px #000' : (isUI ? '0.5px rgba(255,255,255,0.5)' : 'none')",
  "WebkitTextStroke: isWhite ? '1px #000' : '1px rgba(255,255,255,0.5)'"
);
code = code.replace(
  "textShadow: isWhite ? '0 1px 2px rgba(0,0,0,0.6)' : (isUI ? '0 0 2px rgba(255,255,255,0.8)' : '0 1px 1px rgba(255,255,255,0.2)'),",
  "textShadow: isWhite ? '0 1px 2px rgba(0,0,0,0.6)' : '0 0 3px rgba(255,255,255,0.4)',"
);

fs.writeFileSync('src/utils/chessPieces.jsx', code);

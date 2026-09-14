const fs = require('fs');
let code = fs.readFileSync('src/utils/chessPieces.jsx', 'utf8');

// MinimalistPiece: give black a subtle light outline or lighter drop shadow so it pops on dark boards.
code = code.replace(
  /<svg viewBox="0 0 45 45" style=\{\{ width, height, cursor: 'pointer', filter: 'drop-shadow\\(0px 2px 2px rgba\\(0,0,0,0\\.3\\)\\)' \}\}>/g,
  `<svg viewBox="0 0 45 45" style={{ width, height, cursor: 'pointer', filter: isWhite ? 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' : 'drop-shadow(0px 1px 2px rgba(255,255,255,0.4))' }}>`
);

// Actually, the regex above might fail due to parentheses. Let's just do a string replace.
code = code.replace(
  "filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))'",
  "filter: isWhite ? 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' : 'drop-shadow(0px 1px 3px rgba(255,255,255,0.3))'"
);

// Also maybe add a thin lighter stroke for the black minimalist piece:
code = code.replace(
  'stroke={isWhite ? "#dee2e6" : "#212529"}',
  'stroke={isWhite ? "#dee2e6" : "rgba(255,255,255,0.2)"}'
);

fs.writeFileSync('src/utils/chessPieces.jsx', code);

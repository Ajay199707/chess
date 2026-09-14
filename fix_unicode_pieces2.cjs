const fs = require('fs');
let code = fs.readFileSync('src/utils/chessPieces.jsx', 'utf8');

// The file currently has a messy neo and staunton block. Let's rewrite them cleanly.
const newStyles = `
  // Neo
  if (style === 'neo') {
    return (
      <span className={\`piece \${isWhite ? 'white-piece' : 'black-piece'}\`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width, height, fontSize, lineHeight: 1, userSelect: 'none', cursor: 'pointer',
        color: isWhite ? '#f8f9fa' : '#212529',
        WebkitTextStroke: isWhite ? '0.5px #adb5bd' : '1px rgba(255,255,255,0.6)',
        textShadow: isWhite ? '0 0 10px rgba(255,255,255,0.6)' : '0 0 8px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.8)'
      }}>
        {char}
      </span>
    );
  }

  // Classic Staunton (Default fallback)
  return (
    <span className={\`piece \${isWhite ? 'white-piece' : 'black-piece'}\`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width, height, fontSize, lineHeight: 1, userSelect: 'none', cursor: 'pointer',
      color: isWhite ? '#ffffff' : '#000000',
      textShadow: isWhite ? '0 1px 2px rgba(0,0,0,0.6)' : '0 0 3px rgba(255,255,255,0.5)',
      WebkitTextStroke: isWhite ? '1px #000' : '1px rgba(255,255,255,0.6)'
    }}>
      {char}
    </span>
  );
};
`;

code = code.replace(/\/\/ Neo[\s\S]*\}\;\s*$/m, newStyles.trim() + '\n');
fs.writeFileSync('src/utils/chessPieces.jsx', code);

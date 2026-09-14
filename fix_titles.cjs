const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(/title=\{\`\$<ChessPieceSVG[\s\S]*?\/\>\`\}/g, `title="Captured piece"`);
fs.writeFileSync('src/App.jsx', code);

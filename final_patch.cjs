const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Update to the new Render URL
code = code.replace(
  /const BACKEND_PROD_URL = "[^"]+";/,
  'const BACKEND_PROD_URL = "https://chess-1-fj9o.onrender.com";'
);

// Restore the proper isDev check so it uses Render when hosted on GitHub
code = code.replace(
  /const isDev = true; \/\/ Hardcoded to use local backend during dev/,
  "const isDev = window.location.port && window.location.port !== '3001';"
);

fs.writeFileSync('src/App.jsx', code);
